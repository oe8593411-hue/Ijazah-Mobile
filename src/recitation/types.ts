export type ConfidenceLevel = "high" | "medium" | "low";
export type FindingCategory = "lexical" | "phoneme" | "harakah" | "tajweed";

export type RecitationReference = {
  corpusVersion: string;
  riwayah: "hafs";
  surah: number;
  ayah: number;
  referenceHash: string;
};

export type RecitationFinding = {
  category: FindingCategory;
  ruleId?: string;
  wordIndex?: number;
  letterIndex?: number;
  expected: string;
  observed?: string;
  confidence: ConfidenceLevel;
  severity: "info" | "warning" | "error";
  explanationKey: string;
};

export type RecitationAnalysisResult = {
  reference: RecitationReference;
  findings: RecitationFinding[];
  quality: { usable: boolean; score: number };
  processingMs: number;
};
