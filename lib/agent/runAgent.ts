import "server-only";
import type { Content, FunctionDeclaration, Part } from "@google/genai";
import { getGemini } from "../gemini";
import { getGeminiModel } from "../env";
import type { ChatMessage } from "../schemas";
import { createClinicTools } from "./tools";
import { toFunctionDeclarations, type AgentTool } from "./defineTool";
import { buildSystemPrompt } from "./systemPrompt";
import { readConfirmation } from "../confirmation";
import { publicError } from "../errors";
import type { AgentResult, AgentStep } from "./types";

const MAX_ROUNDS = 8;
type ModelResponse = { functionCalls?: { name?: string; args?: Record<string, unknown>; id?: string }[]; text?: string; candidates?: { content?: Content }[] };
export type Generate = (contents: Content[], declarations: FunctionDeclaration[], prompt: string) => Promise<ModelResponse>;

export async function runAgent(messages: ChatMessage[], confirmation?: string): Promise<AgentResult> {
  const approved = confirmation ? readConfirmation(confirmation).action : undefined;
  const tools = createClinicTools(confirmation);
  const ai = getGemini();
  const model = getGeminiModel();
  const deadline = Date.now() + 50_000;
  const result = await runAgentLoop(messages, tools, buildSystemPrompt(approved), (contents, functionDeclarations, systemInstruction) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Agent time budget reached");
    return ai.models.generateContent({ model, contents, config: {
      systemInstruction, tools: [{ functionDeclarations }], temperature: 0.2,
      httpOptions: { timeout: Math.min(25_000, remaining) },
    } });
  });
  if (approved && !result.steps.some(s => s.ok && s.writes && Boolean((s.result as { appointment?: { id?: number } })?.appointment?.id))) {
    result.reply = "No appointment change was confirmed by the database. Review the tool results below, or try again from My Appointments.";
  }
  return result;
}

// Dependency injection is for isolated tests only. Production always uses Gemini above.
export async function runAgentLoop(messages: ChatMessage[], tools: AgentTool[], prompt: string, generate: Generate): Promise<AgentResult> {
  const steps: AgentStep[] = [];
  const functionDeclarations = toFunctionDeclarations(tools);
  const contents: Content[] = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
  for (let round = 0; round < MAX_ROUNDS; round++) {
    let response: ModelResponse;
    try { response = await generate(contents, functionDeclarations, prompt); }
    catch (error) {
      // A provider failure after a database commit must not hide the tool receipt.
      if (steps.length) return {
        reply: "The AI response was interrupted. Review the tool results below and refresh My Appointments before retrying a change.",
        steps,
      };
      throw error;
    }
    const calls = response.functionCalls ?? [];
    if (!calls.length) return { reply: response.text?.trim() || "Please tell me the doctor or appointment you need help with.", steps };
    const modelTurn = response.candidates?.[0]?.content;
    contents.push(modelTurn ?? { role: "model", parts: calls.map(c => ({ functionCall: c })) });
    const responseParts: Part[] = [];
    for (const call of calls) {
      if (steps.length >= 24) return { reply: "This request needs too many lookups. Please narrow the doctor or date.", steps };
      const step = await runTool(tools, call.name ?? "", call.args ?? {});
      steps.push(step);
      responseParts.push({ functionResponse: { id: call.id, name: call.name, response: step.ok ? { result: step.result } : { error: step.error } } });
    }
    contents.push({ role: "user", parts: responseParts });
  }
  return { reply: "I reached the step limit. Check the tool results and My Appointments before trying a more specific request.", steps };
}
export async function runTool(tools: AgentTool[], name: string, rawArgs: unknown): Promise<AgentStep> {
  const tool = tools.find(t => t.name === name);
  if (!tool) return { tool: name, args: rawArgs, ok: false, writes: false, error: "Unknown tool." };
  const parsed = tool.schema.safeParse(rawArgs);
  if (!parsed.success) return { tool: name, args: rawArgs, ok: false, writes: tool.writes, error: "Invalid arguments: " + parsed.error.issues.map(i => i.path.join(".") + ": " + i.message).join("; ") };
  try { return { tool: name, args: parsed.data, ok: true, writes: tool.writes, result: await tool.run(parsed.data) }; }
  catch (err) { return { tool: name, args: parsed.data, ok: false, writes: tool.writes, error: publicError(err).error }; }
}
