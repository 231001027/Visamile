import crypto from "crypto";
import { prisma } from "./prisma";

export interface ApiPartnerContext {
  partnerId: string;
  apiKeyId: string;
}

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `vm_${crypto.randomBytes(24).toString("base64url")}`;
  const prefix = raw.slice(0, 12);
  const hash = hashApiKey(raw);
  return { raw, prefix, hash };
}

export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Resolves X-API-Key header to an approved partner. Returns null if invalid. */
export async function authenticateApiKey(req: Request): Promise<ApiPartnerContext | null> {
  const raw = req.headers.get("x-api-key")?.trim();
  if (!raw || !raw.startsWith("vm_")) return null;

  const prefix = raw.slice(0, 12);
  const hash = hashApiKey(raw);

  const key = await prisma.partnerApiKey.findFirst({
    where: { keyPrefix: prefix, keyHash: hash, active: true },
    include: { partner: { select: { id: true, status: true } } },
  });
  if (!key || key.partner.status !== "APPROVED") return null;

  void prisma.partnerApiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });

  return { partnerId: key.partnerId, apiKeyId: key.id };
}
