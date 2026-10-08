export type WeaknessObservation = {
  confirmedError: boolean;
  successfulRecall: boolean;
  confidence: number;
  daysSinceLastAttempt: number;
};

export function calculateWeaknessScore(previousScore: number, observation: WeaknessObservation): number {
  if (observation.confidence < 0.78) return previousScore;

  const errorDelta = observation.confirmedError ? 0.18 : -0.08;
  const recallDelta = observation.successfulRecall ? -0.14 : 0.06;
  const recencyBoost = Math.min(0.12, (observation.daysSinceLastAttempt / 30) * 0.12);

  return Math.max(0, Math.min(1, previousScore * 0.72 + errorDelta + recallDelta + recencyBoost));
}
