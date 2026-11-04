/**
 * Utilidades compartidas para programación de clases por fecha concreta
 * y rotación semanal de profesores (sin alterar columnas de Supabase).
 */

export const DF_SCHEDULE_MARKER = " ||DF_FECHAS:";

export type ClassScheduleMode = "semanal" | "por_semana" | "fecha_unica";

export interface ParsedClassSchedule {
  mode: ClassScheduleMode;
  baseProfesor: string;
  fechaUnica?: string;
  porFecha: Record<string, string>;
}

const DIAS_SEMANA_INDEX: Record<string, number> = {
  DOMINGO: 0,
  LUNES: 1,
  MARTES: 2,
  MIÉRCOLES: 3,
  MIERCOLES: 3,
  JUEVES: 4,
  VIERNES: 5,
  SÁBADO: 6,
  SABADO: 6,
};

const INDEX_TO_DIA_SEMANA: string[] = [
  "DOMINGO",
  "LUNES",
  "MARTES",
  "MIÉRCOLES",
  "JUEVES",
  "VIERNES",
  "SÁBADO",
];

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_LARGOS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function extractDateISO(input?: string | null): string {
  if (!input) return "";
  const trimmed = String(input).trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

export function getTodayMadridISO(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value || "2026";
    const m = parts.find((p) => p.type === "month")?.value || "01";
    const d = parts.find((p) => p.type === "day")?.value || "01";
    return `${y}-${m}-${d}`;
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export function getDayOfWeekSpanishFromISO(dateISO: string): string {
  const clean = extractDateISO(dateISO);
  if (!clean) return "LUNES";
  const [y, m, d] = clean.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return INDEX_TO_DIA_SEMANA[dt.getDay()] || "LUNES";
}

export function formatShortSpanishDate(dateISO?: string | null): string {
  const clean = extractDateISO(dateISO);
  if (!clean) return "";
  const [y, m, d] = clean.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  const dayShort = DIAS_CORTOS[dt.getDay()] || "";
  const monthShort = MESES_CORTOS[dt.getMonth()] || "";
  return `${dayShort} ${d} ${monthShort}`;
}

export function formatLongSpanishDate(dateISO?: string | null): string {
  const clean = extractDateISO(dateISO);
  if (!clean) return "";
  const [y, m, d] = clean.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  const dayName = INDEX_TO_DIA_SEMANA[dt.getDay()] || "";
  const dayCap = dayName.charAt(0) + dayName.slice(1).toLowerCase();
  const monthName = MESES_LARGOS[dt.getMonth()] || "";
  return `${dayCap} ${d} de ${monthName} ${y}`;
}

export interface UpcomingDayOption {
  dateISO: string;
  labelShort: string;
  labelFull: string;
  isToday: boolean;
}

export function getUpcomingDatesForDayOfWeek(
  diaSemana: string,
  count: number = 8,
  fromDateISO?: string
): UpcomingDayOption[] {
  const normDay = (diaSemana || "LUNES").trim().toUpperCase();
  const targetDow = DIAS_SEMANA_INDEX[normDay] ?? 1;
  const startISO = extractDateISO(fromDateISO) || getTodayMadridISO();
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const cursor = new Date(sy, sm - 1, sd, 12, 0, 0);
  const todayISO = getTodayMadridISO();

  while (cursor.getDay() !== targetDow) {
    cursor.setDate(cursor.getDate() + 1);
  }

  const out: UpcomingDayOption[] = [];
  for (let i = 0; i < count; i++) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;
    out.push({
      dateISO: iso,
      labelShort: formatShortSpanishDate(iso),
      labelFull: formatLongSpanishDate(iso),
      isToday: iso === todayISO,
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}

export function stripScheduleMarker(rawProfesor?: string | null): string {
  if (!rawProfesor) return "";
  const str = String(rawProfesor);
  const idx = str.indexOf("||DF_FECHAS:");
  if (idx === -1) return str.trim();
  return str.slice(0, idx).trim();
}

export function parseClassSchedule(rawProfesor?: string | null): ParsedClassSchedule {
  if (!rawProfesor) {
    return { mode: "semanal", baseProfesor: "", porFecha: {} };
  }
  const str = String(rawProfesor);
  const markerIdx = str.indexOf("||DF_FECHAS:");
  if (markerIdx === -1) {
    return { mode: "semanal", baseProfesor: str.trim(), porFecha: {} };
  }

  const cleanVisible = str.slice(0, markerIdx).trim();
  const jsonPart = str.slice(markerIdx + "||DF_FECHAS:".length).trim();

  try {
    const parsed = JSON.parse(jsonPart);
    const modeRaw = parsed?.m;
    if (modeRaw === "fecha_unica" && typeof parsed?.d === "string" && extractDateISO(parsed.d)) {
      return {
        mode: "fecha_unica",
        baseProfesor: cleanVisible || String(parsed?.b || "").trim(),
        fechaUnica: extractDateISO(parsed.d),
        porFecha: {},
      };
    }
    if (modeRaw === "por_semana" && parsed?.f && typeof parsed.f === "object") {
      const porFecha: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.f)) {
        const cleanDate = extractDateISO(k);
        const cleanTeacher = stripScheduleMarker(String(v || "")).trim();
        if (cleanDate && cleanTeacher) {
          porFecha[cleanDate] = cleanTeacher;
        }
      }
      const base = stripScheduleMarker(String(parsed?.b || cleanVisible || "")).trim();
      return {
        mode: Object.keys(porFecha).length > 0 ? "por_semana" : "semanal",
        baseProfesor: base || Object.values(porFecha)[0] || "",
        porFecha,
      };
    }
  } catch {
    // Fallback limpio al nombre visible sin romper jamás la UI
  }

  return { mode: "semanal", baseProfesor: cleanVisible, porFecha: {} };
}

export function encodeClassSchedule(params: {
  mode: ClassScheduleMode;
  baseProfesor: string;
  fechaUnica?: string;
  porFecha?: Record<string, string>;
}): string {
  const cleanBase = stripScheduleMarker(params.baseProfesor).toUpperCase().trim();

  if (params.mode === "fecha_unica") {
    const cleanDate = extractDateISO(params.fechaUnica);
    if (cleanDate) {
      const teacher = cleanBase || "POR ASIGNAR";
      return `${teacher}${DF_SCHEDULE_MARKER}${JSON.stringify({
        m: "fecha_unica",
        d: cleanDate,
      })}`;
    }
    return cleanBase;
  }

  if (params.mode === "por_semana" && params.porFecha) {
    const sortedEntries = Object.entries(params.porFecha)
      .map(([d, t]) => [extractDateISO(d), stripScheduleMarker(t).toUpperCase().trim()] as const)
      .filter(([d, t]) => Boolean(d && t))
      .sort(([a], [b]) => a.localeCompare(b));

    if (sortedEntries.length > 0) {
      const mapObj: Record<string, string> = {};
      for (const [d, t] of sortedEntries) {
        mapObj[d] = t;
      }
      const todayISO = getTodayMadridISO();
      const nextUpcomingEntry = sortedEntries.find(([d]) => d >= todayISO) || sortedEntries[0];
      const fallbackBase = cleanBase || nextUpcomingEntry[1];
      const visibleLead = nextUpcomingEntry[1] || fallbackBase;
      return `${visibleLead}${DF_SCHEDULE_MARKER}${JSON.stringify({
        m: "por_semana",
        b: fallbackBase,
        f: mapObj,
      })}`;
    }
  }

  return cleanBase;
}

function extractRawProfesor(claseOrRawProf: any): string {
  if (typeof claseOrRawProf === "string") return claseOrRawProf;
  return String(claseOrRawProf?.raw_profesor ?? claseOrRawProf?.profesor ?? "");
}

export function isClassActiveOnDate(claseOrRawProf: any, dateISO?: string | null): boolean {
  const cleanTarget = extractDateISO(dateISO);
  if (!cleanTarget) return true;
  const sched = parseClassSchedule(extractRawProfesor(claseOrRawProf));
  if (sched.mode === "fecha_unica" && sched.fechaUnica) {
    return sched.fechaUnica === cleanTarget;
  }
  return true;
}

export function isSingleDateClassExpired(claseOrRawProf: any, referenceDateISO?: string): boolean {
  const sched = parseClassSchedule(extractRawProfesor(claseOrRawProf));
  if (sched.mode !== "fecha_unica" || !sched.fechaUnica) return false;
  const ref = extractDateISO(referenceDateISO) || getTodayMadridISO();
  return sched.fechaUnica < ref;
}

export function getTeacherForClassDate(
  claseOrRawProf: any,
  dateISO?: string | null
): string {
  const rawProf = extractRawProfesor(claseOrRawProf);
  const diaSemana =
    typeof claseOrRawProf === "object" && claseOrRawProf?.dia_semana
      ? String(claseOrRawProf.dia_semana)
      : "";
  const sched = parseClassSchedule(rawProf);

  const cleanDate = extractDateISO(dateISO);
  if (cleanDate && sched.mode === "por_semana") {
    if (sched.porFecha[cleanDate]) {
      return sched.porFecha[cleanDate];
    }
    return sched.baseProfesor;
  }

  if (sched.mode === "por_semana") {
    const todayISO = getTodayMadridISO();
    if (diaSemana) {
      const nextSession = getUpcomingDatesForDayOfWeek(diaSemana, 1, todayISO)[0];
      if (nextSession && sched.porFecha[nextSession.dateISO]) {
        return sched.porFecha[nextSession.dateISO];
      }
    }
    const nextMapped = Object.entries(sched.porFecha)
      .filter(([d]) => d >= todayISO)
      .sort(([a], [b]) => a.localeCompare(b))[0];
    if (nextMapped) return nextMapped[1];
  }

  return sched.baseProfesor;
}

export function getAllTeachersInSchedule(claseOrRawProf: any): string[] {
  const rawProf = extractRawProfesor(claseOrRawProf);
  const sched = parseClassSchedule(rawProf);
  const set = new Set<string>();
  if (sched.baseProfesor) set.add(sched.baseProfesor);
  for (const t of Object.values(sched.porFecha)) {
    if (t) set.add(t);
  }
  return Array.from(set);
}
