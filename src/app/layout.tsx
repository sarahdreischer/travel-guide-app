import type { Metadata } from "next";
import "./globals.css";
import CookieBanner from '@/components/CookieBanner'

export const metadata: Metadata = {
  title: "Trip Guide",
  description:
    "Real-world, practical travel briefing for curated destinations — powered by AI.",
  icons: {
    icon: "/app-icon.png",
    apple: "/app-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
