import assert from "node:assert/strict";
import { test } from "node:test";
import { TAJWEED_REFERENCE as ref, findExpectedTajweedChecks } from "../../src/recitation/tajweed-rules.ts";

// The letters as the attached notes list them. Order does not matter, so the lists are compared sorted.
const NOTES = {
  ikhfa: ["ص", "ذ", "ث", "ك", "ج", "ش", "ق", "س", "د", "ط", "ز", "ف", "ت", "ض", "ظ"],
  izhar: ["ء", "ه", "ع", "ح", "غ", "خ"],
  idgham: ["ي", "ر", "م", "ل", "و", "ن"],
  qalqalah: ["ق", "ط", "ب", "ج", "د"],
};
const sorted = (letters) => [...letters].sort();

// True when the textual finder marks `ruleId` on the first word of `text`.
function marks(text, ruleId) {
  return findExpectedTajweedChecks(text).some((check) => check.ruleId === ruleId && check.wordIndex === 1);
}

test("tajweed reference: letter counts from the notes", () => {
  assert.equal(ref.ikhfaLetters.length, 15);
  assert.equal(ref.izharHalqi.length, 6);
  assert.equal(ref.idghamLetters.length, 6);
  assert.equal(ref.qalqalahLetters.length, 5);
});

test("tajweed reference: letters match the notes", () => {
  assert.deepEqual(sorted(ref.ikhfaLetters), sorted(NOTES.ikhfa));
  assert.deepEqual(sorted(ref.izharHalqi), sorted(NOTES.izhar));
  assert.deepEqual(sorted(ref.idghamLetters), sorted(NOTES.idgham));
  assert.deepEqual(sorted(ref.qalqalahLetters), sorted(NOTES.qalqalah));
  assert.deepEqual(ref.iqlab, ["ب"]);
  assert.deepEqual(ref.ikhfaShafawi, ["ب"]);
  assert.deepEqual(ref.idghamShafawi, ["م"]);
  assert.deepEqual(sorted(ref.izharShafawiExcept), ["ب", "م"]);
});

test("tajweed reference: bi-ghunnah and bila-ghunnah split the six idgham letters", () => {
  assert.deepEqual(sorted(ref.idghamBiGhunnah), ["م", "ن", "و", "ي"]);
  assert.deepEqual(sorted(ref.idghamBilaGhunnah), ["ر", "ل"]);
  assert.deepEqual(sorted([...ref.idghamBiGhunnah, ...ref.idghamBilaGhunnah]), sorted(ref.idghamLetters));
});

test("tajweed reference: noon sakinah groups do not share a letter", () => {
  const seen = new Set();
  for (const letter of [...ref.ikhfaLetters, ...ref.izharHalqi, ...ref.idghamLetters, ...ref.iqlab]) {
    assert.ok(!seen.has(letter), `${letter} belongs to two groups`);
    seen.add(letter);
  }
});

test("tajweed reference: madd and ghunnah harakat from the notes", () => {
  assert.deepEqual(ref.madd, {
    natural: [2],
    muttasil: [4, 5],
    munfasil: [4, 5],
    lazim: [6],
    aridSukun: [2, 4, 6],
    badal: [2],
    silahSughra: [2],
    silahKubra: [4, 5],
    liinAridSukun: [2, 4, 6],
  });
  assert.equal(ref.ghunnahHarakat, 2);
});

test("textual finder marks each rule on the letters the notes give it", () => {
  for (const letter of NOTES.ikhfa) assert.ok(marks(`مِنْ ${letter}َ`, "ikhfa"), `ikhfa before ${letter}`);
  for (const letter of NOTES.izhar) assert.ok(marks(`مِنْ ${letter}َ`, "izhar"), `izhar before ${letter}`);
  for (const letter of NOTES.idgham) assert.ok(marks(`مِنْ ${letter}َ`, "idgham"), `idgham before ${letter}`);
  assert.ok(marks("مِنْ بَ", "iqlab"), "iqlab before ب");
  assert.ok(marks("هُمْ بِ", "ikhfa"), "ikhfa shafawi before ب");
  assert.ok(marks("هُمْ مَ", "idgham"), "idgham shafawi before م");
  for (const letter of NOTES.qalqalah) assert.ok(marks(`${letter}ْ`, "qalqalah"), `qalqalah on ${letter}`);
});
