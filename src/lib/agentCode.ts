import { nextSequenceValue } from "./idSequence";

/** Generates the next agent code, e.g. C002085 (race-safe via IdSequence). */
export async function generateAgentCode(): Promise<string> {
  const seq = await nextSequenceValue("agent_code");
  return `C${String(seq).padStart(6, "0")}`;
}
