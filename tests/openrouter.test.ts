import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createOpenRouterGenerate } from "../lib/openrouter";
import { defineTool } from "../lib/agent/defineTool";
import { runAgentLoop } from "../lib/agent/runAgent";
import { OpenRouterError, publicAgentError } from "../lib/errors";

process.env.OPENROUTER_MODEL = "test/transport:free";
process.env.OPENROUTER_API_KEY = "isolated-transport-fixture";
const call = (id: string, name: string, args: string) => ({ id, type: "function", function: { name, arguments: args } });
const response = (calls?: ReturnType<typeof call>[]) => new Response(JSON.stringify({ model: "test/transport:free", choices: [{ finish_reason: calls ? "tool_calls" : "stop", message: { role: "assistant", content: calls ? null : "Done", ...(calls ? { tool_calls: calls } : {}) } }] }), { headers: { "Content-Type": "application/json" } });
const user = [{ role: "user" as const, text: "Find my appointment" }];

test("OpenRouter native multi-tool messages retain matching tool_call_id and zero-price routing", async () => {
  let requests = 0, reads = 0;
  const fetcher = (async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(String(options.body)); requests++;
    assert.equal(body.model, "test/transport:free"); assert.deepEqual(body.provider.max_price, { prompt: 0, completion: 0 });
    assert.ok(body.tools.every((t: { type: string }) => t.type === "function"));
    if (requests === 1) return response([call("c1", "first", '{"value":1}'), call("c2", "second", '{"value":2}')]);
    assert.deepEqual(body.messages.slice(-2).map((m: { tool_call_id: string }) => m.tool_call_id), ["c1", "c2"]);
    assert.equal(body.messages.at(-3).tool_calls.length, 2);
    return response();
  }) as typeof fetch;
  const tools = ["first", "second"].map(name => defineTool({ name, description: "Use this when reading", schema: z.strictObject({ value: z.number() }), run: args => { reads++; return Promise.resolve(args); } }));
  const result = await runAgentLoop(user, tools, "Read only", createOpenRouterGenerate(Date.now() + 10_000, fetcher));
  assert.equal(result.reply, "Done"); assert.equal(reads, 2); assert.equal(result.steps.length, 2);
});

test("OpenRouter malformed JSON and invalid Zod arguments never execute tools", async () => {
  let requests = 0, runs = 0;
  const fetcher = (async (_url: unknown, options: RequestInit) => {
    requests++;
    if (requests === 1) return response([call("bad-json", "read", "{broken"), call("bad-zod", "read", '{"value":"not-a-number"}'), call("null-args", "read", "null")]);
    const messages = JSON.parse(String(options.body)).messages;
    assert.ok(messages.slice(-3).every((m: { content: string }) => JSON.parse(m.content).error));
    assert.equal(messages.at(-4).tool_calls[0].function.arguments, "{broken");
    return response();
  }) as typeof fetch;
  const tool = defineTool({ name: "read", description: "Use this when reading", schema: z.strictObject({ value: z.number() }), run: async () => { runs++; } });
  const result = await runAgentLoop(user, [tool], "Read only", createOpenRouterGenerate(Date.now() + 10_000, fetcher));
  assert.equal(runs, 0); assert.equal(result.steps.filter(s => !s.ok).length, 3);
});

test("OpenRouter generation retry does not replay a completed write", async () => {
  let requests = 0, writes = 0;
  const fetcher = (async () => {
    requests++;
    if (requests === 1 || requests === 3) return new Response("private provider body", { status: 503 });
    return requests === 2 ? response([call("write-once", "write", "{}")]) : response();
  }) as typeof fetch;
  const tool = defineTool({ name: "write", description: "Use this when writing", writes: true, schema: z.strictObject({}), run: async () => { writes++; return { changed: true, appointment: { id: 42 } }; } });
  const result = await runAgentLoop(user, [tool], "Test-only confirmed write", createOpenRouterGenerate(Date.now() + 30_000, fetcher));
  assert.equal(writes, 1); assert.equal(result.steps.length, 1); assert.equal(requests, 4);
});

test("OpenRouter paid model selection is rejected before a request", async () => {
  const model = process.env.OPENROUTER_MODEL; process.env.OPENROUTER_MODEL = "test/paid";
  try { await assert.rejects(createOpenRouterGenerate(Date.now() + 1000)([], [], ""), OpenRouterError); }
  finally { process.env.OPENROUTER_MODEL = model; }
});

test("OpenRouter actionable errors never return provider bodies", () => {
  for (const status of [401, 402, 403, 404, 429, 502, 503, 504]) {
    const result = publicAgentError(new OpenRouterError(status));
    assert.match(result.error, new RegExp(String(status))); assert.ok(!result.error.includes(process.env.OPENROUTER_API_KEY!));
  }
});
