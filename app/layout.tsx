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
        {/* The UXPective mark, defined once, used by the avatar, the header brand and the reviewing orb. */}
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <linearGradient id="ux-g" x1="256" y1="8.86594" x2="256" y2="503.134" gradientUnits="userSpaceOnUse">
              <stop offset="0.0913462" stopColor="#FF9162" /><stop offset="0.543269" stopColor="#D87CFF" /><stop offset="0.990385" stopColor="#32B7FF" />
            </linearGradient>
            <symbol id="ux-mark" viewBox="0 0 512 512">
              <ellipse cx="256" cy="256" rx="247.134" ry="247.134" transform="rotate(87.9058 256 256)" fill="url(#ux-g)" />
              <path d="M129.602 273.341C132.993 306.727 163.204 374.685 256.92 379.431C292.995 381.661 368.619 363.565 382.516 273.341" stroke="white" strokeWidth="72" strokeLinecap="round" />
            </symbol>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  );
}
