import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createClinicService } from "../lib/clinic";
import { bookSchema, actionSchema, doctorSearchSchema, isoDate, slotSearchSchema } from "../lib/schemas";
import { signConfirmation, readConfirmation } from "../lib/confirmation";
import { isFutureSlot, todayInIndia, formatClinicDay, formatClinicMonth } from "../lib/dates";
import { hashPasscode, isValidSession } from "../lib/auth";
import { requireSession } from "../lib/http";
import { requireEnv, getGeminiModel } from "../lib/env";
import { runAgentLoop, runTool } from "../lib/agent/runAgent";
import { createClinicTools } from "../lib/agent/tools";
import { defineTool, toFunctionDeclarations } from "../lib/agent/defineTool";
import { z } from "zod";
import type { Appointment, Department, Doctor, Slot } from "../lib/clinic-types";
import { ClinicError, publicGeminiError } from "../lib/errors";
import { GET as appointmentsGET } from "../app/api/appointments/route";
import { GET as doctorsGET } from "../app/api/doctors/route";

process.env.APP_PASSCODE = "isolated-unit-test-passcode-not-a-real-credential";
test("Gemini errors preserve actionable status without exposing provider bodies", () => {
  for (const status of [400, 401, 403, 404, 429, 503, 504]) {
    const result = publicGeminiError({ status, message: "private-provider-body-must-not-be-returned" });
    assert.ok(!result.error.includes("private-provider-body"));
    assert.match(result.error, new RegExp(String(status)));
    assert.equal(result.status, status === 429 || status === 503 || status === 504 ? status : 503);
  }
  assert.equal(publicGeminiError(new ClinicError("Please sign in.", 401)).status, 401);
});
const dep: Department = { id: "D02", name: "Dermatology", common_issues: "skin rash, acne" };
const doctors: Doctor[] = [
  { id: "DR03", name: "Dr. Nisha Menon", department_id: "D02", qualification: "MBBS, MD", experience_years: 12, consultation_fee: 700, languages: ["English", "Tamil"], room: "1-03", department: dep },
  { id: "DR04", name: "Dr. Farhan Ali", department_id: "D02", qualification: "MBBS", experience_years: 6, consultation_fee: 600, languages: ["English", "Hindi"], room: "1-04", department: dep },
];
const slots: Slot[] = [
  { id: 7, doctor_id: "DR03", slot_date: "2099-01-02", start_time: "10:00:00", is_booked: false },
  { id: 8, doctor_id: "DR03", slot_date: "2099-01-02", start_time: "11:00:00", is_booked: true },
  { id: 9, doctor_id: "DR03", slot_date: "2000-01-02", start_time: "10:00:00", is_booked: false },
];
const appointment: Appointment = { id: 1, doctor_id: "DR03", slot_id: 7, reason: null, status: "booked", created_at: "2026-01-01T00:00:00Z", doctor: doctors[0], slot: slots[0] };
function fixtureClient(options: { rpcError?: { code: string; message: string }; otherPatient?: boolean } = {}) {
  const calls: { url: URL; body?: Record<string, unknown> }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    if (url.pathname.includes("/rpc/")) return new Response(JSON.stringify(options.rpcError ?? { changed: true, appointment: { id: 1, status: body?.p_appointment_id ? "cancelled" : "booked" } }), { status: options.rpcError ? 400 : 200, headers: { "Content-Type": "application/json" } });
    const table = url.pathname.split("/").at(-1);
    let data: Record<string, unknown>[] = table === "doctors" ? doctors as unknown as Record<string, unknown>[] : table === "departments" ? [dep] : table === "slots" ? slots : [{ ...appointment, patient_id: options.otherPatient ? "P002" : "P001" }];
    for (const [key, value] of url.searchParams) {
      if (value.startsWith("eq.")) data = data.filter(row => String(row[key]) === value.slice(3));
      if (value.startsWith("gte.")) data = data.filter(row => String(row[key]) >= value.slice(4));
      if (value.startsWith("lte.")) data = data.filter(row => String(row[key]) <= value.slice(4));
    }
    if (init?.headers && new Headers(init.headers).get("accept")?.includes("vnd.pgrst.object")) return new Response(JSON.stringify(data[0] ?? null), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  return { db: createClient("https://isolated-fixture.invalid", "not-a-real-key", { global: { fetch: fetcher }, auth: { persistSession: false } }), calls };
}
test("doctor search filters actual records by department", async () => {
  const { db } = fixtureClient(); const result = await createClinicService(db).searchDoctors({ department_id: "D02" });
  assert.equal(result.doctors.length, 2); assert.equal(result.departments[0].name, "Dermatology");
  assert.equal((await createClinicService(db).searchDoctors({ department_id: "D01" })).count, 0);
});
test("doctor search supports language, name, specialty and common issues", async () => {
  const clinic = createClinicService(fixtureClient().db);
  assert.deepEqual((await clinic.searchDoctors({ language: "tamil" })).doctors.map(d => d.id), ["DR03"]);
  for (const query of ["Nisha", "Dermatology", "skin rash"]) assert.ok((await clinic.searchDoctors({ query })).count > 0);
});
test("availability excludes seeded occupied and past slots", async () => {
  const { db, calls } = fixtureClient(); const result = await createClinicService(db).getAvailableSlots({ doctor_id: "DR03", date: "2099-01-02" });
  assert.deepEqual(result.slots.map(s => s.id), [7]);
  assert.equal(calls[0].url.searchParams.get("is_booked"), "eq.false");
  await assert.rejects(createClinicService(db).getAvailableSlots({ doctor_id: "DR03", from_date: "2099-02-01", to_date: "2099-01-01" }), /end date/);
});
test("appointment reads always filter P001; another patient's record is invisible", async () => {
  const fixture = fixtureClient({ otherPatient: true }), clinic = createClinicService(fixture.db);
  assert.equal((await clinic.getMyAppointments()).appointments.length, 0);
  assert.equal(fixture.calls[0].url.searchParams.get("patient_id"), "eq.P001");
  await assert.rejects(clinic.prepareAction({ kind: "cancel", appointment_id: 1 }), /not found/);
});
test("clinic timezone handles elapsed times on the same date", () => {
  const now = new Date("2026-11-12T04:30:00Z").getTime();
  assert.equal(isFutureSlot({ slot_date: "2026-11-12", start_time: "09:30:00" }, now), false);
  assert.equal(isFutureSlot({ slot_date: "2026-11-12", start_time: "10:30:00" }, now), true);
});
test("clinic calendar date is stable across host timezones and Indian midnight", () => {
  const original = process.env.TZ;
  try {
    for (const zone of ["Pacific/Honolulu", "Asia/Kolkata", "Pacific/Kiritimati"]) {
      process.env.TZ = zone;
      assert.equal(formatClinicDay("2026-11-13"), 13); assert.equal(formatClinicMonth("2026-11-13"), "Nov");
      assert.equal(todayInIndia(new Date("2026-11-12T18:29:59Z")), "2026-11-12");
      assert.equal(todayInIndia(new Date("2026-11-12T18:30:00Z")), "2026-11-13");
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
test("Zod rejects invalid IDs, invented patient args and impossible calendar dates", () => {
  for (const value of [-1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1, "1"]) assert.equal(bookSchema.safeParse({ slot_id: value }).success, false);
  assert.equal(bookSchema.safeParse({ slot_id: 1, patient_id: "P002" }).success, false);
  assert.equal(doctorSearchSchema.safeParse({ patient_id: "P002" }).success, false);
  assert.equal(isoDate.safeParse("2026-02-30").success, false);
  assert.equal(slotSearchSchema.safeParse({ doctor_id: "made-up" }).success, false);
  assert.equal(actionSchema.safeParse({ kind: "deleteEverything" }).success, false);
});
test("confirmation token binds the exact action and detects tampering", () => {
  const token = signConfirmation({ kind: "reschedule", appointment_id: 1, slot_id: 7 }, 4);
  assert.equal(readConfirmation(token).expected_slot_id, 4);
  assert.throws(() => readConfirmation(token + "bad"), /Invalid confirmation/);
});
test("expired confirmations cannot authorize a write", t => {
  const token = signConfirmation({ kind: "book", slot_id: 7 });
  const future = Date.now() + 11 * 60_000;
  t.mock.method(Date, "now", () => future);
  assert.throws(() => readConfirmation(token), /expired/);
});
test("write tools prepare confirmation without calling an RPC", async () => {
  const fixture = fixtureClient(), tools = createClinicTools(undefined, createClinicService(fixture.db));
  const step = await runTool(tools, "bookAppointment", { slot_id: 7 });
  assert.equal(step.ok, true); assert.equal((step.result as { requires_confirmation: boolean }).requires_confirmation, true);
  assert.equal(fixture.calls.filter(c => c.url.pathname.includes("/rpc/")).length, 0);
});
test("only a matching confirmed action reaches the RPC and only once per turn", async () => {
  const fixture = fixtureClient(), token = signConfirmation({ kind: "book", slot_id: 7 });
  const tools = createClinicTools(token, createClinicService(fixture.db));
  assert.equal((await runTool(tools, "bookAppointment", { slot_id: 8 })).ok, false);
  assert.equal((await runTool(tools, "bookAppointment", { slot_id: 7 })).ok, true);
  assert.equal((await runTool(tools, "bookAppointment", { slot_id: 7 })).ok, false);
  assert.equal(fixture.calls.filter(c => c.url.pathname.includes("/rpc/")).length, 1);
});
test("RPC business failures propagate and never fabricate success", async () => {
  const fixture = fixtureClient({ rpcError: { code: "P0001", message: "This slot is already booked." } });
  await assert.rejects(createClinicService(fixture.db).executeAction({ kind: "book", slot_id: 7 }, signConfirmation({ kind: "book", slot_id: 7 })), /already booked/);
});
test("invalid tool arguments cannot execute a function", async () => {
  let ran = false;
  const tool = defineTool({ name: "testTool", description: "Use this when testing", schema: z.object({ id: z.number().int() }), run: async () => { ran = true; } });
  assert.equal((await runTool([tool], "testTool", { id: "bad" })).ok, false); assert.equal(ran, false);
  assert.equal((await runTool([tool], "unknown", {})).ok, false);
});
test("function declarations preserve Zod property names and descriptions", () => {
  const tools = createClinicTools(undefined, createClinicService(fixtureClient().db)), declarations = toFunctionDeclarations(tools);
  assert.equal(declarations.length, 6);
  assert.ok(JSON.stringify(declarations).includes("doctor_id"));
  assert.equal(JSON.stringify(declarations).includes("patient_id"), false);
});
test("agent executes provider-selected tools and returns their results to the provider (mock transport)", async () => {
  let rounds = 0, sawResponse = false;
  const tools = createClinicTools(undefined, createClinicService(fixtureClient().db));
  const result = await runAgentLoop([{ role: "user", text: "Tamil-speaking doctors?" }], tools, "test prompt", async contents => {
    if (rounds++ === 0) return { functionCalls: [{ name: "searchDoctors", args: { language: "Tamil" } }] };
    sawResponse = JSON.stringify(contents).includes("Dr. Nisha Menon");
    return { text: "One matching doctor was found." };
  });
  assert.equal(result.steps[0].tool, "searchDoctors"); assert.equal(sawResponse, true);
});
test("agent loop is bounded even if the provider keeps requesting tools", async () => {
  let rounds = 0;
  const result = await runAgentLoop([{ role: "user", text: "test" }], [], "test", async () => { rounds++; return { functionCalls: [{ name: "unknown" }] }; });
  assert.equal(rounds, 8); assert.match(result.reply, /step limit/);
});
test("provider failure after a committed write preserves visible receipt", async () => {
  let rounds = 0;
  const tool = defineTool({ name: "testWrite", description: "Use this when testing", writes: true, schema: z.object({}), run: async () => ({ changed: true, appointment: { id: 7, status: "booked" } }) });
  const result = await runAgentLoop([{ role: "user", text: "test" }], [tool], "test", async () => { if (!rounds++) return { functionCalls: [{ name: "testWrite", args: {} }] }; throw new Error("provider unavailable"); });
  assert.equal(result.steps[0].ok, true); assert.match(result.reply, /interrupted/);
});
test("missing environment variables report names without values; model has no fallback", () => {
  const previous = process.env.GEMINI_MODEL; delete process.env.GEMINI_MODEL;
  try { assert.throws(() => getGeminiModel(), /Missing environment variable GEMINI_MODEL/); assert.throws(() => requireEnv("CARESLOT_MISSING_TEST_VAR"), /CARESLOT_MISSING_TEST_VAR/); }
  finally { if (previous !== undefined) process.env.GEMINI_MODEL = previous; }
});
test("API authentication fails before reading any database or environment secrets", async () => {
  await assert.rejects(requireSession(new Request("http://localhost/api/appointments")), (e: unknown) => e instanceof ClinicError && e.status === 401);
  const response = await appointmentsGET(new Request("http://localhost/api/appointments"));
  assert.equal(response.status, 401);
  assert.equal((await doctorsGET(new Request("http://localhost/api/doctors"))).status, 401);
});
test("valid passcode cookie is accepted, forged cookies and foreign origins rejected", async () => {
  const hash = await hashPasscode(process.env.APP_PASSCODE!);
  assert.equal(await isValidSession(hash), true); assert.equal(await isValidSession("forged"), false);
  await requireSession(new Request("http://localhost/api/appointments", { headers: { cookie: "app_session=" + hash } }));
  await requireSession(new Request("http://localhost:3100/api/appointments", { method: "POST", headers: { cookie: "app_session=" + hash, host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" } }));
  await assert.rejects(requireSession(new Request("http://localhost/api/appointments", { method: "POST", headers: { cookie: "app_session=" + hash, origin: "https://foreign.invalid" } })), /CareSlot/);
});
