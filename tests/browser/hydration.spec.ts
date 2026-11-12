import { test, expect } from "@playwright/test";

// Fixtures are confined to this regression test; application data remains live.
const department = { id: "D02", name: "Dermatology", common_issues: "skin rash" };
const doctor = { id: "DR03", name: "Dr. Nisha Menon", department_id: "D02", qualification: "MBBS, MD", experience_years: 12, consultation_fee: 700, languages: ["Tamil"], room: "1-03", department };
const slot = { id: 7, doctor_id: "DR03", slot_date: "2099-01-02", start_time: "10:00:00", is_booked: false };
const appointment = { id: 1, doctor_id: "DR03", slot_id: 7, status: "booked", created_at: "2026-11-12T00:00:00Z", doctor, slot };

for (const timezone of ["Pacific/Honolulu", "Asia/Kolkata", "Pacific/Kiritimati"]) {
  test.describe(timezone, () => {
    test.use({ timezoneId: timezone, locale: "en-US" });
    for (const width of [360, 1440]) test(`SSR and hydrated pages agree at ${width}px with a different browser clock`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", e => errors.push(e.message));
      page.on("console", m => { if (/hydrat|server.rendered|did not match|client rendering/i.test(m.text())) errors.push(m.text()); });
      await page.clock.setFixedTime(new Date("2098-12-31T18:31:00Z")); // Jan 1 in clinic time, different from the server clock.
      await page.setViewportSize({ width, height: 1000 });
      await page.route("**/api/doctors*", r => r.fulfill({ json: { doctors: [doctor], departments: [department] } }));
      await page.route("**/api/slots*", r => r.fulfill({ json: { slots: [slot] } }));
      await page.route("**/api/appointments", r => r.fulfill({ json: { appointments: [appointment] } }));
      await page.goto("/login"); await page.getByLabel("Team passcode").fill(process.env.CARESLOT_E2E_PASSCODE!);
      await page.getByRole("button", { name: "Continue to CareSlot" }).click(); await expect(page).toHaveURL("/");
      for (const path of ["/", "/appointments", "/doctors"]) {
        await page.goto(path); await expect(page.getByText(doctor.name, { exact: true }).first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (path !== "/doctors") await expect(page.locator(".appointment-date strong")).toHaveText("2");
      }
      await page.getByRole("button", { name: "View available slots" }).click();
      await expect(page.getByLabel("Appointment date", { exact: true })).toHaveAttribute("min", "2099-01-01");
      await expect(page.locator(".slot-button")).toContainText("10:00");
      await page.reload(); await expect(page.getByText(doctor.name, { exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}
