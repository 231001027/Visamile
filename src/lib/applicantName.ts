/** Full display name: first + optional middle + last. */
export function formatApplicantName(parts: {
  applicantFirstName?: string | null;
  applicantMiddleName?: string | null;
  applicantLastName?: string | null;
}): string {
  return [parts.applicantFirstName, parts.applicantMiddleName, parts.applicantLastName]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join(" ");
}
