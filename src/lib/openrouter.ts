import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AgentKey } from "@/lib/constants";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CallOptions = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Ask the model for strict JSON and parse it. */
  json?: boolean;
  /** Use the cheaper/faster model tier. */
  fast?: boolean;
};

export type CallResult<T = string> = {
  content: string;
  parsed: T | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  durationMs: number;
  simulated: boolean;
};

export function isOpenRouterConfigured(): boolean {
  return Boolean(readApiKey());
}

/** 引用符・Bearer・空白を除く。OPENAI_API_KEY を優先し、なければ OPENROUTER_API_KEY。 */
function cleanKey(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer\s+/i, "")
    .replace(/\s+/g, "");
}

function readApiKey(): string {
  return cleanKey(process.env.OPENAI_API_KEY) || cleanKey(process.env.OPENROUTER_API_KEY);
}

function isOpenAiKey(key: string): boolean {
  return key.startsWith("sk-proj-") || (key.startsWith("sk-") && !key.startsWith("sk-or-"));
}

function describeHttpError(provider: string, status: number, body: string): Error {
  if (status === 401 || status === 403) {
    return new Error(
      `${provider}のAPIキー認証に失敗しました。` +
        "OPENAI_API_KEY または OPENROUTER_API_KEY が実行時に渡っているか、キーが有効かを確認してください。",
    );
  }
  return new Error(`${provider} ${status}: ${body.slice(0, 400)}`);
}

/**
 * OpenRouter 既定モデル。テスト期間中の最小コスト構成。
 * OpenAI キー (sk-proj- / sk-) のときは mistral 名は使えないので gpt-4o-mini に切り替える。
 */
const DEFAULT_MODEL = "mistralai/mistral-small-24b-instruct-2501";
const DEFAULT_MODEL_FAST = "mistralai/mistral-nemo";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const OPENAI_DEFAULT_MODEL_FAST = "gpt-4o-mini";

/**
 * HTTPヘッダはLatin-1しか送れない。
 * OPENROUTER_SITE_NAME に日本語を入れると fetch が TypeError を投げるため、
 * 非ASCII文字を落としてから送る。
 */
function headerSafe(value: string, fallback: string): string {
  const cleaned = value.replace(/[^\x20-\x7E]/g, "").trim();
  return cleaned || fallback;
}

function defaultModel(fast?: boolean, openAi?: boolean) {
  const fromEnv = fast
    ? process.env.OPENAI_MODEL_FAST || process.env.OPENROUTER_MODEL_FAST
    : process.env.OPENAI_MODEL || process.env.OPENROUTER_MODEL;
  if (openAi) {
    if (fromEnv?.startsWith("openai/")) return fromEnv.slice("openai/".length);
    if (fromEnv && !fromEnv.includes("/")) return fromEnv;
    return fast ? OPENAI_DEFAULT_MODEL_FAST : OPENAI_DEFAULT_MODEL;
  }
  return fromEnv || (fast ? DEFAULT_MODEL_FAST : DEFAULT_MODEL);
}

/** Pull the first JSON object/array out of a model response. */
export function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // fall through to bracket scanning
  }

  const start = candidate.search(/[[{]/);
  if (start === -1) return null;
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Low-level OpenRouter call with retry + JSON parsing. */
export async function callModel<T = unknown>(
  opts: CallOptions,
): Promise<CallResult<T>> {
  const started = Date.now();
  const apiKey = readApiKey();
  const openAi = Boolean(apiKey) && isOpenAiKey(apiKey);
  const provider = openAi ? "OpenAI" : "OpenRouter";
  const endpoint = openAi ? OPENAI_ENDPOINT : OPENROUTER_ENDPOINT;
  const model = opts.model || defaultModel(opts.fast, openAi);

  if (!apiKey) {
    return {
      content: "",
      parsed: null,
      model,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      durationMs: Date.now() - started,
      simulated: true,
    };
  }

  const messages = [...opts.messages];
  if (opts.json) {
    const joined = messages.map((m) => m.content).join("\n");
    if (!/json/i.test(joined)) {
      messages[0] = {
        ...messages[0],
        content: `${messages[0]?.content ?? ""}\nRespond with a JSON object only.`,
      };
    }
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 3000,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (!openAi) {
    headers["HTTP-Referer"] = headerSafe(
      process.env.OPENROUTER_SITE_URL ?? "",
      "http://localhost:3000",
    );
    headers["X-Title"] = headerSafe(process.env.OPENROUTER_SITE_NAME ?? "", "AI Koho");
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const text = await res.text();
        // 4xx other than rate limiting will not get better on retry
        if (res.status !== 429 && res.status < 500) {
          throw describeHttpError(provider, res.status, text);
        }
        lastError = describeHttpError(provider, res.status, text);
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }

      const data = await res.json();
      const choice = data?.choices?.[0];
      const content: string = choice?.message?.content ?? "";
      const usage = data?.usage ?? {};

      // 推論(reasoning)型のモデルは、思考だけで max_tokens を使い切り
      // 本文が空のまま HTTP 200 を返すことがある。黙って握りつぶすと
      // 「AIが動いていないのに成功扱い」になるため、失敗として扱う。
      if (!content.trim()) {
        throw new Error(
          `${provider} returned an empty response from ${data?.model ?? model} ` +
            `(finish_reason=${choice?.finish_reason ?? "unknown"}, ` +
            `completion_tokens=${usage.completion_tokens ?? 0}). ` +
            `推論型モデルの場合は max_tokens を増やすか、非推論モデルを指定してください。`,
        );
      }

      return {
        content,
        parsed: opts.json ? extractJson<T>(content) : null,
        model: data?.model || model,
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        costUsd: Number(usage.cost ?? 0),
        durationMs: Date.now() - started,
        simulated: false,
      };
    } catch (err) {
      lastError = err;
      if (attempt === 2) break;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${provider} call failed`);
}

export type AgentRunInput = {
  agent: AgentKey;
  task: string;
  system: string;
  user: string;
  orgId?: string | null;
  subjectId?: string | null;
  json?: boolean;
  fast?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Used when OPENROUTER_API_KEY is absent so the product stays demonstrable. */
  fallback?: () => unknown;
};

/**
 * Runs one of the six specialist agents and records the run in `ai_runs`
 * so cost, latency and output stay auditable.
 */
export async function runAgent<T = unknown>(
  input: AgentRunInput,
): Promise<{ result: T | null; text: string; simulated: boolean; runId: string | null }> {
  const started = Date.now();
  let runId: string | null = null;

  try {
    const res = await callModel<T>({
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      json: input.json,
      fast: input.fast,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });

    if (res.simulated) {
      const fb = (input.fallback?.() ?? null) as T | null;
      runId = await logRun({
        ...input,
        model: "simulated",
        ok: true,
        output: fb,
        durationMs: Date.now() - started,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
      });
      return {
        result: fb,
        text: typeof fb === "string" ? fb : JSON.stringify(fb ?? {}),
        simulated: true,
        runId,
      };
    }

    const parsed = input.json ? res.parsed : (res.content as unknown as T);

    runId = await logRun({
      ...input,
      model: res.model,
      ok: true,
      output: parsed,
      durationMs: res.durationMs,
      promptTokens: res.promptTokens,
      completionTokens: res.completionTokens,
      costUsd: res.costUsd,
    });

    return { result: parsed, text: res.content, simulated: false, runId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    runId = await logRun({
      ...input,
      model: "error",
      ok: false,
      error: message,
      output: null,
      durationMs: Date.now() - started,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
    });

    // Never let a model outage take the product down — degrade to the fallback.
    const fb = (input.fallback?.() ?? null) as T | null;
    if (fb !== null) {
      return { result: fb, text: JSON.stringify(fb), simulated: true, runId };
    }
    throw err;
  }
}

async function logRun(row: {
  agent: AgentKey;
  task: string;
  orgId?: string | null;
  subjectId?: string | null;
  system: string;
  user: string;
  model: string;
  ok: boolean;
  error?: string;
  output: unknown;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}): Promise<string | null> {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("ai_runs")
      .insert({
        org_id: row.orgId ?? null,
        subject_id: row.subjectId ?? null,
        agent: row.agent,
        task: row.task,
        model: row.model,
        input: { system: row.system.slice(0, 4000), user: row.user.slice(0, 8000) },
        output: safeJson(row.output),
        prompt_tokens: row.promptTokens,
        completion_tokens: row.completionTokens,
        cost_usd: row.costUsd,
        duration_ms: row.durationMs,
        ok: row.ok,
        error: row.error ?? null,
      })
      .select("id")
      .single();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

function safeJson(value: unknown) {
  if (value === null || value === undefined) return {};
  if (typeof value === "string") return { text: value.slice(0, 20000) };
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {};
  }
}
