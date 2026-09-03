import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visamile — B2B visa partner platform",
  description: "Submit, track, and manage visa applications for your clients in one dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body min-h-screen bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
