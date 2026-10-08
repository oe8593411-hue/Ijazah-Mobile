import type { RecitationFinding } from "../recitation/types";
import type { AI4XConsensus, AI4XInput } from "./types";

const key = (f: RecitationFinding) =>
  [f.category, f.ruleId ?? "", f.wordIndex ?? -1, f.letterIndex ?? -1, f.expected, f.observed ?? ""].join("|");

export function resolveAI4X(input: AI4XInput): AI4XConsensus {
  const usable = input.agents.filter(a => a.confidence >= 0.7);
  const groups = new Map<string, { finding: RecitationFinding; agents: string[]; score: number }>();

  for (const agent of usable) {
    for (const finding of agent.findings) {
      const k = key(finding);
      const current = groups.get(k);
      if (current) {
        current.agents.push(agent.agent);
        current.score += agent.confidence;
      } else {
        groups.set(k, { finding, agents: [agent.agent], score: agent.confidence });
      }
    }
  }

  const selected = [...groups.values()]
    .filter(g => g.agents.length >= 2 && g.score / g.agents.length >= 0.78)
    .sort((a, b) => b.score - a.score);

  const findings = selected.map(g => g.finding);
  const supportingAgents = [...new Set(selected.flatMap(g => g.agents))] as AI4XConsensus["supportingAgents"];
  const allAgents = input.agents.map(a => a.agent);
  const conflictingAgents = allAgents.filter(a => !supportingAgents.includes(a));

  const confidence = findings.length
    ? Math.min(0.99, Math.max(...selected.map(g => Math.min(0.99, g.score / 4))))
    : Math.min(0.99, usable.reduce((s, a) => s + a.confidence, 0) / Math.max(1, usable.length));

  return {
    status: confidence >= 0.78 && findings.length > 0 ? "confirmed" : "uncertain",
    confidence,
    findings,
    supportingAgents,
    conflictingAgents,
    rounds: 2,
  };
}
