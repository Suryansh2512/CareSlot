import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Authorized live acceptance: actual UI -> selected model -> signed tools -> RPCs.
// Only isolated slots/appointments created by this invocation are removed.
const baseURL = process.env.CARESLOT_BASE_URL ?? "http://127.0.0.1:3300";
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const secrets = ["OPENROUTER_API_KEY", "GEMINI_API_KEY", "SUPABASE_SECRET_KEY", "APP_PASSCODE"].map(k => process.env[k]).filter(Boolean);
const redact = s => secrets.reduce((text, value) => text.split(value).join("[REDACTED]"), String(s));
const browser = await chromium.launch(), context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1050 }, timezoneId: "Pacific/Honolulu" });
const page = await context.newPage(), browserErrors = [], results = [];
page.on("pageerror", e => browserErrors.push(e.message));
page.on("console", m => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) browserErrors.push(m.text()); });
await mkdir("test-results/agent-workflow", { recursive: true });
async function allRows(table) { const rows = []; for (let offset = 0; ; offset += 500) { const r = await db.from(table).select("*").order("id").range(offset, offset + 499); assert.ifError(r.error); rows.push(...r.data); if (r.data.length < 500) return rows; } }
const before = { slots: await allRows("slots"), appointments: await allRows("appointments") };
async function currentSlot(id) { const r = await db.from("slots").select("is_booked").eq("id", id).single(); assert.ifError(r.error); return r.data; }
async function currentAppointment(id) { const r = await db.from("appointments").select("id,patient_id,slot_id,status").eq("id", id).single(); assert.ifError(r.error); return r.data; }
function record(name, data) {
  assert.equal(data.provider?.name, process.env.AI_PROVIDER);
  assert.equal(data.provider.model, process.env.AI_PROVIDER === "openrouter" ? process.env.OPENROUTER_MODEL : process.env.GEMINI_MODEL);
  assert.ok(data.steps.every(s => s.ok), "A live selected tool failed: " + data.steps.filter(s => !s.ok).map(s => s.error).join("; "));
  const evidence = { name, status: "PASS", provider: data.provider, tools: data.steps.map(s => ({ tool: s.tool, args: s.args, writes: s.writes, requiresConfirmation: Boolean(s.result?.requires_confirmation), appointmentId: s.result?.appointment?.id })) };
  results.push(evidence); console.log(JSON.stringify(evidence));
}
async function responseAfter(click) {
  const pending = page.waitForResponse(r => r.url().endsWith("/api/agent") && r.request().method() === "POST", { timeout: 65_000 });
  await click(); const response = await pending, text = await response.text();
  assert.ok(secrets.every(secret => !text.includes(secret)), "Secret value in response; withheld");
  const data = JSON.parse(text); assert.equal(response.status(), 200, `Provider HTTP ${response.status()}: ${data.error ?? "unexpected response"}`); return data;
}
async function send(text) { await page.getByLabel("Your appointment request").fill(text); return responseAfter(() => page.getByRole("button", { name: "Send message" }).click()); }
async function approve(kind) { return responseAfter(() => page.getByRole("button", { name: kind === "cancel" ? "Confirm cancellation" : "Confirm appointment", exact: true }).click()); }
function proposal(data, kind) { const step = data.steps.find(s => s.ok && s.result?.requires_confirmation && s.result.action.kind === kind); assert.ok(step, `Missing ${kind} proposal`); return step.result; }
function receipt(data) { const step = data.steps.find(s => s.ok && s.writes && s.result?.appointment?.id); assert.ok(step, "No real database receipt"); return step.result; }
async function replay(pending, expectedStatus, changed) { const r = await context.request.post("/api/appointments", { data: { action: pending.action, confirmation: pending.token } }); assert.equal(r.status(), expectedStatus); if (changed !== undefined) assert.equal((await r.json()).changed, changed); }
let slotIds = [];
try {
  await page.goto("/login"); await page.waitForLoadState("networkidle");
  await page.getByLabel("Team passcode").fill(process.env.APP_PASSCODE);
  await page.getByRole("button", { name: "Continue to CareSlot" }).click(); await expect(page).toHaveURL(baseURL + "/");
  const date = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const inserted = await db.from("slots").insert(["14:00", "14:30"].map(start_time => ({ doctor_id: "DR03", slot_date: date, start_time, is_booked: false }))).select("id,start_time");
  assert.ifError(inserted.error); slotIds = inserted.data.map(s => s.id);
  const first = inserted.data.find(s => s.start_time.startsWith("14:00")).id, second = inserted.data.find(s => s.start_time.startsWith("14:30")).id;
  let result = await send(`Book a Dermatology visit with Dr. Nisha Menon on ${date} at 14:00 IST. Reason: CareSlot isolated verification.`);
  const book = proposal(result, "book"); assert.equal(book.action.slot_id, first); assert.equal((await currentSlot(first)).is_booked, false); record("model-selected booking proposal, no write before confirmation", result);
  await page.locator(".tool-steps details").last().locator("summary").click();
  await page.screenshot({ path: "test-results/agent-workflow/chat-tools.png", fullPage: true, caret: "initial" });
  result = await approve("book"); const booked = receipt(result).appointment;
  assert.equal((await currentAppointment(booked.id)).patient_id, "P001"); assert.equal((await currentSlot(first)).is_booked, true); record("model-selected confirmed booking persisted", result);
  await expect(page.getByText("Database confirmed", { exact: true }).last()).toBeVisible();
  await page.screenshot({ path: "test-results/agent-workflow/booking-receipt.png", fullPage: true, caret: "initial" });
  await replay(book, 409);
  const appointmentsPage = await context.newPage(); await appointmentsPage.goto("/appointments");
  await expect(appointmentsPage.getByText(`Appointment #${booked.id}`, { exact: true })).toBeVisible();
  await appointmentsPage.screenshot({ path: "test-results/agent-workflow/persisted-appointment.png", fullPage: true, caret: "initial" }); await appointmentsPage.close();
  result = await send(`Move my appointment #${booked.id} to Dr. Nisha Menon on ${date} at 14:30 IST.`);
  const move = proposal(result, "reschedule"); assert.equal(move.action.appointment_id, booked.id); assert.equal(move.action.slot_id, second);
  assert.equal((await currentAppointment(booked.id)).slot_id, first); record("model-selected reschedule proposal, original booking preserved", result);
  result = await approve("reschedule"); assert.equal(receipt(result).appointment.id, booked.id);
  assert.equal((await currentAppointment(booked.id)).slot_id, second); assert.equal((await currentSlot(first)).is_booked, false); assert.equal((await currentSlot(second)).is_booked, true); record("model-selected confirmed reschedule persisted", result);
  await replay(move, 200, false);
  result = await send(`Cancel my appointment #${booked.id}.`); const cancel = proposal(result, "cancel");
  assert.equal((await currentAppointment(booked.id)).status, "booked"); record("model-selected cancellation proposal, no write before confirmation", result);
  result = await approve("cancel"); assert.equal(receipt(result).appointment.status, "cancelled"); assert.equal((await currentSlot(second)).is_booked, false); record("model-selected confirmed cancellation persisted", result);
  await replay(cancel, 200, false);
  for (const text of ["Hello, what can you do?", "Show available dermatologists.", "Which Tamil-speaking doctors are available tomorrow?", "Show my appointments.", "What medicine should I take for a skin rash?", "Book me something."]) {
    await page.goto("/"); result = await send(text);
    if (text.includes("medicine")) { assert.match(result.reply, /cannot|can't|unable|not able|do not|don't|not qualified|not a doctor|not a medical/i); assert.equal(result.steps.some(s => s.writes), false); }
    if (text === "Book me something.") { assert.match(result.reply, /\?/); assert.equal(result.steps.some(s => s.writes), false); }
    if (text.startsWith("Which Tamil")) { assert.ok(result.steps.some(s => s.tool === "searchDoctors")); assert.ok(result.steps.some(s => s.tool === "getAvailableSlots")); }
    if (text === "Show my appointments.") assert.ok(result.steps.some(s => s.tool === "getMyAppointments"));
    record(text, result);
  }
  assert.deepEqual(browserErrors, []); console.log("PASS no browser console/hydration errors during live agent workflow");
} catch (error) {
  console.log("FAIL " + redact(error.message)); results.push({ name: "live workflow", status: "FAIL", message: redact(error.message) }); process.exitCode = 1;
} finally {
  if (slotIds.length) {
    const a = await db.from("appointments").delete().in("slot_id", slotIds); assert.ifError(a.error);
    const s = await db.from("slots").delete().in("id", slotIds); assert.ifError(s.error);
  }
  const after = { slots: await allRows("slots"), appointments: await allRows("appointments") };
  assert.ok(JSON.stringify(before) === JSON.stringify(after), "Existing records changed; inspect privately.");
  console.log(`PASS cleanup preserved ${before.slots.length} existing slots and ${before.appointments.length} existing appointments`);
  await writeFile("test-results/agent-workflow/results.json", JSON.stringify({ date: new Date().toISOString(), results, consoleErrors: browserErrors.map(redact), existingDataPreserved: true }, null, 2));
  await browser.close();
}
