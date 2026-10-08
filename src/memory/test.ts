export type TestQuestionType = "complete" | "continue" | "random_start";

export type TestRange = {
  startSurah: number;
  startAyah: number;
  endSurah: number;
  endAyah: number;
};

export type TestCandidate = {
  surah: number;
  ayah: number;
  wordCount: number;
  weaknessScore?: number;
};

export type SmartTestQuestion = TestCandidate & {
  type: TestQuestionType;
  priority: number;
};

export function buildSmartTest(
  candidates: TestCandidate[],
  count: number,
  difficulty: "easy" | "medium" | "hard",
): SmartTestQuestion[] {
  const weight = difficulty === "hard" ? 1.35 : difficulty === "medium" ? 1.1 : 0.85;

  return [...candidates]
    .map((item) => ({
      ...item,
      type: item.weaknessScore && item.weaknessScore >= 0.65
        ? "continue" as const
        : item.wordCount >= 8
          ? "random_start" as const
          : "complete" as const,
      priority: ((item.weaknessScore ?? 0) * weight) + Math.random() * 0.25,
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, Math.max(1, count));
}
