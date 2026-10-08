import type { RecitationFinding } from "../recitation/types";

export type AI4XAgentId = "alignment" | "acoustic" | "tajweed" | "memory";

export type AI4XAgentEvidence = {
  agent: AI4XAgentId;
  confidence: number;
  findings: RecitationFinding[];
  evidence: Record<string, unknown>;
};

export type AI4XConsensus = {
  status: "confirmed" | "uncertain";
  confidence: number;
  findings: RecitationFinding[];
  supportingAgents: AI4XAgentId[];
  conflictingAgents: AI4XAgentId[];
  rounds: number;
};

export type AI4XInput = {
  referenceHash: string;
  audioQuality: number;
  agents: AI4XAgentEvidence[];
};
