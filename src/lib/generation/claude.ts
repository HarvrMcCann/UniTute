import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/*
 * Claude calls for course generation. Claude Sonnet generates courses (PLAN.md);
 * the tutor will use Claude Haiku in phase 7.
 */

export const GENERATION_MODEL = "claude-sonnet-5";

// USD per million tokens for GENERATION_MODEL. Check anthropic.com/pricing if these change.
const PRICE = { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 };

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
};

export function estimateCostUsd(u: Usage): number {
  return (
    (u.input_tokens * PRICE.input +
      u.output_tokens * PRICE.output +
      u.cache_creation_input_tokens * PRICE.cacheWrite +
      u.cache_read_input_tokens * PRICE.cacheRead) /
    1_000_000
  );
}

/** A failure that retrying won't fix (refusal, output cut off). */
export class GenerationError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ maxRetries: 4 }));

type StructuredCall<T extends z.ZodType> = {
  system: string;
  content: Anthropic.ContentBlockParam[];
  schema: T;
  maxTokens: number;
  effort: "low" | "medium" | "high";
  /** Called as soon as the response arrives, before validation, so failed calls are still counted. */
  onUsage?: (usage: Usage, durationMs: number) => Promise<void>;
  /** Custom validation (e.g. item-by-item, dropping bad items). Defaults to schema.safeParse. */
  parse?: (json: unknown) => z.infer<T> | null;
};

/**
 * The JSON schema Claude must follow, WITHOUT the SDK's built-in parser attached: that parser
 * throws on the first invalid item and loses the whole response. We validate ourselves.
 */
function outputFormat(schema: z.ZodType) {
  const { type, schema: jsonSchema } = zodOutputFormat(schema);
  return { type, schema: jsonSchema };
}

/**
 * One streamed request with structured JSON output, validated against `schema`.
 * The system prompt is cached (it's identical across courses); callers put a
 * cache_control breakpoint on their own shared content too.
 */
export async function callStructured<T extends z.ZodType>(
  call: StructuredCall<T>,
): Promise<{ data: z.infer<T>; usage: Usage; durationMs: number }> {
  const started = Date.now();
  const stream = anthropic().messages.stream({
    model: GENERATION_MODEL,
    max_tokens: call.maxTokens,
    thinking: { type: "adaptive" },
    output_config: { effort: call.effort, format: outputFormat(call.schema) },
    system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: call.content }],
  });

  let message: Anthropic.Message;
  try {
    message = await stream.finalMessage();
  } catch (error) {
    // Bad requests (e.g. a malformed PDF) won't improve on retry; rate limits and 5xx will.
    if (error instanceof Anthropic.BadRequestError) throw new GenerationError(`Claude rejected the request: ${error.message}`, false);
    throw error;
  }

  const usage: Usage = {
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
    cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
  };
  await call.onUsage?.(usage, Date.now() - started);

  if (message.stop_reason === "refusal") {
    throw new GenerationError(`Claude declined this part (${message.stop_details?.category ?? "no category"})`, false);
  }
  if (message.stop_reason === "max_tokens") {
    throw new GenerationError("The response was cut off before it finished", true);
  }

  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GenerationError("Claude's response wasn't valid JSON", true);
  }
  if (call.parse) {
    const data = call.parse(json);
    if (data === null) throw new GenerationError("Claude's response didn't match the format", true);
    return { data, usage, durationMs: Date.now() - started };
  }
  const parsed = call.schema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`Claude's response didn't match the format: ${parsed.error.message.slice(0, 300)}`, true);

  return { data: parsed.data, usage, durationMs: Date.now() - started };
}
