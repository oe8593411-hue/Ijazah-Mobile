#!/usr/bin/env node
// Measures one transcription engine on consented recitation clips, using the app's own matcher.
//
//   node --no-warnings scripts/recitation-eval/evaluate.mjs \
//     --manifest recitation-data/manifest.json \
//     --engine-cmd "python3 services/whisper/transcribe.py" \
//     --label whisper-large-v3
//
// Needs Node 22.18 or newer: the matcher is TypeScript, and Node runs it directly.
// The engine command is split on spaces and run without a shell. It gets the clip path as its last
// argument and prints JSON on stdout: {"words":[{"text":"..."}]}.
//
// Each clip is one verse. "reading" is "correct" (the default) or "with_mistakes", and then
// "planted_words" lists the 1-based word numbers the reciter got wrong. The matcher decides each verse
// word from the engine's words, read as one final result:
//   ok       green on the screen
//   flagged  bad (red) or skipped (amber): the words the screen lists for review
//   unsure   gray: the matcher abstains
//   unread   the matcher did not reach the word
// Strict word accuracy (exact match after the app's normalization) is reported next to these.
//
// Every clip needs a consent record and consent for commercial use, training and evaluation.
// If one clip lacks them, no engine is called. Reports go to recitation-data/reports/, which git ignores.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyTrack, endSpeech, normalizeArabic, startSpeech, takeSpeech } from "../../src/recitation/matching.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const CORPUS_PATH = path.join(repoRoot, "src", "quran", "verified-corpus.json");
const MATCHER_PATH = path.join(repoRoot, "src", "recitation", "matching.ts");
const REQUIRED_CONSENT = ["commercial_use", "training", "evaluation"];
const READINGS = ["correct", "with_mistakes"];
const END_MARKER = /^﴿\d+﴾$/u;
const NOT_MEASURED = [
  "vowel and diacritic errors (the matcher normalizes harakat away)",
  "phoneme error rate",
  "tajweed precision and recall",
  "noise and microphone robustness (clips carry no condition tags yet)",
];
const CAVEATS = [
  "each clip is one verse read as one final recognizer result; live sessions with several results and ayah changes are not measured here",
  "a single missed word is unsure by design, so it is an abstention, not a flag",
  "words after the last word the engine heard stay unread, so a missed last word is not marked",
];

// The verse words as the screen builds them: whitespace-separated tokens, end-of-ayah markers dropped,
// and each token normalized with its spaces removed.
export function verseWords(text) {
  return text
    .split(/\s+/u)
    .filter((token) => token && !END_MARKER.test(token))
    .map((token) => normalizeArabic(token).replace(/ /g, ""))
    .filter(Boolean);
}

// The engine's words as the matcher reads a result: normalized, then split on spaces.
export function heardWords(words) {
  return normalizeArabic(words.join(" ")).split(" ").filter(Boolean);
}

export function findAyah(corpus, surah, ayah) {
  return corpus.ayahs.find((item) => item.surah === surah && item.ayah === ayah) ?? null;
}

// Strict alignment for the word error rate: a word is correct only when it matches exactly.
export function alignWords(ref, hyp) {
  const n = ref.length;
  const m = hyp.length;
  const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) cost[i][0] = i;
  for (let j = 0; j <= m; j += 1) cost[0][j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const diagonal = cost[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1);
      cost[i][j] = Math.min(diagonal, cost[i - 1][j] + 1, cost[i][j - 1] + 1);
    }
  }
  const counts = { correct: 0, substitutions: 0, deletions: 0, insertions: 0 };
  const substitutionPairs = new Map();
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const matches = i > 0 && j > 0 && ref[i - 1] === hyp[j - 1];
    if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + (matches ? 0 : 1)) {
      if (matches) {
        counts.correct += 1;
      } else {
        counts.substitutions += 1;
        const pair = `${ref[i - 1]} -> ${hyp[j - 1]}`;
        substitutionPairs.set(pair, (substitutionPairs.get(pair) ?? 0) + 1);
      }
      i -= 1;
      j -= 1;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      counts.deletions += 1;
      i -= 1;
    } else {
      counts.insertions += 1;
      j -= 1;
    }
  }
  return { ...counts, substitutionPairs };
}

// The matcher's decision for each verse word, from one final result holding the engine's words.
export function appStates(expected, heardText) {
  const start = emptyTrack(expected.length);
  const taken = takeSpeech(expected, start, startSpeech(start), [{ alts: [heardText], isFinal: true }]);
  return endSpeech(expected, taken.track, taken.speech).states;
}

// The screen's groups: ok (green); flagged (bad in red or skipped in amber, both listed for review);
// unsure (gray); unread (the matcher did not reach the word).
export function outcomeOf(state) {
  if (state === "ok") return "ok";
  if (state === "bad" || state === "skipped") return "flagged";
  if (state === "unsure") return "unsure";
  return "unread";
}

// Counts the matcher's decisions for all words, and for the planted mistakes and the clean words apart.
export function judge(states, plantedIndexes) {
  const result = {
    words: states.length, ok: 0, flagged: 0, unsure: 0, unread: 0,
    plantedTotal: 0, plantedFlagged: 0, plantedUnsure: 0, plantedUnread: 0,
    cleanWords: 0, cleanFlagged: 0, cleanUnsure: 0, cleanUnread: 0,
  };
  states.forEach((state, index) => {
    const outcome = outcomeOf(state);
    result[outcome] += 1;
    if (plantedIndexes.has(index)) {
      result.plantedTotal += 1;
      if (outcome === "flagged") result.plantedFlagged += 1;
      else if (outcome === "unsure") result.plantedUnsure += 1;
      else if (outcome === "unread") result.plantedUnread += 1;
    } else {
      result.cleanWords += 1;
      if (outcome === "flagged") result.cleanFlagged += 1;
      else if (outcome === "unsure") result.cleanUnsure += 1;
      else if (outcome === "unread") result.cleanUnread += 1;
    }
  });
  return result;
}

// Returns the problems in the manifest. An empty list means every clip can be scored.
export function checkManifest(clips, corpus, baseDir) {
  if (!Array.isArray(clips) || clips.length === 0) {
    return ['manifest needs a non-empty "clips" array'];
  }
  const problems = [];
  clips.forEach((clip, index) => {
    const label = `clip ${index + 1}${typeof clip?.file === "string" ? ` (${clip.file})` : ""}`;
    if (typeof clip?.file !== "string" || clip.file === "") {
      problems.push(`${label}: "file" is required`);
    } else if (!existsSync(path.resolve(baseDir, clip.file))) {
      problems.push(`${label}: file not found`);
    }
    if (!Number.isInteger(clip?.surah) || clip.surah < 1 || clip.surah > 114) {
      problems.push(`${label}: "surah" must be 1 to 114`);
    }
    const verse =
      Number.isInteger(clip?.surah) && Number.isInteger(clip?.ayah) ? findAyah(corpus, clip.surah, clip.ayah) : null;
    if (!Number.isInteger(clip?.ayah) || clip.ayah < 1) {
      problems.push(`${label}: "ayah" must be a positive whole number`);
    } else if (Number.isInteger(clip?.surah) && !verse) {
      problems.push(`${label}: ${clip.surah}:${clip.ayah} is not in the verified corpus`);
    }
    if (typeof clip?.reciter !== "string" || clip.reciter === "") {
      problems.push(`${label}: "reciter" id is required`);
    }
    const consent = clip?.consent ?? {};
    const missing = REQUIRED_CONSENT.filter((key) => consent[key] !== true);
    if (typeof consent.record !== "string" || consent.record === "") missing.push("record");
    if (missing.length > 0) {
      problems.push(`${label}: consent is missing ${missing.join(", ")}`);
    }
    const reading = clip?.reading ?? "correct";
    const planted = clip?.planted_words;
    if (!READINGS.includes(reading)) {
      problems.push(`${label}: "reading" must be "correct" or "with_mistakes"`);
    } else if (reading === "with_mistakes") {
      if (!Array.isArray(planted) || planted.length === 0) {
        problems.push(`${label}: "planted_words" must list the word numbers the reciter got wrong`);
      } else if (verse) {
        const words = verseWords(verse.text).length;
        const outside = planted.filter((number) => !Number.isInteger(number) || number < 1 || number > words);
        if (outside.length > 0) {
          problems.push(`${label}: planted_words ${outside.join(", ")} are outside 1-${words}`);
        }
      }
    } else if (Array.isArray(planted) ? planted.length > 0 : planted !== undefined) {
      problems.push(`${label}: "planted_words" only applies to readings with mistakes`);
    }
  });
  return problems;
}

export function runEngine(command, clipPath) {
  return new Promise((resolve, reject) => {
    const [program, ...args] = command;
    const started = performance.now();
    const child = spawn(program, [...args, clipPath], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const latencyMs = performance.now() - started;
      if (code !== 0) {
        reject(new Error(`engine exited with code ${code}: ${stderr.trim().slice(-400)}`));
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch (error) {
        reject(new Error(`engine printed invalid JSON: ${error.message}`));
        return;
      }
      if (!parsed || !Array.isArray(parsed.words)) {
        reject(new Error('engine JSON needs a "words" array'));
        return;
      }
      resolve({ words: parsed.words.map((word) => String(word?.text ?? "")), latencyMs });
    });
  });
}

const percent = (part, whole) => (whole === 0 ? null : Math.round((1000 * part) / whole) / 10);

function summarizeWer(rows) {
  const total = { correct: 0, substitutions: 0, deletions: 0, insertions: 0 };
  for (const row of rows) {
    for (const field of Object.keys(total)) total[field] += row.wer[field];
  }
  const refWords = rows.reduce((sum, row) => sum + row.refWords, 0);
  const errors = total.substitutions + total.deletions + total.insertions;
  return { refWords, ...total, accuracyPct: percent(total.correct, refWords), werPct: percent(errors, refWords) };
}

function summarizeApp(rows) {
  const total = {
    words: 0, ok: 0, flagged: 0, unsure: 0, unread: 0,
    plantedTotal: 0, plantedFlagged: 0, plantedUnsure: 0, plantedUnread: 0,
    cleanWords: 0, cleanFlagged: 0, cleanUnsure: 0, cleanUnread: 0,
  };
  for (const row of rows) {
    for (const field of Object.keys(total)) total[field] += row.app[field];
  }
  return {
    ...total,
    okPct: percent(total.ok, total.words),
    flaggedPct: percent(total.flagged, total.words),
    unsurePct: percent(total.unsure, total.words),
    unreadPct: percent(total.unread, total.words),
    recallPct: percent(total.plantedFlagged, total.plantedTotal),
    plantedUnsurePct: percent(total.plantedUnsure, total.plantedTotal),
    falseFlagPct: percent(total.cleanFlagged, total.cleanWords),
    cleanUnsurePct: percent(total.cleanUnsure, total.cleanWords),
  };
}

function summarize(rows) {
  const latencies = rows.map((row) => row.latencyMs);
  return {
    wer: summarizeWer(rows),
    app: summarizeApp(rows),
    meanLatencyMs: latencies.length
      ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
      : null,
  };
}

const withoutPairs = ({ substitutionPairs, ...counts }) => counts;

export async function evaluate({ manifestPath, engineCommand, label, corpus }) {
  const manifestFile = path.resolve(manifestPath);
  const baseDir = path.dirname(manifestFile);
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  const problems = checkManifest(manifest.clips, corpus, baseDir);
  if (problems.length > 0) {
    const error = new Error(`manifest rejected, no engine was called:\n  - ${problems.join("\n  - ")}`);
    error.exitCode = 2;
    throw error;
  }

  const rows = [];
  for (const clip of manifest.clips) {
    const expected = verseWords(findAyah(corpus, clip.surah, clip.ayah).text);
    const engine = await runEngine(engineCommand, path.resolve(baseDir, clip.file));
    const heard = heardWords(engine.words);
    const planted = new Set((clip.planted_words ?? []).map((number) => number - 1));
    const states = appStates(expected, engine.words.join(" "));
    rows.push({
      file: clip.file,
      surah: clip.surah,
      ayah: clip.ayah,
      reciter: clip.reciter,
      reading: clip.reading ?? "correct",
      plantedWords: [...planted].map((index) => index + 1).sort((a, b) => a - b),
      refWords: expected.length,
      hypWords: heard.length,
      latencyMs: Math.round(engine.latencyMs),
      wer: alignWords(expected, heard),
      app: judge(states, planted),
      states: states.map((state) => state ?? "unread"),
    });
  }

  const reciters = [...new Set(rows.map((row) => row.reciter))];
  const pairs = new Map();
  for (const row of rows) {
    for (const [pair, count] of row.wer.substitutionPairs) {
      pairs.set(pair, (pairs.get(pair) ?? 0) + count);
    }
  }
  return {
    label,
    engine: engineCommand.join(" "),
    matcher: {
      file: "src/recitation/matching.ts",
      sha256: createHash("sha256").update(readFileSync(MATCHER_PATH)).digest("hex"),
    },
    corpus: { version: corpus.version, sha256: corpus.sha256 },
    createdAt: new Date().toISOString(),
    clipCount: rows.length,
    totals: summarize(rows),
    perReciter: Object.fromEntries(
      reciters.map((reciter) => [reciter, summarize(rows.filter((row) => row.reciter === reciter))]),
    ),
    topSubstitutions: [...pairs]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([pair, count]) => ({ pair, count })),
    clips: rows.map((row) => ({
      file: row.file,
      surah: row.surah,
      ayah: row.ayah,
      reciter: row.reciter,
      reading: row.reading,
      plantedWords: row.plantedWords,
      refWords: row.refWords,
      hypWords: row.hypWords,
      latencyMs: row.latencyMs,
      wer: withoutPairs(row.wer),
      app: row.app,
      states: row.states,
    })),
    notMeasured: NOT_MEASURED,
    caveats: CAVEATS,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (!flag?.startsWith("--") || argv[index + 1] === undefined) {
      throw new Error(`expected --flag value pairs, got "${flag}"`);
    }
    args[flag.slice(2)] = argv[index + 1];
  }
  return args;
}

async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  if (!args.manifest || !args["engine-cmd"]) {
    console.error('usage: evaluate.mjs --manifest <file> --engine-cmd "<command>" [--label <name>] [--out <file>]');
    return 2;
  }
  const label = (args.label ?? "engine").replace(/[^\w.-]+/g, "_");
  const corpus = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));
  const engineCommand = args["engine-cmd"].split(/\s+/).filter(Boolean);
  let report;
  try {
    report = await evaluate({ manifestPath: args.manifest, engineCommand, label, corpus });
  } catch (error) {
    console.error(error.message);
    return error.exitCode ?? 1;
  }
  const outPath =
    args.out ??
    path.join(repoRoot, "recitation-data", "reports", `${label}-${report.createdAt.replace(/[:.]/g, "-")}.json`);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  const { wer, app, meanLatencyMs } = report.totals;
  console.log(
    `${label}: word accuracy ${wer.accuracyPct}% (WER ${wer.werPct}%), clips ${report.clipCount}, ` +
      `mean latency ${meanLatencyMs} ms`,
  );
  console.log(
    `matcher decisions on ${app.words} words: ok ${app.okPct}%, flagged ${app.flaggedPct}%, ` +
      `unsure ${app.unsurePct}%, unread ${app.unreadPct}%`,
  );
  if (app.plantedTotal > 0) {
    console.log(
      `planted mistakes: ${app.plantedFlagged} of ${app.plantedTotal} flagged (recall ${app.recallPct}%), ` +
        `${app.plantedUnsure} unsure, ${app.plantedUnread} unread`,
    );
  }
  console.log(`correct words flagged: ${app.cleanFlagged} of ${app.cleanWords} (${app.falseFlagPct}%), unsure: ${app.cleanUnsure}`);
  console.log(`report: ${outPath}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
