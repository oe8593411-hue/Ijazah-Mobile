#!/usr/bin/env node
// Word accuracy and error detection of one transcription engine on consented recitation clips.
//
//   node scripts/recitation-eval/evaluate.mjs \
//     --manifest recitation-data/manifest.json \
//     --engine-cmd "python3 services/whisper/transcribe.py" \
//     --label whisper-large-v3
//
// The engine command is split on spaces and run without a shell. It receives the clip
// path as its last argument and prints JSON on stdout: {"words":[{"text":"..."}]}.
//
// Each clip is either a correct reading ("reading": "correct", the default) or a reading
// with known mistakes ("reading": "with_mistakes" plus "planted_words": the 1-based numbers
// of the verse words the reciter got wrong). Correct readings measure word accuracy. For
// every clip the report also counts how many planted mistakes the engine caught, and how
// many correct words it flagged by mistake.
//
// Every clip needs a consent record and consent for commercial use, training and
// evaluation. If any clip is missing one, the run stops before any engine is called.
// Reports are written to recitation-data/reports/, which git ignores.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const CORPUS_PATH = path.join(repoRoot, "src", "quran", "verified-corpus.json");
const REQUIRED_CONSENT = ["commercial_use", "training", "evaluation"];
const READINGS = ["correct", "with_mistakes"];
const NOT_MEASURED = [
  "vowel and diacritic errors (normalization drops harakat)",
  "phoneme error rate",
  "tajweed precision and recall",
  "noise and microphone robustness (clips carry no condition tags yet)",
];
const CAVEATS = [
  "detection uses this harness's word alignment with tolerant matching; the matching engine in app/recite.tsx is not reused yet",
  "a planted mistake counts as caught when its word is substituted or skipped, or when an extra word follows it",
];

// Same rules as normalizeArabic in app/recite.tsx, so the numbers describe what the app matches.
export function normalizeArabic(value) {
  return value
    .normalize("NFC")
    .replace(/ٰ/g, "ا") // dagger alif is a long "a"
    .replace(/[ً-ٰۖ-ۭ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[^ء-ي\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toTokens(text) {
  const normalized = normalizeArabic(text);
  return normalized === "" ? [] : normalized.split(" ");
}

export function findAyah(corpus, surah, ayah) {
  return corpus.ayahs.find((item) => item.surah === surah && item.ayah === ayah) ?? null;
}

function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

// Strict: the normalized words must be identical.
export function strictSame(a, b) {
  return a === b;
}

// Tolerant: close to the app's word matching, which accepts a small slip in a longer word
// (for example الرحمان / الرحمن). Words under two letters never match loosely.
export function tolerantSame(a, b) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 2) return false;
  return editDistance(a, b) / Math.max(a.length, b.length) <= 0.2;
}

// Edit-distance alignment of two word lists. Returns the counts, the substitution pairs, and
// for each reference word whether it was read correctly ("ok"), substituted ("sub") or
// skipped ("del"). extraAfter[k] counts the extra words said right after reference word k.
export function alignWords(ref, hyp, same = strictSame) {
  const n = ref.length;
  const m = hyp.length;
  const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) cost[i][0] = i;
  for (let j = 0; j <= m; j += 1) cost[0][j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const diagonal = cost[i - 1][j - 1] + (same(ref[i - 1], hyp[j - 1]) ? 0 : 1);
      cost[i][j] = Math.min(diagonal, cost[i - 1][j] + 1, cost[i][j - 1] + 1);
    }
  }
  const counts = { correct: 0, substitutions: 0, deletions: 0, insertions: 0 };
  const substitutionPairs = new Map();
  const refStatus = new Array(n).fill("ok");
  const extraAfter = new Array(n).fill(0);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const matches = i > 0 && j > 0 && same(ref[i - 1], hyp[j - 1]);
    if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + (matches ? 0 : 1)) {
      if (matches) {
        counts.correct += 1;
      } else {
        counts.substitutions += 1;
        refStatus[i - 1] = "sub";
        const pair = `${ref[i - 1]} -> ${hyp[j - 1]}`;
        substitutionPairs.set(pair, (substitutionPairs.get(pair) ?? 0) + 1);
      }
      i -= 1;
      j -= 1;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      counts.deletions += 1;
      refStatus[i - 1] = "del";
      i -= 1;
    } else {
      counts.insertions += 1;
      if (n > 0) extraAfter[Math.max(i - 1, 0)] += 1;
      j -= 1;
    }
  }
  return { ...counts, substitutionPairs, refStatus, extraAfter };
}

// A planted mistake counts as caught when its word is substituted or skipped, or when an
// extra word follows it. Every other reference word is clean, so flagging it is a false alarm.
export function detect(refWords, plantedIndexes, aligned) {
  const result = { plantedTotal: 0, plantedCaught: 0, cleanWords: 0, falseFlags: 0 };
  for (let index = 0; index < refWords; index += 1) {
    const flagged = aligned.refStatus[index] !== "ok" || aligned.extraAfter[index] > 0;
    if (plantedIndexes.has(index)) {
      result.plantedTotal += 1;
      if (flagged) result.plantedCaught += 1;
    } else {
      result.cleanWords += 1;
      if (flagged) result.falseFlags += 1;
    }
  }
  return result;
}

// Returns a list of problems. An empty list means every clip can be scored.
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
        const words = toTokens(verse.text).length;
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

function summarizeCounts(rows, key) {
  const total = { correct: 0, substitutions: 0, deletions: 0, insertions: 0 };
  for (const row of rows) {
    for (const field of Object.keys(total)) total[field] += row[key][field];
  }
  const refWords = rows.reduce((sum, row) => sum + row.refWords, 0);
  const errors = total.substitutions + total.deletions + total.insertions;
  return {
    refWords,
    ...total,
    accuracyPct: percent(total.correct, refWords),
    werPct: percent(errors, refWords),
  };
}

function summarizeDetection(rows) {
  const total = { plantedTotal: 0, plantedCaught: 0, cleanWords: 0, falseFlags: 0 };
  for (const row of rows) {
    for (const field of Object.keys(total)) total[field] += row.detection[field];
  }
  return {
    ...total,
    recallPct: percent(total.plantedCaught, total.plantedTotal),
    falseFlagPct: percent(total.falseFlags, total.cleanWords),
  };
}

function summarize(rows) {
  const latencies = rows.map((row) => row.latencyMs);
  return {
    strict: summarizeCounts(rows, "strict"),
    tolerant: summarizeCounts(rows, "tolerant"),
    detection: summarizeDetection(rows),
    meanLatencyMs: latencies.length
      ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
      : null,
  };
}

const withoutDetails = ({ substitutionPairs, refStatus, extraAfter, ...counts }) => counts;

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
    const reference = toTokens(findAyah(corpus, clip.surah, clip.ayah).text);
    const engine = await runEngine(engineCommand, path.resolve(baseDir, clip.file));
    const hypothesis = toTokens(engine.words.join(" "));
    const planted = new Set((clip.planted_words ?? []).map((number) => number - 1));
    const tolerant = alignWords(reference, hypothesis, tolerantSame);
    rows.push({
      file: clip.file,
      surah: clip.surah,
      ayah: clip.ayah,
      reciter: clip.reciter,
      reading: clip.reading ?? "correct",
      plantedWords: [...planted].map((index) => index + 1).sort((a, b) => a - b),
      refWords: reference.length,
      hypWords: hypothesis.length,
      latencyMs: Math.round(engine.latencyMs),
      strict: alignWords(reference, hypothesis, strictSame),
      tolerant,
      detection: detect(reference.length, planted, tolerant),
    });
  }

  const reciters = [...new Set(rows.map((row) => row.reciter))];
  const pairs = new Map();
  for (const row of rows) {
    for (const [pair, count] of row.strict.substitutionPairs) {
      pairs.set(pair, (pairs.get(pair) ?? 0) + count);
    }
  }
  return {
    label,
    engine: engineCommand.join(" "),
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
      strict: withoutDetails(row.strict),
      tolerant: withoutDetails(row.tolerant),
      detection: row.detection,
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
  const label = args.label ?? "engine";
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
  const { strict, tolerant, detection, meanLatencyMs } = report.totals;
  console.log(
    `${label}: strict word accuracy ${strict.accuracyPct}% (WER ${strict.werPct}%), ` +
      `tolerant accuracy ${tolerant.accuracyPct}%, clips ${report.clipCount}, mean latency ${meanLatencyMs} ms`,
  );
  if (detection.plantedTotal > 0) {
    console.log(
      `detection: caught ${detection.plantedCaught} of ${detection.plantedTotal} planted mistakes ` +
        `(recall ${detection.recallPct}%)`,
    );
  }
  console.log(
    `false flags: ${detection.falseFlags} of ${detection.cleanWords} correct words (${detection.falseFlagPct}%)`,
  );
  console.log(`report: ${outPath}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
