import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/*
 * Claude calls. Claude Sonnet generates courses (PLAN.md); Claude Haiku marks short answers and
 * runs the tutor (Haiku 5.5: about a tenth of Haiku 4.5's price per token).
 */

export const GENERATION_MODEL = "claude-sonnet-5";
export const MARKING_MODEL = "claude-haiku-5-5";
export type Model = typeof GENERATION_MODEL | typeof MARKING_MODEL;

// USD per million tokens (Haiku 5.5's rate for prompts up to 100K tokens; ours are far smaller).
// Cache writes cost 1.25x input for the 5-minute cache and 2x for the 1-hour cache; reads 0.1x.
// Check anthropic.com/pricing if these change.
const PRICES: Record<Model, { input: number; output: number }> = {
  [GENERATION_MODEL]: { input: 2, output: 10 },
  [MARKING_MODEL]: { input: 0.1, output: 0.5 },
};

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  /** All cache writes, both TTLs. */
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  /** The part of cache_creation_input_tokens written to the 1-hour cache (billed at 2x, not 1.25x). */
  cache_creation_1h_input_tokens?: number;
};

/** Usage from an API response, keeping the 1-hour cache writes separate for pricing. */
export function usageOf(u: Anthropic.Usage): Usage {
  return {
    input_tokens: u.input_tokens,
    output_tokens: u.output_tokens,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
    cache_creation_1h_input_tokens: u.cache_creation?.ephemeral_1h_input_tokens ?? 0,
  };
}

export function estimateCostUsd(u: Usage, model: Model = GENERATION_MODEL): number {
  const { input, output } = PRICES[model];
  const write1h = u.cache_creation_1h_input_tokens ?? 0;
  const write5m = u.cache_creation_input_tokens - write1h;
  return (
    (u.input_tokens * input +
      u.output_tokens * output +
      write5m * input * 1.25 +
      write1h * input * 2 +
      u.cache_read_input_tokens * input * 0.1) /
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
export const anthropic = () => (client ??= new Anthropic({ maxRetries: 4 }));

type StructuredCall<T extends z.ZodType> = {
  system: string;
  content: Anthropic.ContentBlockParam[];
  schema: T;
  maxTokens: number;
  /** Defaults to GENERATION_MODEL. */
  model?: Model;
  /** How much the model thinks (adaptive thinking; thinking counts toward maxTokens). Default medium. */
  effort?: "low" | "medium" | "high";
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
    model: call.model ?? GENERATION_MODEL,
    max_tokens: call.maxTokens,
    thinking: { type: "adaptive" },
    output_config: { effort: call.effort ?? "medium", format: outputFormat(call.schema) },
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

  const usage = usageOf(message.usage);
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
