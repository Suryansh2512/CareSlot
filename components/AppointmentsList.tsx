"use client";
import Link from "next/link";
import { useState } from "react";
import type { Appointment, Doctor } from "@/lib/clinic-types";
import { formatClinicDate, formatClinicTime, formatClinicDay, formatClinicMonth, isFutureSlot } from "@/lib/dates";
import { Icon } from "./Icons";
import { useClinicData } from "./useClinicData";
import { useClinicAction, ActionFeedback } from "./useClinicAction";
import Slots from "./Slots";
function ReschedulePicker({ appointment, onSelect, disabled }: { appointment: Appointment; onSelect: (id: number) => void; disabled: boolean }) {
  const [doctor, setDoctor] = useState(appointment.doctor_id);
  const { data } = useClinicData<{ doctors: Doctor[] }>("/api/doctors");
  return <div className="reschedule-panel"><label className="field-label">Choose your doctor<select value={doctor} onChange={e => setDoctor(e.target.value)}>{!data && <option value={appointment.doctor_id}>{appointment.doctor.name}</option>}{data?.doctors.map(d => <option key={d.id} value={d.id}>{d.name} · {d.department.name}</option>)}</select></label><Slots doctorId={doctor} onSelect={s => onSelect(s.id)} disabled={disabled} /></div>;
}
export default function AppointmentsList({ compact = false, refreshKey = 0 }: { compact?: boolean; refreshKey?: number }) {
  const { data, loading, error, refresh } = useClinicData<{ appointments: Appointment[] }>("/api/appointments", refreshKey);
  const [tab, setTab] = useState("upcoming"), [moving, setMoving] = useState<number>();
  const action = useClinicAction();
  const appointments = [...(data?.appointments ?? [])];
  const upcoming = appointments.filter(a => a.status === "booked" && isFutureSlot(a.slot)).sort((a, b) => `${a.slot.slot_date} ${a.slot.start_time}`.localeCompare(`${b.slot.slot_date} ${b.slot.start_time}`));
  const visible = compact ? upcoming.slice(0, 2) : tab === "upcoming" ? upcoming : tab === "cancelled" ? appointments.filter(a => a.status === "cancelled") : appointments.filter(a => a.status !== "cancelled" && (a.status === "completed" || !isFutureSlot(a.slot)));
  return <section className={compact ? "appointments-preview panel" : ""}>
    {compact ? <div className="section-heading"><h2>Coming up next</h2><Link href="/appointments" className="text-link">View all <Icon name="arrow" size={15} /></Link></div> : <div className="tabs" role="tablist" aria-label="Appointment status">{["upcoming", "past", "cancelled"].map(t => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "selected" : ""} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}{t === "upcoming" && <span>{upcoming.length}</span>}</button>)}</div>}
    <ActionFeedback action={action} />
    {loading && <p className="muted loading-state" role="status">Loading your appointments…</p>}
    {error && <div className="notice error" role="alert">{error}<button className="text-button" onClick={refresh}>Try again</button></div>}
    {!loading && !error && !visible.length && <div className="empty-state"><Icon name="calendar" size={30} /><h3>{compact || tab === "upcoming" ? "Your next visit starts here" : "No appointments here"}</h3><p>{compact || tab === "upcoming" ? "Find a doctor or ask CareSlot to help you book." : "Appointments in this category will appear here."}</p><Link href="/doctors" className="text-link">Explore doctors <Icon name="arrow" size={15} /></Link></div>}
    <div className="appointment-list">{visible.map(a => <article key={a.id} className={compact ? "appointment-card compact" : "appointment-card"}>
      <div className="appointment-date"><strong>{formatClinicDay(a.slot.slot_date)}</strong><span>{formatClinicMonth(a.slot.slot_date)}</span></div>
      <div className="appointment-body"><div className="appointment-title"><h3>{a.doctor.name}</h3><span className={a.status === "booked" ? "badge teal" : "badge neutral"}>{a.status === "booked" && !isFutureSlot(a.slot) ? "Past visit" : a.status}</span></div><p>{a.doctor.department.name} · Room {a.doctor.room}</p><p className="appointment-time"><Icon name="clock" size={15} />{compact ? formatClinicTime(a.slot.start_time) : `${formatClinicDate(a.slot.slot_date)} · ${formatClinicTime(a.slot.start_time)}`} IST</p><p className="small muted">Appointment #{a.id}</p>{!compact && a.reason && <p className="reason-text">{a.reason}</p>}
      {!compact && a.status === "booked" && <div className="button-row"><button className="button secondary" disabled={action.busy} aria-expanded={moving === a.id} onClick={() => setMoving(moving === a.id ? undefined : a.id)}>{moving === a.id ? "Close times" : "Reschedule"}</button><button className="button subtle-danger" disabled={action.busy} onClick={() => action.prepare({ kind: "cancel", appointment_id: a.id })}>Cancel appointment</button></div>}
      {!compact && moving === a.id && <ReschedulePicker appointment={a} disabled={action.busy} onSelect={id => action.prepare({ kind: "reschedule", appointment_id: a.id, slot_id: id })} />}
      </div>
    </article>)}</div>
    {compact && <div className="preview-footer"><Icon name="clock" size={14} />Live availability · Updates automatically</div>}
  </section>;
}
