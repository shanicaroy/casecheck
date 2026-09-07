/**
 * Run the pipeline from the terminal and print every event:
 *
 *   npm run check -- https://someone.framer.website/case-study-01
 *
 * Needs ANTHROPIC_API_KEY (put it in .env.local; the script loads that file).
 */
import { runPipeline } from "../pipeline/run";

const url = process.argv[2];
if (!url) {
  console.error("Usage: npm run check -- <url>");
  process.exit(2);
}

for await (const event of runPipeline(url)) {
  if (event.type === "step" && event.status === "running") {
    console.error(`▶ ${event.step}…`);
    continue;
  }
  console.log(JSON.stringify(event, null, 2));
}
