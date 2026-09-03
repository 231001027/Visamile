import { NotificationChannel, NotificationStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { enqueue } from "./queue";

async function resolvePartnerEmail(partnerId: string | null): Promise<string | null> {
  if (!partnerId) return null;
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { contactEmail: true, contactPersonEmail: true },
  });
  return partner?.contactPersonEmail || partner?.contactEmail || null;
}

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const apiKey = process.env.NOTIFY_EMAIL_API_KEY;
  const from = process.env.NOTIFY_EMAIL_FROM || "noreply@visamile.test";

  // Resend-compatible HTTP API
  if (apiKey?.startsWith("re_")) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text: body }),
    });
    return res.ok;
  }

  // Generic webhook (Slack, custom relay, etc.)
  if (process.env.NOTIFY_EMAIL_WEBHOOK_URL) {
    const res = await fetch(process.env.NOTIFY_EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body }),
    });
    return res.ok;
  }

  // Dev fallback
  // eslint-disable-next-line no-console
  console.log(`[email] to ${to} — ${subject}: ${body}`);
  return true;
}

async function dispatchNotification(
  id: string,
  channel: NotificationChannel,
  partnerId: string | null,
  subject: string,
  body: string
) {
  try {
    if (channel === "EMAIL") {
      const to = await resolvePartnerEmail(partnerId);
      if (!to) throw new Error("No email address for partner.");
      const ok = await sendEmail(to, subject, body);
      if (!ok) throw new Error("Email provider returned an error.");
    } else {
      // eslint-disable-next-line no-console
      console.log(`[notify:${channel}] partner ${partnerId ?? "n/a"} — ${subject}: ${body}`);
    }
    await prisma.notification.update({ where: { id }, data: { status: "SENT" } });
  } catch (err) {
    await prisma.notification.update({ where: { id }, data: { status: "FAILED" } });
    // eslint-disable-next-line no-console
    console.error("[notify] dispatch failed:", err);
  }
}

/** Queues a notification row and dispatches asynchronously off the request path. */
export async function notify(params: {
  partnerId: string | null;
  channel: NotificationChannel;
  subject: string;
  body: string;
}) {
  const { partnerId, channel, subject, body } = params;

  const row = await prisma.notification.create({
    data: { partnerId: partnerId ?? undefined, channel, subject, body, status: "QUEUED" },
  });

  enqueue(() => dispatchNotification(row.id, channel, partnerId, subject, body));

  return row;
}

export async function listNotifications(partnerId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
