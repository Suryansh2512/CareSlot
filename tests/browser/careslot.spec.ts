import { test, expect, type Page } from "@playwright/test";
const department = { id: "D02", name: "Dermatology", common_issues: "skin rash, acne" };
const doctor = { id: "DR03", name: "Dr. Nisha Menon", department_id: "D02", qualification: "MBBS, MD (Dermatology)", experience_years: 12, consultation_fee: 700, languages: ["English", "Tamil"], room: "1-03", department };
const slot = { id: 7, doctor_id: "DR03", slot_date: "2099-01-02", start_time: "10:00:00", is_booked: false };
const appointment = { id: 1, doctor_id: "DR03", slot_id: 7, reason: "Follow-up", status: "booked", created_at: "2026-11-12T00:00:00Z", doctor, slot };
async function login(page: Page) {
  await page.goto("/login"); await page.getByLabel("Team passcode").fill(process.env.CARESLOT_E2E_PASSCODE!);
  await page.getByRole("button", { name: "Continue to CareSlot" }).click(); await expect(page).toHaveURL("/");
}
async function fixtures(page: Page) {
  // Browser-only HTTP fixtures. They are never imported by application code.
  await page.route("**/api/doctors*", route => route.fulfill({ json: { doctors: [doctor], departments: [department] } }));
  await page.route("**/api/slots*", route => route.fulfill({ json: { slots: [slot], timezone: "Asia/Kolkata" } }));
  await page.route("**/api/appointments", route => route.request().method() === "GET" ? route.fulfill({ json: { appointments: [appointment] } }) : route.continue());
}
test("real server protects every clinic API and page", async ({ request, page }) => {
  for (const path of ["/api/doctors", "/api/slots?doctor_id=DR03", "/api/appointments"]) expect((await request.get(path)).status()).toBe(401);
  expect((await request.post("/api/agent", { data: { messages: [{ role: "user", text: "hi" }] } })).status()).toBe(401);
  expect((await request.post("/api/appointments", { data: { action: { kind: "cancel", appointment_id: 1 } } })).status()).toBe(401);
  await page.goto("/appointments"); await expect(page).toHaveURL("/login");
});
test("login errors and missing environment states are visible without secrets", async ({ page }) => {
  await page.goto("/login"); await page.getByLabel("Team passcode").fill("wrong-passcode");
  await page.getByRole("button", { name: "Continue to CareSlot" }).click(); await expect(page.locator(".notice.error")).toContainText("Wrong passcode");
  await login(page); await expect(page.locator(".notice.error")).toContainText("SUPABASE_URL");
  await page.getByLabel("Your appointment request").fill("Find a skin doctor");
  await page.getByRole("button", { name: "Send message" }).click(); await expect(page.getByRole("log").getByRole("alert")).toContainText("SUPABASE_URL");
});
test("query validation rejects another patient and malformed inputs before database access", async ({ page }) => {
  await login(page);
  for (const url of ["/api/appointments?patient_id=P002", "/api/appointments?status=invalid", "/api/slots?doctor_id=bad", "/api/slots?doctor_id=DR03&date=2026-02-30", "/api/doctors?patient_id=P002"]) {
    const response = await page.request.get(url); expect(response.status()).toBe(400);
  }
});
for (const width of [360, 1440]) {
  test(`all required pages fit ${width}px with real components and browser-only data fixtures`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); await fixtures(page); await login(page);
    await expect(page.getByRole("heading", { name: "How can I help you today?" })).toBeVisible();
    for (const path of ["/", "/doctors", "/appointments"]) {
      await page.goto(path); await expect(page.getByText("Dr. Nisha Menon", { exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto("/doctors"); await page.getByRole("button", { name: "View available slots" }).click();
    await expect(page.getByRole("button", { name: /10:00/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/doctors-${width}.png`, fullPage: true, caret: "initial" });
    await page.goto("/"); await page.screenshot({ path: `test-results/booking-${width}.png`, fullPage: true, caret: "initial" });
  });
}
test("direct booking requires explicit confirmation and displays a returned receipt", async ({ page }) => {
  await fixtures(page);
  let writes = 0;
  await page.route("**/api/appointments", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { appointments: [appointment] } });
    const body = route.request().postDataJSON();
    if (!body.confirmation) return route.fulfill({ json: { requires_confirmation: true, changed: false, token: "browser-only-fixture", action: body.action, title: "Confirm your appointment", doctor: doctor.name, department: department.name, date: slot.slot_date, time: slot.start_time, room: doctor.room, fee: doctor.consultation_fee } });
    writes++; return route.fulfill({ json: { changed: true, appointment: { id: 42, status: "booked" } } });
  });
  await login(page); await page.goto("/doctors"); await page.getByRole("button", { name: "View available slots" }).click();
  await page.getByRole("button", { name: /10:00/ }).click(); await expect(page.getByRole("dialog")).toBeVisible();
  expect(writes).toBe(0); await page.getByRole("button", { name: "Confirm appointment", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Appointment #42 booked");
  expect(writes).toBe(1);
});
test("chat shows provider tool traces and confirmation before a write (mock provider response)", async ({ page }) => {
  await fixtures(page);
  let calls = 0;
  await page.route("**/api/agent", async route => {
    calls++;
    const body = route.request().postDataJSON();
    if (!body.confirmation) return route.fulfill({ json: { reply: "Please confirm this visit.", steps: [{ tool: "bookAppointment", args: { slot_id: 7 }, ok: true, writes: true, result: { requires_confirmation: true, changed: false, token: "browser-only-fixture", action: { kind: "book", slot_id: 7 }, title: "Confirm your appointment", doctor: doctor.name, department: department.name, date: slot.slot_date, time: slot.start_time, room: doctor.room, fee: doctor.consultation_fee } }] } });
    return route.fulfill({ json: { reply: "Appointment #42 booked.", steps: [{ tool: "bookAppointment", args: { slot_id: 7 }, ok: true, writes: true, result: { changed: true, appointment: { id: 42, status: "booked" } } }] } });
  });
  await login(page); await page.getByLabel("Your appointment request").fill("Book a skin doctor");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("bookAppointment", { exact: true })).toBeVisible(); expect(calls).toBe(1);
  await page.getByRole("button", { name: "Confirm appointment", exact: true }).click();
  await expect(page.getByText("Database confirmed", { exact: true })).toBeVisible(); expect(calls).toBe(2);
});
test("appointment screen reschedules and cancels only after confirmation (HTTP fixtures)", async ({ page }) => {
  await fixtures(page);
  let current = { ...appointment }, writes = 0;
  const target = { ...slot, id: 8, start_time: "11:00:00" };
  await page.route("**/api/slots*", route => route.fulfill({ json: { slots: [target] } }));
  await page.route("**/api/appointments", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { appointments: [current] } });
    const body = route.request().postDataJSON();
    if (!body.confirmation) return route.fulfill({ json: {
      requires_confirmation: true, changed: false, token: "browser-only-fixture", action: body.action,
      title: body.action.kind === "cancel" ? "Cancel this appointment?" : "Confirm your new appointment time",
      doctor: doctor.name, department: department.name, date: target.slot_date, time: target.start_time,
      room: doctor.room, fee: doctor.consultation_fee, appointment_id: 1,
    } });
    writes++;
    current = { ...current, slot_id: body.action.kind === "reschedule" ? target.id : current.slot_id, slot: target, status: body.action.kind === "cancel" ? "cancelled" : "booked" };
    return route.fulfill({ json: { changed: true, appointment: { id: 1, status: current.status } } });
  });
  await login(page); await page.goto("/appointments");
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  await page.getByRole("button", { name: /11:00/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible(); expect(writes).toBe(0);
  await page.getByRole("button", { name: "Confirm appointment", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Appointment #1 rescheduled");
  await page.getByRole("button", { name: "Cancel appointment", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible(); expect(writes).toBe(1);
  await page.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Appointment #1 cancelled");
  await page.getByRole("tab", { name: "Cancelled", exact: true }).click();
  await expect(page.getByText("Dr. Nisha Menon", { exact: true })).toBeVisible(); expect(writes).toBe(2);
});
