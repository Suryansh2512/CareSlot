import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { requireEnv } from "./env";
import { actionSchema, type ClinicAction } from "./schemas";
import { ClinicError } from "./errors";
import { CURRENT_USER_ID } from "./currentUser";
const payloadSchema = z.strictObject({ action: actionSchema, patient: z.literal("P001"), expires: z.number(), expected_slot_id: z.number().int().positive().optional() });
type Payload = z.infer<typeof payloadSchema>;
function signature(body: string) {
  return createHmac("sha256", requireEnv("APP_PASSCODE")).update(`careslot-confirmation:${body}`).digest("base64url");
}
export function signConfirmation(action: ClinicAction, expectedSlotId?: number): string {
  const payload: Payload = { action, patient: CURRENT_USER_ID, expires: Date.now() + 10 * 60_000, expected_slot_id: expectedSlotId };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signature(body)}`;
}
export function readConfirmation(token: string): Payload {
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra) throw new ClinicError("Invalid confirmation. Review the appointment again.");
  const expected = Buffer.from(signature(body)), actual = Buffer.from(mac);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new ClinicError("Invalid confirmation. Review the appointment again.");
  let payload: Payload;
  try { payload = payloadSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString())); }
  catch { throw new ClinicError("Invalid confirmation. Review the appointment again."); }
  if (payload.expires < Date.now()) throw new ClinicError("Confirmation expired. Review the appointment again.", 409);
  return payload;
}
export function sameAction(a: ClinicAction, b: ClinicAction): boolean {
  return JSON.stringify(actionSchema.parse(a)) === JSON.stringify(actionSchema.parse(b));
}
