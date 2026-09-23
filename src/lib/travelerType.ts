/** Age under this value is priced/classified as CHILD. */
export const CHILD_MAX_AGE_EXCLUSIVE = 18;

/**
 * Whole years of age on `asOf` (defaults to today, UTC date parts).
 * Returns null if DOB is missing or invalid.
 */
export function ageFromDob(dateOfBirth: string, asOf?: string): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const ref = asOf ? new Date(asOf) : new Date();
  if (Number.isNaN(ref.getTime())) return null;

  let age = ref.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = ref.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  if (age < 0 || age > 120) return null;
  return age;
}

/** Derive ADULT / CHILD from DOB (optionally as of departure date). */
export function travelerTypeFromDob(
  dateOfBirth: string,
  asOf?: string
): "ADULT" | "CHILD" | null {
  const age = ageFromDob(dateOfBirth, asOf);
  if (age == null) return null;
  return age < CHILD_MAX_AGE_EXCLUSIVE ? "CHILD" : "ADULT";
}
