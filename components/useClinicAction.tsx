"use client";
import { useEffect, useRef, useState } from "react";
import type { ClinicAction } from "@/lib/schemas";
import type { Confirmation, MutationResult } from "@/lib/clinic-types";
import ConfirmationCard from "./ConfirmationCard";
import { notifyClinicChanged } from "./useClinicData";
export function useClinicAction() {
  const [pending, setPending] = useState<Confirmation>();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  async function prepare(action: ClinicAction) {
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not review this appointment.");
      setPending(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!pending || busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: pending.action, confirmation: pending.token }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not change this appointment.");
      const result = data as MutationResult;
      setMessage(`Appointment #${result.appointment.id} ${result.changed ? (pending.action.kind === "reschedule" ? "rescheduled" : result.appointment.status) : "is already in this state"}.`);
      setPending(undefined); notifyClinicChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  return { pending, busy, error, message, prepare, confirm, dismiss: () => { setPending(undefined); setError(""); } };
}
export function ActionFeedback({ action }: { action: ReturnType<typeof useClinicAction> }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!action.pending) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [action.pending]);
  return <>
    {action.message && <div role="status" className="notice success">{action.message}</div>}
    {action.error && !action.pending && <div role="alert" className="notice error">{action.error}</div>}
    {action.pending && <div className="modal-backdrop"><div ref={dialog} role="dialog" aria-modal="true" aria-label="Confirm appointment change" className="modal" onKeyDown={event => {
      if (event.key === "Escape" && !action.busy) action.dismiss();
      if (event.key === "Tab") {
        const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        if (!buttons?.length) { event.preventDefault(); return; }
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}><ConfirmationCard pending={action.pending} onConfirm={action.confirm} onDismiss={action.dismiss} busy={action.busy} />{action.error && <div className="notice error" role="alert">{action.error}</div>}</div></div>}
  </>;
}
