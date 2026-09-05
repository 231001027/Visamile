export type VisaPurpose = "TOURIST" | "BUSINESS";

/** Infer purpose from package name/code until a dedicated DB field exists. */
export function visaPurposeFromPackage(pkg: { name: string; code?: string | null }): VisaPurpose {
  const code = (pkg.code || "").toUpperCase();
  if (code.includes("BUSINESS") || code.includes("_B1_") || code.endsWith("_B1")) {
    return "BUSINESS";
  }
  const n = pkg.name.toLowerCase();
  if (n.includes("business")) return "BUSINESS";
  // B1 alone = business; B1/B2 combined visitor stays tourist/visitor.
  if (/\bb1\b/.test(n) && !/\bb2\b/.test(n)) return "BUSINESS";
  return "TOURIST";
}

/** @deprecated use visaPurposeFromPackage */
export function visaPurposeFromName(name: string): VisaPurpose {
  return visaPurposeFromPackage({ name });
}

export function filterVisaTypesByPurpose<T extends { name: string; code?: string | null }>(
  visaTypes: T[],
  purpose: VisaPurpose | ""
): T[] {
  if (!purpose) return visaTypes;
  return visaTypes.filter((vt) => visaPurposeFromPackage(vt) === purpose);
}
