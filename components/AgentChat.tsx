"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AgentResult, AgentStep } from "@/lib/agent/types";
import type { Confirmation, MutationResult } from "@/lib/clinic-types";
import { formatClinicDate, formatClinicTime } from "@/lib/dates";
import ConfirmationCard from "./ConfirmationCard";
import { notifyClinicChanged } from "./useClinicData";
import { Icon } from "./Icons";
type Message = { role: "user" | "model"; text: string; steps?: AgentStep[] };
const prompts = [
  { title: "Find the right doctor", text: "I have a skin rash. Help me find a doctor on Friday morning.", icon: "doctors" as const },
  { title: "Move my appointment", text: "Move my upcoming appointment to the next free slot.", icon: "calendar" as const },
  { title: "Find a Tamil-speaking doctor", text: "Which Tamil-speaking doctors have free slots tomorrow?", icon: "chat" as const },
];
function pendingResult(step: AgentStep): Confirmation | undefined {
  const r = step.result as Confirmation | undefined;
  return step.ok && r?.requires_confirmation ? r : undefined;
}
function ToolSteps({ steps }: { steps: AgentStep[] }) {
  return <div className="tool-steps" aria-label="Agent tool calls">{steps.map((s, i) => {
    const pending = pendingResult(s), result = pending ? { ...pending, token: "[confirmation token hidden]" } : s.result;
    return <details key={i}><summary><span className={s.ok ? "tool-ok" : "tool-failed"}>{pending ? "Review" : s.ok ? "Done" : "Failed"}</span><span className="tool-name">{s.tool}</span><span className="tool-type">{s.writes ? "WRITE" : "READ"}</span></summary><pre>{JSON.stringify({ args: s.args, ...(s.ok ? { result } : { error: s.error }) }, null, 2)}</pre></details>;
  })}</div>;
}
export default function AgentChat({ onDataChanged, provider = "gemini" }: { onDataChanged?: () => void; provider?: "gemini" | "openrouter" }) {
  const [messages, setMessages] = useState<Message[]>([]), [input, setInput] = useState("");
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [handled, setHandled] = useState<string[]>([]);
  const bottom = useRef<HTMLDivElement>(null), inFlight = useRef(false);
  useEffect(() => { if (messages.length) bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, loading]);
  async function send(text: string, pending?: Confirmation) {
    if (!text.trim() || inFlight.current) return;
    inFlight.current = true;
    const next: Message[] = [...messages, { role: "user", text: text.trim() }];
    setMessages(next); setInput(""); setLoading(true); setError("");
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        messages: next.slice(-20).map(({ role, text }) => ({ role, text })), ...(pending ? { confirmation: pending.token } : {}),
      }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not reach CareSlot.");
      const result = data as AgentResult;
      setMessages([...next, { role: "model", text: result.reply, steps: result.steps }]);
      const wrote = result.steps.some(s => s.ok && s.writes && Boolean((s.result as MutationResult)?.appointment?.id));
      if (pending && wrote) setHandled(v => [...v, pending.token]);
      if (wrote) { notifyClinicChanged(); onDataChanged?.(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Please try again."); }
    finally { setLoading(false); inFlight.current = false; }
  }
  return <section className="chat-panel panel" aria-label="Booking chat">
    <div className="chat-header"><span className="assistant-icon"><Icon name="plus" size={23} /></span><div><h2>Your CareSlot assistant</h2><p><span className="status-dot" />Powered by {provider === "openrouter" ? "OpenRouter" : "Gemini"} · Real clinic availability</p></div><span className="badge neutral">AI ASSISTANT</span></div>
    <div className="chat-scroll" role="log" aria-live="polite" aria-relevant="additions">
      {!messages.length && <div className="chat-welcome"><span className="welcome-symbol"><Icon name="chat" size={30} /></span><span className="eyebrow">A LITTLE HELP, A LOT LESS WAITING</span><h2>How can I help you today?</h2><p>Find a doctor, book your next visit, or make a change.<br />Just tell me what you need.</p><div className="suggested-prompts">{prompts.map(p => <button type="button" key={p.title} onClick={() => send(p.text)}><Icon name={p.icon} size={20} /><span><strong>{p.title}</strong><small>{p.text}</small></span><Icon name="arrow" size={17} /></button>)}</div></div>}
      {messages.map((m, i) => <div className={m.role === "user" ? "message user-message" : "message assistant-message"} key={i}>
        {m.role === "model" && <span className="message-avatar"><Icon name="plus" size={17} /></span>}
        <div className="message-content">{m.steps?.length ? <ToolSteps steps={m.steps} /> : null}<div className="message-bubble">{m.text}</div>
        {m.steps?.map((s, j) => {
          const pending = pendingResult(s), receipt = s.result as MutationResult | undefined;
          if (pending) return <ConfirmationCard key={j} pending={pending} busy={loading} done={handled.includes(pending.token)} onDismiss={() => setHandled(v => [...v, pending.token])} onConfirm={() => send(`I confirm the ${pending.action.kind} action for ${pending.doctor}, ${formatClinicDate(pending.date)}, ${formatClinicTime(pending.time)} IST.`, pending)} />;
          return s.ok && s.writes && receipt?.appointment?.id ? <div className="write-receipt" key={j}><Icon name="check" size={18} /><div><strong>{receipt.changed ? "Database confirmed" : "No further change needed"}</strong><p>Appointment #{receipt.appointment.id} · {receipt.appointment.status}</p><Link href="/appointments" className="text-link">View My Appointments <Icon name="arrow" size={14} /></Link></div></div> : null;
        })}</div>
      </div>)}
      {loading && <div className="thinking" role="status"><span /><span /><span /><span>CareSlot is checking…</span></div>}
      {error && <div className="notice error" role="alert">{error}</div>}<div ref={bottom} />
    </div>
    <div className="chat-composer"><form onSubmit={e => { e.preventDefault(); void send(input); }}><label className="sr-only" htmlFor="chat-input">Your appointment request</label><textarea id="chat-input" rows={2} value={input} maxLength={4000} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); } }} placeholder="Ask about a doctor, a time, or your next visit…" disabled={loading} /><button type="submit" className="send-button" disabled={loading || !input.trim()} aria-label="Send message"><Icon name="arrow" size={21} /></button></form><p><Icon name="shield" size={13} />Appointment help only. No diagnoses or medicine recommendations.</p></div>
  </section>;
}
