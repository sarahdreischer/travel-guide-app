import type { Metadata } from "next";
import "./globals.css";

// Start scheduled reconciliation (server-side only, runs periodically)
import '@/lib/scheduled-reconciliation'

export const metadata: Metadata = {
  title: "Travel Guide",
  description:
    "Real-world, practical travel advice for curated destinations — powered by AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body className="w-full max-w-full">{children}</body>
    </html>
  );
}
