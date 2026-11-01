import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { alignWords, checkManifest, evaluate, normalizeArabic, tolerantSame } from "./evaluate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const harness = path.join(here, "evaluate.mjs");
const corpus = JSON.parse(readFileSync(path.join(here, "..", "..", "src", "quran", "verified-corpus.json"), "utf8"));
const consent = { record: "consent/reciter-a.pdf", commercial_use: true, training: true, evaluation: true };

function workDir() {
  return mkdtempSync(path.join(os.tmpdir(), "recite-eval-"));
}

test("normalization drops harakat, reads dagger alif as a long a, unifies alef forms", () => {
  // مَٰلِكِ -> مالك
  assert.equal(normalizeArabic("مَٰلِكِ"), "مالك");
  // أَلْحَمْدُ لِلَّهِ -> الحمد لله
  assert.equal(
    normalizeArabic("أَلْحَمْدُ لِلَّهِ"),
    "الحمد لله",
  );
});

test("alignment separates matches, substitutions, skipped words and extra words", () => {
  const counts = (ref, hyp) => {
    const { correct, substitutions, deletions, insertions } = alignWords(ref, hyp);
    return { correct, substitutions, deletions, insertions };
  };
  assert.deepEqual(counts(["a", "b", "c"], ["a", "x", "c"]), { correct: 2, substitutions: 1, deletions: 0, insertions: 0 });
  assert.deepEqual(counts(["a", "b", "c"], ["a", "c"]), { correct: 2, substitutions: 0, deletions: 1, insertions: 0 });
  assert.deepEqual(counts(["a", "c"], ["a", "b", "c"]), { correct: 2, substitutions: 0, deletions: 0, insertions: 1 });
  assert.deepEqual(counts(["a", "b"], []), { correct: 0, substitutions: 0, deletions: 2, insertions: 0 });
  assert.deepEqual(counts([], ["x"]), { correct: 0, substitutions: 0, deletions: 0, insertions: 1 });
});

test("alignment reports which reference words were skipped, substituted or followed by extra words", () => {
  assert.deepEqual(alignWords(["a", "b", "c"], ["a", "c"]).refStatus, ["ok", "del", "ok"]);
  assert.deepEqual(alignWords(["a", "b", "c"], ["a", "x", "c"]).refStatus, ["ok", "sub", "ok"]);
  assert.deepEqual(alignWords(["a", "b", "c"], ["a", "b", "x", "c"]).extraAfter, [0, 1, 0]);
});

test("tolerant matching accepts a one-letter slip only in longer words", () => {
  assert.equal(tolerantSame("الرحمان", "الرحمن"), true);
  assert.equal(tolerantSame("اله", "الله"), false);
  assert.equal(tolerantSame("ا", "ب"), false);
});

test("a clip without commercial-use consent is refused", () => {
  const dir = workDir();
  writeFileSync(path.join(dir, "a.wav"), "x");
  const problems = checkManifest(
    [{ file: "a.wav", surah: 1, ayah: 1, reciter: "reciter-a", consent: { ...consent, commercial_use: false } }],
    corpus,
    dir,
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /consent is missing commercial_use/);
});

test("unknown ayahs, missing files and missing reciter ids are reported", () => {
  const problems = checkManifest([{ file: "missing.wav", surah: 1, ayah: 999, consent }], corpus, os.tmpdir());
  assert.equal(problems.length, 3);
  assert.match(problems[0], /file not found/);
  assert.match(problems[1], /1:999 is not in the verified corpus/);
  assert.match(problems[2], /reciter/);
});

test("planted word numbers must exist in the verse and only apply to readings with mistakes", () => {
  const dir = workDir();
  writeFileSync(path.join(dir, "a.wav"), "placeholder");
  const base = { file: "a.wav", surah: 1, ayah: 1, reciter: "reciter-a", consent };
  const problems = checkManifest(
    [
      { ...base, reading: "with_mistakes", planted_words: [9] }, // 1:1 has 4 words
      { ...base, reading: "with_mistakes" }, // no planted words listed
      { ...base, planted_words: [2] }, // a correct reading cannot have planted words
    ],
    corpus,
    dir,
  );
  assert.equal(problems.length, 3);
  assert.match(problems[0], /outside 1-4/);
  assert.match(problems[1], /"planted_words" must list/);
  assert.match(problems[2], /only applies to readings with mistakes/);
});

test("end to end: accuracy in both matching modes, and planted mistakes against false alarms", async () => {
  const dir = workDir();
  const engine = path.join(dir, "engine.mjs");
  writeFileSync(
    engine,
    'import { readFileSync } from "node:fs";\nprocess.stdout.write(readFileSync(process.argv.at(-1) + ".json", "utf8"));\n',
  );
  const clips = [
    {
      // The reciter skipped word 2 on purpose, and the engine heard the skip.
      file: "mistake.wav",
      reading: "with_mistakes",
      planted_words: [2],
      words: ["بسم", "الرحمن", "الرحيم"],
    },
    // Correct reading. The engine writes the common spelling of the verse word.
    { file: "correct.wav", words: ["بسم", "الله", "الرحمن", "الرحيم"] },
    // Correct reading. The engine writes a wrong last word, which is a false alarm.
    { file: "wrong.wav", words: ["بسم", "الله", "الرحمن", "الكريم"] },
  ];
  for (const clip of clips) {
    writeFileSync(path.join(dir, clip.file), "placeholder, the fake engine reads a sidecar file");
    writeFileSync(path.join(dir, `${clip.file}.json`), JSON.stringify({ words: clip.words.map((text) => ({ text })) }));
  }
  const manifestPath = path.join(dir, "manifest.json");
  writeFileSync(
    manifestPath,
    JSON.stringify({
      clips: clips.map(({ file, reading, planted_words }) => ({
        file,
        surah: 1,
        ayah: 1,
        reciter: "reciter-a",
        consent,
        ...(reading ? { reading, planted_words } : {}),
      })),
    }),
  );

  const report = await evaluate({ manifestPath, engineCommand: [process.execPath, engine], label: "test", corpus });

  assert.equal(report.clipCount, 3);
  assert.equal(report.totals.strict.refWords, 12);
  assert.equal(report.totals.strict.correct, 7);
  assert.equal(report.totals.tolerant.correct, 10);
  assert.equal(report.totals.tolerant.accuracyPct, 83.3);
  assert.deepEqual(report.topSubstitutions, [
    { pair: "الرحمان -> الرحمن", count: 3 },
    { pair: "الرحيم -> الكريم", count: 1 },
  ]);
  assert.equal(report.totals.detection.plantedTotal, 1);
  assert.equal(report.totals.detection.plantedCaught, 1);
  assert.equal(report.totals.detection.recallPct, 100);
  assert.equal(report.totals.detection.cleanWords, 11);
  assert.equal(report.totals.detection.falseFlags, 1);
  assert.equal(report.totals.detection.falseFlagPct, 9.1);
  assert.deepEqual(report.clips[0].plantedWords, [2]);
  assert.equal(report.perReciter["reciter-a"].strict.refWords, 12);
  assert.ok(report.notMeasured.length >= 3);
  assert.ok(report.caveats.length >= 2);
});

test("the command line stops with exit code 2 before any engine runs when consent is incomplete", () => {
  const dir = workDir();
  const marker = path.join(dir, "engine-was-called");
  const engine = path.join(dir, "engine.mjs");
  writeFileSync(
    engine,
    `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "called");\nprocess.stdout.write(JSON.stringify({ words: [] }));\n`,
  );
  writeFileSync(path.join(dir, "a.wav"), "placeholder");
  const manifestPath = path.join(dir, "manifest.json");
  writeFileSync(
    manifestPath,
    JSON.stringify({
      clips: [
        {
          file: "a.wav",
          surah: 1,
          ayah: 1,
          reciter: "reciter-a",
          consent: { record: "consent/reciter-a.pdf", commercial_use: true, training: true, evaluation: false },
        },
      ],
    }),
  );
  const run = spawnSync(
    process.execPath,
    [harness, "--manifest", manifestPath, "--engine-cmd", `${process.execPath} ${engine}`, "--label", "refused"],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 2);
  assert.match(run.stderr, /consent is missing evaluation/);
  assert.equal(existsSync(marker), false);
});
