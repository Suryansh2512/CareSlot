/** Today's date in India (YYYY-MM-DD). Used in the system prompt so "tomorrow" works. */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function weekdayInIndia(): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long" }).format(
    new Date()
  );
}

export function isFutureSlot(slot: { slot_date: string; start_time: string }, now = Date.now()): boolean {
  return new Date(`${slot.slot_date}T${slot.start_time}+05:30`).getTime() > now;
}
export function formatClinicDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${date}T12:00:00+05:30`));
}
export function formatClinicTime(time: string): string {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(`2000-01-01T${time}+05:30`));
}
