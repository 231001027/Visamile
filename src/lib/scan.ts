const BLOCKED_SIGNATURES: { sig: Buffer; label: string }[] = [
  { sig: Buffer.from([0x4d, 0x5a]), label: "executable" }, // PE/DOS
  { sig: Buffer.from([0x7f, 0x45, 0x4c, 0x46]), label: "ELF" },
];

const ALLOWED_MAGIC: { sig: Buffer; mime: string }[] = [
  { sig: Buffer.from([0x25, 0x50, 0x44, 0x46]), mime: "application/pdf" }, // %PDF
  { sig: Buffer.from([0x89, 0x50, 0x4e, 0x47]), mime: "image/png" },
  { sig: Buffer.from([0xff, 0xd8, 0xff]), mime: "image/jpeg" },
];

export class DocumentScanError extends Error {}

/**
 * Validates file content before storage: magic-byte check, blocked signatures,
 * size already enforced by caller. Hook point for external AV (ClamAV etc.)
 * via DOCUMENT_SCAN_URL when configured.
 */
export async function scanDocument(buffer: Buffer, declaredMime: string): Promise<void> {
  if (buffer.length < 4) {
    throw new DocumentScanError("File is too small to be a valid document.");
  }

  for (const blocked of BLOCKED_SIGNATURES) {
    if (buffer.subarray(0, blocked.sig.length).equals(blocked.sig)) {
      throw new DocumentScanError(`Blocked file type (${blocked.label}).`);
    }
  }

  const magicOk = ALLOWED_MAGIC.some((m) => buffer.subarray(0, m.sig.length).equals(m.sig));
  if (!magicOk) {
    throw new DocumentScanError("File content does not match an allowed document format.");
  }

  const scanUrl = process.env.DOCUMENT_SCAN_URL;
  if (scanUrl) {
    const res = await fetch(scanUrl, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-Declared-Mime": declaredMime },
      body: new Uint8Array(buffer),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new DocumentScanError(body || "External malware scan rejected this file.");
    }
  }
}
