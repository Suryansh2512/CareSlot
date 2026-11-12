import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Real browser, real API, real hosted data. No response fixtures or intercepted data.
// Run: node --env-file=.env.local scripts/verify-live-browser.mjs [--writes] [--gemini]
const baseURL = process.env.CARESLOT_BASE_URL ?? "http://127.0.0.1:3300";
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const browser = await chromium.launch();
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [], results = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", message => { if (message.type() === "error" && !message.text().includes("Failed to load resource")) errors.push(message.text()); });
const secrets = ["GEMINI_API_KEY", "OPENROUTER_API_KEY", "SUPABASE_SECRET_KEY", "APP_PASSCODE"].map(k => process.env[k]).filter(Boolean);
const redact = message => secrets.reduce((text, secret) => text.split(secret).join("[REDACTED]"), String(message));
async function check(name, run) {
  try { await run(); results.push({ name, status: "PASS" }); console.log("PASS " + name); }
  catch (e) { const message = redact(e.message); results.push({ name, status: "FAIL", message }); console.log("FAIL " + name + ": " + message); }
}
await mkdir("test-results/live-browser", { recursive: true });
let testSlotIds = [];
try {
  await check("live passcode login and wrong-passcode feedback", async () => {
    await page.goto("/login"); await page.getByLabel("Team passcode").fill("wrong-live-test");
    await page.getByRole("button", { name: "Continue to CareSlot" }).click(); await expect(page.getByText("Wrong passcode.", { exact: true })).toBeVisible();
    await page.getByLabel("Team passcode").fill(process.env.APP_PASSCODE); await page.getByRole("button", { name: "Continue to CareSlot" }).click();
    await expect(page).toHaveURL(baseURL + "/"); await expect(page.getByRole("heading", { name: "How can I help you today?" })).toBeVisible();
  });
  await check("live doctor search, specialty and language filters", async () => {
    await page.goto("/doctors"); await expect(page.locator(".doctor-card")).toHaveCount(15);
    await page.getByLabel("Specialty", { exact: true }).selectOption("D02"); await expect(page.locator(".doctor-card")).toHaveCount(2);
    await page.getByLabel("Language", { exact: true }).selectOption("Tamil"); await expect(page.locator(".doctor-card")).toHaveCount(1);
    await expect(page.locator(".doctor-card")).toContainText("Dr. Nisha Menon");
    await page.getByLabel("Search doctors", { exact: true }).fill("no-such-doctor-verified"); await expect(page.getByRole("heading", { name: "No doctors found" })).toBeVisible();
    await page.getByLabel("Search doctors", { exact: true }).fill("Nisha"); await expect(page.locator(".doctor-card")).toHaveCount(1);
    await page.getByRole("button", { name: "View available slots" }).click(); await expect(page.locator(".slot-button").first()).toBeVisible();
  });
  await check("live signed booking proposal and dismiss without writing", async () => {
    const pendingResponse = page.waitForResponse(r => r.url().endsWith("/api/appointments") && r.request().method() === "POST");
    await page.locator(".slot-button").first().click();
    const response = await pendingResponse; assert.equal(response.status(), 200); const pending = await response.json();
    assert.equal(pending.requires_confirmation, true); assert.ok(pending.token); await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Keep browsing", exact: true }).click(); await expect(page.getByRole("dialog")).not.toBeVisible();
  });
  for (const width of [360, 1440]) await check(`live required pages at ${width}px`, async () => {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ["/", "/doctors", "/appointments"]) {
      await page.goto(path); await expect(page.locator(".notice.error")).toHaveCount(0);
      if (path === "/doctors") await expect(page.locator(".doctor-card")).toHaveCount(15);
      if (path === "/appointments") await expect(page.locator(".appointment-card").first()).toBeVisible();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${path}`);
      // Do not inject Playwright's caret-hiding style during React hydration.
      await page.screenshot({ path: `test-results/live-browser/${path === "/" ? "chat" : path.slice(1)}-${width}.png`, fullPage: true, caret: "initial" });
    }
  });
  if (process.argv.includes("--agent") || process.argv.includes("--gemini")) await check("live selected-provider tool traces or accurate provider error state", async () => {
    await page.goto("/"); await page.getByLabel("Your appointment request").fill("Show me dermatologists who speak Tamil.");
    const response = page.waitForResponse(r => r.url().endsWith("/api/agent"), { timeout: 65_000 });
    await page.getByRole("button", { name: "Send message" }).click(); const r = await response;
    const data = await r.json();
    if (r.ok()) {
      assert.ok(data.steps.some(s => s.tool === "searchDoctors" && s.ok));
      await expect(page.getByText("searchDoctors", { exact: true }).first()).toBeVisible();
      await page.locator(".tool-steps summary").first().click(); await expect(page.locator(".tool-steps pre").first()).toBeVisible();
    } else {
      assert.ok([429, 503, 504].includes(r.status())); await expect(page.getByRole("log").getByRole("alert")).toBeVisible();
      console.log(`LIVE MODEL UI: provider HTTP ${r.status()}; error feedback verified, live tool traces NOT verified in this browser request.`);
    }
  });
  if (process.argv.includes("--writes")) {
    await check("live browser confirmed booking, rescheduling and cancellation on isolated slots", async () => {
      const date = new Date(Date.now() + 29 * 86_400_000).toISOString().slice(0, 10);
      const inserted = await db.from("slots").insert(["14:00", "14:30"].map(start_time => ({ doctor_id: "DR03", slot_date: date, start_time, is_booked: false }))).select("id");
      assert.ifError(inserted.error); testSlotIds = inserted.data.map(s => s.id);
      await page.goto("/doctors"); await page.getByLabel("Search doctors", { exact: true }).fill("Nisha");
      await expect(page.locator(".doctor-card")).toHaveCount(1); await page.getByRole("button", { name: "View available slots" }).click();
      await page.getByLabel("Appointment date", { exact: true }).fill(date); await expect(page.locator(".slot-button")).toHaveCount(2);
      await page.locator(".slot-button").first().click(); await expect(page.getByRole("dialog")).toBeVisible();
      let receiptResponse = page.waitForResponse(r => r.url().endsWith("/api/appointments") && r.request().method() === "POST");
      await page.getByRole("button", { name: "Confirm appointment", exact: true }).click();
      let response = await receiptResponse; assert.equal(response.status(), 200); const receipt = await response.json(); const id = receipt.appointment.id;
      await expect(page.getByRole("status")).toContainText(`Appointment #${id} booked`);
      await page.goto("/appointments"); const card = page.locator(".appointment-card").filter({ hasText: `Appointment #${id}` });
      await expect(card).toBeVisible(); await card.getByRole("button", { name: "Reschedule", exact: true }).click();
      await card.getByLabel("Appointment date", { exact: true }).fill(date); await expect(card.locator(".slot-button")).toHaveCount(1);
      await card.locator(".slot-button").click(); await expect(page.getByRole("dialog")).toBeVisible();
      receiptResponse = page.waitForResponse(r => r.url().endsWith("/api/appointments") && r.request().method() === "POST");
      await page.getByRole("button", { name: "Confirm appointment", exact: true }).click();
      response = await receiptResponse; assert.equal(response.status(), 200); assert.equal((await response.json()).appointment.id, id);
      await expect(page.getByRole("status")).toContainText(`Appointment #${id} rescheduled`);
      await card.getByRole("button", { name: "Cancel appointment", exact: true }).click(); await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: "Confirm cancellation", exact: true }).click(); await expect(page.getByRole("status")).toContainText(`Appointment #${id} cancelled`);
      const current = await db.from("appointments").select("status").eq("id", id).single(); assert.ifError(current.error); assert.equal(current.data.status, "cancelled");
      const slots = await db.from("slots").select("is_booked").in("id", testSlotIds); assert.ifError(slots.error); assert.ok(slots.data.every(s => !s.is_booked));
      await page.reload(); await page.getByRole("tab", { name: "Cancelled", exact: true }).click(); await expect(card).toBeVisible();
    });
  }
  await check("no browser console, hydration or uncaught errors", async () => { assert.deepEqual(errors, []); });
} finally {
  if (testSlotIds.length) {
    const a = await db.from("appointments").delete().in("slot_id", testSlotIds); assert.ifError(a.error);
    const s = await db.from("slots").delete().in("id", testSlotIds); assert.ifError(s.error);
  }
  await browser.close();
  await writeFile("test-results/live-browser/results.json", JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
}
console.log(`Live browser verification: ${results.filter(r => r.status === "PASS").length} passed, ${results.filter(r => r.status === "FAIL").length} failed.`);
process.exitCode = results.some(r => r.status === "FAIL") ? 1 : 0;
