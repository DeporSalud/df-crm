import { supabase } from "@/lib/supabase/client";
import { getMadridHoursRemaining, getMadridDayRangeUTC, toMadridDate } from "@/lib/timezones";
import { publishSyncEvent } from "./syncEventBus";
import { logActivity } from "@/lib/activityLogger";
export function isTeacherProfile(student?: any, emailOrId?: string, userRole?: string): boolean {
  if (!student && !emailOrId && !userRole) return false;
  const plan = (student?.plan_activo || "").toLowerCase();
  const name = (student?.nombre_completo || student?.name || "").toLowerCase();
  const email = (student?.email || emailOrId || "").toLowerCase();
  const role = (student?.rol || userRole || "").toLowerCase();
  const dni = (student?.dni || "").toUpperCase();
  const nfc = String(student?.nfc_token || "").toUpperCase();

  if (role === "profesor" || role === "docente" || role === "admin" || role === "administrador") return true;
  if (plan.includes("docente") || plan.includes("profesor") || plan.includes("profesora")) return true;
  if (email.endsWith("@dancefactory.es") && !email.startsWith("alumno")) return true;
  if (dni.startsWith("PROF-") || dni.startsWith("DOC-")) return true;
  if (nfc.startsWith("PROF-")) return true;
  return false;
}

export interface OpenClassReserva {
  id: string;
  alumno_id: string;
  alumno_nombre: string;
  clase_id: string;
  nombre_clase: string;
  profesor: string;
  sede: string;
  sala?: string;
  fecha_iso: string; // e.g. "2026-09-21"
  fecha_formateada: string; // e.g. "Lunes 21 de Septiembre"
  dia_semana: string; // e.g. "LUNES"
  hora_inicio: string; // e.g. "19:00"
  hora_fin: string; // e.g. "20:30"
  creado_en: string;
  estado: "Confirmada" | "Cancelada" | "Asistida";
  alumno_email?: string;
  alumno_telefono?: string;
  alumno_dni?: string;
  alumno_plan?: string;
  asistido?: boolean;
}

export interface CalendarDayItem {
  dateISO: string; // "2026-09-21"
  dayName: string; // "LUNES"
  dayShort: string; // "LUN"
  dayNumber: number; // 21
  monthName: string; // "Septiembre"
  monthShort: string; // "Sep"
  fullLabel: string; // "Lunes 21 Sep"
  isToday: boolean;
  isTomorrow: boolean;
  year?: number;
}

export const LEGACY_ID_MAP: Record<string, string> = {
  "oc_lunes_1": "71b12578-d254-4354-bb1c-e0ebfd0178aa",
  "oc_lunes_2": "1ee1eefb-7f1a-4423-ac6a-04030c5c0282",
  "oc_martes_1": "85165dff-e126-4d32-90d4-2212c2fbb244",
  "oc_miercoles_1": "1d7df61b-a65e-4f35-82b2-3d34242abb87",
  "oc_miercoles_2": "6a374f52-f6d8-447c-be48-e8fe3eca8faf",
  "oc_jueves_1": "39807014-ee30-4112-99cf-6b361c820834",
};

export const TEACHER_DB_ID_MAP: Record<string, string> = {
  "1001": "c57fb3d0-525f-474a-8de7-d6d504b540be", // Lucía Muñoz
  "LUCIA MUNOZ": "c57fb3d0-525f-474a-8de7-d6d504b540be",
  "LUCÍA MUÑOZ": "c57fb3d0-525f-474a-8de7-d6d504b540be",
  "1002": "2d95e851-b927-494b-9558-d7ed6d447a20", // Lucía Zamorano
  "LUCIA ZAMORANO": "2d95e851-b927-494b-9558-d7ed6d447a20",
  "LUCÍA ZAMORANO": "2d95e851-b927-494b-9558-d7ed6d447a20",
  "1003": "7a100300-0000-4000-a000-000000001003", // Andrea Soto
  "ANDREA SOTO": "7a100300-0000-4000-a000-000000001003",
  "1004": "80c59814-1ab4-4793-9039-e8fe1c5ef681", // Eva Leiva
  "EVA LEIVA": "80c59814-1ab4-4793-9039-e8fe1c5ef681",
  "1005": "7a100500-0000-4000-a000-000000001005", // Lucas López
  "LUCAS LOPEZ": "7a100500-0000-4000-a000-000000001005",
  "LUCAS LÓPEZ": "7a100500-0000-4000-a000-000000001005",
  "1006": "32d7139b-b2a2-4084-9322-d86cda358df7", // Paula Jiménez
  "PAULA JIMENEZ": "32d7139b-b2a2-4084-9322-d86cda358df7",
  "PAULA JIMÉNEZ": "32d7139b-b2a2-4084-9322-d86cda358df7",
  "1007": "7a100700-0000-4000-a000-000000001007", // Abel y Nayara
  "1008": "7a100800-0000-4000-a000-000000001008", // Darío Humberto
  "1009": "7a100900-0000-4000-a000-000000001009", // Nerea Olivares
  "1010": "7a101000-0000-4000-a000-000000001010", // Alejandro Rovina
  "1011": "7a101100-0000-4000-a000-000000001011", // Nil Barberá
  "1012": "145547d1-643c-40aa-9144-305893e8f64c", // Mario Gadea
  "1013": "0812eb2d-bcb5-4f9e-b690-1beaafcd3e61", // Daniela Mérida
  "1014": "e9cc4200-aba2-4e67-8191-808c40e75621", // Marta García Vázquez
  "2026": "ffd8f04a-5f63-4c8b-b638-9f9483df8d3c", // Ruth Domínguez
  "9998": "ffd8f04a-5f63-4c8b-b638-9f9483df8d3c",
  "9999": "ffd8f04a-5f63-4c8b-b638-9f9483df8d3c"
};

export function normalizeClaseId(id: string): string {
  if (!id) return "";
  return LEGACY_ID_MAP[id] || id;
}

export const DEFAULT_STUDIO2_OPEN_CLASSES = [
  {
    id: "71b12578-d254-4354-bb1c-e0ebfd0178aa", // Andrea Soto
    nombre_clase: "OPEN CLASS COMERCIAL",
    profesor: "Andrea Soto",
    dia_semana: "LUNES",
    hora_inicio: "19:00",
    hora_fin: "20:00",
    sede: "castilla",
    sala: "Sala 1",
    aforo_maximo: 20,
    tipo_clase: "Open Class"
  },
  {
    id: "1ee1eefb-7f1a-4423-ac6a-04030c5c0282", // Nil Barberá
    nombre_clase: "OPEN CLASS COMERCIAL",
    profesor: "Nil Barberá",
    dia_semana: "LUNES",
    hora_inicio: "20:00",
    hora_fin: "21:00",
    sede: "castilla",
    sala: "Sala 1",
    aforo_maximo: 20,
    tipo_clase: "Open Class"
  },
  {
    id: "85165dff-e126-4d32-90d4-2212c2fbb244", // Nerea Olivares
    nombre_clase: "OPEN CLASS HEELS",
    profesor: "Nerea Olivares",
    dia_semana: "MARTES",
    hora_inicio: "19:30",
    hora_fin: "20:45",
    sede: "castilla",
    sala: "Sala 1",
    aforo_maximo: 20,
    tipo_clase: "Open Class"
  },
  {
    id: "1d7df61b-a65e-4f35-82b2-3d34242abb87", // Alejandro Rovina
    nombre_clase: "OPEN CLASS URBAN",
    profesor: "Alejandro Rovina",
    dia_semana: "MIÉRCOLES",
    hora_inicio: "19:00",
    hora_fin: "20:00",
    sede: "castilla",
    sala: "Sala 1",
    aforo_maximo: 20,
    tipo_clase: "Open Class"
  },
  {
    id: "6a374f52-f6d8-447c-be48-e8fe3eca8faf", // Mario Gadea
    nombre_clase: "OPEN CLASS COMERCIAL",
    profesor: "Mario Gadea",
    dia_semana: "MIÉRCOLES",
    hora_inicio: "20:00",
    hora_fin: "21:00",
    sede: "castilla",
    sala: "Sala 1",
    aforo_maximo: 18,
    tipo_clase: "Open Class"
  },
  {
    id: "39807014-ee30-4112-99cf-6b361c820834", // Formación Rotativa
    nombre_clase: "FORMACIÓN ROTATIVA",
    profesor: "Formación Rotativa",
    dia_semana: "JUEVES",
    hora_inicio: "20:30",
    hora_fin: "21:45",
    sede: "castilla",
    sala: "Sala 1",
    aforo_maximo: 20,
    tipo_clase: "Open Class"
  }
];

const STORAGE_KEY = "df_openclass_reservas_v2";

/**
 * Strips time and leading/trailing whitespace from ISO dates, and standardizes formats (including DD/MM/YYYY)
 */
export function cleanDateISO(fechaISO: string | null | undefined): string {
  if (!fechaISO) return "";
  const raw = String(fechaISO).split("T")[0].split(" ")[0].trim();
  const normalized = raw.replace(/[\/\.]/g, "-");
  const parts = normalized.split("-").map(Number);
  if (parts.length === 3 && parts.every(n => !isNaN(n))) {
    if (parts[0] > 31 || /^\d{2}-\d{2}-\d{2}$/.test(normalized)) {
      // YYYY-MM-DD or YY-MM-DD
      const y = parts[0] < 100 ? 2000 + parts[0] : parts[0];
      const m = String(parts[1]).padStart(2, "0");
      const d = String(parts[2]).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } else if (parts[2] > 31) {
      // DD-MM-YYYY
      const y = parts[2] < 100 ? 2000 + parts[2] : parts[2];
      const m = String(parts[1]).padStart(2, "0");
      const d = String(parts[0]).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  return raw;
}

/**
 * Creates a CalendarDayItem from a standard Date object
 */
export function createCalendarDayFromDate(d: Date): CalendarDayItem {
  const now = new Date();
  const dayOfWeek = d.getDay();
  const dayNamesEs = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
  const dayShortEs = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const monthNamesEs = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const monthShortEs = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
  ];

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const dateISO = `${year}-${month}-${day}`;
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  return {
    dateISO,
    dayName: dayNamesEs[dayOfWeek],
    dayShort: dayShortEs[dayOfWeek],
    dayNumber: d.getDate(),
    monthName: monthNamesEs[d.getMonth()],
    monthShort: monthShortEs[d.getMonth()],
    fullLabel: isToday ? "Hoy" : isTomorrow ? "Mañana" : `${dayShortEs[dayOfWeek]} ${d.getDate()} ${monthShortEs[d.getMonth()]}`,
    isToday,
    isTomorrow,
    year
  };
}

/**
 * Creates a CalendarDayItem from a YYYY-MM-DD string or ISO timestamp
 */
export function createCalendarDayFromISO(dateISO: string): CalendarDayItem {
  if (!dateISO) return createCalendarDayFromDate(new Date());
  const cleanISO = cleanDateISO(dateISO);
  const parts = cleanISO.split("-").map(Number);
  const rawYear = parts[0] || new Date().getFullYear();
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const month = Math.max(0, Math.min(11, (parts[1] || 1) - 1));
  const maxDayInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.max(1, Math.min(maxDayInMonth, parts[2] || 1));
  const date = new Date(year, month, day);
  date.setFullYear(year);
  return createCalendarDayFromDate(date);
}

/**
 * Formats a calendar item or ISO date as "Lunes 21 de Septiembre"
 */
export function formatFullCalendarDate(calendarDay: CalendarDayItem | string | null | undefined): string {
  if (!calendarDay) return "";
  const isoFallback = (calendarDay as any)?.dateISO || (calendarDay as any)?.fecha_iso;
  const item = typeof calendarDay === "string" 
    ? createCalendarDayFromISO(calendarDay) 
    : (calendarDay as any) instanceof Date
    ? createCalendarDayFromDate(calendarDay as unknown as Date)
    : !(calendarDay as CalendarDayItem).dayName && isoFallback
    ? createCalendarDayFromISO(isoFallback)
    : calendarDay as CalendarDayItem;

  if (!item || !item.dayName) return "";
  const dayCap = item.dayName.charAt(0) + item.dayName.slice(1).toLowerCase();
  return `${dayCap} ${item.dayNumber} de ${item.monthName}`;
}

/**
 * Generates the upcoming calendar dates for booking (next daysCount days starting from today or startDate)
 */
export function getUpcomingCalendarDates(daysCount = 28, startDate?: Date): CalendarDayItem[] {
  const list: CalendarDayItem[] = [];
  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now);

  for (let i = 0; i < daysCount; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    // Skip Sundays if studio is closed on Sunday
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0) continue;

    list.push(createCalendarDayFromDate(d));
  }

  return list;
}

export const DAY_NAME_TO_INDEX: Record<string, number> = {
  "DOMINGO": 0,
  "LUNES": 1,
  "MARTES": 2,
  "MIERCOLES": 3,
  "MIÉRCOLES": 3,
  "JUEVES": 4,
  "VIERNES": 5,
  "SABADO": 6,
  "SÁBADO": 6,
};

export function normalizeDay(day: string): string {
  return (day || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Calculates the next calendar date (YYYY-MM-DD) that falls on targetDayName, on or after baseDateStr
 */
export function getNextDateForDay(baseDateStr: string, targetDayName: string): string {
  const normTarget = normalizeDay(targetDayName);
  const targetIndex = DAY_NAME_TO_INDEX[normTarget] ?? 1; // Default to LUNES
  const cleanBase = cleanDateISO(baseDateStr) || "2026-09-14";
  const parts = cleanBase.split("-").map(Number);
  const y = parts[0] || 2026;
  const m = (parts[1] || 9) - 1;
  const d = parts[2] || 14;
  
  const dateObj = new Date(y, m, d);
  const currentDay = dateObj.getDay();
  const diff = (targetIndex - currentDay + 7) % 7;
  dateObj.setDate(dateObj.getDate() + diff);

  const resY = dateObj.getFullYear();
  const resM = String(dateObj.getMonth() + 1).padStart(2, "0");
  const resD = String(dateObj.getDate()).padStart(2, "0");
  return `${resY}-${resM}-${resD}`;
}

export function getTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Calculates the next upcoming session date (YYYY-MM-DD) on or after today for a given class
 */
export function getNextUpcomingSessionDate(clase: any, baseDateISO?: string): string {
  const todayISO = cleanDateISO(baseDateISO) || getTodayISO();
  const diaSemana = (typeof clase === "string" ? clase : clase?.dia_semana) || "LUNES";
  return getNextDateForDay(todayISO, diaSemana);
}

/**
 * Generates the upcoming weekly sessions for a specific class (e.g. all upcoming Mondays)
 */
export function getUpcomingSessionsForClass(clase: any, count = 8, startFromISO = "2026-09-14"): CalendarDayItem[] {
  const diaSemana = (typeof clase === "string" ? clase : clase?.dia_semana) || "LUNES";
  const firstDateISO = getNextDateForDay(startFromISO, diaSemana);
  const parts = cleanDateISO(firstDateISO).split("-").map(Number);
  const list: CalendarDayItem[] = [];
  
  for (let i = 0; i < count; i++) {
    const d = new Date(parts[0], parts[1] - 1, parts[2] + (i * 7));
    list.push(createCalendarDayFromDate(d));
  }
  return list;
}

export function normalizeSede(sede: string): "tejar" | "castilla" {
  const s = (sede || "").toLowerCase();
  if (s.includes("tejar") || s.includes("mostoles") || s.includes("móstoles") || s.includes("studio 1") || s.includes("el tejar")) {
    return "tejar";
  }
  return "castilla";
}

export function formatSedeName(sede: string): string {
  return normalizeSede(sede) === "tejar"
    ? "Studio 1 Plaza El Tejar"
    : "Studio 2 Paseo Castilla";
}

export function getSesionReservasCount(claseId: string, fechaISO: string): number {
  const cleanISO = cleanDateISO(fechaISO);
  if (!cleanISO || !claseId) return 0;
  const targetId = normalizeClaseId(claseId);
  const all = getOpenClassReservas();
  return all.filter(r => normalizeClaseId(r.clase_id) === targetId && r.fecha_iso === cleanISO && (r.estado === "Confirmada" || r.estado === "Asistida")).length;
}

export function getReservasCountForDate(fechaISO: string): number {
  const cleanISO = cleanDateISO(fechaISO);
  if (!cleanISO) return 0;
  const all = getOpenClassReservas();
  return all.filter(r => r.fecha_iso === cleanISO && (r.estado === "Confirmada" || r.estado === "Asistida")).length;
}

export function isSesionCompleta(clase: any, fechaISO: string, aforoMaximo?: number): boolean {
  if (!clase) return false;
  const cleanISO = cleanDateISO(fechaISO);
  if (!cleanISO) return false;
  const claseId = typeof clase === "string" ? clase : clase.id;
  if (!claseId) return false;
  const maxCapacity = aforoMaximo || (typeof clase === "object" && clase.aforo_maximo) || 20;
  const currentCount = getSesionReservasCount(claseId, cleanISO);
  return currentCount >= maxCapacity;
}

export function getOpenClassReservas(): OpenClassReserva[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: OpenClassReserva[] = JSON.parse(raw);
    return parsed.map(r => ({
      ...r,
      clase_id: normalizeClaseId(r.clase_id)
    }));
  } catch (e) {
    return [];
  }
}

export function saveOpenClassReservas(reservas: OpenClassReserva[], options?: { silentBroadcast?: boolean }): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(reservas);
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing === serialized) {
      // Sin cambios: evitar escrituras innecesarias y bucles de re-renderizado
      return;
    }
    localStorage.setItem(STORAGE_KEY, serialized);
    window.dispatchEvent(new Event("df_reservas_updated"));
    if (!options?.silentBroadcast) {
      publishSyncEvent("df_reservas_updated");
    }
  } catch (e) {
    console.error("Error saving openclass reservas:", e);
  }
}

export function getReservasAlumno(alumnoId: string): OpenClassReserva[] {
  const all = getOpenClassReservas();
  return all
    .filter(r => r.alumno_id === alumnoId && (r.estado === "Confirmada" || r.estado === "Asistida"))
    .sort((a, b) => (a.fecha_iso || "").localeCompare(b.fecha_iso || ""));
}

export function isAlumnoReservadoEnSesion(alumnoId: string, claseId: string, fechaISO: string): boolean {
  const cleanISO = cleanDateISO(fechaISO);
  if (!cleanISO || !alumnoId || !claseId) return false;
  const targetId = normalizeClaseId(claseId);
  const all = getOpenClassReservas();
  return all.some(r => 
    r.alumno_id === alumnoId && 
    normalizeClaseId(r.clase_id) === targetId && 
    r.fecha_iso === cleanISO && 
    (r.estado === "Confirmada" || r.estado === "Asistida")
  );
}

export function crearReservaOpenClass(data: {
  alumno_id: string;
  alumno_nombre: string;
  clase: any;
  calendarDay: CalendarDayItem;
  alumno_email?: string;
  alumno_telefono?: string;
  alumno_dni?: string;
  alumno_plan?: string;
}): OpenClassReserva {
  const cleanISO = cleanDateISO(data.calendarDay.dateISO);
  if (!cleanISO) {
    throw new Error("Fecha de calendario inválida para reserva de Open Class.");
  }

  const classUUID = normalizeClaseId(data.clase.id);

  // Idempotency: Check if the student already holds a confirmed/attended reservation first
  const current = getOpenClassReservas();
  const existing = current.find(r => 
    r.alumno_id === data.alumno_id && 
    normalizeClaseId(r.clase_id) === classUUID && 
    r.fecha_iso === cleanISO && 
    (r.estado === "Confirmada" || r.estado === "Asistida")
  );
  if (existing) {
    return existing;
  }

  const maxCapacity = data.clase.aforo_maximo || 20;

  // Validación de aforo mínimo (4 personas) y corte de 5 horas previas
  const sessionStatus = getOpenClassSessionStatus(
    classUUID,
    cleanISO,
    data.clase.hora_inicio,
    maxCapacity
  );

  if (!sessionStatus.puedeReservar) {
    throw new Error(sessionStatus.motivoBloqueo || "No es posible reservar esta clase (suspendida o aforo completo).");
  }

  if (isSesionCompleta(data.clase, cleanISO, maxCapacity)) {
    throw new Error(`Aforo completo para la clase ${data.clase.nombre_clase} en fecha ${cleanISO}`);
  }

  const dayCap = data.calendarDay.dayName.charAt(0) + data.calendarDay.dayName.slice(1).toLowerCase();
  const nueva: OpenClassReserva = {
    id: `res_sb_${data.alumno_id}_${classUUID}_${cleanISO}`,
    alumno_id: data.alumno_id,
    alumno_nombre: data.alumno_nombre,
    alumno_email: data.alumno_email,
    alumno_telefono: data.alumno_telefono,
    alumno_dni: data.alumno_dni,
    alumno_plan: data.alumno_plan,
    clase_id: classUUID,
    nombre_clase: data.clase.nombre_clase,
    profesor: data.clase.profesor,
    sede: normalizeSede(data.clase.sede || "castilla"),
    sala: data.clase.sala || "Sala 1",
    fecha_iso: cleanISO,
    fecha_formateada: `${dayCap} ${data.calendarDay.dayNumber} de ${data.calendarDay.monthName}`,
    dia_semana: data.calendarDay.dayName,
    hora_inicio: data.clase.hora_inicio,
    hora_fin: data.clase.hora_fin,
    creado_en: new Date().toISOString(),
    estado: "Confirmada",
    asistido: false
  };

  const updated = [nueva, ...current];
  saveOpenClassReservas(updated);
  return nueva;
}

export function getReservasPorClaseYSesion(claseId: string, fechaISO: string): OpenClassReserva[] {
  const cleanISO = cleanDateISO(fechaISO);
  if (!cleanISO || !claseId) return [];
  const targetId = normalizeClaseId(claseId);
  const all = getOpenClassReservas();
  return all.filter(r => 
    normalizeClaseId(r.clase_id) === targetId && 
    cleanDateISO(r.fecha_iso) === cleanISO && 
    (r.estado === "Confirmada" || r.estado === "Asistida")
  );
}

/**
 * Calculates hours remaining until session start in Europe/Madrid.
 * Negative number if already started/past.
 */
export function getHorasRestantesParaSesion(fechaISO?: string, horaInicio?: string): number {
  const cleanISO = cleanDateISO(fechaISO || "");
  if (!cleanISO) return 0;
  return getMadridHoursRemaining(cleanISO, horaInicio || "19:00");
}

export const OPEN_CLASS_MIN_STUDENTS = 4;
export const OPEN_CLASS_CUTOFF_HOURS = 5;

export interface OpenClassSessionStatus {
  status: "abierta" | "confirmada" | "suspendida_aforo_minimo" | "finalizada";
  horasRestantes: number;
  reservasCount: number;
  minimoRequerido: number;
  puedeReservar: boolean;
  refundRequired?: boolean;
  motivoBloqueo?: string;
  badgeText: string;
  badgeColor: string;
}

/**
 * Conjunto de sesiones suspendidas persistidas en localStorage.
 */
export function getSuspendedSessions(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("df_suspended_sessions_v1");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Comprueba si una sesión específica está suspendida manualmente por Administración.
 */
export function isSesionSuspendida(claseId: string, fechaISO: string): boolean {
  if (typeof window === "undefined") return false;
  const sessionKey = `${normalizeClaseId(claseId)}_${cleanDateISO(fechaISO)}`;
  const list = getSuspendedSessions();
  return list.includes(sessionKey);
}

/**
 * Helper canonical evaluator for Open Class cutoff rules.
 * NOTA: A petición de Administración (Lucía), la regla automática de corte a las 5h
 * fue eliminada para no suspender clases automáticamente. Las sesiones sólo se suspenden
 * cuando Administración lo ejecuta manualmente.
 */
export function evaluateOpenClassCutoff(
  hoursRemaining: number,
  studentCount: number,
  arg3: number = 20,
  arg4?: number,
  isSuspended?: boolean
) {
  const minStudents = typeof arg4 === "number" ? arg3 : OPEN_CLASS_MIN_STUDENTS;
  const maxCapacity = typeof arg4 === "number" ? arg4 : (typeof arg3 === "number" ? arg3 : 20);

  if (hoursRemaining <= 0) {
    return {
      status: "finalizada" as const,
      puedeReservar: false,
      refundRequired: false,
      badgeText: "Finalizada",
      reason: "La sesión ya ha comenzado o finalizado."
    };
  }

  if (isSuspended) {
    return {
      status: "suspendida_aforo_minimo" as const,
      puedeReservar: false,
      refundRequired: false,
      badgeText: "⚠️ Clase Suspendida",
      reason: "Clase suspendida por Administración."
    };
  }

  const isFull = studentCount >= maxCapacity;

  if (studentCount >= minStudents) {
    return {
      status: "confirmada" as const,
      puedeReservar: !isFull,
      refundRequired: false,
      badgeText: isFull ? "Aforo Completo" : `✓ Confirmada (${studentCount}/${maxCapacity})`,
      reason: isFull ? "Aforo completo" : "Abierta para reservas"
    };
  }

  return {
    status: "abierta" as const,
    puedeReservar: !isFull,
    refundRequired: false,
    badgeText: `${studentCount}/${minStudents} inscritos`,
    reason: isFull ? "Aforo completo" : "Abierta para reservas"
  };
}

/**
 * Regla de negocio oficial de Dance Factory:
 * Las sesiones permanecen ABIERTAS y activas (puedeReservar: true) hasta su inicio o completar aforo.
 * La suspensión de clases es manual y exclusiva de Administración.
 */
export function getOpenClassSessionStatus(
  claseId: string,
  fechaISO: string,
  horaInicio: string,
  aforoMaximo: number = 20
): OpenClassSessionStatus {
  const horasRestantes = getHorasRestantesParaSesion(fechaISO, horaInicio);
  const reservasCount = getSesionReservasCount(claseId, fechaISO);
  const isFull = reservasCount >= aforoMaximo;

  if (horasRestantes <= 0) {
    return {
      status: "finalizada",
      horasRestantes,
      reservasCount,
      minimoRequerido: OPEN_CLASS_MIN_STUDENTS,
      puedeReservar: false,
      refundRequired: false,
      motivoBloqueo: "La sesión ya ha comenzado o finalizado.",
      badgeText: "Finalizada",
      badgeColor: "bg-slate-800 text-slate-400 border border-slate-700"
    };
  }

  // SUSPENSIÓN MANUAL POR ADMINISTRACIÓN
  if (isSesionSuspendida(claseId, fechaISO)) {
    return {
      status: "suspendida_aforo_minimo",
      horasRestantes,
      reservasCount,
      minimoRequerido: OPEN_CLASS_MIN_STUDENTS,
      puedeReservar: false,
      refundRequired: false,
      motivoBloqueo: "Clase suspendida por Administración.",
      badgeText: "⚠️ Suspendida por Administración",
      badgeColor: "bg-red-500/20 text-red-300 border border-red-500/40"
    };
  }

  const hasMin = reservasCount >= OPEN_CLASS_MIN_STUDENTS;
  return {
    status: hasMin ? "confirmada" : "abierta",
    horasRestantes,
    reservasCount,
    minimoRequerido: OPEN_CLASS_MIN_STUDENTS,
    puedeReservar: !isFull,
    refundRequired: false,
    motivoBloqueo: isFull ? "Aforo completo" : undefined,
    badgeText: isFull 
      ? "Aforo Completo" 
      : hasMin 
      ? `✓ Confirmada (${reservasCount}/${aforoMaximo})` 
      : `${reservasCount}/${OPEN_CLASS_MIN_STUDENTS} mín.`,
    badgeColor: isFull
      ? "bg-red-500/20 text-red-300 border border-red-500/30"
      : hasMin
      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
      : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
  };
}

/**
 * Safely deletes a specific Open Class reservation from alumnos_clases,
 * guaranteed to NEVER delete reservations for different dates or subsequent weeks.
 */
export async function deleteAlumnosClasesBySessionDate(
  alumnoId: string,
  claseId: string,
  sessionDateISO: string
): Promise<{ success: boolean; count: number; error?: any }> {
  if (!alumnoId || !claseId || !sessionDateISO) {
    return { success: false, count: 0, error: "Missing required parameters (alumnoId, claseId, sessionDateISO)" };
  }

  const cleanISO = cleanDateISO(sessionDateISO);
  const normClassId = normalizeClaseId(claseId);
  if (!cleanISO || !normClassId) {
    return { success: false, count: 0, error: "Invalid date or class UUID" };
  }

  // 1. Calculate the Madrid day boundaries in UTC (CET: UTC+1, CEST: UTC+2)
  const { startISO, endISO } = getMadridDayRangeUTC(cleanISO);

  // 2. Expand slightly to accommodate literal UTC strings (e.g. "2026-09-21T00:00:00.000Z")
  const literalStart = `${cleanISO}T00:00:00.000Z`;
  const literalEnd = `${cleanISO}T23:59:59.999Z`;
  const minBound = startISO < literalStart ? startISO : literalStart;
  const maxBound = endISO > literalEnd ? endISO : literalEnd;

  // 3. Perform strict scoped deletion
  const { error, count } = await supabase
    .from("alumnos_clases")
    .delete({ count: "exact" })
    .eq("alumno_id", alumnoId)
    .eq("clase_id", normClassId)
    .gte("asignado_en", minBound)
    .lte("asignado_en", maxBound);

  if (error) {
    console.error(`[deleteAlumnosClasesBySessionDate] Error deleting for student ${alumnoId}:`, error);
    return { success: false, count: 0, error };
  }

  // 4. Secondary fallback if count is 0: match string prefix if stored without timezone
  if (count === 0) {
    const { error: errFallback, count: countFallback } = await supabase
      .from("alumnos_clases")
      .delete({ count: "exact" })
      .eq("alumno_id", alumnoId)
      .eq("clase_id", normClassId)
      .gte("asignado_en", `${cleanISO}T00:00:00`)
      .lte("asignado_en", `${cleanISO}T23:59:59.999Z`);

    if (!errFallback && countFallback && countFallback > 0) {
      return { success: true, count: countFallback };
    }
  }

  return { success: true, count: count || 0 };
}

/**
 * Suspende manualmente una sesión por decisión de Administración:
 * 1. Marca la sesión en df_suspended_sessions_v1.
 * 2. Cancela las reservas existentes y reembolsa atómicamente 1 clase en Supabase (deleteAlumnosClasesBySessionDate).
 * 3. Registra auditoría con logActivity.
 * 4. Emite eventos locales y cross-device (df_reservas_updated) vía syncEventBus.
 */
export async function suspenderSesionManualmente(
  claseId: string,
  fechaISO: string,
  motivo: string = "Suspendida por Administración",
  claseNombre?: string
): Promise<{ success: boolean; count: number; alumnosReembolsados: string[]; message: string }> {
  if (typeof window === "undefined") {
    return { success: false, count: 0, alumnosReembolsados: [], message: "Entorno no compatible." };
  }

  const cleanISO = cleanDateISO(fechaISO);
  const normClassId = normalizeClaseId(claseId);
  const sessionKey = `${normClassId}_${cleanISO}`;

  // 1. Sincronizar SIEMPRE desde Supabase antes de proceder
  try {
    await syncReservasFromSupabase();
  } catch (syncErr) {
    console.warn("[suspenderSesionManualmente] Error sincronizando con Supabase:", syncErr);
  }

  // 2. Registrar en conjunto de suspendidas
  const suspendedSessions = getSuspendedSessions();
  const suspendedSet = new Set(suspendedSessions);
  suspendedSet.add(sessionKey);
  try {
    localStorage.setItem("df_suspended_sessions_v1", JSON.stringify(Array.from(suspendedSet)));
  } catch {}

  // 3. Procesar reservas existentes de la sesión
  const current = getOpenClassReservas();
  let updated = false;
  const reembolsados: string[] = [];

  for (const r of current) {
    if (normalizeClaseId(r.clase_id) === normClassId && cleanDateISO(r.fecha_iso) === cleanISO) {
      if (r.estado === "Confirmada") {
        r.estado = "Cancelada";
        r.asistido = false;
        updated = true;

        try {
          const delResult = await deleteAlumnosClasesBySessionDate(r.alumno_id, normClassId, cleanISO);
          if (delResult.success && delResult.count > 0) {
            reembolsados.push(r.alumno_nombre || r.alumno_id);

            const { data: st } = await supabase
              .from("alumnos")
              .select("id, clases_restantes, plan_activo")
              .eq("id", r.alumno_id)
              .maybeSingle();

            if (st && typeof st.clases_restantes === "number") {
              const planLower = (st.plan_activo || "").toLowerCase();
              const isUnlimited = planLower.includes("ilimitad");
              if (!isUnlimited) {
                await supabase.from("alumnos").update({
                  clases_restantes: st.clases_restantes + 1
                }).eq("id", st.id);
              }
            }
          }
        } catch (err) {
          console.error("[suspenderSesionManualmente] Error reembolsando alumno:", err);
        }
      }
    }
  }

  if (updated) {
    saveOpenClassReservas(current);
  }

  // 4. Registrar en log de auditoría
  try {
    await logActivity({
      origen: "recepcion",
      tipo_evento: "clase_suspendida",
      descripcion: `Clase suspendida manualmente por Administración: ${claseNombre || normClassId} para el ${cleanISO}. ${reembolsados.length} alumnos reembolsados. Motivo: ${motivo}`,
      usuario_afectado: "Administración Dance Factory",
      sede: "Dance Factory"
    });
  } catch (logErr) {
    console.warn("[suspenderSesionManualmente] Error registrando auditoría:", logErr);
  }

  // 5. Difundir evento de sincronización multi-dispositivo y multi-pestaña
  try {
    window.dispatchEvent(new Event("df_reservas_updated"));
    publishSyncEvent("df_reservas_updated", {
      sessionKey,
      claseId: normClassId,
      fechaISO: cleanISO,
      action: "suspended"
    });
  } catch {}

  return {
    success: true,
    count: reembolsados.length,
    alumnosReembolsados: reembolsados,
    message: `Sesión suspendida con éxito. Se ha reembolsado la clase a ${reembolsados.length} alumno(s).`
  };
}

/**
 * Reactiva (reanuda) una sesión previamente suspendida por Administración.
 */
export async function reactivarSesionSuspendida(
  claseId: string,
  fechaISO: string,
  claseNombre?: string
): Promise<{ success: boolean; message: string }> {
  if (typeof window === "undefined") {
    return { success: false, message: "Entorno no compatible." };
  }

  const cleanISO = cleanDateISO(fechaISO);
  const normClassId = normalizeClaseId(claseId);
  const sessionKey = `${normClassId}_${cleanISO}`;

  const suspendedSessions = getSuspendedSessions();
  const filtered = suspendedSessions.filter(k => k !== sessionKey);
  try {
    localStorage.setItem("df_suspended_sessions_v1", JSON.stringify(filtered));
  } catch {}

  try {
    await logActivity({
      origen: "recepcion",
      tipo_evento: "clase_reactivada",
      descripcion: `Sesión reactivada manualmente por Administración: ${claseNombre || normClassId} para el ${cleanISO}.`,
      usuario_afectado: "Administración Dance Factory",
      sede: "Dance Factory"
    });
  } catch {}

  try {
    window.dispatchEvent(new Event("df_reservas_updated"));
    publishSyncEvent("df_reservas_updated", {
      sessionKey,
      claseId: normClassId,
      fechaISO: cleanISO,
      action: "reactivated"
    });
  } catch {}

  return {
    success: true,
    message: "Sesión reanudada con éxito. Ya está abierta de nuevo para reservas."
  };
}

/**
 * Mantenido por retrocompatibilidad de interfaz.
 * Nota oficial: A petición de Lucía (Administración), la regla automática de corte a las 5 horas fue retirada.
 * Las suspensiones de clases son ahora 100% manuales ejecutadas por Administración.
 */
export async function verificarYSuspenderSesionesBajoAforo(): Promise<{ canceladasCount: number; alumnosReembolsados: string[] }> {
  return { canceladasCount: 0, alumnosReembolsados: [] };
}

/**
 * Checks if a reservation can be cancelled according to the strict 24-hour advance policy.
 */
export function isReservaCancelable(reserva: { fecha_iso?: string; hora_inicio?: string }): {
  cancelable: boolean;
  horasRestantes: number;
  motivo?: string;
} {
  const horasRestantes = getHorasRestantesParaSesion(reserva.fecha_iso, reserva.hora_inicio);
  
  if (horasRestantes <= 0) {
    return {
      cancelable: false,
      horasRestantes,
      motivo: "La sesión ya ha comenzado o se ha impartido. No es posible cancelarla."
    };
  }

  if (horasRestantes < OPEN_CLASS_CUTOFF_HOURS) {
    return {
      cancelable: false,
      horasRestantes,
      motivo: `Faltan menos de ${OPEN_CLASS_CUTOFF_HOURS} horas para el inicio de la clase. Según la normativa oficial, no es cancelable y la sesión se computa de tu bono.`
    };
  }

  return {
    cancelable: true,
    horasRestantes
  };
}

export function cancelarReservaOpenClass(reservaId: string, options?: { allowUnder24h?: boolean }): boolean {
  const current = getOpenClassReservas();
  const target = current.find(r => r.id === reservaId);
  if (!target || target.estado === "Cancelada") {
    return false;
  }

  // Reject cancellation if within 5 hours unless explicitly allowed (admin bypass)
  if (!options?.allowUnder24h) {
    const { cancelable, motivo } = isReservaCancelable(target);
    if (!cancelable) {
      console.warn("Cancelación bloqueada por normativa de 5h:", motivo);
      return false;
    }
  }

  const updated = current.map(r => r.id === reservaId ? { ...r, estado: "Cancelada" as const, asistido: false } : r);
  saveOpenClassReservas(updated);
  return true;
}

export function confirmarAsistenciaReservaOpenClass(reservaId: string): boolean {
  const current = getOpenClassReservas();
  let found = false;
  const updated = current.map(r => {
    if (r.id === reservaId) {
      found = true;
      return { ...r, asistido: true, estado: "Asistida" as const };
    }
    return r;
  });
  if (found) {
    saveOpenClassReservas(updated);
  }
  return found;
}

export function marcarAsistenciaPorAlumnoYSesion(alumnoId: string, claseId: string, fechaISO: string): boolean {
  const cleanISO = cleanDateISO(fechaISO);
  if (!cleanISO || !alumnoId || !claseId) return false;
  const targetId = normalizeClaseId(claseId);
  const current = getOpenClassReservas();
  let found = false;
  const updated = current.map(r => {
    if (
      r.alumno_id === alumnoId && 
      normalizeClaseId(r.clase_id) === targetId && 
      cleanDateISO(r.fecha_iso) === cleanISO && 
      (r.estado === "Confirmada" || r.estado === "Asistida")
    ) {
      found = true;
      return { ...r, asistido: true, estado: "Asistida" as const };
    }
    return r;
  });
  if (found) {
    saveOpenClassReservas(updated);
  }
  return found;
}

export function marcarAsistenciaPorAlumnoEnFecha(alumnoId: string, fechaISO: string): boolean {
  const cleanISO = cleanDateISO(fechaISO);
  if (!cleanISO || !alumnoId) return false;
  const current = getOpenClassReservas();
  let found = false;
  const updated = current.map(r => {
    if (r.alumno_id === alumnoId && cleanDateISO(r.fecha_iso) === cleanISO && (r.estado === "Confirmada" || r.estado === "Asistida")) {
      found = true;
      return { ...r, asistido: true, estado: "Asistida" as const };
    }
    return r;
  });
  if (found) {
    saveOpenClassReservas(updated);
  }
  return found;
}

/**
 * Synchronizes Open Class reservations from Supabase (alumnos_clases + asistencias) into localStorage
 */
export async function syncReservasFromSupabase(): Promise<OpenClassReserva[]> {
  if (typeof window === "undefined") return [];
  try {
    const { data: acData, error: acError } = await supabase
      .from("alumnos_clases")
      .select(`
        alumno_id,
        clase_id,
        asignado_en,
        alumnos (
          id,
          nombre_completo,
          email,
          telefono,
          dni,
          plan_activo
        ),
        clases_cuadrante (
          id,
          nombre_clase,
          profesor,
          dia_semana,
          hora_inicio,
          hora_fin,
          sede,
          aforo_maximo
        )
      `);

    if (acError || !acData) {
      console.warn("Could not fetch alumnos_clases for open classes sync:", acError);
      return getOpenClassReservas();
    }

    // Also fetch attendances to know who is already marked present
    const asistenciasMap = new Set<string>();
    try {
      const { data: asData } = await supabase
        .from("asistencias")
        .select("alumno_id, clase_id, fecha_hora");
      if (asData) {
        asData.forEach((a: any) => {
          const datePart = cleanDateISO(a.fecha_hora);
          const key = `${a.alumno_id}_${normalizeClaseId(a.clase_id)}_${datePart}`;
          asistenciasMap.add(key);
        });
      }
    } catch (e) {}

    const dbMappedReservas: OpenClassReserva[] = [];

    for (const row of acData) {
      let c = (row as any).clases_cuadrante;
      const a = (row as any).alumnos;
      if (!a) continue;

      const normClassId = normalizeClaseId(row.clase_id);
      if (!c) {
        c = DEFAULT_STUDIO2_OPEN_CLASSES.find(def => def.id === normClassId);
      }
      if (!c) continue;

      const isOC = 
        (c.nombre_clase || "").toUpperCase().includes("OPEN") ||
        (c.nombre_clase || "").toUpperCase().includes("FORMACI") ||
        c.tipo_clase === "Open Class" ||
        DEFAULT_STUDIO2_OPEN_CLASSES.some(def => def.id === normClassId) ||
        Boolean(LEGACY_ID_MAP[row.clase_id]);

      if (!isOC) continue;

      const diaSemana = c.dia_semana || "LUNES";
      const rawDate = row.asignado_en ? cleanDateISO(row.asignado_en) : "";
      
      // Calculate session date
      let fechaISO = "";
      if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        fechaISO = rawDate;
      } else if (rawDate) {
        const calDay = createCalendarDayFromISO(rawDate);
        if (normalizeDay(calDay.dayName) === normalizeDay(diaSemana)) {
          fechaISO = rawDate;
        } else {
          fechaISO = getNextDateForDay(rawDate, diaSemana);
        }
      } else {
        fechaISO = getNextDateForDay("2026-09-14", diaSemana);
      }

      const calItem = createCalendarDayFromISO(fechaISO);
      const dayCap = calItem.dayName.charAt(0) + calItem.dayName.slice(1).toLowerCase();
      const attendanceKey = `${row.alumno_id}_${normClassId}_${fechaISO}`;
      const isAttended = asistenciasMap.has(attendanceKey);

      dbMappedReservas.push({
        id: `res_sb_${row.alumno_id}_${normClassId}_${fechaISO}`,
        alumno_id: row.alumno_id,
        alumno_nombre: a.nombre_completo || "Alumno",
        alumno_email: a.email || "",
        alumno_telefono: a.telefono || "",
        alumno_dni: a.dni || "",
        alumno_plan: a.plan_activo || "Bono Open Class",
        clase_id: normClassId,
        nombre_clase: c.nombre_clase || "OPEN CLASS",
        profesor: c.profesor || "",
        sede: normalizeSede(c.sede || "castilla"),
        sala: c.sala || "Sala 1",
        fecha_iso: fechaISO,
        fecha_formateada: `${dayCap} ${calItem.dayNumber} de ${calItem.monthName}`,
        dia_semana: calItem.dayName,
        hora_inicio: c.hora_inicio || "19:00",
        hora_fin: c.hora_fin || "20:00",
        creado_en: row.asignado_en || new Date().toISOString(),
        estado: isAttended ? "Asistida" : "Confirmada",
        asistido: isAttended
      });
    }

    // Authoritative sync: dbMappedReservas is the single source of truth for active reservations.
    // Never resurrect local 'Confirmada' reservations that no longer exist in Supabase alumnos_clases.
    const local = getOpenClassReservas();
    const merged: OpenClassReserva[] = [...dbMappedReservas];

    for (const l of local) {
      const normLocalClassId = normalizeClaseId(l.clase_id);
      const matchIndex = merged.findIndex(m => 
        m.alumno_id === l.alumno_id &&
        normalizeClaseId(m.clase_id) === normLocalClassId &&
        m.fecha_iso === l.fecha_iso
      );

      if (matchIndex >= 0) {
        if (l.asistido || l.estado === "Asistida") {
          merged[matchIndex].asistido = true;
          merged[matchIndex].estado = "Asistida";
        }
      } else if (l.estado === "Cancelada") {
        merged.push({
          ...l,
          clase_id: normLocalClassId
        });
      }
    }

    saveOpenClassReservas(merged, { silentBroadcast: true });
    return getOpenClassReservas();
  } catch (err) {
    console.error("Error in syncReservasFromSupabase:", err);
    return getOpenClassReservas();
  }
}

export interface CheckInClassResolution {
  claseId: string | null;
  claseNombre: string;
  profesor?: string;
  sede?: string;
  isRegular: boolean;
  isOpenClass: boolean;
  timingStatus?: 'on_time' | 'early' | 'late' | 'outside_schedule';
  timingMinutes?: number;
  timingMessage?: string;
  horaInicio?: string;
  horaFin?: string;
}

/**
 * Resolución canónica de puntualidad y ventanas de acceso a clase (R4)
 */
export function resolveClassTiming(
  horaInicio?: string,
  horaFin?: string,
  checkInTimeStr?: string
): {
  timingStatus: 'on_time' | 'early' | 'late' | 'outside_schedule';
  timingMinutes: number;
  timingMessage: string;
  allowsAccess: boolean;
} {
  const parseMin = (s?: string) => {
    if (!s) return 0;
    const [h = 0, m = 0] = String(s).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const startMin = parseMin(horaInicio);
  const endMin = parseMin(horaFin);
  let checkMin: number;
  if (checkInTimeStr) {
    checkMin = parseMin(checkInTimeStr);
  } else {
    const now = new Date();
    checkMin = now.getHours() * 60 + now.getMinutes();
  }
  const delta = checkMin - startMin;

  if (delta >= -10 && delta <= 10) {
    return {
      timingStatus: "on_time",
      timingMinutes: Math.abs(delta),
      timingMessage: "A tiempo para clase",
      allowsAccess: true
    };
  } else if (delta < -10 && delta >= -60) {
    const earlyMin = Math.abs(delta);
    return {
      timingStatus: "early",
      timingMinutes: earlyMin,
      timingMessage: `Llegada anticipada: ${earlyMin} min antes de clase`,
      allowsAccess: true
    };
  } else if (delta > 10 && delta <= 30) {
    return {
      timingStatus: "late",
      timingMinutes: delta,
      timingMessage: `Llegada con retraso: ${delta} min tarde a clase`,
      allowsAccess: true
    };
  } else {
    return {
      timingStatus: "outside_schedule",
      timingMinutes: Math.abs(delta),
      timingMessage: "Fuera de horario de clase",
      allowsAccess: false
    };
  }
}


/**
 * Búsqueda ultra robusta de alumnos para escáner QR, RFID, NFC y búsqueda manual:
 * Admite:
 * - Token NFC numérico de 4 a 6 dígitos (ej. 2557)
 * - Códigos QR con prefijos: DF-STUDENT-2557, DF-2557, STUDENT-2557
 * - UUID de base de datos
 * - Nombre y apellidos (ej. "Olivia Anna", "Olivia", "Hrebenyvk")
 * - Teléfono con o sin espacios, o con prefijo +34 (ej. "608 814 341", "608814341")
 * - DNI / NIE (ej. "54243763B")
 * - Email
 */
async function resolveActiveSiblingStudent(foundStudent: any): Promise<any> {
  if (!foundStudent) return null;

  const planLower = (foundStudent.plan_activo || "").toLowerCase().trim();
  const hasClasses = Array.isArray(foundStudent.alumnos_clases) && foundStudent.alumnos_clases.length > 0;
  const isSinPlan = !hasClasses && (
    !foundStudent.plan_activo || 
    planLower === "" || 
    planLower.includes("sin plan") || 
    planLower.includes("pendiente")
  );

  // Si ya tiene un plan regular o activo con clases, retornarlo directamente
  if (!isSinPlan) {
    return foundStudent;
  }

  // Si tiene 'Sin Plan Activo', buscar si existe un registro activo hermano por email, teléfono o nombre
  const cleanName = (foundStudent.nombre_completo || "").trim();
  const cleanEmail = foundStudent.email ? foundStudent.email.trim().toLowerCase() : "";
  const cleanPhone = foundStudent.telefono ? foundStudent.telefono.replace(/\D/g, "").slice(-9) : "";

  const orClauses: string[] = [];
  if (cleanEmail && cleanEmail.includes("@")) {
    orClauses.push(`email.ilike.${cleanEmail}`);
  }
  if (cleanPhone.length >= 9) {
    orClauses.push(`telefono.ilike.%${cleanPhone}%`);
  }
  if (cleanName.length >= 4) {
    orClauses.push(`nombre_completo.ilike.%${cleanName}%`);
  }

  if (orClauses.length === 0) return foundStudent;

  try {
    const { data: siblings } = await supabase
      .from("alumnos")
      .select("*, alumnos_clases(*)")
      .neq("id", foundStudent.id)
      .or(orClauses.join(","));

    if (siblings && siblings.length > 0) {
      // Priorizar el hermano que tenga clases matriculadas o plan regular
      const activeSibling = siblings.find(s => 
        (Array.isArray(s.alumnos_clases) && s.alumnos_clases.length > 0) ||
        (s.plan_activo && !s.plan_activo.toLowerCase().includes("sin plan"))
      );
      if (activeSibling) {
        console.log(`[Scanner] Smart deduplication: re-routing ${foundStudent.nombre_completo} (${foundStudent.id}) to active enrolled profile ${activeSibling.nombre_completo} (${activeSibling.id})`);
        return activeSibling;
      }
    }
  } catch (e) {
    console.warn("[Scanner] Error resolving sibling student:", e);
  }

  return foundStudent;
}

export async function findStudentByCodeOrText(rawCode: string): Promise<any | null> {
  const trimmed = (rawCode || "").trim();
  if (!trimmed) return null;

  // 1. UUID exacto
  if (trimmed.length === 36 && (trimmed.match(/-/g) || []).length === 4) {
    const { data } = await supabase.from("alumnos").select("*, alumnos_clases(*)").eq("id", trimmed).maybeSingle();
    if (data) return await resolveActiveSiblingStudent(data);
  }

  // 2. Normalizar teclado español y prefijos (incluye prefijos de profesor DF-TEACHER-, DF-PROFESOR-)
  const normalized = trimmed.replace(/[/\\':_.]/g, "-").trim();
  const cleanToken = normalized
    .replace(/^DF-TEACHER-/i, "")
    .replace(/^DF-PROFESOR-/i, "")
    .replace(/^TEACHER-/i, "")
    .replace(/^PROFESOR-/i, "")
    .replace(/^DF-STUDENT-/i, "")
    .replace(/^DF-ALUMNO-/i, "")
    .replace(/^STUDENT-/i, "")
    .replace(/^ALUMNO-/i, "")
    .replace(/^DF-/i, "")
    .trim();

  const pureToken = trimmed
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^(DFTEACHER|DFPROFESOR|TEACHER|PROFESOR|DFSTUDENT|DFALUMNO|STUDENT|ALUMNO|DF)/i, "")
    .trim();

  const candidates = Array.from(new Set([
    cleanToken,
    pureToken,
    normalized,
    trimmed,
    `DF-${cleanToken}`,
    `DF-${pureToken}`,
    `PROF-${cleanToken}`,
    `PROF-${pureToken}`
  ])).filter(Boolean);

  for (const token of candidates) {
    // 2.0 Mapping de IDs/PINs de Profesores (ej. 1001, 1005, etc.)
    const mappedTeacherId = TEACHER_DB_ID_MAP[token] || TEACHER_DB_ID_MAP[token.toUpperCase()];
    if (mappedTeacherId) {
      const { data: byTeacherId } = await supabase.from("alumnos").select("*, alumnos_clases(*)").eq("id", mappedTeacherId).maybeSingle();
      if (byTeacherId) return await resolveActiveSiblingStudent(byTeacherId);
    }

    // Exact nfc_token
    const { data: byNfc } = await supabase.from("alumnos").select("*, alumnos_clases(*)").eq("nfc_token", token).limit(1).maybeSingle();
    if (byNfc) return await resolveActiveSiblingStudent(byNfc);

    // Exact DNI
    const { data: byDni } = await supabase.from("alumnos").select("*, alumnos_clases(*)").ilike("dni", token).limit(1).maybeSingle();
    if (byDni) return await resolveActiveSiblingStudent(byDni);

    // Exact email
    if (token.includes("@")) {
      const { data: byEmail } = await supabase.from("alumnos").select("*, alumnos_clases(*)").ilike("email", token).limit(1).maybeSingle();
      if (byEmail) return await resolveActiveSiblingStudent(byEmail);
    }

    // Exact ID match if UUID
    if (token.length === 36 && (token.match(/-/g) || []).length === 4) {
      const { data: byId } = await supabase.from("alumnos").select("*, alumnos_clases(*)").eq("id", token).limit(1).maybeSingle();
      if (byId) return await resolveActiveSiblingStudent(byId);
    }
  }

  // 3. Teléfono normalizado (con y sin espacios)
  const phoneDigits = trimmed.replace(/\D/g, "").replace(/^34/, "");
  if (phoneDigits.length >= 9) {
    const digits9 = phoneDigits.slice(-9);
    const spaced1 = `${digits9.slice(0, 3)} ${digits9.slice(3, 6)} ${digits9.slice(6, 9)}`;
    const spaced2 = `${digits9.slice(0, 3)} ${digits9.slice(3, 5)} ${digits9.slice(5, 7)} ${digits9.slice(7, 9)}`;

    const { data: byPhone } = await supabase
      .from("alumnos")
      .select("*, alumnos_clases(*)")
      .or(`telefono.eq.${digits9},telefono.eq.${spaced1},telefono.eq.${spaced2},telefono.ilike.%${digits9.slice(3, 9)}%`)
      .limit(1)
      .maybeSingle();

    if (byPhone) return await resolveActiveSiblingStudent(byPhone);
  }

  // 4. Búsqueda por Nombre Completo (soporta "Olivia Anna", "Olivia", "Hrebenyvk", etc.)
  if (cleanToken && cleanToken.length >= 3) {
    // Intento 1: Nombre completo ilike '%cleanToken%'
    const { data: byName } = await supabase
      .from("alumnos")
      .select("*, alumnos_clases(*)")
      .ilike("nombre_completo", `%${cleanToken}%`)
      .limit(1)
      .maybeSingle();
    if (byName) return await resolveActiveSiblingStudent(byName);

    // Si tiene varios términos (ej. "Olivia Anna"), buscar por cada palabra relevante
    const words = cleanToken.split(/\s+/).filter(w => w.length >= 3);
    for (const w of words) {
      const { data: byWord } = await supabase
        .from("alumnos")
        .select("*, alumnos_clases(*)")
        .ilike("nombre_completo", `%${w}%`)
        .limit(1)
        .maybeSingle();
      if (byWord) return await resolveActiveSiblingStudent(byWord);
    }

    // Intento 2: OR ampliado (nfc_token, dni, email, telefono, nombre_completo)
    const { data: byOr } = await supabase
      .from("alumnos")
      .select("*, alumnos_clases(*)")
      .or(`nfc_token.ilike.%${cleanToken}%,dni.ilike.%${cleanToken}%,email.ilike.%${cleanToken}%,telefono.ilike.%${cleanToken}%,nombre_completo.ilike.%${cleanToken}%`)
      .limit(1)
      .maybeSingle();
    if (byOr) return await resolveActiveSiblingStudent(byOr);
  }

  return null;
}

/**
 * Resolución inteligente y contextual de clase para el escáner de recepción y check-in:
 * 1. Prioriza las clases regulares matriculadas del alumno en el día de hoy dentro de la ventana de llegada (inicio - 45 min a fin + 15 min).
 * 2. Si no tiene clase regular hoy, comprueba si tiene reserva confirmada de Open Class hoy en la ventana de llegada.
 * 3. Si no tiene reserva de Open Class ni clase regular propia, comprueba si recepción seleccionó una clase válida para este momento o la clase activa de la sede.
 * 4. Si ninguna coincide: Acceso General (clase_id: null). Nunca asigna Open Class indebidamente a las 21:00h a alumnos de clases regulares.
 */
export async function resolveClassForCheckIn(
  student: { id: string; nombre_completo?: string; plan_activo?: string; sede?: string },
  activeSede?: string,
  preferredClaseId?: string | null
): Promise<CheckInClassResolution> {
  const planLower = (student.plan_activo || "").toLowerCase();
  const isRegularOrUnlimited = 
    planLower.includes("regular") || 
    planLower.includes("mensual") || 
    planLower.includes("ilimitad") || 
    planLower.includes("cuota");

  const dias = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
  const now = new Date();
  const hoyDia = dias[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const todayISO = `${y}-${m}-${d}`;

  const parseTimeToMinutes = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const [hh, mm] = timeStr.split(":").map(Number);
    return (hh || 0) * 60 + (mm || 0);
  };

  // 1. COMPROBAR CLASES REGULARES O RESERVAS DE HOY MATRICULADAS EN alumnos_clases
  try {
    const { data: enrollments } = await supabase
      .from("alumnos_clases")
      .select("clase_id, asignado_en, clases_cuadrante(*)")
      .eq("alumno_id", student.id);

    if (enrollments && enrollments.length > 0) {
      const todayClasses = enrollments
        .filter((e: any) => {
          const c = e.clases_cuadrante;
          if (!c || (c.dia_semana || "").toUpperCase() !== hoyDia) return false;
          const isOpen = (c.nombre_clase || "").toUpperCase().includes("OPEN") || c.tipo_clase === "Open Class";
          // Si es Open Class, SOLO cuenta como reserva de hoy si asignado_en corresponde a todayISO
          if (isOpen && e.asignado_en) {
            return cleanDateISO(e.asignado_en) === todayISO;
          }
          return true;
        })
        .map((e: any) => e.clases_cuadrante);

      let bestRegular: any = null;
      let minDistance = Infinity;

      for (const c of todayClasses) {
        const startMin = parseTimeToMinutes(c.hora_inicio);
        const endMin = parseTimeToMinutes(c.hora_fin);

        // Ventana de llegada flexible [inicio - 60 min, fin + 30 min]
        if (currentMinutes >= (startMin - 60) && currentMinutes <= (endMin + 30)) {
          const dist = Math.abs(currentMinutes - startMin);
          if (dist < minDistance) {
            minDistance = dist;
            bestRegular = c;
          }
        }
      }

      // Si el alumno tiene clase hoy pero llega fuera de la ventana habitual (ej. 75 min antes o tras fin),
      // seleccionar la clase de hoy más cercana para informar a recepción sin bloquear acceso
      if (!bestRegular && todayClasses.length > 0) {
        for (const c of todayClasses) {
          const startMin = parseTimeToMinutes(c.hora_inicio);
          const dist = Math.abs(currentMinutes - startMin);
          if (dist < minDistance) {
            minDistance = dist;
            bestRegular = c;
          }
        }
      }

      if (bestRegular) {
        const isOpen = (bestRegular.nombre_clase || "").toUpperCase().includes("OPEN") || bestRegular.tipo_clase === "Open Class";
        const timing = resolveClassTiming(bestRegular.hora_inicio, bestRegular.hora_fin);

        let customMessage = timing.timingMessage;
        if (timing.timingStatus === "early") {
          customMessage = `⏰ Llegada anticipada: ${timing.timingMinutes} min antes de su clase (${bestRegular.hora_inicio})`;
        } else if (timing.timingStatus === "late") {
          customMessage = `⚠️ Llegada con retraso: ${timing.timingMinutes} min tarde a su clase (${bestRegular.hora_inicio})`;
        } else if (timing.timingStatus === "outside_schedule") {
          const startMin = parseTimeToMinutes(bestRegular.hora_inicio);
          const delta = currentMinutes - startMin;
          customMessage = delta < 0
            ? `⏰ Fuera de horario: Llegada ${timing.timingMinutes} min antes de su clase (${bestRegular.hora_inicio})`
            : `⚠️ Fuera de horario: Clase finalizada (${bestRegular.hora_inicio} - ${bestRegular.hora_fin || ''})`;
        }

        return {
          claseId: bestRegular.id,
          claseNombre: bestRegular.nombre_clase,
          profesor: bestRegular.profesor,
          sede: bestRegular.sede,
          isRegular: !isOpen,
          isOpenClass: isOpen,
          timingStatus: timing.timingStatus,
          timingMinutes: timing.timingMinutes,
          timingMessage: customMessage,
          horaInicio: bestRegular.hora_inicio,
          horaFin: bestRegular.hora_fin
        };
      }
    }
  } catch (err) {
    console.warn("[resolveClassForCheckIn] Error comprobando matriculas regulares:", err);
  }

  // 2. COMPROBAR SI TIENE RESERVA DE OPEN CLASS PARA HOY
  try {
    const localReservas = getOpenClassReservas();
    const todayReserva = localReservas.find(r => 
      r.alumno_id === student.id && 
      r.fecha_iso === todayISO && 
      (r.estado === "Confirmada" || r.estado === "Asistida")
    );

    if (todayReserva) {
      const startMin = parseTimeToMinutes(todayReserva.hora_inicio);
      const endMin = parseTimeToMinutes(todayReserva.hora_fin);

      if (currentMinutes >= (startMin - 60) && currentMinutes <= (endMin + 30)) {
        const timing = resolveClassTiming(todayReserva.hora_inicio, todayReserva.hora_fin);
        let customMessage = timing.timingMessage;
        if (timing.timingStatus === "early") {
          customMessage = `⏰ Llegada anticipada: ${timing.timingMinutes} min antes de su clase (${todayReserva.hora_inicio})`;
        } else if (timing.timingStatus === "late") {
          customMessage = `⚠️ Llegada con retraso: ${timing.timingMinutes} min tarde a su clase (${todayReserva.hora_inicio})`;
        }

        return {
          claseId: todayReserva.clase_id,
          claseNombre: todayReserva.nombre_clase,
          profesor: todayReserva.profesor,
          sede: todayReserva.sede,
          isRegular: false,
          isOpenClass: true,
          timingStatus: timing.timingStatus,
          timingMinutes: timing.timingMinutes,
          timingMessage: customMessage,
          horaInicio: todayReserva.hora_inicio,
          horaFin: todayReserva.hora_fin
        };
      }
    }
  } catch (err) {
    console.warn("[resolveClassForCheckIn] Error comprobando reservas open class:", err);
  }

  // 3. SI EL USUARIO SELECCIONÓ EXPLÍCITAMENTE UNA CLASE EN RECEPCIÓN (preferredClaseId)
  if (preferredClaseId) {
    try {
      const { data: prefClass } = await supabase
        .from("clases_cuadrante")
        .select("*")
        .eq("id", preferredClaseId)
        .maybeSingle();

      if (prefClass && (prefClass.dia_semana || "").toUpperCase() === hoyDia) {
        const startMin = parseTimeToMinutes(prefClass.hora_inicio);
        const endMin = parseTimeToMinutes(prefClass.hora_fin);

        // Solo usar la clase si estamos dentro del rango temporal (±50 min)
        if (currentMinutes >= (startMin - 50) && currentMinutes <= (endMin + 30)) {
          const isPrefOpen = (prefClass.nombre_clase || "").toUpperCase().includes("OPEN");
          if (!isPrefOpen || !isRegularOrUnlimited || currentMinutes < endMin) {
            const timing = resolveClassTiming(prefClass.hora_inicio, prefClass.hora_fin);
            return {
              claseId: prefClass.id,
              claseNombre: prefClass.nombre_clase,
              profesor: prefClass.profesor,
              sede: prefClass.sede,
              isRegular: !isPrefOpen,
              isOpenClass: isPrefOpen,
              timingStatus: timing.timingStatus,
              timingMinutes: timing.timingMinutes,
              timingMessage: timing.timingMessage,
              horaInicio: prefClass.hora_inicio,
              horaFin: prefClass.hora_fin
            };
          }
        }
      }
    } catch {}
  }

  // 4. COMPROBAR CLASE ACTIVA PARA EL HORARIO ACTUAL (Soporte Multi-Sede Universal)
  try {
    const { data: activeClasses } = await supabase
      .from("clases_cuadrante")
      .select("*")
      .eq("dia_semana", hoyDia);

    if (activeClasses && activeClasses.length > 0) {
      let candidate: any = null;
      let minDelta = Infinity;

      for (const c of activeClasses) {
        const startMin = parseTimeToMinutes(c.hora_inicio);
        const endMin = parseTimeToMinutes(c.hora_fin);
        const isOpen = (c.nombre_clase || "").toUpperCase().includes("OPEN") || c.tipo_clase === "Open Class";

        // CRÍTICO: NUNCA asignar Open Class en el fallback de proximidad a alumnos de clases regulares.
        if (isOpen && isRegularOrUnlimited) continue;

        // Ventana de llegada [inicio - 50 min, fin + 20 min]
        if (currentMinutes >= (startMin - 50) && currentMinutes <= (endMin + 20)) {
          let delta = Math.abs(currentMinutes - startMin);
          // Preferencia de desempate si coincide con la sede activa o sede del alumno
          if (activeSede && activeSede !== "consolidado" && normalizeSede(c.sede) === normalizeSede(activeSede)) {
            delta -= 5;
          } else if (student.sede && normalizeSede(c.sede) === normalizeSede(student.sede)) {
            delta -= 3;
          }

          if (delta < minDelta) {
            minDelta = delta;
            candidate = c;
          }
        }
      }

      if (candidate) {
        const isCandidateOpen = (candidate.nombre_clase || "").toUpperCase().includes("OPEN") || candidate.tipo_clase === "Open Class";
        const timing = resolveClassTiming(candidate.hora_inicio, candidate.hora_fin);
        return {
          claseId: candidate.id,
          claseNombre: candidate.nombre_clase,
          profesor: candidate.profesor,
          sede: candidate.sede,
          isRegular: !isCandidateOpen,
          isOpenClass: isCandidateOpen,
          timingStatus: timing.timingStatus,
          timingMinutes: timing.timingMinutes,
          timingMessage: timing.timingMessage,
          horaInicio: candidate.hora_inicio,
          horaFin: candidate.hora_fin
        };
      }
    }
  } catch (err) {
    console.warn("[resolveClassForCheckIn] Error buscando clase activa:", err);
  }

  // 5. ACCESO A INSTALACIONES (Ninguna clase regular activa en este horario)
  return {
    claseId: null,
    claseNombre: "Acceso a Instalaciones",
    isRegular: isRegularOrUnlimited,
    isOpenClass: false,
    timingStatus: "on_time",
    timingMinutes: 0,
    timingMessage: "Acceso a instalaciones"
  };
}

/**
 * Concilia el consumo de bono cuando un alumno con Bono ficha en el escáner de recepción:
 * - Si el alumno YA tenía reserva confirmada para la sesión de hoy en `alumnos_clases`,
 *   su clase ya fue descontada al reservar -> NO vuelve a descontar (evita doble descuento).
 * - Si el alumno con Bono acude presencialmente SIN reserva previa para hoy en `alumnos_clases`,
 *   registra su inscripción de hoy en `alumnos_clases` y descuenta 1 clase de `clases_restantes` en Supabase.
 */
export async function reconcileBonoConsumptionOnCheckIn(
  student: any,
  resolvedClaseId?: string | null,
  horaInicio?: string | null
): Promise<{ deducted: boolean; newBalance: number | null }> {
  if (!student?.id) return { deducted: false, newBalance: student?.clases_restantes ?? null };

  // Docentes y profesores JAMÁS consumen clases de bono al validar acceso en torno
  if (isTeacherProfile(student)) {
    return { deducted: false, newBalance: student?.clases_restantes ?? null };
  }

  const planLower = (student.plan_activo || "").toLowerCase().trim();
  const isRegularOrUnlimited =
    planLower.includes("regular") ||
    planLower.includes("mensual") ||
    planLower.includes("ilimitad") ||
    planLower.includes("cuota") ||
    student.clases_restantes === null ||
    student.clases_restantes === undefined;

  if (isRegularOrUnlimited) {
    return { deducted: false, newBalance: student.clases_restantes ?? null };
  }

  try {
    // Si se resolvió una clase específica, verificar que sea una Open Class (nunca descontar bono por asistir a clase regular)
    if (resolvedClaseId) {
      const normId = normalizeClaseId(resolvedClaseId);
      const isDefaultOC = DEFAULT_STUDIO2_OPEN_CLASSES.some(c => c.id === normId) || Boolean(LEGACY_ID_MAP[resolvedClaseId]);
      if (!isDefaultOC) {
        const { data: clRow } = await supabase
          .from("clases_cuadrante")
          .select("nombre_clase")
          .eq("id", normId)
          .maybeSingle();
        if (clRow && clRow.nombre_clase) {
          const upper = clRow.nombre_clase.toUpperCase();
          if (!upper.includes("OPEN") && !upper.includes("FORMACI")) {
            return { deducted: false, newBalance: student.clases_restantes ?? null };
          }
        }
      }
    }

    const todayNow = new Date();
    const todayISO = `${todayNow.getFullYear()}-${String(todayNow.getMonth() + 1).padStart(2, "0")}-${String(todayNow.getDate()).padStart(2, "0")}`;
    const { startISO, endISO } = getMadridDayRangeUTC(todayISO);
    const literalStart = `${todayISO}T00:00:00.000Z`;
    const literalEnd = `${todayISO}T23:59:59.999Z`;
    const minBound = startISO < literalStart ? startISO : literalStart;
    const maxBound = endISO > literalEnd ? endISO : literalEnd;

    // 1. Obtener saldo fresco de Supabase
    const { data: freshStudent } = await supabase
      .from("alumnos")
      .select("id, clases_restantes, plan_activo")
      .eq("id", student.id)
      .maybeSingle();

    const currentBalance = typeof freshStudent?.clases_restantes === "number"
      ? freshStudent.clases_restantes
      : (typeof student.clases_restantes === "number" ? student.clases_restantes : 0);

    if (currentBalance <= 0) {
      student.clases_restantes = 0;
      return { deducted: false, newBalance: 0 };
    }

    // 2. Comprobar si ya tenía reserva hoy en alumnos_clases (lo que implica que ya se descontó al reservar)
    let acQuery = supabase
      .from("alumnos_clases")
      .select("id, clase_id, asignado_en")
      .eq("alumno_id", student.id)
      .gte("asignado_en", minBound)
      .lte("asignado_en", maxBound);

    if (resolvedClaseId) {
      acQuery = acQuery.eq("clase_id", normalizeClaseId(resolvedClaseId));
    }

    const { data: todayBookings, error: acErr } = await acQuery;
    if (acErr) {
      return { deducted: false, newBalance: currentBalance };
    }

    if (todayBookings && todayBookings.length > 0) {
      // Ya tenía reserva para esta sesión hoy -> el bono ya fue descontado al reservar
      student.clases_restantes = currentBalance;
      return { deducted: false, newBalance: currentBalance };
    }

    // 3. No tenía reserva previa para hoy (walk-in con bono): insertar PRIMERO en alumnos_clases para hoy y solo si tiene éxito descontar 1 clase
    if (resolvedClaseId) {
      const normClassId = normalizeClaseId(resolvedClaseId);
      const cleanHour = (horaInicio || "19:00").trim();
      const sessionISO = `${todayISO}T${cleanHour.length === 5 ? cleanHour : "19:00"}:00+00:00`;
      const { error: insErr } = await supabase.from("alumnos_clases").insert([{
        alumno_id: student.id,
        clase_id: normClassId,
        asignado_en: sessionISO
      }]);
      if (insErr) {
        return { deducted: false, newBalance: currentBalance };
      }
    }

    const updatedBalance = Math.max(0, currentBalance - 1);
    const { error: updErr } = await supabase
      .from("alumnos")
      .update({ clases_restantes: updatedBalance })
      .eq("id", student.id);

    if (!updErr) {
      student.clases_restantes = updatedBalance;
      return { deducted: true, newBalance: updatedBalance };
    }

    return { deducted: false, newBalance: currentBalance };
  } catch (err) {
    console.warn("[reconcileBonoConsumptionOnCheckIn] Error:", err);
    return { deducted: false, newBalance: student.clases_restantes ?? null };
  }
}

export { evaluateReceptionAccess, isCuotaImpagada, dispatchAccessDenied } from "./accessControlService";
export type { AccessEvaluationResult, AccessDenialReason, StudentAccessCandidate } from "./accessControlService";


