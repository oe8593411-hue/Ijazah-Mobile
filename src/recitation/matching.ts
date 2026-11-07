// Recitation matching engine. It compares what the recognizer heard with the verified verse
// text and decides which words are ok, unsure, bad or skipped. Pure functions only: no React
// and no Expo, so the screen in app/recite.tsx and the evaluation harness in
// scripts/recitation-eval run the same decisions.
export function normalizeArabic(value: string) {
  return value.normalize("NFC")
    .replace(/ٰ/g, "ا") // dagger alif is a real long "a": مَٰلِكِ matches what is said: مالك
    .replace(/[ً-ٰٟۖ-ۭ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ـ/g, "")
    .replace(/[^ء-ي\s]/g, " ").replace(/\s+/g, " ").trim();
}

export type WordState = "ok" | "unsure" | "bad" | "skipped";

// Letters that speech recognition often confuses: a mismatch on them costs half an error.
export const CONFUSABLE: Record<string, string> = { "ة": "ه", "ظ": "ض", "ط": "ت", "ذ": "ز", "ث": "س", "ؤ": "و", "ئ": "ي" };
export function letterCost(a: string, b: string) {
  if (a === b) return 0;
  if (CONFUSABLE[a] === b || CONFUSABLE[b] === a || (CONFUSABLE[a] && CONFUSABLE[a] === CONFUSABLE[b])) return 0.5;
  return 1;
}
export function weightedDistance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + letterCost(a[i - 1], b[j - 1]));
    }
    prev = cur;
  }
  return prev[b.length];
}
// ---------- Results of the recognizer ----------

export type Heard = { alts: string[]; isFinal: boolean };

// The recognizer's result list as plain data.
export function readResults(list: any): Heard[] {
  const out: Heard[] = [];
  for (let i = 0; i < list.length; i++) {
    const alts: string[] = [];
    for (let j = 0; j < list[i].length; j++) {
      const t = list[i][j]?.transcript;
      if (t) alts.push(t);
    }
    out.push({ alts, isFinal: !!list[i].isFinal });
  }
  return out;
}

// ---------- Alignment of the heard words with the verified words ----------

// The recognizer may drop a word, add a filler, write two words as one, or one word as two.
// The alignment finds the most likely reading: a verified word that is not heard costs something,
// a heard word that matches nothing costs something, and the cheapest reading wins.
export const MISS_COST = 0.2;  // a verified word that was not heard
export const EXTRA_COST = 0.8; // a heard word that is not in the verified text
export const JOIN_COST = 0.3;  // two heard words for one verified word, or one heard word for two

// 0.1 or less: ok. Up to 0.5: unsure (the recognizer may be at fault). Otherwise (0.7): a different word.
// It must cost less than a skipped word plus an extra word, or a wrong word would be read as a skip.
export function wordCost(expected: string, heard: string) {
  if (expected === heard) return 0;
  if (Math.min(expected.length, heard.length) < 2) return 0.7;
  const ratio = weightedDistance(expected, heard) / Math.max(expected.length, heard.length);
  return ratio <= 0.2 ? 0.1 : ratio <= 0.4 ? 0.5 : 0.7;
}
export function costState(cost: number): WordState {
  return cost <= 0.1 ? "ok" : cost <= 0.5 ? "unsure" : "bad";
}

// What has been read: per verified word a state (and what was heard for a wrong one), and the next word to read.
export type Track = { text: string; cursor: number; states: (WordState | undefined)[]; heardAt: (string | undefined)[] };
export type Cell = { state: WordState; heard?: string };

export function emptyTrack(n: number): Track {
  return { text: "", cursor: 0, states: Array(n).fill(undefined), heardAt: Array(n).fill(undefined) };
}

// End a surah only after the final expected word has actually been heard.
// A cursor at the end is not sufficient: alignment can reach it by skipping unread words.
export function hasReachedEnd(track: Track, expectedLength = track.states.length): boolean {
  // A short or uninitialized track must never be mistaken for a completed surah.
  if (expectedLength <= 0 || track.states.length !== expectedLength) return false;
  if (track.cursor < expectedLength) return false;
  const finalState = track.states[expectedLength - 1];
  return finalState !== undefined && finalState !== "skipped";
}

// Aligns the heard words with the verified words from `from` on. It may skip verified words (at a cost),
// and it may ignore heard words. Returns the cells of the verified words it covers, and the new cursor.
export function alignFrom(expected: string[], from: number, heard: string[]) {
  const W = Math.min(expected.length - from, 90);
  const m = heard.length;
  const INF = 1e9;
  const D: number[][] = Array.from({ length: m + 1 }, () => Array(W + 1).fill(INF));
  const B: string[][] = Array.from({ length: m + 1 }, () => Array(W + 1).fill(""));
  D[0][0] = 0;
  for (let j = 1; j <= W; j++) { D[0][j] = D[0][j - 1] + MISS_COST; B[0][j] = "D"; }
  for (let i = 1; i <= m; i++) {
    D[i][0] = D[i - 1][0] + EXTRA_COST; B[i][0] = "I";
    for (let j = 1; j <= W; j++) {
      const e = expected[from + j - 1];
      let best = D[i - 1][j - 1] + wordCost(e, heard[i - 1]);
      let op = "S";
      const tryOp = (cost: number, name: string) => { if (cost < best) { best = cost; op = name; } };
      tryOp(D[i][j - 1] + MISS_COST, "D");
      tryOp(D[i - 1][j] + EXTRA_COST, "I");
      if (i >= 2) tryOp(D[i - 2][j - 1] + wordCost(e, heard[i - 2] + heard[i - 1]) + JOIN_COST, "M");
      if (j >= 2) tryOp(D[i - 1][j - 2] + wordCost(expected[from + j - 2] + e, heard[i - 1]) + JOIN_COST, "P");
      D[i][j] = best;
      B[i][j] = op;
    }
  }
  let jEnd = 0;
  for (let j = 1; j <= W; j++) if (D[m][j] < D[m][jEnd]) jEnd = j;

  // Walk back from the best end: what each verified word was.
  const cells: (Cell | undefined)[] = Array(jEnd).fill(undefined);
  const missed: boolean[] = Array(jEnd).fill(false);
  let i = m, j = jEnd;
  while (i > 0 || j > 0) {
    const op = i === 0 ? "D" : j === 0 ? "I" : B[i][j];
    if (op === "S") {
      cells[j - 1] = { state: costState(wordCost(expected[from + j - 1], heard[i - 1])), heard: heard[i - 1] };
      i--; j--;
    } else if (op === "D") {
      missed[j - 1] = true;
      j--;
    } else if (op === "I") {
      i--;
    } else if (op === "M") {
      const joined = heard[i - 2] + " " + heard[i - 1];
      cells[j - 1] = { state: costState(wordCost(expected[from + j - 1], heard[i - 2] + heard[i - 1])), heard: joined };
      i -= 2; j--;
    } else {
      const c = costState(wordCost(expected[from + j - 2] + expected[from + j - 1], heard[i - 1]));
      cells[j - 2] = { state: c, heard: heard[i - 1] };
      cells[j - 1] = cells[j - 2];
      i--; j -= 2;
    }
  }
  // A verified word missed on its own is unsure (the recognizer may have dropped it); two in a row are skipped.
  for (let c = 0; c < jEnd; c++) {
    if (!missed[c]) continue;
    const run = (c > 0 && missed[c - 1]) || (c + 1 < jEnd && missed[c + 1]);
    cells[c] = { state: run ? "skipped" : "unsure" };
  }
  return { cursor: from + jEnd, cells, cost: D[m][jEnd] };
}

// What the recognizer has said in one session. Its results are cumulative: the first `done` of them are final
// and already read into the track; the rest are still changing.
export type Speech = { from: number; done: number; results: Heard[] };

export function startSpeech(track: Track): Speech {
  return { from: track.cursor, done: 0, results: [] };
}

// Reads one final result into the track, with the guess that fits it best from where the reading stands.
export function readFinal(expected: string[], track: Track, alts: string[]): Track {
  const candidates: ReturnType<typeof alignFrom>[] = [];
  const seenAlternatives = new Set<string>();
  for (const alt of alts) {
    const words = normalizeArabic(alt).split(" ").filter(Boolean);
    const key = words.join(" ");
    if (words.length && !seenAlternatives.has(key)) {
      seenAlternatives.add(key);
      candidates.push(alignFrom(expected, track.cursor, words));
    }
  }
  if (!candidates.length) return track;
  candidates.sort((a, b) => a.cost - b.cost);
  const best = candidates[0];
  const cells = best.cells.map((cell, index) => {
    if (!cell || cell.state !== "bad") return cell;
    const agreement = candidates.filter(candidate => candidate.cells[index]?.state === "bad").length;
    // A single speech-recognition guess is not enough to accuse the reader of an error.
    return agreement >= 2 ? cell : { ...cell, state: "unsure" as WordState };
  });
  return applyAlignment(track, track.cursor, { ...best, cells });
}

// The words still changing: each of the newest results keeps the guess that fits the session best.
export function pendingWords(expected: string[], speech: Speech) {
  const pending = speech.results.slice(speech.done);
  const choice = pending.map(() => 0);
  const wordsOf = (k: number, c: number) => normalizeArabic(pending[k].alts[c] ?? "").split(" ").filter(Boolean);
  const joint = () => pending.flatMap((_, k) => wordsOf(k, choice[k]));
  let best = alignFrom(expected, speech.from, joint()).cost;
  for (let k = Math.max(0, pending.length - 3); k < pending.length; k++) {
    for (let c = 1; c < pending[k].alts.length; c++) {
      const keep = choice[k];
      choice[k] = c;
      const cost = alignFrom(expected, speech.from, joint()).cost;
      if (cost < best) best = cost; else choice[k] = keep;
    }
  }
  return joint();
}

// Writes an alignment onto the track, from the word where it starts.
export function applyAlignment(track: Track, from: number, r: { cursor: number; cells: (Cell | undefined)[] }): Track {
  const next: Track = { text: track.text, cursor: r.cursor, states: track.states.slice(), heardAt: track.heardAt.slice() };
  r.cells.forEach((c, k) => {
    if (!c) return;
    next.states[from + k] = c.state;
    next.heardAt[from + k] = c.state === "bad" ? c.heard : undefined;
  });
  return next;
}

// What the session shows now: the track with the words still changing on top. The newest word of a result
// still being said waits until it settles.
export function viewOf(expected: string[], track: Track, speech: Speech): Track {
  const words = pendingWords(expected, speech);
  let r = alignFrom(expected, speech.from, words);
  const last = speech.results[speech.results.length - 1];
  if (last && !last.isFinal && words.length) {
    const newest = words[words.length - 1];
    const settled = r.cells.some(c => c && c.state === "ok" && c.heard !== undefined && c.heard.split(" ").pop() === newest);
    if (!settled) {
      // Keep the newest partial word visible for faster feedback, but never mark
      // an unfinished/interim mismatch red.
      const preview = alignFrom(expected, speech.from, words);
      const lastCell = preview.cells.length - 1;
      if (lastCell >= 0 && preview.cells[lastCell]?.state === "bad") {
        preview.cells[lastCell] = { ...preview.cells[lastCell]!, state: "unsure" };
      }
      r = preview;
    }
  }
  return applyAlignment(track, speech.from, r);
}

// One event of a recognizer session: final results are read into the track, and the view is what is shown now.
export function takeSpeech(expected: string[], track: Track, speech: Speech, results: Heard[]) {
  let t = track;
  let done = speech.done;
  while (done < results.length && results[done].isFinal) {
    t = readFinal(expected, t, results[done].alts);
    done++;
  }
  const next: Speech = { from: t.cursor, done, results };
  return { track: t, speech: next, view: viewOf(expected, t, next) };
}

// The session has ended: whatever it still holds is read as it is.
export function endSpeech(expected: string[], track: Track, speech: Speech): Track {
  let t = track;
  for (let k = speech.done; k < speech.results.length; k++) t = readFinal(expected, t, speech.results[k].alts);
  return t;
}
