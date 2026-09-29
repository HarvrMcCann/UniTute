/**
 * Checks each generation schema compiles as a structured-output grammar on the API
 * (the API rejects grammars that are too large). Run after changing any generation schema.
 * Each check is a tiny request cut off after a few tokens: about US$0.01 in total.
 *
 * Usage: npm run check:grammar
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { GENERATION_MODEL } from "../src/lib/generation/claude";
import { outlineSchema, widgetBuildSchema } from "../src/lib/generation/schemas";
import { lessonWireSchema } from "../src/lib/generation/wire";

const SCHEMAS: [string, z.ZodType][] = [
  ["outline", outlineSchema],
  ["lesson", lessonWireSchema],
  ["widget", widgetBuildSchema],
];

async function main() {
  const client = new Anthropic();
  let failed = 0;
  for (const [name, schema] of SCHEMAS) {
    const { type, schema: jsonSchema } = zodOutputFormat(schema);
    const chars = JSON.stringify(jsonSchema).length;
    try {
      await client.messages.create({
        model: GENERATION_MODEL,
        max_tokens: 20,
        output_config: { effort: "low", format: { type, schema: jsonSchema } },
        messages: [{ role: "user", content: "Reply with a minimal valid object." }],
      });
      console.log(`ok       ${name} (schema ${chars.toLocaleString()} chars)`);
    } catch (error) {
      failed++;
      console.log(`REJECTED ${name} (schema ${chars.toLocaleString()} chars): ${error instanceof Error ? error.message.slice(0, 160) : error}`);
    }
  }
  process.exitCode = failed ? 1 : 0;
}

main();
