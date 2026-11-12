import "server-only";
import type { Content, FunctionDeclaration } from "@google/genai";
import { z } from "zod";
import { requireEnv } from "./env";
import type { Generate } from "./agent/runAgent";
import { OpenRouterError } from "./errors";

const toolCallSchema = z.object({
  id: z.string().min(1), type: z.literal("function"),
  function: z.object({ name: z.string().min(1), arguments: z.string() }),
});
const responseSchema = z.object({
  model: z.string().optional(),
  choices: z.array(z.object({
    finish_reason: z.string().nullable().optional(),
    message: z.object({
      role: z.literal("assistant"), content: z.string().nullable().optional(),
      tool_calls: z.array(toolCallSchema).max(24).optional(), reasoning_details: z.unknown().optional(),
    }),
  })).min(1),
});
type Message = { role: string; content?: string | null; tool_calls?: z.infer<typeof toolCallSchema>[]; tool_call_id?: string; reasoning_details?: unknown };

export function toOpenRouterTools(declarations: FunctionDeclaration[]) {
  return declarations.map(d => ({ type: "function", function: { name: d.name, description: d.description, parameters: d.parametersJsonSchema } }));
}

// The same agent loop and clinic tools serve both transports. Original assistant
// turns retain raw arguments/reasoning so tool_call_id correlation stays exact.
export function createOpenRouterGenerate(deadline: number, fetcher: typeof fetch = fetch): Generate {
  const originals = new Map<string, Message>();
  return async (contents: Content[], declarations, prompt) => {
    const model = requireEnv("OPENROUTER_MODEL");
    const apiKey = requireEnv("OPENROUTER_API_KEY");
    // No random router, paid models, cross-model fallbacks or paid endpoints.
    if (!model.endsWith(":free")) throw new OpenRouterError(400);
    const messages: Message[] = [{ role: "system", content: prompt }];
    for (const turn of contents) {
      const parts = turn.parts ?? [];
      const calls = parts.flatMap(p => p.functionCall ? [p.functionCall] : []);
      const responses = parts.flatMap(p => p.functionResponse ? [p.functionResponse] : []);
      if (calls.length) {
        const original = calls[0].id && originals.get(calls[0].id);
        if (!original) throw new OpenRouterError(502);
        messages.push(original);
      } else if (responses.length) {
        for (const response of responses) {
          if (!response.id) throw new OpenRouterError(502);
          messages.push({ role: "tool", tool_call_id: response.id, content: JSON.stringify(response.response) });
        }
      } else messages.push({ role: turn.role === "model" ? "assistant" : "user", content: parts.map(p => p.text ?? "").join("\n") });
    }
    const body = JSON.stringify({ model, messages, tools: toOpenRouterTools(declarations), tool_choice: "auto", temperature: 0.2,
      max_tokens: 1800, provider: { require_parameters: true, max_price: { prompt: 0, completion: 0 } } });
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new OpenRouterError(504);
      try {
        const response = await fetcher("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-OpenRouter-Title": "CareSlot" },
          body, signal: AbortSignal.timeout(Math.min(20_000, remaining)),
        });
        // Never surface raw provider bodies, metadata, request URLs or API keys.
        if (!response.ok) throw new OpenRouterError(response.status);
        const parsed = responseSchema.safeParse(await response.json());
        if (!parsed.success) throw new OpenRouterError(502);
        if (parsed.data.model && parsed.data.model !== model) throw new OpenRouterError(502);
        const choice = parsed.data.choices[0], message = choice.message;
        if (choice.finish_reason === "length") throw new OpenRouterError(502);
        const calls = message.tool_calls ?? [];
        if (!calls.length && !message.content?.trim()) throw new OpenRouterError(502);
        if (new Set(calls.map(c => c.id)).size !== calls.length || calls.some(c => originals.has(c.id))) throw new OpenRouterError(502);
        for (const call of calls) originals.set(call.id, { role: "assistant", content: message.content ?? null, tool_calls: calls, ...(message.reasoning_details ? { reasoning_details: message.reasoning_details } : {}) });
        return { text: message.content ?? undefined, functionCalls: calls.map(c => {
          try { return { id: c.id, name: c.function.name, args: JSON.parse(c.function.arguments) as unknown }; }
          catch { return { id: c.id, name: c.function.name, invalidArguments: true }; }
        }) };
      } catch (error) {
        const safe = error instanceof OpenRouterError ? error : new OpenRouterError(error instanceof Error && /timeout|abort/i.test(error.name) ? 504 : 502);
        // Retry generation only. Never restart a turn or replay executed tools.
        if (attempt === 0 && [502, 503, 504].includes(safe.status) && deadline - Date.now() > 12_000) {
          await new Promise(resolve => setTimeout(resolve, 400 * 2 ** attempt)); continue;
        }
        throw safe;
      }
    }
    throw new OpenRouterError(503);
  };
}
