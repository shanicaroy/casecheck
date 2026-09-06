import type { Metadata } from "next";
import "./globals.css";
import { copy } from "@/content/copy";

export const metadata: Metadata = {
  title: copy.name,
  description: copy.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
