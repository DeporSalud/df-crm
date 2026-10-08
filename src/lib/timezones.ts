/**
 * Canonical Europe/Madrid timezone utility module.
 * Dance Factory operates exclusively in Alcorcón (Madrid, Spain).
 * Standard Time: CET (UTC+1). Daylight Saving Time: CEST (UTC+2).
 */

export const MADRID_TIMEZONE = "Europe/Madrid";

/**
 * Returns the current date formatted as "YYYY-MM-DD" in Europe/Madrid.
 */
export function getMadridDateISO(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MADRID_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

/**
 * Alias for getMadridDateISO ("YYYY-MM-DD" in Europe/Madrid).
 */
export function getMadridDateString(date: Date | string = new Date()): string {
  return getMadridDateISO(date);
}

/**
 * Returns the current time formatted as "HH:mm" in Europe/Madrid.
 */
export function getMadridTimeString(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "00:00";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MADRID_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
}

/**
 * Returns the current Date object representing "now".
 */
export function nowMadrid(): Date {
  return new Date();
}

/**
 * Converts a Madrid local date ("YYYY-MM-DD") and optional time ("HH:mm" or "HH:mm:ss")
 * into a UTC Date object, correctly accounting for CET/CEST daylight saving time.
 */
export function toMadridDate(dateStr: string, timeStr: string = "00:00:00"): Date {
  const cleanDate = dateStr.trim();
  const [y, m, d] = cleanDate.split("-").map(Number);
  const cleanTime = timeStr.trim();
  const [h = 0, min = 0, s = 0] = cleanTime.split(":").map(Number);

  // Initial UTC estimate
  const utcEstimate = new Date(Date.UTC(y, m - 1, d, h, min, s));

  // Determine what time utcEstimate evaluates to in Europe/Madrid
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MADRID_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });

  const parts = formatter.formatToParts(utcEstimate);
  const p: Record<string, string> = {};
  parts.forEach(pt => { p[pt.type] = pt.value; });

  const targetMs = Date.UTC(y, m - 1, d, h, min, s);
  const hourNum = p.hour === "24" ? 0 : Number(p.hour);
  const actualMadridMs = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hourNum,
    Number(p.minute),
    Number(p.second)
  );
  const diffMs = targetMs - actualMadridMs;

  return new Date(utcEstimate.getTime() + diffMs);
}

/**
 * Returns the UTC ISO string ("YYYY-MM-DDTHH:mm:ss.sssZ") corresponding
 * to a scheduled class session in Madrid local time.
 */
export function toMadridSessionISO(dateStr: string, timeStr: string = "19:00"): string {
  return toMadridDate(dateStr, timeStr).toISOString();
}

/**
 * Returns the exact UTC start and end bounds covering the full 24-hour day in Europe/Madrid.
 * Used for database queries: .gte("fecha_hora", startISO).lte("fecha_hora", endISO).
 *
 * Example (October 8 CEST):
 * startISO: "2026-10-07T22:00:00.000Z" (00:00:00 Madrid)
 * endISO:   "2026-10-08T21:59:59.999Z" (23:59:59.999 Madrid)
 */
export function getMadridDayRangeUTC(dateStr: string): { startISO: string; endISO: string } {
  const startUTC = toMadridDate(dateStr, "00:00:00");
  const endUTC = new Date(toMadridDate(dateStr, "23:59:59").getTime() + 999);
  return {
    startISO: startUTC.toISOString(),
    endISO: endUTC.toISOString()
  };
}

/**
 * Checks if a timestamp belongs to the given Madrid calendar date ("YYYY-MM-DD").
 */
export function isSameMadridDay(timestamp: string | Date, targetDateStr: string): boolean {
  return getMadridDateISO(timestamp) === targetDateStr.trim();
}

/**
 * Calculates remaining hours from now until a session begins in Madrid.
 * Negative if already past.
 */
export function getMadridHoursRemaining(dateStr: string, timeStr: string = "19:00"): number {
  const sessionDateUTC = toMadridDate(dateStr, timeStr);
  const now = new Date();
  return (sessionDateUTC.getTime() - now.getTime()) / (1000 * 60 * 60);
}
