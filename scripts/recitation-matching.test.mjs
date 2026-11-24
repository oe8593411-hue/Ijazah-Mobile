import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeArabic, wordCost, costState, alignFrom, emptyTrack,
  readFinal, endSpeech, startSpeech, readResults, takeSpeech,
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


test("final results advance once, interim words remain provisional, and a restarted session resumes at the cursor", () => {
  const expected = ["الحمد", "لله", "رب", "العالمين"];
  let track = emptyTrack(expected.length);
  let speech = startSpeech(track);

  let event = takeSpeech(expected, track, speech, [
    { alts: ["الحمد"], confidences: [undefined], isFinal: true },
    { alts: ["لله"], confidences: [undefined], isFinal: false },
  ]);
  track = event.track;
  speech = event.speech;
  assert.equal(track.cursor, 1);
  assert.equal(track.states[0], "ok");
  assert.equal(track.states[1], undefined);
  assert.equal(event.view.cursor, 2);

  event = takeSpeech(expected, track, speech, [
    { alts: ["الحمد"], confidences: [undefined], isFinal: true },
    { alts: ["لله"], confidences: [undefined], isFinal: true },
    { alts: ["رب"], confidences: [undefined], isFinal: false },
  ]);
  track = event.track;
  speech = event.speech;
  assert.equal(track.cursor, 2);
  assert.equal(track.states[1], "ok");
  assert.equal(track.states[2], undefined);
  assert.equal(event.view.cursor, 3);

  // A duplicate event must not consume already-final results a second time.
  event = takeSpeech(expected, track, speech, [
    { alts: ["الحمد"], confidences: [undefined], isFinal: true },
    { alts: ["لله"], confidences: [undefined], isFinal: true },
    { alts: ["رب"], confidences: [undefined], isFinal: false },
  ]);
  track = event.track;
  speech = event.speech;
  assert.equal(track.cursor, 2);

  track = endSpeech(expected, track, speech);
  assert.equal(track.cursor, 2);
  assert.equal(track.states[2], undefined);

  // A fresh recognizer session starts from the last committed word.
  const resumed = takeSpeech(expected, track, startSpeech(track), [
    { alts: ["رب"], confidences: [undefined], isFinal: true },
  ]);
  assert.equal(resumed.track.cursor, 3);
  assert.equal(resumed.track.states[2], "ok");
});

test("alignment clamps a stale cursor past the verified text and does not invent words", () => {
  const result = alignFrom(["الحمد"], 2, ["لله"]);
  assert.equal(result.cursor, 1);
  assert.deepEqual(result.cells, []);
  assert.equal(result.cost, 0.8);
});
