import { nextSequenceValue } from "./idSequence";

/** Human-friendly case reference like VM-2026-000123 (race-safe via IdSequence). */
export async function generateReferenceNo(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequenceValue(`case_ref_${year}`);
  return `VM-${year}-${String(seq).padStart(6, "0")}`;
}
