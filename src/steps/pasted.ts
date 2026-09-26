/**
 * The fallback intake (contract §5): when a page can't be read, the designer
 * can paste the case study's text and, optionally, add screenshots. This turns
 * that input into the same shape the fetch step produces, so every later step
 * runs unchanged. Nothing is fetched and nothing is stored (§9).
 */
import type { CapturedImage, FetchOk } from "./fetch";
import { cleanText, wordCount } from "../lib/text";

/** Stands in for a URL wherever the pipeline records where the text came from. */
export const PASTED_SOURCE = "pasted:text";

export interface PastedImage {
  /** Base64 JPEG, already downscaled in the browser. */
  data: string;
  width: number;
  height: number;
}

export interface PastedInput {
  text: string;
  images?: PastedImage[];
}

export function fromPasted(input: PastedInput, imageCap: number): FetchOk {
  const text = cleanText(input.text);
  const words = wordCount(text);
  const firstLine = input.text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  const shots = (input.images ?? []).slice(0, imageCap);
  const images: CapturedImage[] = shots.map((img, i) => ({
    index: i + 1,
    alt: `Screenshot ${i + 1}`,
    width: img.width,
    height: img.height,
    position: (i + 1) / (shots.length + 1),
    // Screenshots are added because the text is thin there, so they are read first.
    nearbyWords: 0,
    mediaType: "image/jpeg",
    data: img.data,
  }));
  return {
    ok: true,
    requestedUrl: PASTED_SOURCE,
    finalUrl: PASTED_SOURCE,
    status: 200,
    title: firstLine.slice(0, 120) || "Pasted case study",
    text,
    wordCount: words,
    imageCount: images.length,
    narrativeWordCount: words,
    links: [],
    images,
    imageCandidates: images.length,
    embeds: [],
    fetchedAt: new Date().toISOString(),
    durationMs: 0,
  };
}
