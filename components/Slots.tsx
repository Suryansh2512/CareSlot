"use client";
import { useEffect, useState } from "react";
import type { Slot } from "@/lib/clinic-types";
import { todayInIndia, formatClinicDate, formatClinicTime } from "@/lib/dates";
import { useClinicData } from "./useClinicData";
export default function Slots({ doctorId, onSelect, disabled }: { doctorId: string; onSelect: (slot: Slot) => void; disabled?: boolean }) {
  const [date, setDate] = useState("");
  const [today, setToday] = useState<string>();
  useEffect(() => {
    const update = () => setToday(todayInIndia());
    update();
    const timer = window.setInterval(update, 5000);
    return () => window.clearInterval(timer);
  }, []);
  const { data, loading, error } = useClinicData<{ slots: Slot[] }>(`/api/slots?doctor_id=${doctorId}${date ? "&date=" + date : ""}`);
  return <div className="slot-picker">
    <label className="field-label">Choose a date<input type="date" min={today} value={date} onChange={e => setDate(e.target.value)} aria-label="Appointment date" /></label>
    {loading && <p className="muted" role="status">Checking available times…</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {!loading && !error && !data?.slots.length && <p className="empty-inline">No free slots for this date. Try another date or doctor.</p>}
    <div className="slots-grid">{data?.slots.map(s => <button className="slot-button" key={s.id} onClick={() => onSelect(s)} disabled={disabled}><span>{formatClinicDate(s.slot_date)}</span><strong>{formatClinicTime(s.start_time)}</strong></button>)}</div>
    <p className="small muted">All times are IST · Availability refreshes every 5 seconds</p>
  </div>;
}
