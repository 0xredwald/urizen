import type { Metadata, Viewport } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

const SITE = "https://urizenfund.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "URIZEN · The AI-powered terminal for onchain RWAs",
    template: "%s · URIZEN",
  },
  description:
    "TradFi has Bloomberg, now crypto has Urizen. An AI-powered terminal for onchain real-world assets — 24/7 charts for tokenized stocks and ETFs, one-tap swaps, live prediction-market odds, and an agent that trades alongside you. $URI unlocks the desk.",
  keywords: [
    "URIZEN",
    "onchain terminal",
    "RWA terminal",
    "tokenized stocks",
    "real-world assets",
    "AI trading terminal",
    "Robinhood Chain",
    "onchain Bloomberg",
    "$URI",
  ],
  openGraph: {
    title: "URIZEN · The AI-powered terminal for onchain RWAs",
    description:
      "TradFi has Bloomberg, now crypto has Urizen. An AI-powered terminal for onchain RWAs — 24/7 charts, on-chain swaps, prediction-market odds, and an agent that trades alongside you.",
    url: SITE,
    siteName: "URIZEN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@urizenfund",
    creator: "@urizenfund",
    title: "URIZEN · The AI-powered terminal for onchain RWAs",
    description: "TradFi has Bloomberg, now crypto has Urizen. The AI-powered terminal for onchain real-world assets.",
  },
  icons: { icon: "/icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${inter.variable} ${spaceMono.variable}`}
    >
      <body className="grain min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
