import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TopSim — Satisfying Ball Simulations for Shorts",
  description:
    "30+ physics-based, oddly satisfying ball simulations in 9:16 with procedural ASMR audio and automatic video recording for YouTube Shorts & Reels.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#050509",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="overflow-hidden antialiased">{children}</body>
    </html>
  );
}
