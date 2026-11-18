export type RecitationScope = "ayah" | "range" | "surah";

export type ExpectedReference = {
  surah: number;
  scope: RecitationScope;
  ayah?: number;
  startAyah?: number;
};

export type ConsensusWordHighlights = {
  matchedExpectedIndexes: Set<number>;
  wrongWordKeys: Set<string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns word highlights only when both transcription engines passed the
 * server-side consensus gate for the exact surah/scope currently on screen.
 * Insertions are deliberately not painted red because they do not identify a
 * Quran word that should be marked as mispronounced.
 */
export function getConsensusWordHighlights(
  analysis: unknown,
  expectedReference: ExpectedReference,
  expectedWordCount: number,
): ConsensusWordHighlights {
  const matchedExpectedIndexes = new Set<number>();
  const wrongWordKeys = new Set<string>();
  if (
    !Number.isInteger(expectedReference.surah)
    || expectedReference.surah < 1
    || expectedReference.surah > 114
    || !Number.isInteger(expectedWordCount)
    || expectedWordCount < 0
    || !isRecord(analysis)
  ) {
    return { matchedExpectedIndexes, wrongWordKeys };
  }

  const reference = isRecord(analysis.reference) ? analysis.reference : null;
  const ai4x = isRecord(analysis.ai4x) ? analysis.ai4x : null;
  const stages = ai4x && isRecord(ai4x.stages) ? ai4x.stages : null;
  const gate = stages && isRecord(stages.confidenceGate) ? stages.confidenceGate : null;
  const textAlignment = isRecord(analysis.textAlignment) ? analysis.textAlignment : null;
  const status = gate?.status;
  const scopeMatches = reference !== null
    && reference.surah === expectedReference.surah
    && reference.riwaya === "حفص عن عاصم"
    && (expectedReference.scope === "surah"
      ? reference.scope === "surah"
      : expectedReference.scope === "range"
        ? reference.scope === "range" && reference.startAyah === expectedReference.startAyah
        : reference.scope === undefined && reference.ayah === expectedReference.ayah);
  const gatePassed = analysis.confidence === "corroborated"
    && gate?.canReleaseResults === true
    && (status === "passed_consensus_no_mismatch" || status === "passed_consensus_with_mismatches");

  if (!scopeMatches || !gatePassed || !textAlignment) {
    return { matchedExpectedIndexes, wrongWordKeys };
  }

  const matched = textAlignment.matchedExpectedIndexes;
  if (Array.isArray(matched)) {
    for (const index of matched) {
      if (Number.isInteger(index) && index >= 0 && index < expectedWordCount) {
        matchedExpectedIndexes.add(index as number);
      }
    }
  }

  if (status === "passed_consensus_with_mismatches" && Array.isArray(textAlignment.errors)) {
    for (const value of textAlignment.errors) {
      if (!isRecord(value)) continue;
      if (value.type !== "possible_omission" && value.type !== "possible_substitution") continue;
      if (
        value.surah !== expectedReference.surah
        || !Number.isInteger(value.ayah)
        || (value.ayah as number) < 1
        || (value.ayah as number) > 286
        || !Number.isInteger(value.wordIndex)
        || (value.wordIndex as number) < 1
        || (value.wordIndex as number) > 100
      ) continue;
      wrongWordKeys.add(String(value.surah) + ":" + String(value.ayah) + ":" + String(value.wordIndex));
    }
  }

  return { matchedExpectedIndexes, wrongWordKeys };
}
