import { writeFileSync, mkdirSync } from "fs";
import { runPerplexity } from "./adapters/perplexity";

async function main() {
  mkdirSync("out", { recursive: true });
  const queries = ["best ai referral tools", "how to track ai chat clicks"];
  for (const q of queries) {
    const { capture, citations } = await runPerplexity(q);
    const lines = [
      JSON.stringify({ capture }),
      ...citations.map(c => JSON.stringify({ citation: c }))
    ].join("\n") + "\n";
    writeFileSync(`out/${capture.id}.ndjson`, lines);
    console.log(`Wrote out/${capture.id}.ndjson`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
