import type { Metadata } from "next";
import "./globals.css";
import { copy } from "@/content/copy";

export const metadata: Metadata = {
  title: copy.name,
  description: copy.landing.hero.title,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Satoshi only, weights 300/400/500, never 700 (UI reference). */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
