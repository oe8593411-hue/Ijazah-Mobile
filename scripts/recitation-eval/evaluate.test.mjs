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

test("end to end: engine words are scored strictly and tolerantly against the verified ayah", async () => {
  const dir = workDir();
  const engine = path.join(dir, "engine.mjs");
  writeFileSync(
    engine,
    'import { readFileSync } from "node:fs";\nprocess.stdout.write(readFileSync(process.argv.at(-1) + ".json", "utf8"));\n',
  );
  writeFileSync(path.join(dir, "fatiha-1-1.wav"), "placeholder, the fake engine reads a sidecar file");
  writeFileSync(
    path.join(dir, "fatiha-1-1.wav.json"),
    JSON.stringify({ words: [{ text: "بسم" }, { text: "الله" }, { text: "الرحمن" }, { text: "الرحيم" }] }),
  );
  const manifestPath = path.join(dir, "manifest.json");
  writeFileSync(
    manifestPath,
    JSON.stringify({ clips: [{ file: "fatiha-1-1.wav", surah: 1, ayah: 1, reciter: "reciter-a", consent }] }),
  );

  const report = await evaluate({ manifestPath, engineCommand: [process.execPath, engine], label: "test", corpus });

  assert.equal(report.clipCount, 1);
  assert.equal(report.totals.strict.refWords, 4);
  assert.equal(report.totals.strict.correct, 3);
  assert.equal(report.totals.strict.substitutions, 1);
  assert.equal(report.totals.strict.werPct, 25);
  assert.equal(report.totals.tolerant.correct, 4);
  assert.equal(report.totals.tolerant.accuracyPct, 100);
  assert.deepEqual(report.topSubstitutions, [{ pair: "الرحمان -> الرحمن", count: 1 }]);
  assert.equal(report.perReciter["reciter-a"].strict.refWords, 4);
  assert.ok(report.notMeasured.length >= 3);
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
