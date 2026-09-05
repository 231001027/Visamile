/**
 * One-off Resend smoke test.
 *
 * 1. Put your real key in .env (replace re_xxxxxxxxx):
 *      RESEND_API_KEY=re_xxxxxxxxx
 * 2. Run: npm run email:test
 */
import "dotenv/config";
import { sendEmail } from "../src/lib/email";

async function main() {
  const apiKey = process.env.RESEND_API_KEY || process.env.NOTIFY_EMAIL_API_KEY;
  if (!apiKey || apiKey === "re_xxxxxxxxx" || !apiKey.startsWith("re_")) {
    console.error(
      "Set RESEND_API_KEY (or NOTIFY_EMAIL_API_KEY) in .env to your real Resend key (re_...)."
    );
    process.exit(1);
  }

  const result = await sendEmail({
    from: process.env.NOTIFY_EMAIL_FROM || "onboarding@resend.dev",
    to: "231001027@rajalakshmi.edu.in",
    subject: "Hello World",
    html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
  });

  if (!result.ok) {
    console.error("Failed to send:", result.error);
    process.exit(1);
  }

  console.log("Email sent successfully.", result.id ? `id=${result.id}` : "");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
