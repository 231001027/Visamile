import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Visamile — Your visa. On time.",
  description:
    "Indian passports, 20+ destinations. Exact visa package, INR fee, and expected timeline — then apply, pay, and track with Visamile.",
  icons: {
    icon: [{ url: "/images/visamile-icon.png", type: "image/png" }],
    apple: "/images/visamile-icon.png",
  },
  openGraph: {
    title: "Visamile — Your visa. On time.",
    description:
      "Indian passports, 20+ destinations. Exact visa package, INR fee, and expected timeline — then apply, pay, and track with Visamile.",
    images: [{ url: "/images/visamile-icon.png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable}`}>
      <body className="font-body min-h-screen bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
