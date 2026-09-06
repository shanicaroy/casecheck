/**
 * Run step 1 by hand from the terminal:
 *
 *   npm run fetch -- https://someone.framer.website/case-study-01
 *
 * Prints the full result as JSON so you can see exactly what later steps will
 * be given. Nothing here is user-facing UI.
 */
import { fetchPage } from "../steps/fetch";

const url = process.argv[2];
if (!url) {
  console.error("Usage: npm run fetch -- <url>");
  process.exit(2);
}

const result = await fetchPage(url);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
