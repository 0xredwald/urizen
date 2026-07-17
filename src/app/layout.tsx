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
    default: "URIZEN · The first autonomous fund on Robinhood Chain",
    template: "%s · URIZEN",
  },
  description:
    "Robinhood brought investing onchain. Urizen is the next step, the first autonomous fund on Robinhood Chain. A tokenized fund that allocates across stocks, real-world assets and crypto, 24/7, with one objective: maximize long-term returns.",
  keywords: [
    "URIZEN",
    "autonomous fund",
    "Robinhood Chain",
    "tokenized fund",
    "tokenized stocks",
    "real-world assets",
    "onchain investing",
    "onchain fund",
  ],
  openGraph: {
    title: "URIZEN · The first autonomous fund on Robinhood Chain",
    description:
      "A tokenized fund on Robinhood Chain that allocates across stocks, RWAs and crypto, 24/7, fully onchain and verifiable.",
    url: SITE,
    siteName: "URIZEN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@urizenfund",
    creator: "@urizenfund",
    title: "URIZEN · The first autonomous fund on Robinhood Chain",
    description: "Autonomous investing. A tokenized fund across stocks, RWAs and crypto.",
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
