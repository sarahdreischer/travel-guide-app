import type { Metadata } from "next";
import "./globals.css";

// Start scheduled reconciliation (server-side only, runs periodically)
import '@/lib/scheduled-reconciliation'
import { Geist, Fraunces } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Travel Guide — Practical, AI-powered trip advice",
  description:
    "Real-world, practical travel advice for curated destinations — powered by AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(
        "overflow-x-hidden bg-background font-sans",
        geist.variable,
        fraunces.variable
      )}
    >
      <body className="w-full max-w-full">{children}</body>
    </html>
  );
}
