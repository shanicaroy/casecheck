/**
 * The one place the app talks to Claude.
 *
 * Every step that needs a model asks for a tier (cheap or strong), gives a
 * system prompt, a user message, and a Zod schema describing the exact shape
 * of the answer it needs. The API is asked for structured output matching
 * that schema, so the step gets back typed data, never free prose to parse.
 *
 * Usage (model, tokens, time) is returned with every call so the run log can
 * record cost per step, as the evaluation sheet §7 requires.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";
import { models, type Tier } from "../../config/models";

export interface ModelUsage {
  tier: Tier;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  durationMs: number;
}

export interface CallImage {
  /** Text shown to the model just before the image, e.g. "Image 3 of 5: alt 'Research map', 40% down the page". */
  label: string;
  mediaType: "image/jpeg" | "image/png";
  data: string;
}

export interface StructuredCall<T> {
  tier: Tier;
  system: string;
  user: string;
  /** Page images for vision. Each is placed after the text, with its label. */
  images?: CallImage[];
  schema: ZodType<T>;
  /** low for cheap classification-type work, high for judgement. Default: high. */
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

export type CallModel = <T>(call: StructuredCall<T>) => Promise<{ data: T; usage: ModelUsage }>;

export class ModelError extends Error {
  constructor(message: string, public readonly kind: "not_configured" | "refusal" | "invalid_output" | "api") {
    super(message);
  }
}

export function modelFor(tier: Tier): string {
  const override = tier === "cheap" ? process.env.CASECHECK_CHEAP_MODEL : process.env.CASECHECK_STRONG_MODEL;
  return override || models[tier];
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ModelError("ANTHROPIC_API_KEY is not set on this server.", "not_configured");
  }
  client ??= new Anthropic({ timeout: 240_000, maxRetries: 2 });
  return client;
}

export const callModel: CallModel = async (call) => {
  const started = Date.now();
  const model = modelFor(call.tier);
  const anthropic = getClient();

  const content: Anthropic.ContentBlockParam[] = [{ type: "text", text: call.user }];
  for (const img of call.images ?? []) {
    content.push({ type: "text", text: img.label });
    content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
  }

  let response;
  try {
    response = await anthropic.messages.parse({
      model,
      max_tokens: call.maxTokens ?? 8_000,
      system: call.system,
      messages: [{ role: "user", content }],
      output_config: {
        format: zodOutputFormat(call.schema),
        effort: call.effort ?? "high",
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new ModelError(`Claude API error ${err.status}: ${err.message}`, "api");
    }
    throw err;
  }

  if (response.stop_reason === "refusal") {
    throw new ModelError("The model declined this request.", "refusal");
  }
  if (!response.parsed_output) {
    throw new ModelError("The model's answer did not match the expected shape.", "invalid_output");
  }

  return {
    data: response.parsed_output,
    usage: {
      tier: call.tier,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      durationMs: Date.now() - started,
    },
  };
};
