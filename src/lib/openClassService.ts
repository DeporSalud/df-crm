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
    aforo_maximo: 20,
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
  return all.filter(r => r.alumno_id === alumnoId && (r.estado === "Confirmada" || r.estado === "Asistida"));
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

export function cancelarReservaOpenClass(reservaId: string): boolean {
  const current = getOpenClassReservas();
  const target = current.find(r => r.id === reservaId);
  if (!target || target.estado === "Cancelada") {
    return false;
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
          sala,
          tipo_clase,
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
        } else if (l.estado === "Cancelada") {
          merged[matchIndex].estado = "Cancelada";
        }
      } else {
        merged.push({
          ...l,
          clase_id: normLocalClassId
        });
      }
    }

    saveOpenClassReservas(merged);
    return merged;
  } catch (err) {
    console.error("Error in syncReservasFromSupabase:", err);
    return getOpenClassReservas();
  }
}


