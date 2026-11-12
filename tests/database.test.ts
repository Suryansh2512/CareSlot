import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import type { Client } from "pg";

let cluster: EmbeddedPostgres, db: Client, root: string;
const migration = await readFile(new URL("../seed/ps3_atomic_operations.sql", import.meta.url), "utf8");
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "careslot-db-"));
  const port = await new Promise<number>((resolve, reject) => { const s = createServer(); s.on("error", reject); s.listen(0, "127.0.0.1", () => { const address = s.address(); const p = typeof address === "object" && address ? address.port : 0; s.close(() => resolve(p)); }); });
  cluster = new EmbeddedPostgres({ databaseDir: path.join(root, "data"), user: "postgres", password: randomBytes(24).toString("hex"), port, persistent: true, authMethod: "scram-sha-256", postgresFlags: ["-h", "127.0.0.1"], onLog: () => {}, onError: () => {} });
  await cluster.initialise(); await cluster.start();
  db = cluster.getPgClient(); await db.connect();
  // These mimic Supabase's roles only in this disposable local cluster.
  await db.query("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.query(await readFile(new URL("../seed/ps3_clinic_appointments.sql", import.meta.url), "utf8"));
  await db.query(migration);
  await db.query("grant usage on schema public to service_role; grant all on all tables in schema public to service_role; grant usage, select on all sequences in schema public to service_role;");
}, { timeout: 90_000 });
after(async () => {
  await db?.end(); await cluster?.stop();
  if (root && path.dirname(root) === path.resolve(tmpdir()) && path.basename(root).startsWith("careslot-db-")) await rm(root, { recursive: true, force: true });
});
async function slot(booked = false, past = false, doctor = "DR03") {
  const result = await db.query("insert into slots(doctor_id,slot_date,start_time,is_booked) values ($1,current_date + $2::int, '15:00', $3) returning id", [doctor, past ? -100 - seq++ : 100 + seq++, booked]);
  return Number(result.rows[0].id);
}
let seq = 0;
async function book(id: number) { return (await db.query("select careslot_book($1,'test appointment') as result", [id])).rows[0].result; }
async function cancel(id: number) { return (await db.query("select careslot_cancel($1) as result", [id])).rows[0].result; }
async function move(id: number, target: number, expected: number) { return (await db.query("select careslot_reschedule($1,$2,$3) as result", [id, target, expected])).rows[0].result; }
async function getSlot(id: number) { return (await db.query("select * from slots where id=$1", [id])).rows[0]; }
async function getAppointment(id: number) { return (await db.query("select * from appointments where id=$1", [id])).rows[0]; }

test("migration is repeatable and preserves seeded occupancy without appointment rows", async () => {
  const before = (await db.query("select id from slots where is_booked and id not in (select slot_id from appointments) order by id")).rows;
  assert.ok(before.length > 0);
  await db.query(migration);
  assert.deepEqual((await db.query("select id from slots where is_booked and id not in (select slot_id from appointments) order by id")).rows, before);
  const future = (await db.query("select id from slots where is_booked and slot_date > current_date and id not in (select slot_id from appointments) limit 1")).rows[0];
  await assert.rejects(book(Number(future.id)), /already booked/);
});
test("successful booking derives doctor and marks slot occupied", async () => {
  const id = await slot(), result = await book(id);
  assert.equal(result.changed, true); assert.equal(result.appointment.patient_id, "P001"); assert.equal(result.appointment.doctor_id, "DR03");
  assert.equal((await getSlot(id)).is_booked, true);
});
test("duplicate booking is rejected", async () => {
  const id = await slot(); await book(id); await assert.rejects(book(id), /already booked/);
  assert.equal((await db.query("select count(*)::int n from appointments where slot_id=$1", [id])).rows[0].n, 1);
});
test("past slot cannot be booked", async () => { const id = await slot(false, true); await assert.rejects(book(id), /future slot/); assert.equal((await getSlot(id)).is_booked, false); });
test("invalid slot ID is rejected", async () => { await assert.rejects(book(999999999), /Slot not found/); });
test("booking rolls back its slot flag if appointment insertion fails", async () => {
  const id = await slot();
  await assert.rejects(db.query("select careslot_book($1,repeat('x',501))", [id]), /500 characters/);
  assert.equal((await getSlot(id)).is_booked, false);
  // A failure AFTER setting is_booked also rolls back (forced only in disposable DB).
  await db.query("create function public.test_fail_insert() returns trigger language plpgsql as $$ begin raise exception 'forced insertion failure'; end $$; create trigger test_fail before insert on appointments for each row execute function public.test_fail_insert();");
  try { await assert.rejects(book(id), /forced insertion failure/); assert.equal((await getSlot(id)).is_booked, false); }
  finally { await db.query("drop trigger test_fail on appointments; drop function public.test_fail_insert();"); }
});
test("successful cancellation releases slot", async () => {
  const id = await slot(), a = await book(id); const result = await cancel(a.appointment.id);
  assert.equal(result.appointment.status, "cancelled"); assert.equal((await getSlot(id)).is_booked, false);
});
test("repeated cancellation never frees a subsequently rebooked slot", async () => {
  const id = await slot(), a = await book(id); await cancel(a.appointment.id); const second = await book(id);
  assert.equal((await cancel(a.appointment.id)).changed, false);
  assert.equal((await getSlot(id)).is_booked, true); assert.equal((await getAppointment(second.appointment.id)).status, "booked");
});
test("unauthorized cancellation and rescheduling are rejected without changes", async () => {
  const id = await slot(true), target = await slot();
  const a = (await db.query("insert into appointments(patient_id,doctor_id,slot_id) values('P002','DR03',$1) returning id", [id])).rows[0];
  await assert.rejects(cancel(a.id), /Appointment not found/); await assert.rejects(move(a.id, target, id), /Appointment not found/);
  assert.equal((await getSlot(id)).is_booked, true); assert.equal((await getSlot(target)).is_booked, false);
});
test("completed appointment cannot be changed", async () => {
  const id = await slot(), a = await book(id); await db.query("update appointments set status='completed' where id=$1", [a.appointment.id]);
  await assert.rejects(cancel(a.appointment.id), /Completed/); await assert.rejects(move(a.appointment.id, await slot(), id), /Only booked/);
});
test("reschedule preserves ID, moves doctor and updates both flags", async () => {
  const old = await slot(), target = await slot(false, false, "DR04"), a = await book(old);
  const result = await move(a.appointment.id, target, old);
  assert.equal(result.appointment.id, a.appointment.id); assert.equal(result.appointment.slot_id, target); assert.equal(result.appointment.doctor_id, "DR04");
  assert.equal((await getSlot(old)).is_booked, false); assert.equal((await getSlot(target)).is_booked, true);
});
test("occupied target rejects rescheduling and preserves original appointment", async () => {
  const old = await slot(), target = await slot(true), a = await book(old);
  await assert.rejects(move(a.appointment.id, target, old), /already booked/);
  assert.equal(Number((await getAppointment(a.appointment.id)).slot_id), old); assert.equal((await getSlot(old)).is_booked, true);
});
test("past and missing reschedule targets preserve original booking", async () => {
  const old = await slot(), a = await book(old);
  await assert.rejects(move(a.appointment.id, await slot(false, true), old), /future slot/);
  await assert.rejects(move(a.appointment.id, 999999999, old), /Slot not found/);
  assert.equal(Number((await getAppointment(a.appointment.id)).slot_id), old);
});
test("stale reschedule approval and same-slot requests are safe", async () => {
  const old = await slot(), target = await slot(), a = await book(old);
  assert.equal((await move(a.appointment.id, old, old)).changed, false);
  await move(a.appointment.id, target, old);
  await assert.rejects(move(a.appointment.id, await slot(), old), /changed/);
});
test("concurrent bookings over separate PostgreSQL connections have exactly one winner", async () => {
  const id = await slot(), clients = [cluster.getPgClient(), cluster.getPgClient()];
  await Promise.all(clients.map(c => c.connect()));
  try {
    const results = await Promise.allSettled(clients.map(c => c.query("select careslot_book($1,null)", [id])));
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(results.filter(r => r.status === "rejected").length, 1);
    assert.equal((await db.query("select count(*)::int n from appointments where slot_id=$1 and status='booked'", [id])).rows[0].n, 1);
  } finally { await Promise.all(clients.map(c => c.end())); }
});
test("concurrent reschedule and cancellation leave no orphan flags", async () => {
  const old = await slot(), target = await slot(), a = await book(old), clients = [cluster.getPgClient(), cluster.getPgClient()];
  await Promise.all(clients.map(c => c.connect()));
  try {
    await Promise.allSettled([clients[0].query("select careslot_reschedule($1,$2,$3)", [a.appointment.id, target, old]), clients[1].query("select careslot_cancel($1)", [a.appointment.id])]);
    assert.equal((await getAppointment(a.appointment.id)).status, "cancelled");
    assert.equal((await getSlot(old)).is_booked, false); assert.equal((await getSlot(target)).is_booked, false);
  } finally { await Promise.all(clients.map(c => c.end())); }
});
test("database constraints reject duplicate occupancy and mismatched doctor", async () => {
  const id = await slot(); await book(id);
  await assert.rejects(db.query("insert into appointments(patient_id,doctor_id,slot_id) values('P001','DR03',$1)", [id]), /unique/);
  await assert.rejects(db.query("insert into appointments(patient_id,doctor_id,slot_id) values('P001','DR04',$1)", [await slot()]), /foreign key/);
});
test("concurrent reschedules to one target have one winner and preserve the loser", async () => {
  const old1 = await slot(), old2 = await slot(), target = await slot();
  const a = await book(old1), b = await book(old2), clients = [cluster.getPgClient(), cluster.getPgClient()];
  await Promise.all(clients.map(c => c.connect()));
  try {
    const results = await Promise.allSettled([
      clients[0].query("select careslot_reschedule($1,$2,$3)", [a.appointment.id, target, old1]),
      clients[1].query("select careslot_reschedule($1,$2,$3)", [b.appointment.id, target, old2]),
    ]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    const loser = results[0].status === "rejected" ? { id: a.appointment.id, slot: old1 } : { id: b.appointment.id, slot: old2 };
    assert.equal(Number((await getAppointment(loser.id)).slot_id), loser.slot);
    assert.equal((await getSlot(loser.slot)).is_booked, true);
    assert.equal((await getSlot(target)).is_booked, true);
  } finally { await Promise.all(clients.map(c => c.end())); }
});
test("sensitive functions deny public roles and allow service_role", async () => {
  const result = (await db.query("select has_function_privilege('anon','careslot_book(bigint,text)','execute') as anon, has_function_privilege('authenticated','careslot_cancel(bigint)','execute') as authenticated, has_function_privilege('service_role','careslot_reschedule(bigint,bigint,bigint)','execute') as server")).rows[0];
  assert.deepEqual(result, { anon: false, authenticated: false, server: true });
  const id = await slot(); await db.query("set role service_role");
  try { assert.ok((await book(id)).appointment.id); } finally { await db.query("reset role"); }
});
