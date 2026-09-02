export interface OpenClassReserva {
  id: string;
  alumno_id: string;
  alumno_nombre: string;
  clase_id: string;
  nombre_clase: string;
  profesor: string;
  sede: string;
  sala?: string;
  fecha_iso: string; // e.g. "2026-09-01"
  fecha_formateada: string; // e.g. "Lunes 1 de Septiembre"
  dia_semana: string; // e.g. "LUNES"
  hora_inicio: string; // e.g. "19:00"
  hora_fin: string; // e.g. "20:00"
  creado_en: string;
  estado: "Confirmada" | "Cancelada";
}

export interface CalendarDayItem {
  dateISO: string; // "2026-09-01"
  dayName: string; // "LUNES"
  dayShort: string; // "LUN"
  dayNumber: number; // 1
  monthName: string; // "Septiembre"
  monthShort: string; // "Sep"
  fullLabel: string; // "Lunes 1 Sep"
  isToday: boolean;
  isTomorrow: boolean;
}

const STORAGE_KEY = "df_openclass_reservas_v2";

/**
 * Generates the upcoming calendar dates for booking (next 30 days starting from current/upcoming season)
 */
export function getUpcomingCalendarDates(daysCount = 28): CalendarDayItem[] {
  const list: CalendarDayItem[] = [];
  const now = new Date();
  
  // Open Classes start on September 9th, 2026
  const seasonOpenClassStart = new Date(2026, 8, 9, 0, 0, 0); // Sep 9, 2026
  const start = now.getTime() < seasonOpenClassStart.getTime() ? new Date(seasonOpenClassStart) : new Date(now);
  
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

  for (let i = 0; i < daysCount; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    // Skip Sundays if studio is closed on Sunday
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0) continue;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateISO = `${year}-${month}-${day}`;
    const dayName = dayNamesEs[dayOfWeek];
    const dayShort = dayShortEs[dayOfWeek];
    const dayNumber = d.getDate();
    const monthName = monthNamesEs[d.getMonth()];
    const monthShort = monthShortEs[d.getMonth()];

    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    list.push({
      dateISO,
      dayName,
      dayShort,
      dayNumber,
      monthName,
      monthShort,
      fullLabel: isToday ? "Hoy" : isTomorrow ? "Mañana" : `${dayShort} ${dayNumber} ${monthShort}`,
      isToday,
      isTomorrow
    });
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
  const all = getOpenClassReservas();
  return all.filter(r => r.clase_id === claseId && r.fecha_iso === fechaISO && r.estado === "Confirmada").length;
}

export function isSesionCompleta(clase: any, fechaISO: string): boolean {
  if (!clase) return false;
  const currentCount = getSesionReservasCount(clase.id, fechaISO);
  const maxCapacity = clase.aforo_maximo || 20;
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
  return all.filter(r => r.alumno_id === alumnoId && r.estado === "Confirmada");
}

export function isAlumnoReservadoEnSesion(alumnoId: string, claseId: string, fechaISO: string): boolean {
  const all = getOpenClassReservas();
  return all.some(r => 
    r.alumno_id === alumnoId && 
    r.clase_id === claseId && 
    r.fecha_iso === fechaISO && 
    r.estado === "Confirmada"
  );
}

export function crearReservaOpenClass(data: {
  alumno_id: string;
  alumno_nombre: string;
  clase: any;
  calendarDay: CalendarDayItem;
}): OpenClassReserva {
  const nueva: OpenClassReserva = {
    id: "res_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    alumno_id: data.alumno_id,
    alumno_nombre: data.alumno_nombre,
    clase_id: data.clase.id,
    nombre_clase: data.clase.nombre_clase,
    profesor: data.clase.profesor,
    sede: normalizeSede(data.clase.sede || "tejar"),
    sala: data.clase.sala || "Sala 1",
    fecha_iso: data.calendarDay.dateISO,
    fecha_formateada: `${data.calendarDay.dayName.charAt(0) + data.calendarDay.dayName.slice(1).toLowerCase()} ${data.calendarDay.dayNumber} de ${data.calendarDay.monthName}`,
    dia_semana: data.calendarDay.dayName,
    hora_inicio: data.clase.hora_inicio,
    hora_fin: data.clase.hora_fin,
    creado_en: new Date().toISOString(),
    estado: "Confirmada"
  };

  const current = getOpenClassReservas();
  const updated = [nueva, ...current];
  saveOpenClassReservas(updated);
  return nueva;
}

export function getReservasPorClaseYSesion(claseId: string, fechaISO: string): OpenClassReserva[] {
  const all = getOpenClassReservas();
  return all.filter(r => r.clase_id === claseId && r.fecha_iso === fechaISO && r.estado === "Confirmada");
}

export function cancelarReservaOpenClass(reservaId: string): boolean {
  const current = getOpenClassReservas();
  const updated = current.map(r => r.id === reservaId ? { ...r, estado: "Cancelada" as const } : r);
  saveOpenClassReservas(updated);
  return true;
}
