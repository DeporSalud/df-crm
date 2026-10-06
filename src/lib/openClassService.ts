import { supabase } from "@/lib/supabase/client";

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
    if (parts[0] > 31) {
      // YYYY-MM-DD
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

export function saveOpenClassReservas(reservas: OpenClassReserva[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reservas));
    window.dispatchEvent(new Event("df_reservas_updated"));
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
    id: "res_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
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
 * Calculates hours remaining until session start.
 * Negative number if already started/past.
 */
export function getHorasRestantesParaSesion(fechaISO?: string, horaInicio?: string): number {
  const cleanISO = cleanDateISO(fechaISO || "");
  if (!cleanISO) return 0;
  const [year, month, day] = cleanISO.split("-").map(Number);
  const [h, m] = (horaInicio || "19:00").split(":").map(Number);
  const sessionDate = new Date(year, month - 1, day, isNaN(h) ? 19 : h, isNaN(m) ? 0 : m, 0, 0);
  const now = new Date();
  return (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60);
}

export const OPEN_CLASS_MIN_STUDENTS = 4;
export const OPEN_CLASS_CUTOFF_HOURS = 5;

export interface OpenClassSessionStatus {
  status: "abierta" | "confirmada" | "suspendida_aforo_minimo" | "finalizada";
  horasRestantes: number;
  reservasCount: number;
  minimoRequerido: number;
  puedeReservar: boolean;
  motivoBloqueo?: string;
  badgeText: string;
  badgeColor: string;
}

/**
 * Regla de negocio oficial de Dance Factory:
 * Si quedan menos de 5 horas para la clase y hay menos de 4 personas apuntadas,
 * la sesión queda suspendida por aforo mínimo y se bloquean nuevas reservas.
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
      motivoBloqueo: "La sesión ya ha comenzado o finalizado.",
      badgeText: "Finalizada",
      badgeColor: "bg-slate-800 text-slate-400 border border-slate-700"
    };
  }

  // REGLA DE LAS 5 HORAS PREVIAS (CORTE DE AFORO MÍNIMO)
  if (horasRestantes < OPEN_CLASS_CUTOFF_HOURS) {
    if (reservasCount < OPEN_CLASS_MIN_STUDENTS) {
      return {
        status: "suspendida_aforo_minimo",
        horasRestantes,
        reservasCount,
        minimoRequerido: OPEN_CLASS_MIN_STUDENTS,
        puedeReservar: false,
        motivoBloqueo: `Clase suspendida: No se alcanzó el mínimo de ${OPEN_CLASS_MIN_STUDENTS} personas a las ${OPEN_CLASS_CUTOFF_HOURS} horas previas de la sesión. Saldo de clase reembolsado.`,
        badgeText: `⚠️ Suspendida (mín. ${OPEN_CLASS_MIN_STUDENTS} pers.)`,
        badgeColor: "bg-red-500/20 text-red-300 border border-red-500/40"
      };
    } else {
      return {
        status: "confirmada",
        horasRestantes,
        reservasCount,
        minimoRequerido: OPEN_CLASS_MIN_STUDENTS,
        puedeReservar: !isFull,
        motivoBloqueo: isFull ? "Aforo completo" : undefined,
        badgeText: isFull ? "Aforo Completo" : "✓ Confirmada",
        badgeColor: isFull 
          ? "bg-red-500/20 text-red-300 border border-red-500/30" 
          : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
      };
    }
  }

  // Faltan 5 horas o más
  const hasMin = reservasCount >= OPEN_CLASS_MIN_STUDENTS;
  return {
    status: hasMin ? "confirmada" : "abierta",
    horasRestantes,
    reservasCount,
    minimoRequerido: OPEN_CLASS_MIN_STUDENTS,
    puedeReservar: !isFull,
    motivoBloqueo: isFull ? "Aforo completo" : undefined,
    badgeText: hasMin
      ? `✓ Confirmada (${reservasCount}/${aforoMaximo})`
      : `${reservasCount}/${OPEN_CLASS_MIN_STUDENTS} mín. (corte 5h)`,
    badgeColor: hasMin
      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
      : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
  };
}

/**
 * Detecta sesiones dentro de las 5 horas previas con menos de 4 alumnos,
 * cancela la sesión y reembolsa automáticamente 1 clase al bono del alumno en Supabase.
 * 
 * Reglas de seguridad e idempotencia:
 * 1. Opera ÚNICAMENTE sobre sesiones FUTURAS (horasRestantes > 0 && horasRestantes <= OPEN_CLASS_CUTOFF_HOURS).
 * 2. Utiliza un registro persistente (df_suspended_sessions_v1) para garantizar que una sesión jamás se suspenda ni reembolse más de una vez.
 * 3. Al reembolsar, elimina el registro en alumnos_clases en Supabase para que syncReservasFromSupabase no lo vuelva a importar.
 */
export async function verificarYSuspenderSesionesBajoAforo(): Promise<{ canceladasCount: number; alumnosReembolsados: string[] }> {
  if (typeof window === "undefined") return { canceladasCount: 0, alumnosReembolsados: [] };
  
  // Conjunto de sesiones ya suspendidas previamente
  let suspendedSessions: string[] = [];
  try {
    const raw = localStorage.getItem("df_suspended_sessions_v1");
    if (raw) suspendedSessions = JSON.parse(raw);
  } catch {}
  const suspendedSet = new Set(suspendedSessions);

  const current = getOpenClassReservas();
  let updated = false;
  const reembolsados: string[] = [];

  const sessionsMap: Record<string, OpenClassReserva[]> = {};
  current.forEach(r => {
    if (r.estado === "Confirmada") {
      const key = `${normalizeClaseId(r.clase_id)}_${cleanDateISO(r.fecha_iso)}`;
      if (!sessionsMap[key]) sessionsMap[key] = [];
      sessionsMap[key].push(r);
    }
  });

  for (const [sessionKey, reservas] of Object.entries(sessionsMap)) {
    // Si la sesión ya fue suspendida y reembolsada, no volver a procesar
    if (suspendedSet.has(sessionKey)) continue;

    if (reservas.length > 0 && reservas.length < OPEN_CLASS_MIN_STUDENTS) {
      const sample = reservas[0];
      const horasRestantes = getHorasRestantesParaSesion(sample.fecha_iso, sample.hora_inicio);
      
      // ÚNICAMENTE sesiones futuras dentro del margen de 5 horas previas
      if (horasRestantes > 0 && horasRestantes <= OPEN_CLASS_CUTOFF_HOURS) {
        suspendedSet.add(sessionKey);

        for (const r of reservas) {
          r.estado = "Cancelada";
          r.asistido = false;
          updated = true;
          reembolsados.push(r.alumno_nombre || r.alumno_id);

          // Reembolsar 1 clase en Supabase si tiene saldo de bono y eliminar reserva de alumnos_clases
          try {
            const { data: st } = await supabase
              .from("alumnos")
              .select("id, clases_restantes, plan_activo")
              .eq("id", r.alumno_id)
              .maybeSingle();

            if (st && typeof st.clases_restantes === "number") {
              await supabase.from("alumnos").update({
                clases_restantes: st.clases_restantes + 1
              }).eq("id", st.id);
            }

            // Eliminar asignación de la base de datos para evitar re-lectura activa
            await supabase.from("alumnos_clases")
              .delete()
              .eq("alumno_id", r.alumno_id)
              .eq("clase_id", r.clase_id);
          } catch (e) {
            console.error("Error reembolsando saldo a alumno por aforo mínimo:", e);
          }
        }
      }
    }
  }

  if (updated) {
    try {
      localStorage.setItem("df_suspended_sessions_v1", JSON.stringify(Array.from(suspendedSet)));
    } catch {}
    saveOpenClassReservas(current);
    window.dispatchEvent(new Event("df_reservas_updated"));
  }

  return { canceladasCount: reembolsados.length, alumnosReembolsados: reembolsados };
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

  if (horasRestantes <= 24) {
    return {
      cancelable: false,
      horasRestantes,
      motivo: "Faltan menos de 24 horas para el inicio de la clase. Según la normativa oficial, no es cancelable y la sesión se computa de tu bono."
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

  // Reject cancellation if within 24 hours unless explicitly allowed (admin bypass)
  if (!options?.allowUnder24h) {
    const { cancelable, motivo } = isReservaCancelable(target);
    if (!cancelable) {
      console.warn("Cancelación bloqueada por normativa de 24h:", motivo);
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
      if (rawDate) {
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

    // Merge with current local reservations
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
      } else {
        // Only keep local reservations that do not originate from Supabase (res_sb_)
        if (!l.id.startsWith("res_sb_")) {
          merged.push({
            ...l,
            clase_id: normLocalClassId
          });
        }
      }
    }

    saveOpenClassReservas(merged);
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
export async function findStudentByCodeOrText(rawCode: string): Promise<any | null> {
  const trimmed = (rawCode || "").trim();
  if (!trimmed) return null;

  // 1. UUID exacto
  if (trimmed.length === 36 && (trimmed.match(/-/g) || []).length === 4) {
    const { data } = await supabase.from("alumnos").select("*").eq("id", trimmed).maybeSingle();
    if (data) return data;
  }

  // 2. Normalizar teclado español y prefijos
  const normalized = trimmed.replace(/[/\\':_.]/g, "-").trim();
  const cleanToken = normalized
    .replace(/^DF-STUDENT-/i, "")
    .replace(/^DF-ALUMNO-/i, "")
    .replace(/^STUDENT-/i, "")
    .replace(/^ALUMNO-/i, "")
    .replace(/^DF-/i, "")
    .trim();

  const pureToken = trimmed
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^(DFSTUDENT|DFALUMNO|STUDENT|ALUMNO|DF)/i, "")
    .trim();

  const candidates = Array.from(new Set([
    cleanToken,
    pureToken,
    normalized,
    trimmed,
    `DF-${cleanToken}`,
    `DF-${pureToken}`
  ])).filter(Boolean);

  for (const token of candidates) {
    // Exact nfc_token
    const { data: byNfc } = await supabase.from("alumnos").select("*").eq("nfc_token", token).limit(1).maybeSingle();
    if (byNfc) return byNfc;

    // Exact DNI
    const { data: byDni } = await supabase.from("alumnos").select("*").ilike("dni", token).limit(1).maybeSingle();
    if (byDni) return byDni;

    // Exact email
    if (token.includes("@")) {
      const { data: byEmail } = await supabase.from("alumnos").select("*").ilike("email", token).limit(1).maybeSingle();
      if (byEmail) return byEmail;
    }

    // Exact ID match if UUID
    if (token.length === 36 && (token.match(/-/g) || []).length === 4) {
      const { data: byId } = await supabase.from("alumnos").select("*").eq("id", token).limit(1).maybeSingle();
      if (byId) return byId;
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
      .select("*")
      .or(`telefono.eq.${digits9},telefono.eq.${spaced1},telefono.eq.${spaced2},telefono.ilike.%${digits9.slice(3, 9)}%`)
      .limit(1)
      .maybeSingle();

    if (byPhone) return byPhone;
  }

  // 4. Búsqueda por Nombre Completo (soporta "Olivia Anna", "Olivia", "Hrebenyvk", etc.)
  if (cleanToken && cleanToken.length >= 3) {
    // Intento 1: Nombre completo ilike '%cleanToken%'
    const { data: byName } = await supabase
      .from("alumnos")
      .select("*")
      .ilike("nombre_completo", `%${cleanToken}%`)
      .limit(1)
      .maybeSingle();
    if (byName) return byName;

    // Si tiene varios términos (ej. "Olivia Anna"), buscar por cada palabra relevante
    const words = cleanToken.split(/\s+/).filter(w => w.length >= 3);
    for (const w of words) {
      const { data: byWord } = await supabase
        .from("alumnos")
        .select("*")
        .ilike("nombre_completo", `%${w}%`)
        .limit(1)
        .maybeSingle();
      if (byWord) return byWord;
    }

    // Intento 2: OR ampliado (nfc_token, dni, email, telefono, nombre_completo)
    const { data: byOr } = await supabase
      .from("alumnos")
      .select("*")
      .or(`nfc_token.ilike.%${cleanToken}%,dni.ilike.%${cleanToken}%,email.ilike.%${cleanToken}%,telefono.ilike.%${cleanToken}%,nombre_completo.ilike.%${cleanToken}%`)
      .limit(1)
      .maybeSingle();
    if (byOr) return byOr;
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

  // 1. COMPROBAR CLASES REGULARES MATRICULADAS HOY EN alumnos_clases
  try {
    const { data: enrollments } = await supabase
      .from("alumnos_clases")
      .select("clase_id, clases_cuadrante(*)")
      .eq("alumno_id", student.id);

    if (enrollments && enrollments.length > 0) {
      const todayClasses = enrollments
        .map((e: any) => e.clases_cuadrante)
        .filter((c: any) => c && (c.dia_semana || "").toUpperCase() === hoyDia);

      let bestRegular: any = null;
      let minDistance = Infinity;

      for (const c of todayClasses) {
        const startMin = parseTimeToMinutes(c.hora_inicio);
        const endMin = parseTimeToMinutes(c.hora_fin);

        // Ventana de llegada [inicio - 45 min, fin + 15 min]
        if (currentMinutes >= (startMin - 45) && currentMinutes <= (endMin + 15)) {
          const dist = Math.abs(currentMinutes - startMin);
          if (dist < minDistance) {
            minDistance = dist;
            bestRegular = c;
          }
        }
      }

      if (bestRegular) {
        return {
          claseId: bestRegular.id,
          claseNombre: bestRegular.nombre_clase,
          profesor: bestRegular.profesor,
          sede: bestRegular.sede,
          isRegular: true,
          isOpenClass: false
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

      if (currentMinutes >= (startMin - 45) && currentMinutes <= (endMin + 15)) {
        return {
          claseId: todayReserva.clase_id,
          claseNombre: todayReserva.nombre_clase,
          profesor: todayReserva.profesor,
          sede: todayReserva.sede,
          isRegular: false,
          isOpenClass: true
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

        // Solo usar la clase si estamos dentro del rango temporal (±45 min)
        if (currentMinutes >= (startMin - 45) && currentMinutes <= (endMin + 20)) {
          const isPrefOpen = (prefClass.nombre_clase || "").toUpperCase().includes("OPEN");
          if (!isPrefOpen || !isRegularOrUnlimited || currentMinutes < endMin) {
            return {
              claseId: prefClass.id,
              claseNombre: prefClass.nombre_clase,
              profesor: prefClass.profesor,
              sede: prefClass.sede,
              isRegular: !isPrefOpen,
              isOpenClass: isPrefOpen
            };
          }
        }
      }
    } catch {}
  }

  // 4. COMPROBAR CLASE REGULAR ACTIVA EN LA SEDE PARA EL HORARIO ACTUAL
  try {
    let query = supabase
      .from("clases_cuadrante")
      .select("*")
      .eq("dia_semana", hoyDia);

    if (activeSede && activeSede !== "consolidado") {
      const sedeKey = activeSede.toLowerCase().includes("castilla") ? "castilla" : "tejar";
      query = query.in("sede", sedeKey === "tejar" ? ["tejar", "studio", "mostoles"] : ["castilla", "alcorcon"]);
    }

    const { data: activeClasses } = await query;
    if (activeClasses && activeClasses.length > 0) {
      let candidate: any = null;
      let minDelta = Infinity;

      for (const c of activeClasses) {
        const startMin = parseTimeToMinutes(c.hora_inicio);
        const endMin = parseTimeToMinutes(c.hora_fin);
        const isOpen = (c.nombre_clase || "").toUpperCase().includes("OPEN") || c.tipo_clase === "Open Class";

        // CRÍTICO: NUNCA asignar Open Class en el fallback de proximidad.
        // Las Open Classes requieren reserva previa confirmada (comprobada en el paso 2).
        if (isOpen) continue;

        // Comprobar sede del alumno si se conoce
        if (student.sede && c.sede && normalizeSede(student.sede) !== normalizeSede(c.sede)) {
          continue;
        }

        if (currentMinutes >= (startMin - 35) && currentMinutes <= (endMin + 10)) {
          const delta = Math.abs(currentMinutes - startMin);
          if (delta < minDelta) {
            minDelta = delta;
            candidate = c;
          }
        }
      }

      if (candidate) {
        return {
          claseId: candidate.id,
          claseNombre: candidate.nombre_clase,
          profesor: candidate.profesor,
          sede: candidate.sede,
          isRegular: true,
          isOpenClass: false
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
    isOpenClass: false
  };
}


