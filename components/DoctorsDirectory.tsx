"use client";
import { useState } from "react";
import type { Department, Doctor } from "@/lib/clinic-types";
import { useClinicData } from "./useClinicData";
import { useClinicAction, ActionFeedback } from "./useClinicAction";
import { Icon } from "./Icons";
import Slots from "./Slots";
export default function DoctorsDirectory() {
  const [query, setQuery] = useState(""), [department, setDepartment] = useState(""), [language, setLanguage] = useState(""), [open, setOpen] = useState("");
  const params = new URLSearchParams();
  if (query.trim()) params.set("query", query.trim());
  if (department) params.set("department_id", department);
  if (language) params.set("language", language);
  const { data, error, loading, refresh } = useClinicData<{ doctors: Doctor[]; departments: Department[] }>(`/api/doctors?${params}`);
  const catalog = useClinicData<{ doctors: Doctor[]; departments: Department[] }>("/api/doctors");
  const languages = [...new Set(catalog.data?.doctors.flatMap(d => d.languages) ?? [])].sort();
  const action = useClinicAction();
  return <>
    <div className="filter-bar"><label className="search-field"><Icon name="search" /><input value={query} maxLength={100} onChange={e => setQuery(e.target.value)} placeholder="Search doctors or specialty" aria-label="Search doctors" /></label>
      <label className="sr-only" htmlFor="department">Specialty</label><select id="department" value={department} onChange={e => setDepartment(e.target.value)}><option value="">All specialties</option>{catalog.data?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
      <label className="sr-only" htmlFor="language">Language</label><select id="language" value={language} onChange={e => setLanguage(e.target.value)}><option value="">All languages</option>{languages.map(l => <option key={l}>{l}</option>)}</select>
    </div>
    <ActionFeedback action={action} />
    {error && <div className="notice error" role="alert">{error}<button className="text-button" onClick={refresh}>Try again</button></div>}
    {loading && <div className="loading-grid" role="status">Loading your doctor directory…</div>}
    {!loading && !error && <p className="results-count">{data?.doctors.length ?? 0} doctors match your search</p>}
    {!loading && !error && !data?.doctors.length && <div className="empty-state"><Icon name="search" size={30} /><h3>No doctors found</h3><p>Try a different name, specialty or language.</p></div>}
    <div className="doctor-grid">{data?.doctors.map((d, i) => <article key={d.id} className="doctor-card">
      <div className="doctor-card-top"><span className={`doctor-avatar tone-${i % 3}`}>{d.name.replace(/^Dr\.\s*/, "").split(" ").slice(0, 2).map(n => n[0]).join("")}</span><span className="badge teal">{d.department.name}</span></div>
      <h2>{d.name}</h2><p className="muted qualification">{d.qualification}</p><p className="doctor-experience"><Icon name="doctors" size={16} />{d.experience_years} years of experience</p>
      <div className="doctor-details"><span>Speaks</span><strong>{d.languages.join(", ")}</strong><span>Consultation</span><strong>₹{d.consultation_fee.toLocaleString("en-IN")}</strong><span>Clinic room</span><strong>{d.room}</strong></div>
      <button className="button secondary full-width" aria-expanded={open === d.id} onClick={() => setOpen(open === d.id ? "" : d.id)}>{open === d.id ? "Hide availability" : "View available slots"}<Icon name="arrow" size={17} /></button>
      {open === d.id && <Slots doctorId={d.id} disabled={action.busy} onSelect={s => action.prepare({ kind: "book", slot_id: s.id })} />}
    </article>)}</div>
  </>;
}
