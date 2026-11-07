import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { emptyTrack, hasReachedEnd, normalizeArabic, readFinal, startSpeech, takeSpeech } from "../../src/recitation/matching.ts";
import { alignWords, appStates, checkManifest, evaluate, judge, verseWords } from "./evaluate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const harness = path.join(here, "evaluate.mjs");
const corpus = JSON.parse(readFileSync(path.join(here, "..", "..", "src", "quran", "verified-corpus.json"), "utf8"));
const consent = { record: "consent/reciter-a.pdf", commercial_use: true, training: true, evaluation: true };
// Verse 1:1 as the screen reads it: four words, with the dagger alif read as a long a.
const VERSE_1_1 = ["بسم", "الله", "الرحمان", "الرحيم"];
// A fake engine that prints the words written next to the clip, so each test controls what is heard.
const FAKE_ENGINE = 'import { readFileSync } from "node:fs";\nprocess.stdout.write(readFileSync(process.argv.at(-1) + ".json", "utf8"));\n';

function workDir() {
  return mkdtempSync(path.join(os.tmpdir(), "recite-eval-"));
}

test("normalization drops harakat, reads dagger alif as a long a, unifies alef forms", () => {
  assert.equal(normalizeArabic("مَٰلِكِ"), "مالك");
  assert.equal(normalizeArabic("أَلْحَمْدُ لِلَّهِ"), "الحمد لله");
});


test("a word is red only when at least two distinct recognition alternatives agree", () => {
  const expected = ["بسم", "الله", "الرحمان", "الرحيم"];
  const track = emptyTrack(expected.length);
  const singleGuess = readFinal(expected, track, ["بسم الله الرحمان سيارة"]);
  assert.equal(singleGuess.states[3], "unsure");

  const duplicateGuess = readFinal(expected, track, [
    "بسم الله الرحمان سيارة",
    "بسم الله الرحمان سيارة",
  ]);
  assert.equal(duplicateGuess.states[3], "unsure");

  const corroboratedGuess = readFinal(expected, track, [
    "بسم الله الرحمان سيارة",
    "بسم الله الرحمان كتاب",
    "بسم الله الرحمان قلم",
  ]);
  assert.equal(corroboratedGuess.states[3], "bad");

  const disagreement = readFinal(expected, track, [
    "بسم الله الرحمان الكريم",
    "بسم الله الرحمان العزيز",
    "بسم الله الرحمان الرحيم",
  ]);
  assert.equal(disagreement.states[3], "ok");
});

test("interim speech highlights the current word without showing an unconfirmed red error", () => {
  const expected = ["بسم", "الله", "الرحمان", "الرحيم"];
  const track = emptyTrack(expected.length);
  const speech = startSpeech(track);
  const interim = takeSpeech(expected, track, speech, [{ alts: ["الكريم"], isFinal: false }]);
  assert.equal(interim.view.states[0], "unsure");
  assert.equal(interim.view.states[1], undefined);
  assert.equal(interim.view.states[2], undefined);
  assert.equal(interim.view.states[3], undefined);
});

test("verse words are read the way the screen reads them", () => {
  const verse = corpus.ayahs.find((item) => item.surah === 1 && item.ayah === 1).text;
  assert.deepEqual(verseWords(verse), VERSE_1_1);
  assert.deepEqual(verseWords("بِسْمِ ٱللَّهِ ﴿1﴾"), ["بسم", "الله"]);
});

test("strict alignment separates matches, substitutions, skipped words and extra words", () => {
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

test("the matcher marks one missed word unsure, two in a row skipped, and a clearly wrong word bad", () => {
  assert.deepEqual(appStates(VERSE_1_1, "بسم الله الرحمان الرحيم"), ["ok", "ok", "ok", "ok"]);
  assert.deepEqual(appStates(VERSE_1_1, "بسم الله الرحيم"), ["ok", "ok", "unsure", "ok"]);
  assert.deepEqual(appStates(VERSE_1_1, "بسم الرحيم"), ["ok", "skipped", "skipped", "ok"]);
  assert.deepEqual(appStates(VERSE_1_1, "بسم الله الرحمان كتاب"), ["ok", "ok", "ok", "unsure"]);
});

test("words after the last word the engine heard stay unread", () => {
  assert.deepEqual(appStates(VERSE_1_1, "بسم"), ["ok", undefined, undefined, undefined]);
});

test("a surah completes only when the final expected word was actually heard", () => {
  const complete = emptyTrack(4);
  complete.cursor = 4;
  complete.states = ["ok", "ok", "ok", "ok"];
  assert.equal(hasReachedEnd(complete), true);

  const finalWordUnsure = { ...complete, states: ["ok", "ok", "ok", "unsure"] };
  assert.equal(hasReachedEnd(finalWordUnsure), true);

  const finalWordWrongButHeard = { ...complete, states: ["ok", "ok", "ok", "bad"] };
  assert.equal(hasReachedEnd(finalWordWrongButHeard), true);

  const finalWordSkipped = { ...complete, states: ["ok", "ok", "ok", "skipped"] };
  assert.equal(hasReachedEnd(finalWordSkipped), false);

  const finalWordUnread = { ...complete, states: ["ok", "ok", "ok", undefined] };
  assert.equal(hasReachedEnd(finalWordUnread), false);

  const cursorShort = { ...complete, cursor: 3 };
  assert.equal(hasReachedEnd(cursorShort), false);
});

test("the counts keep planted mistakes apart from clean words", () => {
  const r = judge(["ok", "unsure", "bad", "skipped", undefined], new Set([1, 2]));
  assert.equal(r.ok, 1);
  assert.equal(r.flagged, 2);
  assert.equal(r.unsure, 1);
  assert.equal(r.unread, 1);
  assert.equal(r.plantedTotal, 2);
  assert.equal(r.plantedFlagged, 1);
  assert.equal(r.plantedUnsure, 1);
  assert.equal(r.cleanWords, 3);
  assert.equal(r.cleanFlagged, 1);
  assert.equal(r.cleanUnread, 1);
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

test("end to end: the matcher's decisions and strict accuracy, with planted mistakes", async () => {
  const dir = workDir();
  const engine = path.join(dir, "engine.mjs");
  writeFileSync(engine, FAKE_ENGINE);
  const clips = [
    // The reciter skipped word 2 on purpose, and the engine heard the skip. One skipped word is unsure.
    { file: "mistake.wav", reading: "with_mistakes", planted_words: [2], words: ["بسم", "الرحمن", "الرحيم"] },
    // Correct reading. The engine writes the common spelling of the verse word.
    { file: "correct.wav", words: ["بسم", "الله", "الرحمن", "الرحيم"] },
    // Correct reading. The engine writes a different last word, which the matcher leaves unsure.
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
  assert.equal(report.totals.wer.refWords, 12);
  assert.equal(report.totals.wer.correct, 7);
  assert.equal(report.totals.wer.accuracyPct, 58.3);
  assert.deepEqual(report.topSubstitutions, [
    { pair: "الرحمان -> الرحمن", count: 3 },
    { pair: "الرحيم -> الكريم", count: 1 },
  ]);
  assert.equal(report.totals.app.words, 12);
  assert.equal(report.totals.app.okPct, 83.3);
  assert.equal(report.totals.app.unsurePct, 16.7);
  assert.equal(report.totals.app.flagged, 0);
  assert.equal(report.totals.app.plantedTotal, 1);
  assert.equal(report.totals.app.plantedUnsure, 1);
  assert.equal(report.totals.app.recallPct, 0);
  assert.equal(report.totals.app.cleanWords, 11);
  assert.equal(report.totals.app.falseFlagPct, 0);
  assert.equal(report.totals.app.cleanUnsurePct, 9.1);
  assert.deepEqual(report.clips[0].plantedWords, [2]);
  assert.deepEqual(report.clips[0].states, ["ok", "unsure", "ok", "ok"]);
  assert.deepEqual(report.clips[2].states, ["ok", "ok", "ok", "unsure"]);
  assert.equal(report.perReciter["reciter-a"].wer.refWords, 12);
  assert.match(report.matcher.sha256, /^[0-9a-f]{64}$/);
  assert.ok(report.notMeasured.length >= 3);
  assert.ok(report.caveats.length >= 2);
});

test("the command line writes the report and prints the summary", () => {
  const dir = workDir();
  const engine = path.join(dir, "engine.mjs");
  writeFileSync(engine, FAKE_ENGINE);
  writeFileSync(path.join(dir, "a.wav"), "placeholder");
  writeFileSync(path.join(dir, "a.wav.json"), JSON.stringify({ words: VERSE_1_1.map((text) => ({ text })) }));
  const manifestPath = path.join(dir, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify({ clips: [{ file: "a.wav", surah: 1, ayah: 1, reciter: "reciter-a", consent }] }));
  const out = path.join(dir, "report.json");
  const run = spawnSync(
    process.execPath,
    [harness, "--manifest", manifestPath, "--engine-cmd", `${process.execPath} ${engine}`, "--label", "cli", "--out", out],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /cli: word accuracy 100% \(WER 0%\)/);
  assert.match(run.stdout, /correct words flagged: 0 of 4 \(0%\)/);
  assert.equal(JSON.parse(readFileSync(out, "utf8")).totals.app.okPct, 100);
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
