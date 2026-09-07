/**
 * Run the pipeline from the terminal and print every event:
 *
 *   npm run check -- https://someone.framer.website/case-study-01 [--current junior] [--target mid]
 *
 * Needs ANTHROPIC_API_KEY (put it in .env.local; the script loads that file).
 */
import { runPipeline } from "../pipeline/run";
import { isLevel } from "../lib/levels";

const url = process.argv[2];
const flag = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  return isLevel(value) ? value : undefined;
};
if (!url) {
  console.error("Usage: npm run check -- <url>");
  process.exit(2);
}

for await (const event of runPipeline(url, { currentLevel: flag("current"), targetLevel: flag("target") })) {
  if (event.type === "step" && event.status === "running") {
    console.error(`▶ ${event.step}…`);
    continue;
  }
  console.log(JSON.stringify(event, null, 2));
}
