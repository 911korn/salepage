// Free-first LLM routing.
//
// Every Claude call goes to OpenRouter's free "stealth/union-alpha" first and falls back
// to this project's own ANTHROPIC_API_KEY the moment OpenRouter is unavailable.
// union-alpha is a stealth model and OpenRouter retires those without notice, so the paid
// key stays wired in and takes over on the first failure (then again 5 min later).
//
// Call sites are untouched: routedAnthropic() returns an object shaped like an Anthropic
// SDK client, so `client.messages.create({ model: CLAUDE_MODEL, ... })` keeps working and
// the model name is swapped underneath.

import Anthropic from "@anthropic-ai/sdk";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api";
const COOLDOWN_MS = 5 * 60 * 1000;

// Clients are cached per API-key value, not just "once": a rotated key in the
// environment has to build a new client instead of silently reusing the old one.
let freeClient: Anthropic | null = null;
let freeClientKey = "";
let paidClient: Anthropic | null = null;
let paidClientKey = "";
let freeBlockedUntil = 0;

function freeModel(): string {
  return process.env.OPENROUTER_MODEL || "stealth/union-alpha";
}

function free(): Anthropic | null {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || Date.now() < freeBlockedUntil) return null;
  if (!freeClient || freeClientKey !== apiKey) {
    freeClient = new Anthropic({ apiKey, baseURL: OPENROUTER_BASE_URL });
    freeClientKey = apiKey;
  }
  return freeClient;
}

function paid(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!paidClient || paidClientKey !== apiKey) {
    paidClient = new Anthropic({ apiKey });
    paidClientKey = apiKey;
  }
  return paidClient;
}

// union-alpha accepts max_tokens / temperature / top_p / tools / tool_choice /
// response_format. Anthropic-only fields are dropped so they can never 400 the request.
function asFree(params: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...params, model: freeModel() };
  delete next.thinking;
  delete next.betas;
  delete next.stop_sequences;
  // Anthropic's strict grammar. union-alpha has no strict-schema mode, so ask for
  // plain JSON instead of sending a field the endpoint would reject.
  if (next.output_config) {
    const format = (next.output_config as { format?: { type?: string } } | undefined)?.format;
    if (format?.type === "json_schema" && !next.response_format) {
      next.response_format = { type: "json_object" };
    }
    delete next.output_config;
  }
  return next;
}

function stepAside(err: unknown): void {
  freeBlockedUntil = Date.now() + COOLDOWN_MS;
  freeClient = null;
  freeClientKey = "";
  const status = (err as { status?: number } | null)?.status;
  console.warn(
    `[ai] openrouter ${freeModel()} unavailable (${status ?? "network"}) - using ANTHROPIC_API_KEY for the next 5 min`,
  );
}

function noKeys(): Error {
  return new Error("No LLM key configured - set OPENROUTER_API_KEY or ANTHROPIC_API_KEY");
}

/** True when either the free route or the paid key can serve a request. */
export function hasLlmKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY);
}

/** Which route the next call would take - for health endpoints and tests. */
export function activeLlmRoute(): "openrouter" | "anthropic" | "none" {
  if (free()) return "openrouter";
  if (paid()) return "anthropic";
  return "none";
}

export function routedAnthropic(): Anthropic {
  return {
    messages: {
      async create(params: Record<string, unknown>) {
        const f = free();
        if (f) {
          try {
            return await f.messages.create(asFree(params) as never);
          } catch (err) {
            stepAside(err);
          }
        }
        const p = paid();
        if (!p) throw noKeys();
        return p.messages.create(params as never);
      },
      stream(params: Record<string, unknown>) {
        const f = free();
        if (f) {
          const s = f.messages.stream(asFree(params) as never);
          // A stream that dies mid-flight cannot be retried transparently, but the next
          // call must not walk into the same wall.
          s.on("error", stepAside);
          return s;
        }
        const p = paid();
        if (!p) throw noKeys();
        return p.messages.stream(params as never);
      },
    },
  } as unknown as Anthropic;
}
