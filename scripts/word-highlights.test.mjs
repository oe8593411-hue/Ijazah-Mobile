import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(new URL("../src/recitation/word-highlights.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = "data:text/javascript;base64," + Buffer.from(javascript).toString("base64");
const { getConsensusWordHighlights } = await import(moduleUrl);

const reference = { surah: 1, riwaya: "حفص عن عاصم", scope: "range", startAyah: 2 };
const expected = { surah: 1, scope: "range", startAyah: 2 };
const base = {
  reference,
  confidence: "corroborated",
  ai4x: { stages: { confidenceGate: { status: "passed_consensus_with_mismatches", canReleaseResults: true } } },
  textAlignment: {
    matchedExpectedIndexes: [0, 2, 99, -1, 1.5],
    errors: [
      { type: "possible_omission", surah: 1, ayah: 2, wordIndex: 2 },
      { type: "possible_substitution", surah: 1, ayah: 3, wordIndex: 1 },
      { type: "possible_addition", surah: 1, ayah: 2, wordIndex: 3 },
      { type: "possible_omission", surah: 2, ayah: 2, wordIndex: 1 },
      { type: "possible_omission", surah: 1, ayah: 2, wordIndex: 0 },
    ],
  },
};

test("blocks all highlights when consensus is missing or weak", () => {
  const weak = structuredClone(base);
  weak.confidence = "needs_review";
  const noGate = structuredClone(base);
  noGate.ai4x.stages.confidenceGate.canReleaseResults = false;
  const preliminary = { textAlignment: base.textAlignment };
  for (const value of [weak, noGate, preliminary]) {
    const result = getConsensusWordHighlights(value, expected, 4);
    assert.equal(result.matchedExpectedIndexes.size, 0);
    assert.equal(result.wrongWordKeys.size, 0);
  }
});

test("releases matched words only after a passing no-mismatch gate", () => {
  const clean = structuredClone(base);
  clean.ai4x.stages.confidenceGate.status = "passed_consensus_no_mismatch";
  clean.textAlignment.errors = [];
  const result = getConsensusWordHighlights(clean, expected, 4);
  assert.deepEqual([...result.matchedExpectedIndexes], [0, 2]);
  assert.equal(result.wrongWordKeys.size, 0);
});

test("marks only corroborated omissions and substitutions, never additions", () => {
  const result = getConsensusWordHighlights(base, expected, 4);
  assert.deepEqual([...result.matchedExpectedIndexes], [0, 2]);
  assert.deepEqual([...result.wrongWordKeys].sort(), ["1:2:2", "1:3:1"]);
});

test("rejects stale surah, ayah, range, or riwayah results", () => {
  const staleCases = [
    [{ ...reference, surah: 2 }, expected],
    [{ ...reference, startAyah: 3 }, expected],
    [{ ...reference, riwaya: "ورش عن نافع" }, expected],
    [{ ...reference, scope: "surah" }, expected],
  ];
  for (const [actualReference, expectedReference] of staleCases) {
    const result = getConsensusWordHighlights({ ...base, reference: actualReference }, expectedReference, 4);
    assert.equal(result.matchedExpectedIndexes.size, 0);
    assert.equal(result.wrongWordKeys.size, 0);
  }
  const wrongScope = getConsensusWordHighlights(base, { surah: 1, scope: "ayah", ayah: 2 }, 4);
  assert.equal(wrongScope.matchedExpectedIndexes.size, 0);
});
