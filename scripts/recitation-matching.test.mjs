import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeArabic, wordCost, costState, alignFrom, emptyTrack,
  readFinal, endSpeech, startSpeech, readResults,
} from "../src/recitation/matching.ts";

test("normalizes Arabic diacritics and dagger alif without changing the base word", () => {
  assert.equal(normalizeArabic("مَٰلِكِ"), "مالك");
});

test("confusable and short-word mismatches stay uncertain rather than red", () => {
  assert.equal(wordCost("ظ", "ض"), 0.5);
  assert.equal(costState(wordCost("ظ", "ض")), "unsure");
});

test("an exact multi-word alignment marks every matched word correct", () => {
  const result = alignFrom(["الحمد", "لله"], 0, ["الحمد", "لله"]);
  assert.equal(result.cursor, 2);
  assert.deepEqual(result.cells.map(cell => cell?.state), ["ok", "ok"]);
});

test("a single omitted word is uncertain, not a definite error", () => {
  const result = alignFrom(["الحمد", "لله", "رب"], 0, ["الحمد", "رب"]);
  assert.equal(result.cursor, 3);
  assert.deepEqual(result.cells.map(cell => cell?.state), ["ok", "unsure", "ok"]);
});

test("two consecutive omitted words are marked skipped", () => {
  const result = alignFrom(["الحمد", "لله", "رب", "العالمين"], 0, ["الحمد", "العالمين"]);
  assert.equal(result.cursor, 4);
  assert.deepEqual(result.cells.map(cell => cell?.state), ["ok", "skipped", "skipped", "ok"]);
});

test("two ASR fragments can match one verified word conservatively", () => {
  const result = alignFrom(["الحمد"], 0, ["ال", "حمد"]);
  assert.equal(result.cursor, 1);
  assert.equal(result.cells[0]?.state, "ok");
});

test("one ASR token can cover two verified words without cursor loss", () => {
  const result = alignFrom(["عبد", "الله"], 0, ["عبدالله"]);
  assert.equal(result.cursor, 2);
  assert.deepEqual(result.cells.map(cell => cell?.state), ["ok", "ok"]);
});

test("text match wins over a high-confidence but worse ASR alternative", () => {
  const track = readFinal(["الحمد"], emptyTrack(1), ["الحمض", "الحمد"], [0.99, 0.01]);
  assert.equal(track.cursor, 1);
  assert.equal(track.states[0], "ok");
  assert.equal(track.heardAt[0], undefined);
});

test("endSpeech never commits interim hypotheses", () => {
  const expected = ["الحمد"];
  const track = emptyTrack(1);
  const speech = startSpeech(track);
  speech.results = [{ alts: ["الحمد"], confidences: [undefined], isFinal: false }];
  const ended = endSpeech(expected, track, speech);
  assert.equal(ended.cursor, 0);
  assert.deepEqual(ended.states, [undefined]);
});

test("recognizer confidence values outside 0..1 are discarded", () => {
  const list = [Object.assign([{ transcript: "الحمد", confidence: 1.5 }], { isFinal: false })];
  const parsed = readResults(list);
  assert.deepEqual(parsed[0].confidences, [undefined]);
});
