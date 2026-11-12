"use client";
import type { Confirmation } from "@/lib/clinic-types";
import { formatClinicDate, formatClinicTime } from "@/lib/dates";
import { Icon } from "./Icons";
export default function ConfirmationCard({ pending, onConfirm, onDismiss, busy, done }: { pending: Confirmation; onConfirm: () => void; onDismiss?: () => void; busy?: boolean; done?: boolean }) {
  return <section className="confirmation-card" aria-label="Review appointment change">
    <div className="eyebrow"><Icon name="shield" size={16} /> YOUR CONFIRMATION REQUIRED</div>
    <h3>{pending.title}</h3><strong>{pending.doctor}</strong><p>{pending.department} · Room {pending.room}</p>
    <div className="confirmation-date"><Icon name="calendar" size={18} /><span>{formatClinicDate(pending.date)}<br /><b>{formatClinicTime(pending.time)} IST</b></span></div>
    {pending.previous_date && <p className="muted">Moving from {formatClinicDate(pending.previous_date)} at {formatClinicTime(pending.previous_time!)}.</p>}
    <p>{pending.action.kind === "cancel" ? "Your slot will be released." : `Consultation fee: ₹${pending.fee.toLocaleString("en-IN")}`}{pending.appointment_id ? ` · Appointment #${pending.appointment_id}` : ""}</p>
    {pending.action.kind === "book" && pending.action.reason && <p className="reason-text">Reason: {pending.action.reason}</p>}
    <p className="small muted">Availability is checked again when you confirm. No payment is collected here.</p>
    <div className="button-row"><button type="button" className={pending.action.kind === "cancel" ? "button danger" : "button primary"} disabled={busy || done} onClick={onConfirm}>{done ? "Confirmation sent" : busy ? "Confirming…" : pending.action.kind === "cancel" ? "Confirm cancellation" : "Confirm appointment"}{!busy && !done && <Icon name="check" size={17} />}</button>{onDismiss && !done && <button type="button" className="button secondary" disabled={busy} onClick={onDismiss}>Keep browsing</button>}</div>
  </section>;
}
