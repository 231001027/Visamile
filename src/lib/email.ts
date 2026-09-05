import { Resend } from "resend";

function getApiKey(): string | undefined {
  return process.env.RESEND_API_KEY || process.env.NOTIFY_EMAIL_API_KEY;
}

export function getResendClient(): Resend | null {
  const apiKey = getApiKey();
  if (!apiKey || !apiKey.startsWith("re_")) return null;
  return new Resend(apiKey);
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const resend = getResendClient();
  const from = params.from || process.env.NOTIFY_EMAIL_FROM || "onboarding@resend.dev";

  if (!resend) {
    if (process.env.NOTIFY_EMAIL_WEBHOOK_URL) {
      const res = await fetch(process.env.NOTIFY_EMAIL_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: params.to,
          subject: params.subject,
          body: params.text || params.html,
        }),
      });
      return res.ok ? { ok: true } : { ok: false, error: `Webhook returned ${res.status}` };
    }

    // Dev fallback when no provider is configured
    // eslint-disable-next-line no-console
    console.log(`[email] to ${params.to} — ${params.subject}: ${params.text || params.html}`);
    return { ok: true };
  }

  const payload = params.html
    ? { from, to: params.to, subject: params.subject, html: params.html, ...(params.text ? { text: params.text } : {}) }
    : { from, to: params.to, subject: params.subject, text: params.text || "" };

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data?.id };
}
