/** Today's date in India (YYYY-MM-DD). Used in the system prompt so "tomorrow" works. */
export function todayInIndia(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", calendar: "gregory", numberingSystem: "latn",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: "year" | "month" | "day") => parts.find(p => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
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

// A SQL date is a clinic calendar date, not a browser-local instant.
export function formatClinicDay(date: string): number { return Number(date.slice(8, 10)); }
export function formatClinicMonth(date: string): string {
  return new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" })
    .format(new Date(`${date}T12:00:00+05:30`));
}
