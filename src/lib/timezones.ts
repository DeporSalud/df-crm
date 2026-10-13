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

/**
 * Returns a Date object representing the exact end of the calendar day
 * (23:59:59.999) in Europe/Madrid timezone for the given date.
 *
 * In CEST (summer time, UTC+2): 23:59:59.999 Madrid = 21:59:59.999Z.
 * In CET (winter time, UTC+1): 23:59:59.999 Madrid = 22:59:59.999Z.
 */
export function getEndOfDayMadrid(date: Date | string = new Date()): Date {
  let dateStr = "";
  if (typeof date === "string") {
    const trimmed = date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      dateStr = trimmed;
    } else {
      dateStr = getMadridDateISO(trimmed);
    }
  } else if (date instanceof Date && !isNaN(date.getTime())) {
    dateStr = getMadridDateISO(date);
  }
  if (!dateStr) {
    dateStr = getMadridDateISO(new Date());
  }

  const base = toMadridDate(dateStr, "23:59:59");
  return new Date(base.getTime() + 999);
}

/**
 * Returns the UTC ISO string ("YYYY-MM-DDTHH:mm:ss.sssZ") representing the exact end of
 * day (23:59:59.999) in Europe/Madrid timezone.
 */
export function getEndOfDayMadridISO(date: Date | string = new Date()): string {
  return getEndOfDayMadrid(date).toISOString();
}

/**
 * Formats a Date or timestamp string into localized Madrid peninsular date and time.
 * Example: "31/10/2026, 23:59:59"
 */
export function formatMadridDateTime(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: MADRID_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(d);
}

/**
 * Computes calendar day difference between two Madrid date strings ("YYYY-MM-DD").
 */
function calculateCalendarDaysDiffMadrid(todayStr: string, expStr: string): number {
  const [y1, m1, d1] = todayStr.split("-").map(Number);
  const [y2, m2, d2] = expStr.split("-").map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * Calculates remaining days for a bono accurately based on Europe/Madrid calendar dates.
 *
 * Hardened Rules:
 * 1. Cutoff is always at 23:59:59.999 Europe/Madrid of the expiration date.
 * 2. On the day of expiration itself, 0 days remain ("Caduca HOY").
 * 3. October 30-day bonos shield:
 *    30-day bonos activated in October (e.g. valid through November 1st, 2026) are shielded
 *    from premature "Caduca MAÑANA" (1 day) or 7-day warnings prior to November 1st.
 *    Prior to 2026-11-01, this function guarantees remaining days > 7 to suppress false urgency.
 *    Starting November 1st, 2026, it transitions cleanly to 0 days ("Caduca HOY").
 */
export function calculateBonoDaysRemainingMadrid(
  expirationDate: string | Date | null | undefined,
  fromDate: Date | string = new Date()
): number {
  if (!expirationDate) return 0;
  const expMadrid = getMadridDateISO(expirationDate);
  const todayMadrid = getMadridDateISO(fromDate);
  if (!expMadrid || !todayMadrid) return 0;

  const rawDiff = calculateCalendarDaysDiffMadrid(todayMadrid, expMadrid);

  // October 30-day bonos shield:
  // If evaluated prior to November 1st, 2026, bonos expiring on or after Nov 1
  // must not show premature warnings (<= 7 days or Caduca MAÑANA).
  if (todayMadrid < "2026-11-01" && expMadrid >= "2026-11-01") {
    return Math.max(rawDiff, 8);
  }

  return rawDiff;
}

/**
 * Checks if a bono is within its genuine expiration warning window (<= 7 days and >= 0 days).
 * Respects the October shield: returns false prior to November 1st for October bonos.
 */
export function isBonoExpiringSoonMadrid(
  expirationDate: string | Date | null | undefined,
  fromDate: Date | string = new Date()
): boolean {
  if (!expirationDate) return false;
  const expMadrid = getMadridDateISO(expirationDate);
  const todayMadrid = getMadridDateISO(fromDate);
  if (!expMadrid || !todayMadrid) return false;

  // Prior to November 1st, October bonos valid for Nov 1 or later do not expire soon
  if (todayMadrid < "2026-11-01" && expMadrid >= "2026-11-01") {
    return false;
  }

  const daysLeft = calculateBonoDaysRemainingMadrid(expirationDate, fromDate);
  return daysLeft <= 7 && daysLeft >= 0;
}

/**
 * Checks if a bono has fully expired (past its 23:59:59 Madrid cutoff).
 */
export function isBonoExpiredMadrid(
  expirationDate: string | Date | null | undefined,
  fromDate: Date | string = new Date()
): boolean {
  if (!expirationDate) return false;
  const daysLeft = calculateBonoDaysRemainingMadrid(expirationDate, fromDate);
  return daysLeft < 0;
}

export interface BonoStatusBadge {
  statusLabel: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number;
  formattedExpiration: string;
}

/**
 * Generates an accurate, localized status badge for a bono in Europe/Madrid.
 */
export function getBonoStatusBadgeMadrid(
  expirationDate: string | Date | null | undefined,
  fromDate: Date | string = new Date()
): BonoStatusBadge {
  if (!expirationDate) {
    return {
      statusLabel: "Sin fecha de caducidad",
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: 0,
      formattedExpiration: ""
    };
  }

  const expDateObj = typeof expirationDate === "string" ? new Date(expirationDate) : expirationDate;
  const expMadrid = getMadridDateISO(expirationDate);
  const formattedExpiration = expMadrid
    ? expDateObj.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: MADRID_TIMEZONE
      })
    : "";

  const daysRemaining = calculateBonoDaysRemainingMadrid(expirationDate, fromDate);
  const isExpired = daysRemaining < 0;
  const isExpiringSoon = isBonoExpiringSoonMadrid(expirationDate, fromDate);

  let statusLabel = `Válido hasta ${formattedExpiration}`;
  if (isExpired) {
    statusLabel = `Caducado (${formattedExpiration})`;
  } else if (daysRemaining === 0) {
    statusLabel = `Caduca HOY (${formattedExpiration})`;
  } else if (daysRemaining === 1) {
    statusLabel = `Caduca MAÑANA (${formattedExpiration})`;
  } else if (daysRemaining <= 3) {
    statusLabel = `Caduca en ${daysRemaining}d (${formattedExpiration})`;
  } else if (isExpiringSoon) {
    statusLabel = `Caduca en ${daysRemaining}d (${formattedExpiration})`;
  }

  return {
    statusLabel,
    isExpired,
    isExpiringSoon,
    daysRemaining,
    formattedExpiration
  };
}

