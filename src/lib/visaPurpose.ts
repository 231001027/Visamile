export type VisaPurpose = "TOURIST" | "BUSINESS";

/** Infer purpose from package name until a dedicated DB field exists. */
export function visaPurposeFromName(name: string): VisaPurpose {
  const n = name.toLowerCase();
  if (n.includes("business")) return "BUSINESS";
  // B1 alone = business; B1/B2 combined visitor stays tourist/visitor.
  if (/\bb1\b/.test(n) && !/\bb2\b/.test(n)) return "BUSINESS";
  return "TOURIST";
}

export function filterVisaTypesByPurpose<T extends { name: string }>(
  visaTypes: T[],
  purpose: VisaPurpose | ""
): T[] {
  if (!purpose) return visaTypes;
  return visaTypes.filter((vt) => visaPurposeFromName(vt.name) === purpose);
}
