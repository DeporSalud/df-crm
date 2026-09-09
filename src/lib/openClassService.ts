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

export const DEFAULT_STUDIO2_OPEN_CLASSES = [
  {
    id: "oc_lunes_1",
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
    id: "oc_lunes_2",
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
    id: "oc_martes_1",
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
    id: "oc_miercoles_1",
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
    id: "oc_miercoles_2",
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
    id: "oc_jueves_1",
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

export function normalizeDay(day: string): string {
  return (day || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
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
  const all = getOpenClassReservas();
  return all.filter(r => r.clase_id === claseId && r.fecha_iso === cleanISO && (r.estado === "Confirmada" || r.estado === "Asistida")).length;
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
    return raw ? JSON.parse(raw) : [];
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
  const all = getOpenClassReservas();
  return all.some(r => 
    r.alumno_id === alumnoId && 
    r.clase_id === claseId && 
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

  // Idempotency: Check if the student already holds a confirmed/attended reservation first
  const current = getOpenClassReservas();
  const existing = current.find(r => 
    r.alumno_id === data.alumno_id && 
    r.clase_id === data.clase.id && 
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
    clase_id: data.clase.id,
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
  const all = getOpenClassReservas();
  return all.filter(r => r.clase_id === claseId && r.fecha_iso === cleanISO && (r.estado === "Confirmada" || r.estado === "Asistida"));
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
      return { ...r, asistido: true, estado: "Confirmada" as const };
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
  const current = getOpenClassReservas();
  let found = false;
  const updated = current.map(r => {
    if (r.alumno_id === alumnoId && r.clase_id === claseId && r.fecha_iso === cleanISO && (r.estado === "Confirmada" || r.estado === "Asistida")) {
      found = true;
      return { ...r, asistido: true };
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
    if (r.alumno_id === alumnoId && r.fecha_iso === cleanISO && (r.estado === "Confirmada" || r.estado === "Asistida")) {
      found = true;
      return { ...r, asistido: true };
    }
    return r;
  });
  if (found) {
    saveOpenClassReservas(updated);
  }
  return found;
}

