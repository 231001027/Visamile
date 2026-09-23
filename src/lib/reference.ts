import { nextSequenceValue } from "./idSequence";

/** Human-friendly case reference like VM-2026-000123 (race-safe via IdSequence). */
export async function generateReferenceNo(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequenceValue(`case_ref_${year}`);
  return `VM-${year}-${String(seq).padStart(6, "0")}`;
}

/**
 * Short booking prefix from destination ISO code.
 * Examples: Thailand → TL, India → IND, UAE → UAE, UK → UK.
 */
const BOOKING_PREFIX_BY_ISO: Record<string, string> = {
  THA: "TL",
  IND: "IND",
  ARE: "UAE",
  GBR: "UK",
  USA: "US",
  AUS: "AU",
  FRA: "FR",
  AUT: "AT",
  OMN: "OM",
  SAU: "SA",
  RUS: "RU",
  SGP: "SG",
  VNM: "VN",
  KHM: "KH",
  IDN: "ID",
  UZB: "UZ",
  ARM: "AM",
  GEO: "GE",
  TJK: "TJ",
  QAT: "QA",
  BHR: "BH",
};

export function bookingPrefixFromIso(isoCode: string | null | undefined): string {
  const iso = (isoCode || "").trim().toUpperCase();
  if (!iso) return "BK";
  return BOOKING_PREFIX_BY_ISO[iso] ?? iso.slice(0, 3);
}

/**
 * Booking id issued after payment.
 * e.g. Thailand case VM-2026-000001 → TL-2026000001
 */
export function bookingIdFromReference(
  referenceNo: string,
  countryIsoCode?: string | null
): string {
  const prefix = bookingPrefixFromIso(countryIsoCode);
  const body = referenceNo.replace(/^VM-/i, "").replace(/-/g, "");
  return `${prefix}-${body}`;
}

/** True if an existing booking id already uses a destination prefix (not legacy BK-). */
export function bookingIdNeedsCountryPrefix(bookingId: string | null | undefined): boolean {
  if (!bookingId) return true;
  return /^BK-/i.test(bookingId);
}
