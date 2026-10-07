import type { ConfidenceLevel, RecitationFinding } from "./types";

export function gateFinding(
  finding: RecitationFinding,
  evidenceScore: number,
): RecitationFinding | null {
  const confidence: ConfidenceLevel =
    evidenceScore >= 0.9 ? "high" : evidenceScore >= 0.7 ? "medium" : "low";

  if (confidence === "low") return null;
  return { ...finding, confidence };
}
