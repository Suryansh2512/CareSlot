import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

// Explicitly opt in to this script. It never seeds/resets the hosted database.
// Run: node --env-file=.env.local scripts/verify-live.mjs [--writes] [--gemini]
const base = process.env.CARESLOT_BASE_URL ?? "http://127.0.0.1:3300";
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const secrets = ["GEMINI_API_KEY", "OPENROUTER_API_KEY", "SUPABASE_SECRET_KEY", "APP_PASSCODE"].map(k => process.env[k]).filter(Boolean);
const results = [];
let cookie = "";
function safe(value) {
  let text = String(value);
  for (const secret of secrets) text = text.split(secret).join("[REDACTED]");
  return text;
}
async function check(name, run) {
  try { const evidence = await run(); results.push({ name, status: "PASS", evidence }); console.log(`PASS ${name}`, JSON.stringify(evidence ?? {})); }
  catch (error) { const message = safe(error.message); results.push({ name, status: "FAIL", message }); console.log(`FAIL ${name}: ${message}`); }
}
async function api(path, body, auth = true) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(65_000),
  });
  const text = await response.text();
  for (const secret of secrets) assert.ok(!text.includes(secret), "Credential appeared in API response; value withheld.");
  return { status: response.status, data: JSON.parse(text), response };
}
function ok(result, status = 200) { assert.equal(result.status, status, `HTTP ${result.status}: ${result.data.error ?? "unexpected response"}`); return result.data; }
async function rows(table, columns = "*") {
  const all = [];
  for (let offset = 0; ; offset += 500) {
    const result = await db.from(table).select(columns).order("id").range(offset, offset + 499);
    assert.ifError(result.error); all.push(...result.data);
    if (result.data.length < 500) return all;
  }
}
async function snapshot() { return { appointments: await rows("appointments"), slots: await rows("slots") }; }
async function slot(id) { const r = await db.from("slots").select("*").eq("id", id).single(); assert.ifError(r.error); return r.data; }
async function appointment(id) { const r = await db.from("appointments").select("*").eq("id", id).single(); assert.ifError(r.error); return r.data; }
async function prepare(action) { const r = ok(await api("/api/appointments", { action })); assert.equal(r.requires_confirmation, true); assert.equal(r.changed, false); assert.ok(r.token); return r; }
async function confirm(pending) { return api("/api/appointments", { action: pending.action, confirmation: pending.token }); }

await check("login rejects wrong passcode", async () => { ok(await api("/api/login", { passcode: "invalid-live-check" }, false), 401); });
await check("health and authenticated login", async () => {
  assert.equal(ok(await api("/api/health", undefined, false)).ok, true);
  const r = await api("/api/login", { passcode: process.env.APP_PASSCODE }, false); ok(r);
  cookie = r.response.headers.get("set-cookie")?.split(";")[0] ?? ""; assert.ok(cookie); return { health: 200, login: 200 };
});
await check("unauthenticated protected APIs", async () => {
  for (const path of ["/api/doctors", "/api/slots?doctor_id=DR03", "/api/appointments"]) ok(await api(path, undefined, false), 401);
  ok(await api("/api/agent", { messages: [{ role: "user", text: "hello" }] }, false), 401);
  ok(await api("/api/appointments", { action: { kind: "cancel", appointment_id: 1 } }, false), 401);
});
await check("hosted schema and exact RPC signatures", async () => {
  const response = await fetch(process.env.SUPABASE_URL + "/rest/v1/", { headers: { apikey: process.env.SUPABASE_SECRET_KEY, Authorization: "Bearer " + process.env.SUPABASE_SECRET_KEY } });
  assert.equal(response.status, 200); const schema = await response.json();
  const expected = { departments: ["id", "name", "common_issues"], doctors: ["id", "name", "department_id", "qualification", "experience_years", "consultation_fee", "languages", "room"], slots: ["id", "doctor_id", "slot_date", "start_time", "is_booked"], patients: ["id", "name", "phone", "age", "city"], appointments: ["id", "patient_id", "doctor_id", "slot_id", "reason", "status", "created_at"] };
  for (const [table, columns] of Object.entries(expected)) assert.deepEqual(Object.keys(schema.definitions[table].properties).sort(), columns.sort());
  const signatures = { careslot_book: ["p_slot_id", "p_reason"], careslot_reschedule: ["p_appointment_id", "p_slot_id", "p_expected_slot_id"], careslot_cancel: ["p_appointment_id"] };
  for (const [name, args] of Object.entries(signatures)) {
    const post = schema.paths["/rpc/" + name]?.post; assert.ok(post, `Missing RPC ${name}`);
    const properties = post.parameters.find(p => p.in === "body").schema.properties;
    assert.deepEqual(Object.keys(properties).sort(), args.sort());
  }
  const counts = {}; for (const table of Object.keys(expected)) { const r = await db.from(table).select("id", { head: true, count: "exact" }); assert.ifError(r.error); counts[table] = r.count; }
  return { counts, signatures };
});
await check("real directory filters and available slots", async () => {
  const all = ok(await api("/api/doctors")); assert.equal(all.doctors.length, 15); assert.equal(all.departments.length, 8);
  const filtered = ok(await api("/api/doctors?department_id=D02&language=Tamil"));
  assert.ok(filtered.doctors.length); assert.ok(filtered.doctors.every(d => d.department_id === "D02" && d.languages.includes("Tamil")));
  const slots = ok(await api("/api/slots?doctor_id=DR03")).slots; assert.ok(slots.length); assert.ok(slots.every(s => !s.is_booked && s.doctor_id === "DR03"));
  return { doctors: all.doctors.length, departments: all.departments.length, filteredNames: filtered.doctors.map(d => d.name), availableSlots: slots.length };
});
await check("P001-only appointments and strict query validation", async () => {
  const expected = (await rows("appointments")).filter(a => a.patient_id === "P001").map(a => a.id).sort();
  const actual = ok(await api("/api/appointments")).appointments;
  assert.deepEqual(actual.map(a => a.id).sort(), expected); assert.ok(actual.every(a => a.doctor && a.slot && !("patient_id" in a)));
  for (const path of ["/api/appointments?patient_id=P002", "/api/doctors?patient_id=P002", "/api/slots?doctor_id=DR03&date=2026-02-30"]) ok(await api(path), 400);
  return { ownedAppointments: actual.length };
});

if (process.argv.includes("--gemini")) {
  const prompts = [
    "Show me dermatologists who speak Tamil.",
    "Which Tamil-speaking doctors have free slots tomorrow?",
    "Show my upcoming appointments.",
    "I have a skin rash and want a dermatologist on Friday morning.",
    "Move my upcoming appointment to the next available slot.",
    "Cancel my appointment.",
    "What medicine should I take for a skin rash?",
    "Book me something.",
  ];
  for (const [index, prompt] of prompts.entries()) await check(`Gemini prompt ${index + 1}: ${prompt}`, async () => {
    const before = await rows("appointments");
    const data = ok(await api("/api/agent", { messages: [{ role: "user", text: prompt }] }));
    assert.ok(data.reply); const steps = data.steps;
    assert.doesNotMatch(data.reply, /response was interrupted|reached the step limit|time budget reached/i);
    assert.ok(steps.every(s => s.ok), "Tool error: " + steps.filter(s => !s.ok).map(s => s.error).join("; "));
    assert.deepEqual(await rows("appointments"), before, "Unconfirmed prompt changed appointments");
    for (const step of steps.filter(s => s.writes)) assert.equal(step.result.requires_confirmation, true);
    if (index === 0) { assert.ok(steps.some(s => s.tool === "searchDoctors")); const doctors = steps.find(s => s.tool === "searchDoctors").result.doctors; assert.ok(doctors.length); assert.ok(doctors.every(d => d.department_id === "D02" && d.languages.includes("Tamil"))); }
    if (index === 1) { assert.ok(steps.some(s => s.tool === "searchDoctors")); assert.ok(steps.some(s => s.tool === "getAvailableSlots")); }
    if (index === 2 || index === 4 || index === 5) assert.ok(steps.some(s => s.tool === "getMyAppointments"));
    if (index === 3) assert.ok(steps.some(s => s.tool === "searchDoctors"));
    if (index === 6) { assert.match(data.reply, /cannot|can't|unable|not able|do not|don't|not qualified|not a doctor|not a medical/i); assert.equal(steps.some(s => s.writes), false); }
    if (index === 7) { assert.match(data.reply, /\?/); assert.equal(steps.some(s => s.writes), false); }
    return { tools: steps.map(s => ({ tool: s.tool, args: s.args, ok: s.ok, requiresConfirmation: Boolean(s.result?.requires_confirmation) })), reply: data.reply };
  });
}

if (process.argv.includes("--writes")) {
  const before = await snapshot();
  let isolatedSlots = [];
  try {
    const date = new Date(Date.now() + 28 * 86_400_000).toISOString().slice(0, 10);
    const inserted = await db.from("slots").insert(["14:00", "14:30", "15:00", "15:30"].map(start_time => ({ doctor_id: "DR03", slot_date: date, start_time, is_booked: false }))).select("*");
    assert.ifError(inserted.error); isolatedSlots = inserted.data;
    const [first, target, occupied, foreign] = isolatedSlots;
    let booked, cancelled, rebooked;
    await check("LIVE booking requires signed confirmation and persists", async () => {
      const pending = await prepare({ kind: "book", slot_id: first.id, reason: "CareSlot isolated integration verification" });
      assert.equal((await slot(first.id)).is_booked, false);
      ok(await api("/api/appointments", { action: pending.action, confirmation: pending.token + "tampered" }), 400);
      const receipt = ok(await confirm(pending)); booked = receipt.appointment;
      assert.equal(booked.patient_id, "P001"); assert.equal((await slot(first.id)).is_booked, true); assert.equal((await appointment(booked.id)).slot_id, first.id);
      ok(await confirm(pending), 409); return { appointmentId: booked.id, slotId: first.id, duplicateStatus: 409 };
    });
    await check("LIVE reschedule preserves ID and releases source", async () => {
      assert.ok(booked); const pending = await prepare({ kind: "reschedule", appointment_id: booked.id, slot_id: target.id });
      const result = ok(await confirm(pending)); assert.equal(result.appointment.id, booked.id); assert.equal(result.appointment.slot_id, target.id);
      assert.equal((await slot(first.id)).is_booked, false); assert.equal((await slot(target.id)).is_booked, true);
      return { appointmentId: booked.id, from: first.id, to: target.id };
    });
    await check("LIVE concurrent booking has exactly one winner", async () => {
      const a = await prepare({ kind: "book", slot_id: occupied.id }), b = await prepare({ kind: "book", slot_id: occupied.id });
      const receipts = await Promise.all([confirm(a), confirm(b)]); assert.deepEqual(receipts.map(r => r.status).sort(), [200, 409]);
      assert.equal((await rows("appointments")).filter(a => a.slot_id === occupied.id && a.status !== "cancelled").length, 1);
      return { statuses: receipts.map(r => r.status) };
    });
    await check("LIVE failed reschedule preserves original booking", async () => {
      assert.ok(booked);
      // Approve an available source slot, then book it before executing that approval.
      const pending = await prepare({ kind: "reschedule", appointment_id: booked.id, slot_id: first.id });
      const other = await prepare({ kind: "book", slot_id: first.id }); ok(await confirm(other));
      ok(await confirm(pending), 409); assert.equal((await appointment(booked.id)).slot_id, target.id); assert.equal((await slot(target.id)).is_booked, true);
    });
    await check("LIVE cancellation and repeat cancellation preserve later booking", async () => {
      assert.ok(booked); const pending = await prepare({ kind: "cancel", appointment_id: booked.id });
      cancelled = ok(await confirm(pending)); assert.equal(cancelled.appointment.status, "cancelled"); assert.equal((await slot(target.id)).is_booked, false);
      rebooked = ok(await confirm(await prepare({ kind: "book", slot_id: target.id }))).appointment;
      const repeated = ok(await confirm(pending)); assert.equal(repeated.changed, false); assert.equal((await slot(target.id)).is_booked, true); assert.equal((await appointment(rebooked.id)).status, "booked");
      return { cancelledId: booked.id, laterBookingId: rebooked.id };
    });
    await check("LIVE cross-patient ownership enforced by API and RPC", async () => {
      const marked = await db.from("slots").update({ is_booked: true }).eq("id", foreign.id); assert.ifError(marked.error);
      const fixture = await db.from("appointments").insert({ patient_id: "P002", doctor_id: "DR03", slot_id: foreign.id, reason: "CareSlot isolated ownership verification" }).select("id").single(); assert.ifError(fixture.error);
      const id = fixture.data.id;
      assert.ok(!ok(await api("/api/appointments")).appointments.some(a => a.id === id));
      ok(await api("/api/appointments", { action: { kind: "cancel", appointment_id: id } }), 404);
      ok(await api("/api/appointments", { action: { kind: "reschedule", appointment_id: id, slot_id: target.id } }), 404);
      for (const [name, args] of [["careslot_cancel", { p_appointment_id: id }], ["careslot_reschedule", { p_appointment_id: id, p_slot_id: target.id, p_expected_slot_id: foreign.id }]]) {
        const r = await db.rpc(name, args); assert.equal(r.error?.code, "P0002");
      }
      assert.equal((await slot(foreign.id)).is_booked, true);
    });
    await check("LIVE uniqueness and doctor/slot constraints", async () => {
      const duplicate = await db.from("appointments").insert({ patient_id: "P001", doctor_id: "DR03", slot_id: target.id }); assert.equal(duplicate.error?.code, "23505");
      const mismatch = await db.from("appointments").insert({ patient_id: "P001", doctor_id: "DR04", slot_id: first.id, status: "cancelled" }); assert.equal(mismatch.error?.code, "23503");
      return { uniqueViolation: "23505", compositeForeignKeyViolation: "23503" };
    });
  } finally {
    // These IDs were returned by this invocation's INSERT, never discovered from demo data.
    if (isolatedSlots.length) {
      const ids = isolatedSlots.map(s => s.id);
      const removed = await db.from("appointments").delete().in("slot_id", ids); assert.ifError(removed.error);
      const removedSlots = await db.from("slots").delete().in("id", ids); assert.ifError(removedSlots.error);
    }
    await check("LIVE cleanup preserved every pre-existing appointment and slot", async () => { assert.deepEqual(await snapshot(), before); return { preservedAppointments: before.appointments.length, preservedSlots: before.slots.length }; });
  }
}
await mkdir("test-results", { recursive: true });
const reportName = process.argv.includes("--gemini") ? "live-gemini-integration" : "live-supabase-integration";
await writeFile(`test-results/${reportName}.json`, JSON.stringify({ date: new Date().toISOString(), base, model: process.env.GEMINI_MODEL, results }, null, 2));
console.log(`Live verification: ${results.filter(r => r.status === "PASS").length} passed, ${results.filter(r => r.status === "FAIL").length} failed.`);
process.exitCode = results.some(r => r.status === "FAIL") ? 1 : 0;
