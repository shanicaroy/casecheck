/** Small display helpers shared by the views. No React, no state. */
import { copy } from "@/content/copy";
import { PASTED_SOURCE } from "@/src/steps/pasted";

/** "https://name.framer.website/relay/" → "name.framer.website/relay". */
export function displaySource(url: string): string {
  if (url === PASTED_SOURCE) return "";
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The path part of a link, for the clarify cards. */
export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname : u.pathname;
  } catch {
    return url;
  }
}

/** "mid" → "Mid-level". Unknown values pass through. */
export function levelWord(level: string): string {
  return (copy.landing.levels as Record<string, string>)[level] ?? level;
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function capital(t: string): string {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

export function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
