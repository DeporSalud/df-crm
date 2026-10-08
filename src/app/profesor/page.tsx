"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { 
  UserCheck, Check, Clock, Users, ShieldAlert, Sparkles, Calendar, Search, 
  Lock, LogOut, KeyRound, ArrowLeft, ChevronRight, Flame, Ticket, GraduationCap, 
  CreditCard, Building2, Trash2, AlertTriangle, AlertCircle, Tag, CheckCircle2, ShieldCheck, X,
  CalendarDays, BarChart3, MessageCircle, Filter
} from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import AppModal, { ModalState } from "@/components/AppModal";
import { 
  getUpcomingCalendarDates, 
  CalendarDayItem, 
  normalizeDay, 
  normalizeSede, 
  formatSedeName, 
  getSesionReservasCount, 
  isSesionCompleta, 
  isAlumnoReservadoEnSesion, 
  crearReservaOpenClass, 
  cancelarReservaOpenClass,
  getReservasPorClaseYSesion,
  getOpenClassReservas,
  OpenClassReserva,
  normalizeClaseId,
  syncReservasFromSupabase,
  getUpcomingSessionsForClass,
  DEFAULT_STUDIO2_OPEN_CLASSES,
  LEGACY_ID_MAP,
  cleanDateISO,
  getNextUpcomingSessionDate,
  getTodayISO,
  deleteAlumnosClasesBySessionDate
} from "@/lib/openClassService";
import { publishSyncEvent } from "@/lib/syncEventBus";
import {
  getMadridDateISO,
  getMadridDateString,
  getMadridTimeString,
  toMadridSessionISO,
  getMadridDayRangeUTC,
  isSameMadridDay
} from "@/lib/timezones";

const TEACHER_PINS: Record<string, { name: string; isAdmin?: boolean }> = {
  "9999": { name: "ADMINISTRADOR MASTER", isAdmin: true },
  "2026": { name: "RUTH DOMÍNGUEZ", isAdmin: true },
  "1001": { name: "LUCÍA MUÑOZ" },
  "1002": { name: "LUCÍA ZAMORANO" },
  "1003": { name: "ANDREA SOTO" },
  "1004": { name: "EVA LEIVA" },
  "1005": { name: "LUCAS LÓPEZ" },
  "1006": { name: "PAULA JIMÉNEZ" },
  "1007": { name: "ABEL Y NAYARA" },
  "1008": { name: "DARÍO HUMBERTO" },
  "1009": { name: "NEREA OLIVARES" },
  "1010": { name: "ALEJANDRO ROVINA" },
  "1011": { name: "NIL BARBERÁ" },
  "1012": { name: "MARIO GADEA" },
  "1013": { name: "DANIELA MÉRIDA" },
  "1014": { name: "MARTA GARCÍA VÁZQUEZ" }
};

const TEACHER_DB_ID_MAP: Record<string, string> = {
  // 1001: Lucía Muñoz
  "LUCIA MUNOZ": "c57fb3d0-525f-474a-8de7-d6d504b540be",
  "LUCÍA MUÑOZ": "c57fb3d0-525f-474a-8de7-d6d504b540be",
  "1001": "c57fb3d0-525f-474a-8de7-d6d504b540be",

  // 1002: Lucía Zamorano
  "LUCIA ZAMORANO": "2d95e851-b927-494b-9558-d7ed6d447a20",
  "LUCÍA ZAMORANO": "2d95e851-b927-494b-9558-d7ed6d447a20",
  "1002": "2d95e851-b927-494b-9558-d7ed6d447a20",

  // 1003: Andrea Soto
  "ANDREA SOTO": "7a100300-0000-4000-a000-000000001003",
  "1003": "7a100300-0000-4000-a000-000000001003",

  // 1004: Eva Leiva
  "EVA LEIVA": "80c59814-1ab4-4793-9039-e8fe1c5ef681",
  "1004": "80c59814-1ab4-4793-9039-e8fe1c5ef681",

  // 1005: Lucas López
  "LUCAS LOPEZ": "7a100500-0000-4000-a000-000000001005",
  "LUCAS LÓPEZ": "7a100500-0000-4000-a000-000000001005",
  "1005": "7a100500-0000-4000-a000-000000001005",

  // 1006: Paula Jiménez
  "PAULA JIMENEZ": "32d7139b-b2a2-4084-9322-d86cda358df7",
  "PAULA JIMÉNEZ": "32d7139b-b2a2-4084-9322-d86cda358df7",
  "1006": "32d7139b-b2a2-4084-9322-d86cda358df7",

  // 1007: Abel y Nayara
  "ABEL Y NAYARA": "7a100700-0000-4000-a000-000000001007",
  "1007": "7a100700-0000-4000-a000-000000001007",

  // 1008: Darío Humberto
  "DARIO HUMBERTO": "7a100800-0000-4000-a000-000000001008",
  "DARÍO HUMBERTO": "7a100800-0000-4000-a000-000000001008",
  "1008": "7a100800-0000-4000-a000-000000001008",

  // 1009: Nerea Olivares
  "NEREA OLIVARES": "7a100900-0000-4000-a000-000000001009",
  "1009": "7a100900-0000-4000-a000-000000001009",

  // 1010: Alejandro Rovina
  "ALEJANDRO ROVINA": "7a101000-0000-4000-a000-000000001010",
  "1010": "7a101000-0000-4000-a000-000000001010",

  // 1011: Nil Barberá
  "NIL BARBERA": "7a101100-0000-4000-a000-000000001011",
  "NIL BARBERÁ": "7a101100-0000-4000-a000-000000001011",
  "1011": "7a101100-0000-4000-a000-000000001011",

  // 1012: Mario Gadea
  "MARIO GADEA": "145547d1-643c-40aa-9144-305893e8f64c",
  "1012": "145547d1-643c-40aa-9144-305893e8f64c",

  // 1013: Daniela Mérida
  "DANIELA MERIDA": "0812eb2d-bcb5-4f9e-b690-1beaafcd3e61",
  "DANIELA MÉRIDA": "0812eb2d-bcb5-4f9e-b690-1beaafcd3e61",
  "1013": "0812eb2d-bcb5-4f9e-b690-1beaafcd3e61",

  // 1014: Marta García Vázquez
  "MARTA GARCIA": "e9cc4200-aba2-4e67-8191-808c40e75621",
  "MARTA GARCÍA": "e9cc4200-aba2-4e67-8191-808c40e75621",
  "MARTA GARCIA VAZQUEZ": "e9cc4200-aba2-4e67-8191-808c40e75621",
  "MARTA GARCÍA VÁZQUEZ": "e9cc4200-aba2-4e67-8191-808c40e75621",
  "1014": "e9cc4200-aba2-4e67-8191-808c40e75621"
};

// Safe haptic feedback helper
const triggerHaptic = (pattern: number | number[] = 15) => {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors if unsupported or blocked by browser policy
    }
  }
};

const normalizeText = (text?: string | null): string => {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
};

const isStudio1 = (sede?: string | null): boolean => {
  const s = (sede || "").toLowerCase().trim();
  return s === "tejar" || s === "mostoles" || s === "studio" || s === "studio 1";
};

const getStudioDisplayName = (sede?: string | null): string => {
  return isStudio1(sede) ? "Studio 1 (Plaza El Tejar)" : "Studio 2 (Paseo Castilla)";
};

const getTodayDateRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

const isRegularMembership = (plan?: string | null, remaining?: number | null): boolean => {
  if (remaining === null) return true;
  const p = (plan || "").toLowerCase();
  return p.includes("regular") || p.includes("mensual") || p.includes("ilimitad") || p.includes("cuota");
};

const getDayOrder = (day?: string | null): number => {
  const days: Record<string, number> = {
    "LUNES": 1, "MARTES": 2, "MIÉRCOLES": 3, "MIERCOLES": 3,
    "JUEVES": 4, "VIERNES": 5, "SÁBADO": 6, "SABADO": 6, "DOMINGO": 7
  };
  return days[normalizeText(day)] || 8;
};

const checkClassIntervalConflict = (startA?: string, endA?: string, startB?: string, endB?: string): boolean => {
  if (!startA || !endA || !startB || !endB) return false;
  return (startA < endB) && (endA > startB);
};

const checkTeacherTimeConflict = (
  targetClass: any,
  teacherClasses: any[] = [],
  enrolledOpenClasses: any[] = []
): { conflict: boolean; conflictingClassName?: string; reason?: string } => {
  if (!targetClass.hora_inicio || !targetClass.hora_fin) {
    return { conflict: true, reason: "Horas no especificadas" };
  }
  if (targetClass.hora_inicio >= targetClass.hora_fin) {
    return { conflict: true, reason: "La hora de fin debe ser posterior a la hora de inicio" };
  }

  const targetDay = normalizeText(targetClass.dia_semana);
  const allClassesToCheck = [...teacherClasses, ...enrolledOpenClasses];

  for (const c of allClassesToCheck) {
    if (c.id && c.id === targetClass.id) continue;
    if (normalizeText(c.dia_semana) !== targetDay) continue;

    const overlaps = checkClassIntervalConflict(
      targetClass.hora_inicio, targetClass.hora_fin,
      c.hora_inicio, c.hora_fin
    );

    if (overlaps) {
      return {
        conflict: true,
        conflictingClassName: c.nombre_clase,
        reason: `Existe un solapamiento horario con "${c.nombre_clase}" (${c.dia_semana} ${c.hora_inicio}-${c.hora_fin}h).`
      };
    }
  }

  return { conflict: false };
};

const isOpenClass = (clase: any) => {
  if (!clase) return false;
  const nameUpper = (clase.nombre_clase || "").toUpperCase();
  const typeUpper = (clase.tipo_clase || "").toUpperCase();
  return (
    typeUpper.includes("OPEN") || 
    nameUpper.includes("OPEN") || 
    nameUpper.includes("FORMACI") || 
    nameUpper.includes("ROTAT") ||
    Boolean(DEFAULT_STUDIO2_OPEN_CLASSES?.some((def: any) => def.id === clase.id)) ||
    Boolean(LEGACY_ID_MAP?.[clase.id])
  );
};

const getMonthNameSpanish = (monthStr: string) => {
  const months: Record<string, string> = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
    "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
  };
  return months[monthStr] || monthStr;
};

export default function ProfesorPortal() {
  const [pinInput, setPinInput] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string>("");
  
  const [selectedProfesor, setSelectedProfesor] = useState<string>("LUCÍA MUÑOZ");
  const [activeTab, setActiveTab] = useState<"mis_clases" | "open_classes" | "comprar_bono">("mis_clases");
  
  // Teacher's own student record in `alumnos` (to track their bono balance and Open Class enrollments)
  const [teacherStudent, setTeacherStudent] = useState<any | null>(null);

  // Mis Clases (Teacher classes)
  const [clasesProfesor, setClasesProfesor] = useState<any[]>([]);
  const [selectedClase, setSelectedClase] = useState<any | null>(null);
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>("");
  const [roster, setRoster] = useState<any[]>([]);
  const [rosterSearch, setRosterSearch] = useState<string>("");
  const [asistenciasRegistradas, setAsistenciasRegistradas] = useState<string[]>([]);
  const [deductedStudentIds, setDeductedStudentIds] = useState<Set<string>>(new Set());
  
  // Horario semanal por días & seguimiento de asistencias y faltas
  const [dayScheduleFilter, setDayScheduleFilter] = useState<string>("HOY");
  const [attendanceFilter, setAttendanceFilter] = useState<"todos" | "presentes" | "faltas">("todos");
  const [classAllAttendances, setClassAllAttendances] = useState<any[]>([]);
  const [isClassMonthlyModalOpen, setIsClassMonthlyModalOpen] = useState<boolean>(false);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<any | null>(null);
  const [classViewTab, setClassViewTab] = useState<"pase_lista" | "dias_asistencia">("pase_lista");

  // Open Classes & Calendar State
  const calendarDays = getUpcomingCalendarDates(30);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<CalendarDayItem>(calendarDays[0]);
  const [allOpenClasses, setAllOpenClasses] = useState<any[]>([]);
  const [teacherEnrolledClassIds, setTeacherEnrolledClassIds] = useState<string[]>([]);
  const [openClassReservasVersion, setOpenClassReservasVersion] = useState<number>(0);

  // Unified calendar sessions for ANY class (Regulares y Open Class)
  const currentClassSessions = useMemo(() => {
    if (!selectedClase) return [];
    return getUpcomingSessionsForClass(selectedClase, 12, "2026-09-07");
  }, [selectedClase?.id, selectedClase?.dia_semana, openClassReservasVersion]);
  
  // Checkout
  const [selectedBonoForPayment, setSelectedBonoForPayment] = useState<any | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isRosterLoading, setIsRosterLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ isOpen: false, message: "" });

  const profesoresDisponibles = [
    "LUCÍA MUÑOZ",
    "LUCÍA ZAMORANO",
    "ANDREA SOTO",
    "EVA LEIVA",
    "LUCAS LÓPEZ",
    "PAULA JIMÉNEZ",
    "ABEL Y NAYARA",
    "DARÍO HUMBERTO",
    "NEREA OLIVARES",
    "ALEJANDRO ROVINA",
    "NIL BARBERÁ",
    "MARIO GADEA",
    "DANIELA MÉRIDA",
    "MARTA GARCÍA VÁZQUEZ",
    "RUTH DOMÍNGUEZ"
  ];

  const systemDays = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
  const todayStr = systemDays[new Date().getDay()];

  // Teacher Discounted Bonos (-10%)
  const bonosDocentes = [
    { 
      id: "Bono 4 clases", 
      nombre: "Bono 4 Clases Docente", 
      clasesCount: 4,
      precioOriginal: "45,00 €",
      precioDocente: "40,50 €", 
      precioNum: 40.50,
      desc: "4 clases • Validez 30 días • Acceso a OPEN CLASS con 10% dto. especial para profesores" 
    },
    { 
      id: "Bono 8 clases", 
      nombre: "Bono 8 Clases Docente", 
      clasesCount: 8,
      precioOriginal: "57,00 €",
      precioDocente: "51,30 €", 
      precioNum: 51.30,
      popular: true,
      desc: "8 clases (Recomendado) • Validez 30 días • 10% dto. especial para profesores" 
    },
    { 
      id: "Bono 10 clases", 
      nombre: "Bono 10 Clases Docente", 
      clasesCount: 10,
      precioOriginal: "79,00 €",
      precioDocente: "71,10 €", 
      precioNum: 71.10,
      desc: "10 clases • Validez 30 días • Acceso intensivo a OPEN CLASS con 10% dto." 
    },
    { 
      id: "Mensualidad Ilimitada", 
      nombre: "Pase Ilimitado Open Class Docente", 
      clasesCount: 999,
      precioOriginal: "100,00 €",
      precioDocente: "90,00 € / mes", 
      precioNum: 90.00,
      desc: "Acceso total sin límite a todas las OPEN CLASS de la escuela con 10% dto. mensual" 
    },
    { 
      id: "Clase Suelta", 
      nombre: "Clase Suelta Open Class Docente", 
      clasesCount: 1,
      precioOriginal: "15,00 €",
      precioDocente: "13,50 €", 
      precioNum: 13.50,
      desc: "1 sesión individual de OPEN CLASS con 10% dto." 
    },
    { 
      id: "Formacion Especial", 
      nombre: "Acceso Formación Especial Docente", 
      clasesCount: 1,
      precioOriginal: "35,00 €",
      precioDocente: "31,50 €", 
      precioNum: 31.50,
      desc: "Plaza para intensivos y formación rotativa con 10% dto. docente aplicado" 
    }
  ];

  // Check saved PIN session on mount
  useEffect(() => {
    const savedPin = sessionStorage.getItem("df_profesor_pin");
    if (savedPin && TEACHER_PINS[savedPin]) {
      const teacherInfo = TEACHER_PINS[savedPin];
      setIsAuthenticated(true);
      setIsAdmin(!!teacherInfo.isAdmin);
      if (!teacherInfo.isAdmin) {
        setSelectedProfesor(teacherInfo.name);
      }
    }
  }, []);

  // Handle PIN Keypad input
  const handleKeyClick = (digit: string) => {
    triggerHaptic(15);
    setPinError("");
    setPinInput(prev => {
      if (prev.length >= 4) return prev;
      const newPin = prev + digit;
      if (newPin.length === 4) {
        setTimeout(() => validatePin(newPin), 0);
      }
      return newPin;
    });
  };

  const handleDelete = () => {
    triggerHaptic(15);
    setPinError("");
    setPinInput(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    triggerHaptic(15);
    setPinError("");
    setPinInput("");
  };

  const validatePin = (pin: string) => {
    const teacherInfo = TEACHER_PINS[pin];
    if (teacherInfo) {
      triggerHaptic([20, 20]);
      setIsAuthenticated(true);
      setIsAdmin(!!teacherInfo.isAdmin);
      sessionStorage.setItem("df_profesor_pin", pin);
      
      if (!teacherInfo.isAdmin) {
        setSelectedProfesor(teacherInfo.name);
      }
      setPinInput("");
      setPinError("");
    } else {
      triggerHaptic([40, 30, 40]);
      setPinError("Código PIN incorrecto. Revisa e inténtalo de nuevo.");
      setTimeout(() => {
        setPinInput("");
      }, 600);
    }
  };

  // Physical Keyboard Support when on PIN keypad screen
  useEffect(() => {
    if (isAuthenticated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toUpperCase();
      if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeyClick(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleDelete();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClear();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (pinInput.length === 4) {
          validatePin(pinInput);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthenticated, pinInput]);

  const handleLogout = () => {
    sessionStorage.removeItem("df_profesor_pin");
    setIsAuthenticated(false);
    setIsAdmin(false);
    setPinInput("");
    setPinError("");
    setSelectedProfesor("LUCÍA MUÑOZ");
    setActiveTab("mis_clases");
    setTeacherStudent(null);
    setClasesProfesor([]);
    setSelectedClase(null);
    setRoster([]);
    setRosterSearch("");
    setAsistenciasRegistradas([]);
    setDeductedStudentIds(new Set());
    setDayScheduleFilter("HOY");
    setAttendanceFilter("todos");
    setClassAllAttendances([]);
    setIsClassMonthlyModalOpen(false);
    setSelectedStudentForHistory(null);
    setAllOpenClasses([]);
    setTeacherEnrolledClassIds([]);
    setSelectedBonoForPayment(null);
    setIsProcessingPayment(false);
    setIsRosterLoading(false);
    setSavingId(null);
    setModal({ isOpen: false, message: "" });
  };

  // Get or create Teacher student profile in `alumnos` table
  const fetchTeacherStudentProfile = async () => {
    if (!selectedProfesor) return;

    const normProf = normalizeText(selectedProfesor);
    const explicitUUID = TEACHER_DB_ID_MAP[normProf] || TEACHER_DB_ID_MAP[selectedProfesor.toUpperCase().trim()] || (pinInput ? TEACHER_DB_ID_MAP[pinInput] : undefined);

    let existing: any = null;

    if (explicitUUID) {
      const { data } = await supabase.from("alumnos").select("*").eq("id", explicitUUID).maybeSingle();
      if (data) existing = data;
    }

    if (!existing) {
      if (normProf.includes("MARTA")) {
        const { data } = await supabase.from("alumnos").select("*").eq("id", "e9cc4200-aba2-4e67-8191-808c40e75621").maybeSingle();
        if (data) existing = data;
      } else if (normProf.includes("LUCIA") && normProf.includes("MUNOZ")) {
        const { data } = await supabase.from("alumnos").select("*").eq("id", "c57fb3d0-525f-474a-8de7-d6d504b540be").maybeSingle();
        if (data) existing = data;
      } else if (normProf.includes("PAULA") && normProf.includes("JIMENEZ")) {
        const { data } = await supabase.from("alumnos").select("*").eq("id", "32d7139b-b2a2-4084-9322-d86cda358df7").maybeSingle();
        if (data) existing = data;
      }
    }

    if (!existing) {
      const { data: matches } = await supabase.from("alumnos").select("*").ilike("nombre_completo", `%${selectedProfesor}%`);
      if (matches && matches.length > 0) {
        existing = matches[0];
      }
    }

    if (!existing) {
      // Auto-provision teacher student profile with special teacher plan and canonical UUID
      const newTeacherRecord: any = {
        nombre_completo: selectedProfesor,
        email: `${selectedProfesor.toLowerCase().replace(/[\s\./]/g, "")}@dancefactory.es`,
        telefono: "600000000",
        plan_activo: "Docente (10% Dto)",
        clases_restantes: 0,
        estado: "Activo",
        sede: "castilla",
        nfc_token: `PROF-${pinInput || Math.floor(1000 + Math.random() * 9000)}`
      };

      if (explicitUUID) {
        newTeacherRecord.id = explicitUUID;
      }

      const { data: created } = await supabase
        .from("alumnos")
        .insert([newTeacherRecord])
        .select()
        .single();

      if (created) existing = created;
    }

    setTeacherStudent(existing);

    // Fetch teacher's enrolled Open Class IDs
    if (existing?.id) {
      const { data: enrollments } = await supabase
        .from("alumnos_clases")
        .select("clase_id")
        .eq("alumno_id", existing.id);

      if (enrollments) {
        setTeacherEnrolledClassIds(enrollments.map(e => e.clase_id));
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated && selectedProfesor) {
      fetchTeacherStudentProfile();
    }
  }, [selectedProfesor, isAuthenticated]);

  // 1. Fetch Teacher Classes (without days filter, sorted by day and hour)
  const fetchTeacherClasses = async () => {
    setIsLoading(true);
    try {
      await syncReservasFromSupabase();

      const { data, error } = await supabase
        .from("clases_cuadrante")
        .select("*");

      if (error) {
        console.error("Error fetching clases cuadrante:", error);
      }

      if (data && data.length > 0) {
        const normalizedSelected = normalizeText(selectedProfesor);
        const filtered = data.filter(c => {
          const profNorm = normalizeText(c.profesor);
          return profNorm.includes(normalizedSelected) || normalizedSelected.includes(profNorm);
        });

        const sorted = filtered.sort((a, b) => {
          if (getDayOrder(a.dia_semana) !== getDayOrder(b.dia_semana)) {
            return getDayOrder(a.dia_semana) - getDayOrder(b.dia_semana);
          }
          return (a.hora_inicio || "").localeCompare(b.hora_inicio || "");
        });
        setClasesProfesor(sorted);
      } else {
        setClasesProfesor([]);
      }
    } catch (err) {
      console.error("Error in fetchTeacherClasses:", err);
      setClasesProfesor([]);
    } finally {
      setSelectedClase(null);
      setIsLoading(false);
    }
  };

  // 2. Fetch All Open Classes & Formaciones in the School (Excluding logged-in teacher's own classes)
  const fetchAllOpenClasses = async () => {
    const { data } = await supabase
      .from("clases_cuadrante")
      .select("*");

    if (data) {
      const normalizedSelected = normalizeText(selectedProfesor);
      const openAndFormaciones = data.filter(c => {
        const nameUpper = (c.nombre_clase || "").toUpperCase();
        return (nameUpper.includes("OPEN CLASS") || nameUpper.includes("FORMACI") || nameUpper.includes("ROTAT")) &&
          !normalizeText(c.profesor).includes(normalizedSelected);
      }).sort((a, b) => {
        if (getDayOrder(a.dia_semana) !== getDayOrder(b.dia_semana)) {
          return getDayOrder(a.dia_semana) - getDayOrder(b.dia_semana);
        }
        return (a.hora_inicio || "").localeCompare(b.hora_inicio || "");
      });
      setAllOpenClasses(openAndFormaciones);
    }
  };

  useEffect(() => {
    if (isAuthenticated && selectedProfesor) {
      fetchTeacherClasses();
      fetchAllOpenClasses();
    }
  }, [selectedProfesor, isAuthenticated]);

  // 3. Load Roster and Attendance for Selected Class & Date
  const loadRosterForDate = async (clase: any, dateIso: string, isSilentRefresh = false) => {
    if (!clase?.id) {
      setRoster([]);
      setAsistenciasRegistradas([]);
      setClassAllAttendances([]);
      return;
    }

    if (!isSilentRefresh) {
      setIsRosterLoading(true);
    }
    try {
      const classUUID = normalizeClaseId(clase.id);

      // Fetch all recorded attendances for this class to calculate stats and per-session counts
      const { data: allAttendancesData } = await supabase
        .from("asistencias")
        .select("id, alumno_id, fecha_hora")
        .eq("clase_id", classUUID);

      const allAtts = allAttendancesData || [];
      setClassAllAttendances(allAtts);

      // Filter for active session date in Europe/Madrid
      const activeSessionAtts = allAtts.filter(a => a.fecha_hora && isSameMadridDay(a.fecha_hora, dateIso));
      setAsistenciasRegistradas(activeSessionAtts.map(a => a.alumno_id));

      if (isOpenClass(clase)) {
        await syncReservasFromSupabase();

        // 1. Fetch from synced service
        let sessionReservas = getReservasPorClaseYSesion(classUUID, dateIso);

        // 2. Direct fallback to alumnos_clases in Supabase if service returns 0
        if (sessionReservas.length === 0) {
          const { data: directRows } = await supabase
            .from("alumnos_clases")
            .select(`
              id,
              alumno_id,
              clase_id,
              asignado_en,
              alumnos (
                id,
                nombre_completo,
                email,
                telefono,
                dni,
                plan_activo,
                clases_restantes,
                estado,
                sede
              )
            `)
            .eq("clase_id", classUUID);

          const matchingDirect = (directRows || []).filter(r => {
            const rawDate = r.asignado_en ? cleanDateISO(r.asignado_en) : "";
            return !dateIso || rawDate === dateIso || rawDate.startsWith(dateIso);
          });

          if (matchingDirect.length > 0) {
            const attendees = matchingDirect.map(r => {
              const a: any = Array.isArray(r.alumnos) ? r.alumnos[0] : r.alumnos;
              const isDocente = (a?.nombre_completo || "").toLowerCase().includes("docente") ||
                                (a?.plan_activo || "").toLowerCase().includes("docente");
              return {
                id: r.alumno_id,
                nombre_completo: a?.nombre_completo || "Alumno",
                email: a?.email || "",
                telefono: a?.telefono || "",
                plan_activo: a?.plan_activo || "Open Class",
                clases_restantes: a?.clases_restantes ?? null,
                estado: a?.estado || "Activo",
                sede: a?.sede || clase.sede,
                is_docente: isDocente,
                reserva_id: r.id,
                fecha_reserva: dateIso,
                bono_agotado: false,
                debe_cuota: false
              };
            });
            setRoster(attendees);
            setIsRosterLoading(false);
            return;
          }
        }

        const { data: allDbStudents } = await supabase.from("alumnos").select("*");
        const dbMap = new Map((allDbStudents || []).map((s: any) => [s.id, s]));

        const attendees = sessionReservas.map(r => {
          const dbS = dbMap.get(r.alumno_id);
          const isDocente = r.alumno_nombre.toLowerCase().includes("docente") || 
                            r.alumno_nombre.toLowerCase().includes("profesor") ||
                            (dbS?.plan_activo || "").toLowerCase().includes("docente");

          return {
            id: r.alumno_id,
            nombre_completo: r.alumno_nombre,
            email: dbS?.email || "",
            telefono: dbS?.telefono || "",
            plan_activo: dbS?.plan_activo || (isDocente ? "Docente Dance Factory" : "Open Class"),
            clases_restantes: dbS?.clases_restantes ?? null,
            estado: dbS?.estado || "Activo",
            sede: r.sede,
            is_docente: isDocente,
            reserva_id: r.id,
            fecha_reserva: r.fecha_formateada,
            bono_agotado: false,
            debe_cuota: false
          };
        });

        setRoster(attendees);
      } else {
        let studentList: any[] = [];

        // 1. Robust 2-step query: alumnos_clases -> alumnos table (Guarantees data across all Supabase schemas)
        try {
          const { data: rawEnrollments, error: rawErr } = await supabase
            .from("alumnos_clases")
            .select("alumno_id")
            .eq("clase_id", classUUID);

          if (!rawErr && rawEnrollments && rawEnrollments.length > 0) {
            const studentIds = rawEnrollments
              .map((e: any) => e.alumno_id)
              .filter((id: any) => Boolean(id && typeof id === "string" && id.trim() !== ""));

            if (studentIds.length > 0) {
              const { data: studentsData, error: studentsErr } = await supabase
                .from("alumnos")
                .select("id, nombre_completo, telefono, email, plan_activo, clases_restantes, estado, sede, dni")
                .in("id", studentIds);

              if (!studentsErr && studentsData && studentsData.length > 0) {
                studentList = studentsData.map((s: any) => ({
                  ...s,
                  bono_agotado: typeof s.clases_restantes === "number" && s.clases_restantes <= 0,
                  debe_cuota: s.estado === "Pendiente" || (s.plan_activo || "").toLowerCase().includes("pendiente")
                }));
              }
            }
          }
        } catch (errStep1) {
          console.error("Error fetching enrolled student IDs:", errStep1);
        }

        // 2. Relational nested query fallback if 2-step returned no rows
        if (studentList.length === 0) {
          try {
            const { data: enrolled, error: enrollError } = await supabase
              .from("alumnos_clases")
              .select(`
                alumno_id,
                alumnos (
                  id,
                  nombre_completo,
                  telefono,
                  email,
                  plan_activo,
                  clases_restantes,
                  estado,
                  sede,
                  dni
                )
              `)
              .eq("clase_id", classUUID);

            if (!enrollError && enrolled && enrolled.length > 0) {
              studentList = enrolled
                .map((e: any) => (Array.isArray(e.alumnos) ? e.alumnos[0] : e.alumnos))
                .filter((a: any) => a != null && a.id)
                .map((s: any) => ({
                  ...s,
                  bono_agotado: typeof s.clases_restantes === "number" && s.clases_restantes <= 0,
                  debe_cuota: s.estado === "Pendiente" || (s.plan_activo || "").toLowerCase().includes("pendiente")
                }));
            }
          } catch (errStep2) {
            console.error("Error fetching nested enrolled students:", errStep2);
          }
        }

        // Deduplicate students by ID
        const uniqueStudents = Array.from(
          new Map(studentList.map(s => [s.id, s])).values()
        ).sort((a: any, b: any) => (a.nombre_completo || "").localeCompare(b.nombre_completo || "", "es"));

        setRoster(uniqueStudents);
      }
    } catch (err) {
      console.error("Error in loadRosterForDate:", err);
    } finally {
      setIsRosterLoading(false);
    }
  };

  const handleSelectClase = async (clase: any) => {
    setSelectedClase(clase);
    setRoster([]);
    setAsistenciasRegistradas([]);
    setClassAllAttendances([]);
    setAttendanceFilter("todos");
    setRosterSearch("");

    if (isOpenClass(clase)) {
      await syncReservasFromSupabase();
    }

    const sessions = getUpcomingSessionsForClass(clase, 12, "2026-09-07");
    const todayIso = getTodayISO();
    const todaySession = sessions.find(s => s.dateISO === todayIso);
    let targetDate = "";
    if (todaySession) {
      targetDate = todaySession.dateISO;
    } else {
      const pastSessions = sessions.filter(s => s.dateISO <= todayIso);
      if (pastSessions.length > 0) {
        targetDate = pastSessions[pastSessions.length - 1].dateISO;
      } else {
        targetDate = sessions[0]?.dateISO || todayIso;
      }
    }
    setSelectedSessionDate(targetDate);
    await loadRosterForDate(clase, targetDate);
  };

  const handleChangeSessionDate = async (newDateIso: string) => {
    if (!selectedClase) return;
    setSelectedSessionDate(newDateIso);
    await loadRosterForDate(selectedClase, newDateIso);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const handleReservasUpdated = () => {
      setOpenClassReservasVersion(v => v + 1);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (selectedClase && selectedSessionDate) {
          loadRosterForDate(selectedClase, selectedSessionDate, true);
        }
      }, 500);
    };
    window.addEventListener("df_reservas_updated", handleReservasUpdated);
    window.addEventListener("storage", handleReservasUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("df_reservas_updated", handleReservasUpdated);
      window.removeEventListener("storage", handleReservasUpdated);
    };
  }, [selectedClase, selectedSessionDate]);

  // 4. Digital Roll Call Toggle
  const handleToggleAsistencia = async (student: any) => {
    if (!selectedClase?.id || savingId) return;
    setSavingId(student.id);
    const targetDate = selectedSessionDate || getMadridDateISO();
    const selectedClassUUID = normalizeClaseId(selectedClase.id);
    const { startISO, endISO } = getMadridDayRangeUTC(targetDate);

    try {
      const yaAsistio = asistenciasRegistradas.includes(student.id);
      const isRegular = isRegularMembership(student.plan_activo, student.clases_restantes);

      if (yaAsistio) {
        if (!isRegular && typeof student.clases_restantes === "number") {
          if (deductedStudentIds.has(student.id)) {
            const refundedBalance = student.clases_restantes + 1;
            await supabase
              .from("alumnos")
              .update({ clases_restantes: refundedBalance })
              .eq("id", student.id);

            setDeductedStudentIds(prev => {
              const next = new Set(prev);
              next.delete(student.id);
              return next;
            });
          }
        }

        await supabase
          .from("asistencias")
          .delete()
          .eq("alumno_id", student.id)
          .eq("clase_id", selectedClassUUID)
          .gte("fecha_hora", startISO)
          .lte("fecha_hora", endISO);

        setAsistenciasRegistradas(prev => prev.filter(id => id !== student.id));
        setClassAllAttendances(prev => prev.filter(a => !(a.alumno_id === student.id && a.fecha_hora && isSameMadridDay(a.fecha_hora, targetDate))));
        publishSyncEvent("df_reservas_updated");

        logActivity({
          origen: "profesor",
          tipo_evento: "asistencia_profesor",
          descripcion: `Profesor ${selectedProfesor} desmarcó asistencia (falta) a ${student.nombre_completo} en ${selectedClase.nombre_clase}`,
          usuario_afectado: student.nombre_completo,
          sede: isStudio1(selectedClase.sede) ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
        });
      } else {
        // Idempotency check: verify in Supabase before insertion
        const { data: existing } = await supabase
          .from("asistencias")
          .select("id")
          .eq("alumno_id", student.id)
          .eq("clase_id", selectedClassUUID)
          .gte("fecha_hora", startISO)
          .lte("fecha_hora", endISO);

        if (existing && existing.length > 0) {
          setAsistenciasRegistradas(prev => prev.includes(student.id) ? prev : [...prev, student.id]);
          return;
        }

        const isPrepaidOpenClass = isOpenClass(selectedClase) || Boolean(student.reserva_id);

        if (!isRegular && !isPrepaidOpenClass && typeof student.clases_restantes === "number" && student.clases_restantes > 0) {
          const newBalance = Math.max(0, student.clases_restantes - 1);
          await supabase
            .from("alumnos")
            .update({ clases_restantes: newBalance })
            .eq("id", student.id);

          setDeductedStudentIds(prev => new Set(prev).add(student.id));
        }

        // Construction of correct attendance timestamp in Madrid timezone
        const attendanceISO = targetDate === getMadridDateISO()
          ? new Date().toISOString()
          : toMadridSessionISO(targetDate, selectedClase.hora_inicio || "18:00");

        await supabase.from("asistencias").insert([{
          alumno_id: student.id,
          clase_id: selectedClassUUID,
          fecha_hora: attendanceISO
        }]);

        setAsistenciasRegistradas(prev => [...prev, student.id]);
        setClassAllAttendances(prev => [...prev, {
          id: "temp_" + Date.now(),
          alumno_id: student.id,
          fecha_hora: attendanceISO
        }]);

        publishSyncEvent("df_checkin_success", {
          alumno_id: student.id,
          alumno_nombre: student.nombre_completo,
          clase_id: selectedClassUUID,
          count: 1
        });

        logActivity({
          origen: "profesor",
          tipo_evento: "asistencia_profesor",
          descripcion: `Profesor ${selectedProfesor} confirmó asistencia presencial de ${student.nombre_completo} en ${selectedClase.nombre_clase}`,
          usuario_afectado: student.nombre_completo,
          sede: isStudio1(selectedClase.sede) ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
        });
      }
    } catch (err) {
      console.error("Error in handleToggleAsistencia:", err);
    } finally {
      setSavingId(null);
    }
  };

  // 5. Booking Open Class as a Teacher
  const handleTeacherOpenClassBooking = async (clase: any) => {
    if (!teacherStudent?.id) return;

    if (!isOpenClass(clase)) {
      setModal({
        isOpen: true,
        title: "Solo Open Classes",
        message: "En el portal de profesores solo está permitido reservar plazas en sesiones de Open Class. Las clases regulares no admiten reservas.",
        type: "warning",
        confirmText: "Entendido"
      });
      return;
    }

    const isRotativa = 
      clase.nombre_clase?.toUpperCase().includes("ROTAT") || 
      clase.profesor?.toUpperCase().includes("ROTAT") ||
      (clase.tipo_clase || "").toUpperCase().includes("ROTAT");

    if (isRotativa) {
      setModal({
        isOpen: true,
        title: "ℹ️ Formación Rotativa",
        message: "Las clases de Formación Rotativa no se pueden reservar desde el portal. Para inscribirte, por favor consulta directamente en recepción.",
        type: "info",
        confirmText: "Entendido"
      });
      return;
    }

    if (isSesionCompleta(clase, selectedCalendarDay.dateISO)) {
      setModal({
        isOpen: true,
        title: "Aforo Completo",
        message: `El aforo máximo (${clase.aforo_maximo || 20} plazas) para ${clase.nombre_clase} el ${selectedCalendarDay.dayName.toLowerCase()} ${selectedCalendarDay.dayNumber} de ${selectedCalendarDay.monthName} está completo.`,
        type: "warning"
      });
      return;
    }

    const hasUnlimited = (teacherStudent.plan_activo || "").toLowerCase().includes("ilimitad");
    const remainingClasses = typeof teacherStudent.clases_restantes === "number" ? teacherStudent.clases_restantes : 0;

    if (!hasUnlimited && remainingClasses <= 0) {
      setModal({
        isOpen: true,
        title: "Bono Docente Requerido",
        message: "No dispones de saldo de clases en tu Bono Docente para reservar esta Open Class. Puedes solicitar una recarga con 10% de descuento en la pestaña 'Comprar Bono'.",
        type: "warning"
      });
      return;
    }

    if (!hasUnlimited && remainingClasses > 0) {
      const newCount = remainingClasses - 1;
      setTeacherStudent((prev: any) => ({ ...prev, clases_restantes: newCount }));
      try {
        await supabase
          .from("alumnos")
          .update({ clases_restantes: newCount })
          .eq("id", teacherStudent.id);
      } catch (e) {
        console.error("Error updating teacher classes:", e);
      }
    }

    // Persistencia central en Supabase alumnos_clases para visualización inmediata en recepción
    const classUUID = normalizeClaseId(clase.id);
    const sessionISO = `${selectedCalendarDay.dateISO}T${clase.hora_inicio || "19:00"}:00.000Z`;
    try {
      await supabase.from("alumnos_clases").insert([{
        alumno_id: teacherStudent.id,
        clase_id: classUUID,
        asignado_en: sessionISO
      }]);
    } catch (err) {
      console.warn("Notice: teacher enrollment in alumnos_clases:", err);
    }

    crearReservaOpenClass({
      alumno_id: teacherStudent.id,
      alumno_nombre: `${selectedProfesor} (Docente)`,
      clase,
      calendarDay: selectedCalendarDay
    });

    setTeacherEnrolledClassIds(prev => Array.from(new Set([...prev, clase.id, classUUID])));
    setOpenClassReservasVersion(v => v + 1);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("df_reservas_updated"));
    }

    logActivity({
      origen: "profesor",
      tipo_evento: "asistencia_profesor",
      descripcion: `Docente ${selectedProfesor} reservó plaza en ${clase.nombre_clase} con ${clase.profesor} para el ${selectedCalendarDay.dayName} ${selectedCalendarDay.dayNumber} de ${selectedCalendarDay.monthName}`,
      usuario_afectado: selectedProfesor,
      sede: isStudio1(clase.sede) ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
    });

    setModal({
      isOpen: true,
      title: "✓ Plaza Reservada con Éxito",
      message: `Te has inscrito correctamente en ${clase.nombre_clase} con ${clase.profesor}.\n\n📅 Fecha: ${selectedCalendarDay.dayName} ${selectedCalendarDay.dayNumber} de ${selectedCalendarDay.monthName}\n⏰ Horario: ${clase.hora_inicio} - ${clase.hora_fin}h\n🚪 Sala: ${clase.sala || "Sala Principal"}\n\nYa apareces en la lista de asistencia del docente titular para esa sesión y en recepción.`,
      type: "success"
    });
  };

  // Cancel Booking as a Teacher
  const handleTeacherCancelBooking = async (clase: any) => {
    if (!teacherStudent?.id) return;
    const all = getOpenClassReservas();
    const classUUID = normalizeClaseId(clase.id);
    const cleanISO = cleanDateISO(selectedCalendarDay.dateISO);

    // Borrar de Supabase alumnos_clases para que recepción actualice el aforo
    try {
      await supabase
        .from("alumnos_clases")
        .delete()
        .eq("alumno_id", teacherStudent.id)
        .eq("clase_id", classUUID)
        .ilike("asignado_en", `${cleanISO}%`);
    } catch (e) {
      console.warn("Error deleting teacher enrollment from alumnos_clases:", e);
    }

    const found = all.find(r => 
      r.alumno_id === teacherStudent.id && 
      normalizeClaseId(r.clase_id) === classUUID && 
      cleanDateISO(r.fecha_iso) === cleanISO && 
      (r.estado === "Confirmada" || r.estado === "Asistida")
    );

    if (found) {
      cancelarReservaOpenClass(found.id);
    }

    try {
      await deleteAlumnosClasesBySessionDate(
        teacherStudent.id,
        clase.id,
        selectedCalendarDay.dateISO
      );
    } catch (e) {
      console.warn("Error deleting teacher reservation from alumnos_clases:", e);
    }

    const hasUnlimited = (teacherStudent.plan_activo || "").toLowerCase().includes("ilimitad");
    if (!hasUnlimited && typeof teacherStudent.clases_restantes === "number") {
      const newCount = teacherStudent.clases_restantes + 1;
      setTeacherStudent((prev: any) => ({ ...prev, clases_restantes: newCount }));
      try {
        await supabase.from("alumnos").update({ clases_restantes: newCount }).eq("id", teacherStudent.id);
      } catch (e) {}
    }

    setTeacherEnrolledClassIds(prev => prev.filter(id => id !== clase.id && id !== classUUID));
    setOpenClassReservasVersion(v => v + 1);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("df_reservas_updated"));
    }
    publishSyncEvent("df_reservas_updated");

    setModal({
      isOpen: true,
      title: "Reserva Cancelada",
      message: `Has cancelado tu inscripción para ${clase.nombre_clase} el ${selectedCalendarDay.dayName} ${selectedCalendarDay.dayNumber} de ${selectedCalendarDay.monthName}. Se ha reintegrado 1 clase a tu saldo docente.`,
      type: "info"
    });
  };

  const handleMarkAllPresent = async () => {
    if (!selectedClase?.id || roster.length === 0 || savingId) return;
    setSavingId("ALL");
    const targetDate = selectedSessionDate || getMadridDateISO();
    const selectedClassUUID = normalizeClaseId(selectedClase.id);
    const { startISO, endISO } = getMadridDayRangeUTC(targetDate);

    try {
      // Query existing attendances in Supabase to avoid duplicates
      const { data: existingAll } = await supabase
        .from("asistencias")
        .select("alumno_id")
        .eq("clase_id", selectedClassUUID)
        .gte("fecha_hora", startISO)
        .lte("fecha_hora", endISO);

      const alreadyMarkedSet = new Set((existingAll || []).map(r => r.alumno_id));
      const studentsToMark = roster.filter(s => !alreadyMarkedSet.has(s.id));

      if (studentsToMark.length === 0) {
        setAsistenciasRegistradas(roster.map(s => s.id));
        return;
      }

      const attendanceISO = targetDate === getMadridDateISO()
        ? new Date().toISOString()
        : toMadridSessionISO(targetDate, selectedClase.hora_inicio || "18:00");

      const newCheckins: any[] = [];
      for (const student of studentsToMark) {
        const isRegular = isRegularMembership(student.plan_activo, student.clases_restantes);
        const isPrepaidOpenClass = isOpenClass(selectedClase) || Boolean(student.reserva_id);

        if (!isRegular && !isPrepaidOpenClass && typeof student.clases_restantes === "number" && student.clases_restantes > 0) {
          const newBalance = Math.max(0, student.clases_restantes - 1);
          await supabase
            .from("alumnos")
            .update({ clases_restantes: newBalance })
            .eq("id", student.id);

          setDeductedStudentIds(prev => new Set(prev).add(student.id));
        }

        newCheckins.push({
          alumno_id: student.id,
          clase_id: selectedClassUUID,
          fecha_hora: attendanceISO
        });
      }

      if (newCheckins.length > 0) {
        await supabase.from("asistencias").insert(newCheckins);
        setAsistenciasRegistradas(roster.map(s => s.id));
        setClassAllAttendances(prev => [
          ...prev.filter(a => !(a.fecha_hora && isSameMadridDay(a.fecha_hora, targetDate))),
          ...newCheckins.map((c, i) => ({ id: "temp_all_" + i + "_" + Date.now(), ...c }))
        ]);

        logActivity({
          origen: "profesor",
          tipo_evento: "asistencia_profesor",
          descripcion: `Profesor ${selectedProfesor} hizo pase de lista masivo (${roster.length} alumnos) en ${selectedClase.nombre_clase} para la sesión ${targetDate}`,
          usuario_afectado: `${selectedProfesor} (Masivo)`,
          sede: isStudio1(selectedClase.sede) ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
        });
      }
    } catch (err) {
      console.error("Error in handleMarkAllPresent:", err);
    } finally {
      setSavingId(null);
    }
  };

  const handleClearAllPresent = async () => {
    if (!selectedClase?.id || asistenciasRegistradas.length === 0 || savingId) return;
    setSavingId("ALL");
    const targetDate = selectedSessionDate || getMadridDateISO();
    const selectedClassUUID = normalizeClaseId(selectedClase.id);
    const { startISO, endISO } = getMadridDayRangeUTC(targetDate);

    try {
      await supabase
        .from("asistencias")
        .delete()
        .eq("clase_id", selectedClassUUID)
        .gte("fecha_hora", startISO)
        .lte("fecha_hora", endISO);

      setAsistenciasRegistradas([]);
      setClassAllAttendances(prev => prev.filter(a => !(a.fecha_hora && isSameMadridDay(a.fecha_hora, targetDate))));

      logActivity({
        origen: "profesor",
        tipo_evento: "asistencia_profesor",
        descripcion: `Profesor ${selectedProfesor} desmarcó la asistencia completa de la sesión ${targetDate} en ${selectedClase.nombre_clase}`,
        usuario_afectado: `${selectedProfesor} (Desmarcar Todo)`,
        sede: isStudio1(selectedClase.sede) ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
      });
    } catch (err) {
      console.error("Error in handleClearAllPresent:", err);
    } finally {
      setSavingId(null);
    }
  };

  // 5. Teacher Open Class Enrollment Handler
  const handleTeacherApuntarme = async (clase: any) => {
    if (!teacherStudent?.id) return;

    if (!isOpenClass(clase)) {
      setModal({
        isOpen: true,
        title: "Solo Open Classes",
        message: "En el portal de profesores solo está permitido reservar plazas en sesiones de Open Class. Las clases regulares no admiten reservas.",
        type: "warning",
        confirmText: "Entendido"
      });
      return;
    }

    // Check aforo
    const { count } = await supabase
      .from("alumnos_clases")
      .select("id", { count: "exact", head: true })
      .eq("clase_id", clase.id);

    const occupied = count || 0;
    if (occupied >= (clase.aforo_maximo || 20)) {
      setModal({
        isOpen: true,
        title: "Aforo Completo",
        message: `La clase "${clase.nombre_clase}" (${clase.dia_semana} ${clase.hora_inicio}h) ya tiene el aforo completo (${occupied}/${clase.aforo_maximo}).`,
        type: "warning",
        confirmText: "Entendido"
      });
      return;
    }

    // Schedule Collision Prevention: check overlap against teaching classes and other enrolled Open Classes
    const enrolledOpenClasses = allOpenClasses.filter(c => teacherEnrolledClassIds.includes(c.id));
    const collision = checkTeacherTimeConflict(clase, clasesProfesor, enrolledOpenClasses);
    if (collision.conflict) {
      setModal({
        isOpen: true,
        title: "⚠️ Solapamiento Horario Detectado",
        message: collision.reason || `Existe un conflicto de horario con "${collision.conflictingClassName || 'otra clase'}". No es posible apuntarse a dos clases que coinciden en el mismo horario.`,
        type: "warning",
        confirmText: "Entendido"
      });
      return;
    }

    const hasUnlimited = teacherStudent.plan_activo?.toLowerCase().includes("ilimitad");
    const remainingClasses = typeof teacherStudent.clases_restantes === "number" ? teacherStudent.clases_restantes : 0;

    if (!hasUnlimited && remainingClasses <= 0) {
      setModal({
        isOpen: true,
        title: "Bono Requerido con 10% Descuento",
        message: `Hola ${selectedProfesor}, necesitas saldo de bono para apuntarte a esta sesión.\n\nComo profesor/a de la escuela, ¡tienes un 10% de DESCUENTO DIRECTO en todos los bonos de Open Class y Formaciones!`,
        type: "warning",
        confirmText: "Comprar con 10% Dto",
        onConfirm: () => setActiveTab("comprar_bono")
      });
      return;
    }

    // Deduct 1 class from teacher balance if not unlimited
    if (!hasUnlimited) {
      const updatedBalance = Math.max(0, remainingClasses - 1);
      await supabase.from("alumnos").update({ clases_restantes: updatedBalance }).eq("id", teacherStudent.id);
      setTeacherStudent((prev: any) => ({ ...prev, clases_restantes: updatedBalance }));
    }

    // Enroll teacher
    await supabase.from("alumnos_clases").insert([{
      alumno_id: teacherStudent.id,
      clase_id: clase.id
    }]);

    setTeacherEnrolledClassIds(prev => [...prev, clase.id]);

    logActivity({
      origen: "profesor",
      tipo_evento: "reserva_bono",
      descripcion: `Profesor ${selectedProfesor} se apuntó a la clase "${clase.nombre_clase}" (${clase.dia_semana} ${clase.hora_inicio}h)`,
      usuario_afectado: selectedProfesor,
      sede: isStudio1(clase.sede) ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
    });

    setModal({
      isOpen: true,
      title: "✓ ¡Plaza Reservada!",
      message: `Te has apuntado con éxito a "${clase.nombre_clase}" (${clase.dia_semana} a las ${clase.hora_inicio}h).\n\n${!hasUnlimited ? `Saldo restante: ${(teacherStudent.clases_restantes || 1) - 1} clases.` : "Pase ilimitado activo."}`,
      type: "success",
      confirmText: "Genial"
    });
  };

  // 6. Teacher Open Class Un-enroll Handler (with 24h check)
  const handleTeacherDesapuntarme = async (clase: any) => {
    if (!teacherStudent?.id) return;

    // Helper to calculate hours remaining (with diacritic normalization for days)
    const daysMap: Record<string, number> = {
      "DOMINGO": 0, "LUNES": 1, "MARTES": 2, "MIERCOLES": 3, "MIÉRCOLES": 3,
      "JUEVES": 4, "VIERNES": 5, "SABADO": 6, "SÁBADO": 6
    };
    const targetDayNum = daysMap[normalizeText(clase.dia_semana)] ?? 1;
    const now = new Date();
    const currentDayNum = now.getDay();
    let daysUntil = (targetDayNum - currentDayNum + 7) % 7;
    const [hours, minutes] = (clase.hora_inicio || "00:00").split(":").map(Number);
    const classDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil, hours, minutes || 0, 0);
    if (daysUntil === 0 && classDate.getTime() <= now.getTime()) {
      classDate.setDate(classDate.getDate() + 7);
    }
    const diffHours = (classDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      setModal({
        isOpen: true,
        title: "⚠️ Cancelación Fuera de Plazo",
        message: `Faltan menos de 24 horas para el inicio de "${clase.nombre_clase}". Por política de aforo, solo es posible desapuntarse con al menos 24 horas de antelación.`,
        type: "warning",
        confirmText: "Entendido"
      });
      return;
    }

    // Delete enrollment
    await supabase
      .from("alumnos_clases")
      .delete()
      .eq("alumno_id", teacherStudent.id)
      .eq("clase_id", clase.id);

    // Refund 1 class
    const isUnlimited = teacherStudent.plan_activo?.toLowerCase().includes("ilimitad");
    if (!isUnlimited && typeof teacherStudent.clases_restantes === "number") {
      const refunded = teacherStudent.clases_restantes + 1;
      await supabase.from("alumnos").update({ clases_restantes: refunded }).eq("id", teacherStudent.id);
      setTeacherStudent((prev: any) => ({ ...prev, clases_restantes: refunded }));
    }

    setTeacherEnrolledClassIds(prev => prev.filter(id => id !== clase.id));

    setModal({
      isOpen: true,
      title: "✓ Te has desapuntado",
      message: `Te has desapuntado correctamente de "${clase.nombre_clase}".\n\n${!isUnlimited ? "Se ha devuelto 1 clase a tu saldo docente." : ""}`,
      type: "success",
      confirmText: "Aceptar"
    });
  };

  // 7. Teacher Checkout Mock (Reception Standby Request)
  const handleTeacherPaymentMock = async (metodo: "stripe" | "recepcion" = "recepcion") => {
    if (!selectedBonoForPayment || !teacherStudent?.id) return;
    setIsProcessingPayment(true);

    // Reception Standby Option
    const pendingPlanText = `Pendiente: ${selectedBonoForPayment.nombre} (${selectedBonoForPayment.precioDocente})`;

    await supabase
      .from("alumnos")
      .update({ plan_activo: pendingPlanText })
      .eq("id", teacherStudent.id);

    setTeacherStudent((prev: any) => ({ ...prev, plan_activo: pendingPlanText }));

    // Cross-app reactivity broadcast (Zero localStorage)
    publishSyncEvent("df_pending_bonos_updated", { alumno_id: teacherStudent.id });

    logActivity({
      origen: "profesor",
      tipo_evento: "solicitud_bono",
      descripcion: `Profesor ${selectedProfesor} solicitó en recepción el bono con 10% dto: "${selectedBonoForPayment.nombre}" (${selectedBonoForPayment.precioDocente})`,
      usuario_afectado: selectedProfesor,
      sede: "Studio 2 Paseo Castilla"
    });

    setIsProcessingPayment(false);
    setSelectedBonoForPayment(null);

    setModal({
      isOpen: true,
      title: "⏳ Solicitud Registrada en Standby",
      message: `Tu solicitud para el "${selectedBonoForPayment.nombre}" (${selectedBonoForPayment.precioDocente}) ha quedado registrada en STANDBY.\n\nAparece notificada en la Recepción para que puedas abonarla en efectivo o datáfono. En cuanto se confirme el cobro, se activará automáticamente tu saldo.`,
      type: "info",
      confirmText: "Entendido"
    });
  };

  // Classes filtered by day schedule
  const filteredClases = useMemo(() => {
    let list = [...clasesProfesor];
    if (dayScheduleFilter === "HOY") {
      list = list.filter(c => normalizeDay(c.dia_semana) === normalizeDay(todayStr));
    } else if (dayScheduleFilter !== "TODAS") {
      const dayMap: Record<string, string> = {
        "LUN": "LUNES",
        "MAR": "MARTES",
        "MIÉ": "MIÉRCOLES",
        "JUE": "JUEVES",
        "VIE": "VIERNES",
        "SÁB": "SÁBADO"
      };
      list = list.filter(c => normalizeDay(c.dia_semana) === normalizeDay(dayMap[dayScheduleFilter]));
    }
    return list.sort((a, b) => {
      if (dayScheduleFilter === "TODAS") {
        if (getDayOrder(a.dia_semana) !== getDayOrder(b.dia_semana)) {
          return getDayOrder(a.dia_semana) - getDayOrder(b.dia_semana);
        }
      }
      return (a.hora_inicio || "00:00").localeCompare(b.hora_inicio || "00:00");
    });
  }, [clasesProfesor, dayScheduleFilter, todayStr]);

  // Students in class filtered by search and attendance status (Todos / Presentes / Faltas)
  const filteredRoster = useMemo(() => {
    return roster.filter(s => {
      const matchesSearch = !rosterSearch.trim() || 
        (s.nombre_completo || "").toLowerCase().includes(rosterSearch.toLowerCase());
      if (!matchesSearch) return false;

      const isPresent = asistenciasRegistradas.includes(s.id);
      if (attendanceFilter === "presentes") return isPresent;
      if (attendanceFilter === "faltas") return !isPresent;
      return true;
    });
  }, [roster, rosterSearch, asistenciasRegistradas, attendanceFilter]);

  // Monthly stats helper per student
  const getStudentMonthlyStats = (studentId: string) => {
    const currentMonthPrefix = (selectedSessionDate || getTodayISO()).substring(0, 7);
    const monthSessions = currentClassSessions.filter(
      s => s.dateISO.startsWith(currentMonthPrefix) && s.dateISO <= getTodayISO()
    );
    const totalPossible = Math.max(1, monthSessions.length);
    const attendedCount = classAllAttendances.filter(
      a => a.alumno_id === studentId && a.fecha_hora && a.fecha_hora.startsWith(currentMonthPrefix)
    ).length;
    const faltasCount = Math.max(0, totalPossible - attendedCount);
    const percent = Math.min(100, Math.round((attendedCount / totalPossible) * 100));

    return { totalPossible, attendedCount, faltasCount, percent, currentMonthPrefix };
  };

  // ----------------------------------------------------
  // VISTA 1: SCREEN LOGIN CON PANTALLA TÁCTIL PIN
  // ----------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-body)] flex items-center justify-center p-4">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 w-full max-w-xs shadow-2xl relative overflow-hidden text-center">
          <div className="absolute top-0 right-0 w-36 h-36 bg-[var(--color-primary)]/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white flex items-center justify-center font-[family-name:var(--font-heading)] text-2xl mx-auto shadow-lg mb-3">
              DF
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-text-title)] tracking-wide">Portal del Profesor</h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">Introduce tu código PIN</p>
          </div>

          {/* Indicadores de 4 dígitos */}
          <div className="flex justify-center gap-4 mb-6">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pinInput.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    pinError
                      ? "border-[var(--color-danger)] bg-[var(--color-danger)]/20 animate-shake"
                      : isFilled
                      ? "bg-[var(--color-primary)] border-[var(--color-primary)] scale-110 shadow-lg shadow-[var(--color-primary)]/50"
                      : "border-[var(--color-border)] bg-transparent"
                  }`}
                />
              );
            })}
          </div>

          {pinError && (
            <div className="mb-4 text-xs font-semibold text-[var(--color-danger)] animate-pulse">
              {pinError}
            </div>
          )}

          {/* Teclado Numérico */}
          <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto mb-4">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyClick(num)}
                className="w-16 h-16 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-2xl font-bold font-mono flex items-center justify-center hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] active:scale-95 transition-all shadow-md mx-auto touch-manipulation select-none"
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              className="w-16 h-16 rounded-full bg-transparent text-[var(--color-text-secondary)] text-[11px] font-bold uppercase tracking-wider flex items-center justify-center hover:text-white active:scale-95 transition-all mx-auto select-none"
            >
              Borrar
            </button>

            <button
              type="button"
              onClick={() => handleKeyClick("0")}
              className="w-16 h-16 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-2xl font-bold font-mono flex items-center justify-center hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] active:scale-95 transition-all shadow-md mx-auto touch-manipulation select-none"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="w-16 h-16 rounded-full bg-transparent text-[var(--color-text-secondary)] flex items-center justify-center hover:text-white active:scale-95 transition-all mx-auto select-none"
              title="Borrar último número"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58-4.92-2.674 2.87a1.5 1.5 0 0 0 0 2.1l2.674 2.87A1.5 1.5 0 0 0 10.605 18h7.645a1.5 1.5 0 0 0 1.5-1.5V7.5a1.5 1.5 0 0 0-1.5-1.5h-7.645a1.5 1.5 0 0 0-1.07.45Z" />
              </svg>
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-center">
            <span className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider font-semibold">Dance Factory Alcorcón</span>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VISTA 2: PORTAL PRINCIPAL DEL PROFESOR (CON BOTTOM NAV MÓVIL)
  // ----------------------------------------------------
  return (
    <div className="flex flex-col h-screen w-full bg-[var(--color-bg)] overflow-hidden max-w-lg mx-auto relative font-sans text-[var(--color-text-body)]">
      
      {/* Contenedor Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none">
        
        {/* Header Sticky */}
        <header className="p-4 sm:p-5 bg-[var(--color-bg-card)] border-b border-[var(--color-border)] sticky top-0 z-40 shadow-lg space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2.5 py-1 rounded-md border border-[var(--color-primary)]/20 shrink-0">
                {isAdmin ? "PANEL ADMIN MASTER" : "PORTAL DOCENTE"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[var(--color-primary)] bg-[var(--color-bg)] px-2.5 py-1 rounded-full border border-[var(--color-border)] shrink-0">
                {todayStr}
              </span>

              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 border border-[var(--color-border)] transition-colors"
                title="Cerrar Sesión / Salir"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-0.5">Profesor/a Activo:</label>
              {isAdmin ? (
                <select 
                  value={selectedProfesor}
                  onChange={(e) => setSelectedProfesor(e.target.value)}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-primary)] text-[var(--color-text-title)] font-bold rounded-xl px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-primary)] transition-colors shadow-inner truncate"
                >
                  {profesoresDisponibles.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-1.5 text-[var(--color-text-title)] font-bold text-base">
                  <span className="truncate">{selectedProfesor}</span>
                  <Lock className="w-3.5 h-3.5 text-[var(--color-success)] shrink-0" />
                </div>
              )}
            </div>

            {/* Saldo de bono docente en Open Class */}
            <div 
              onClick={() => setActiveTab("comprar_bono")}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-[var(--color-bg)] border border-amber-500/30 px-3 py-1.5 rounded-xl shrink-0 cursor-pointer hover:border-amber-400 transition-colors shadow-sm"
              title="Ver saldo y comprar bonos docente con 10% dto"
            >
              <Flame className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="text-[9px] uppercase tracking-wider text-amber-400 font-bold block leading-tight">Saldo Open Class:</span>
                <span className="text-xs font-bold text-white font-mono">
                  {teacherStudent?.clases_restantes || 0} {teacherStudent?.clases_restantes === 1 ? "clase" : "clases"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Contenido Principal */}
        <main className="p-4 sm:p-5 space-y-4">
          
          {/* Banner Persistente de Solicitud en STANDBY (visible en todas las pestañas) */}
          {teacherStudent?.plan_activo?.includes("Pendiente") && (
            <div className="bg-amber-500/10 border-2 border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs shadow-lg animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-base shrink-0">
                  ⏳
                </div>
                <div>
                  <strong className="block text-amber-300 font-bold">Solicitud en STANDBY: Pendiente de cobro en recepción</strong>
                  <span className="text-[11px] text-slate-300">{teacherStudent.plan_activo}</span>
                </div>
              </div>
              <span className="bg-amber-500/20 text-amber-300 font-bold px-3 py-1 rounded-full border border-amber-500/30 text-[10px] uppercase shrink-0">
                Pendiente de Pago
              </span>
            </div>
          )}

          {/* ==================================================== */}
          {/* MÓDULO 1: MIS CLASES DOCENTES & PASE DE LISTA */}
          {/* ==================================================== */}
          {activeTab === "mis_clases" && (
            <>
              {!selectedClase ? (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center px-1">
                    <div>
                      <h2 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                        Horario y Clases Asignadas
                      </h2>
                      <p className="text-[11px] text-slate-400">Selecciona el día para ver tus clases por orden horario</p>
                    </div>
                    <span className="text-xs font-semibold text-[var(--color-primary)] font-mono">
                      {clasesProfesor.length} {clasesProfesor.length === 1 ? 'clase total' : 'clases totales'}
                    </span>
                  </div>

                  {/* SELECTOR DE DÍA / HORARIO SEMANAL */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {[
                      { id: "HOY", label: `📍 HOY (${todayStr.slice(0, 3)})` },
                      { id: "LUN", label: "LUN" },
                      { id: "MAR", label: "MAR" },
                      { id: "MIÉ", label: "MIÉ" },
                      { id: "JUE", label: "JUE" },
                      { id: "VIE", label: "VIE" },
                      { id: "SÁB", label: "SÁB" },
                      { id: "TODAS", label: "TODAS" },
                    ].map((tab) => {
                      const isSelected = dayScheduleFilter === tab.id;
                      let count = 0;
                      if (tab.id === "TODAS") {
                        count = clasesProfesor.length;
                      } else if (tab.id === "HOY") {
                        count = clasesProfesor.filter(c => normalizeDay(c.dia_semana) === normalizeDay(todayStr)).length;
                      } else {
                        const dayMap: Record<string, string> = {
                          "LUN": "LUNES",
                          "MAR": "MARTES",
                          "MIÉ": "MIÉRCOLES",
                          "JUE": "JUEVES",
                          "VIE": "VIERNES",
                          "SÁB": "SÁBADO"
                        };
                        count = clasesProfesor.filter(c => normalizeDay(c.dia_semana) === normalizeDay(dayMap[tab.id])).length;
                      }

                      return (
                        <button
                          key={tab.id}
                          onClick={() => setDayScheduleFilter(tab.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/30 scale-105"
                              : "bg-[var(--color-bg-card)] border border-[var(--color-border)] text-slate-300 hover:border-[var(--color-primary)]/50"
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected ? "bg-black/30 text-white" : count > 0 ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]" : "text-slate-500"
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {isLoading ? (
                    <div className="p-8 text-center text-xs text-[var(--color-text-secondary)]">Cargando tus clases...</div>
                  ) : clasesProfesor.length === 0 ? (
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 text-center text-xs text-[var(--color-text-secondary)] shadow-sm">
                      No tienes clases regulares asignadas como docente principal actualmente.
                    </div>
                  ) : filteredClases.length === 0 ? (
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 text-center space-y-3 shadow-sm">
                      <p className="text-xs text-slate-300">
                        {dayScheduleFilter === "HOY" 
                          ? `No tienes clases asignadas programadas para hoy (${todayStr}).`
                          : `No tienes clases asignadas programadas para este día.`}
                      </p>
                      <button
                        onClick={() => setDayScheduleFilter("TODAS")}
                        className="text-xs font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)] hover:text-white px-3 py-1.5 rounded-xl transition-all"
                      >
                        Ver todas tus clases ({clasesProfesor.length})
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 w-full">
                      {filteredClases.map(clase => {
                        const studio1 = isStudio1(clase.sede);
                        const isToday = normalizeDay(clase.dia_semana) === normalizeDay(todayStr);

                        return (
                          <button
                            key={clase.id}
                            onClick={() => handleSelectClase(clase)}
                            className={`w-full text-left p-4 rounded-2xl border transition-all shadow-lg hover:shadow-xl group cursor-pointer ${
                              isToday
                                ? "bg-[var(--color-bg-card)] border-[var(--color-primary)]/50 hover:border-[var(--color-primary)]"
                                : "bg-[var(--color-bg-card)] border-[var(--color-border)] hover:border-[var(--color-primary)]"
                            }`}
                          >
                            <div className="flex justify-between items-center gap-2 mb-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono ${
                                  isToday 
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" 
                                    : "bg-white/5 text-slate-300 border border-white/10"
                                }`}>
                                  {clase.dia_semana} {isToday ? "• HOY" : ""}
                                </span>
                                <span className="text-xs font-mono font-bold text-[var(--color-primary)]">
                                  {clase.hora_inicio} - {clase.hora_fin}h
                                </span>
                              </div>
                              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${
                                studio1 ? 'bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border border-[var(--color-secondary)]/20' : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20'
                              }`}>
                                {studio1 ? 'Studio 1' : 'Studio 2'}
                              </span>
                            </div>

                            <div className="flex justify-between items-end gap-2 mt-2">
                              <div>
                                <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-title)] tracking-wide">{clase.nombre_clase}</h3>
                                <span className="text-xs text-[var(--color-text-secondary)] block mt-0.5">
                                  🚪 {clase.sala || "Sala Principal"} • Aforo: {clase.aforo_maximo || 20} plazas
                                </span>
                              </div>

                              <div className="flex items-center gap-1 text-xs font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-3 py-1.5 rounded-xl border border-[var(--color-primary)]/20 group-hover:bg-[var(--color-primary)] group-hover:text-white transition-all shrink-0">
                                <span>Pasar Lista</span>
                                <ChevronRight className="w-4 h-4" />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* PASE DE LISTA DE LA CLASE SELECCIONADA */
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-xl w-full">
                  {/* Botón Volver al Listado */}
                  <button
                    onClick={() => setSelectedClase(null)}
                    className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] hover:text-white bg-[var(--color-bg)] px-3 py-2 rounded-xl border border-[var(--color-border)] mb-4 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Volver a mis clases</span>
                  </button>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-[var(--color-border)] w-full">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--color-text-title)]">
                          {selectedClase.nombre_clase}
                        </h3>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 truncate">
                          {selectedClase.dia_semana} {selectedClase.hora_inicio}-{selectedClase.hora_fin}
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                          isStudio1(selectedClase.sede) ? 'bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]' : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        }`}>
                          {isStudio1(selectedClase.sede) ? 'Studio 1' : 'Studio 2'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">Control de asistencia por sesión y seguimiento mensual</p>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0">
                      <span className="text-xs font-bold text-[var(--color-success)] bg-[var(--color-success)]/10 px-3 py-1.5 rounded-full border border-[var(--color-success)]/20 shrink-0">
                        {asistenciasRegistradas.length} / {roster.length} Presentes
                      </span>
                    </div>
                  </div>

                  {/* PESTAÑAS PRINCIPALES: PASE DE LISTA VS DÍAS DE ASISTENCIA POR ALUMNO */}
                  <div className="grid grid-cols-2 gap-2 mb-4 bg-[var(--color-bg)] p-1.5 rounded-2xl border border-[var(--color-border)]">
                    <button
                      onClick={() => setClassViewTab("pase_lista")}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        classViewTab === "pase_lista"
                          ? "bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Check size={15} />
                      <span>1. Pase de Lista de Sesión</span>
                    </button>
                    <button
                      onClick={() => setClassViewTab("dias_asistencia")}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        classViewTab === "dias_asistencia"
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <CalendarDays size={15} />
                      <span>2. Días que ha venido cada Alumno</span>
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/30 text-white font-mono font-bold">
                        {roster.length}
                      </span>
                    </button>
                  </div>

                  {classViewTab === "dias_asistencia" ? (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {/* Cabecera informativa */}
                      <div className="p-4 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] shadow-md">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                              <CalendarDays size={16} className="text-emerald-400" />
                              <span>Registro Acumulado de Asistencias por Alumno</span>
                            </h4>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                              Consulta nominal de todos los días exactos que ha venido cada alumno a {selectedClase.nombre_clase}.
                            </p>
                          </div>
                          <button
                            onClick={() => setIsClassMonthlyModalOpen(true)}
                            className="text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <BarChart3 size={14} />
                            <span>Ver Matriz Mensual</span>
                          </button>
                        </div>

                        {/* Buscador dentro de días de asistencia */}
                        <div className="relative mt-3.5">
                          <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--color-text-secondary)]" />
                          <input
                            type="text"
                            placeholder="Buscar alumno en esta clase..."
                            value={rosterSearch}
                            onChange={(e) => setRosterSearch(e.target.value)}
                            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Lista nominal de alumnos con los días que han venido */}
                      <div className="space-y-3">
                        {roster
                          .filter(s => {
                            if (!rosterSearch.trim()) return true;
                            const q = rosterSearch.toLowerCase();
                            return (
                              (s.nombre_completo || "").toLowerCase().includes(q) ||
                              (s.email || "").toLowerCase().includes(q) ||
                              (s.telefono || "").includes(q)
                            );
                          })
                          .map((student) => {
                            const attendedDates = Array.from(new Set(
                              classAllAttendances
                                .filter(a => a.alumno_id === student.id && a.fecha_hora)
                                .map(a => a.fecha_hora.substring(0, 10))
                            )).sort((a, b) => b.localeCompare(a));

                            return (
                              <div
                                key={student.id}
                                className="p-4 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-emerald-500/40 transition-all flex flex-col gap-3"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-[var(--color-primary)] flex items-center justify-center text-white font-black text-xs shrink-0 shadow-md">
                                      {(student.nombre_completo || "A").split(" ").slice(0, 2).map((n: string) => n[0]).join("")}
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-white text-sm">
                                        {student.nombre_completo}
                                      </h5>
                                      <span className="text-[11px] text-[var(--color-text-secondary)]">
                                        {student.plan_activo || "Alumno Regular"} {student.telefono ? `• ${student.telefono}` : ""}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 self-start sm:self-auto">
                                    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono border ${
                                      attendedDates.length > 0 
                                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                        : "bg-slate-800 text-slate-400 border-slate-700"
                                    }`}>
                                      {attendedDates.length} {attendedDates.length === 1 ? "día asistido" : "días asistidos"}
                                    </span>
                                    <button
                                      onClick={() => setSelectedStudentForHistory(student)}
                                      className="p-1.5 px-2.5 rounded-lg bg-[var(--color-bg-card)] hover:bg-white/10 text-slate-300 hover:text-white border border-[var(--color-border)] text-xs font-semibold transition-colors cursor-pointer"
                                      title="Ver ficha completa y WhatsApp"
                                    >
                                      Ficha
                                    </button>
                                  </div>
                                </div>

                                {/* Chips de Fechas */}
                                <div className="pt-2 border-t border-[var(--color-border)]/60">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                    Días que ha venido a esta clase:
                                  </span>
                                  {attendedDates.length === 0 ? (
                                    <span className="text-xs text-slate-500 italic flex items-center gap-1.5 py-1">
                                      <AlertTriangle size={13} className="text-amber-500/70" />
                                      Sin asistencias registradas aún en esta clase.
                                    </span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {attendedDates.map((dateISO) => {
                                        const [y, m, d] = dateISO.split("-");
                                        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
                                        const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
                                        const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                                        const dayName = diasSemana[dateObj.getDay()];
                                        const monthName = meses[dateObj.getMonth()];
                                        const formattedDate = `${dayName} ${d} ${monthName}`;

                                        return (
                                          <button
                                            key={dateISO}
                                            onClick={() => {
                                              handleChangeSessionDate(dateISO);
                                              setClassViewTab("pase_lista");
                                            }}
                                            className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm hover:bg-emerald-500/25 transition-all cursor-pointer"
                                            title={`Ver pase de lista del ${formattedDate}`}
                                          >
                                            <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                                            <span>{formattedDate}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ) : (
                    <>
                  {/* UNIFIED SESSION DATE SWITCHER (PARA TODAS LAS CLASES: REGULARES Y OPEN) */}
                  <div className="space-y-2 bg-[var(--color-bg)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-md mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <CalendarDays size={13} className="text-[var(--color-primary)]" />
                        <span>Sesión a Pasar Lista:</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 px-2 py-0.5 rounded-full">
                        {isOpenClass(selectedClase)
                          ? `${roster.length} inscritos / ${selectedClase.aforo_maximo || 20} max`
                          : `${roster.length} alumnos matriculados`}
                      </span>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
                      {currentClassSessions.map((day) => {
                        const isSelected = selectedSessionDate === day.dateISO;
                        const sessionAttendeesCount = classAllAttendances.filter(a => a.fecha_hora && a.fecha_hora.startsWith(day.dateISO)).length;
                        const openCount = isOpenClass(selectedClase) ? getSesionReservasCount(selectedClase.id, day.dateISO) : 0;

                        return (
                          <button
                            key={day.dateISO}
                            onClick={() => handleChangeSessionDate(day.dateISO)}
                            className={`py-2 px-3 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer min-w-[76px] shrink-0 border text-center ${
                              isSelected
                                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] font-extrabold shadow-md scale-105"
                                : "bg-[var(--color-bg-card)] text-slate-300 hover:bg-[var(--color-bg-hover)] border-[var(--color-border)]"
                            }`}
                          >
                            <span className={`text-[9px] uppercase font-bold tracking-wider ${isSelected ? "text-white" : "text-[var(--color-primary)]"}`}>
                              {day.isToday ? "Hoy" : day.dayShort}
                            </span>
                            <span className="text-base font-mono font-black leading-tight">
                              {day.dayNumber}
                            </span>
                            <span className="text-[8px] opacity-80 uppercase">
                              {day.monthShort}
                            </span>
                            <span className={`mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold leading-none ${
                              isSelected 
                                ? "bg-black/30 text-white" 
                                : sessionAttendeesCount > 0 
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                                : "text-slate-500"
                            }`}>
                              {isOpenClass(selectedClase) 
                                ? (openCount > 0 ? `${openCount} res` : `${sessionAttendeesCount} pres`)
                                : `${sessionAttendeesCount} pres`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CONTROLES DEL ROSTER: FILTROS (TODOS/PRESENTES/FALTAS) & ACCIONES */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-3.5">
                    {/* Tabs de Filtro */}
                    <div className="flex bg-[var(--color-bg)] p-1 rounded-xl border border-[var(--color-border)] text-xs">
                      <button
                        onClick={() => setAttendanceFilter("todos")}
                        className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all text-center cursor-pointer ${
                          attendanceFilter === "todos"
                            ? "bg-[var(--color-bg-card)] text-white shadow-sm"
                            : "text-[var(--color-text-secondary)] hover:text-white"
                        }`}
                      >
                        Todos ({roster.length})
                      </button>
                      <button
                        onClick={() => setAttendanceFilter("presentes")}
                        className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                          attendanceFilter === "presentes"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                            : "text-emerald-400/70 hover:text-emerald-300"
                        }`}
                      >
                        <Check size={12} />
                        <span>Presentes ({asistenciasRegistradas.length})</span>
                      </button>
                      <button
                        onClick={() => setAttendanceFilter("faltas")}
                        className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                          attendanceFilter === "faltas"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm"
                            : "text-rose-400/70 hover:text-rose-300"
                        }`}
                      >
                        <X size={12} />
                        <span>Faltas ({Math.max(0, roster.length - asistenciasRegistradas.length)})</span>
                      </button>
                    </div>

                    {/* Acciones Rápidas */}
                    <div className="flex items-center gap-1.5 shrink-0 justify-end flex-wrap">
                      <button
                        onClick={() => setIsClassMonthlyModalOpen(true)}
                        className="text-xs font-bold bg-[var(--color-bg)] text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                        title="Ver matriz y resumen mensual de asistencias de la clase"
                      >
                        <BarChart3 size={13} />
                        <span>Resumen Mes</span>
                      </button>

                      {roster.length > 0 && (
                        <>
                          {asistenciasRegistradas.length < roster.length && (
                            <button
                              onClick={handleMarkAllPresent}
                              disabled={savingId === "ALL"}
                              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                            >
                              <Check size={13} />
                              <span>Todos Presentes</span>
                            </button>
                          )}
                          {asistenciasRegistradas.length > 0 && (
                            <button
                              onClick={handleClearAllPresent}
                              disabled={savingId === "ALL"}
                              className="text-xs font-bold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                            >
                              <X size={13} />
                              <span>Desmarcar Todos</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Buscador de alumno dentro de la lista */}
                  {roster.length > 0 && (
                    <div className="relative mb-3.5 w-full">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--color-text-secondary)]" />
                      <input
                        type="text"
                        placeholder="Buscar alumno o profesor en lista..."
                        value={rosterSearch}
                        onChange={(e) => setRosterSearch(e.target.value)}
                        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-title)] text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-[var(--color-primary)]"
                      />
                    </div>
                  )}

                  {isRosterLoading ? (
                    <div className="py-8 text-center text-xs text-[var(--color-text-secondary)] flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                      <span>Cargando alumnos de la clase...</span>
                    </div>
                  ) : roster.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--color-text-secondary)]">
                      {isOpenClass(selectedClase)
                        ? "No hay alumnos ni profesores inscritos para esta sesión."
                        : "No hay alumnos matriculados en esta clase."}
                    </div>
                  ) : filteredRoster.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--color-text-secondary)]">
                      {attendanceFilter === "faltas"
                        ? "¡Genial! No hay faltas registradas en esta sesión. Todos los alumnos están marcados como presentes."
                        : attendanceFilter === "presentes"
                        ? "Todavía no se ha marcado ningún alumno como presente para esta sesión."
                        : `No se encontraron alumnos coincidentes con la búsqueda "${rosterSearch}".`}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[450px] overflow-y-auto pr-0.5 w-full">
                      {filteredRoster.map(student => {
                        const isPresent = asistenciasRegistradas.includes(student.id);
                        const isRegular = isRegularMembership(student.plan_activo, student.clases_restantes);
                        const isBonoExhausted = !isRegular && typeof student.clases_restantes === "number" && student.clases_restantes <= 0;
                        const hasPendingPayment = student.estado === "Pendiente" || student.plan_activo?.includes("Pendiente");
                        const stats = getStudentMonthlyStats(student.id);

                        return (
                          <div 
                            key={student.id} 
                            className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 transition-all w-full ${
                              isPresent 
                                ? "bg-emerald-500/10 border-emerald-500/40" 
                                : "bg-[var(--color-bg)] border-[var(--color-border)] hover:border-slate-600"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-xs sm:text-sm text-[var(--color-text-title)] truncate">
                                  {student.nombre_completo}
                                </span>
                                {student.is_docente && (
                                  <span className="text-[9px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                                    DOCENTE
                                  </span>
                                )}
                                {isBonoExhausted && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md shrink-0">
                                    <AlertTriangle size={11} className="text-red-400" />
                                    <span>Bono Agotado</span>
                                  </span>
                                )}
                                {hasPendingPayment && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md shrink-0">
                                    <Clock size={11} className="text-amber-400" />
                                    <span>Pago Pendiente</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[11px] text-[var(--color-text-secondary)]">
                                  <strong className={isBonoExhausted ? "text-[var(--color-danger)]" : student.clases_restantes === 1 ? "text-amber-400" : "text-slate-300"}>
                                    {isRegular ? "Mensualidad Regular" : `${student.clases_restantes ?? 0} ${(student.clases_restantes === 1) ? "clase" : "clases"}`}
                                  </strong>
                                </span>

                                {/* Badge de Seguimiento Mensual (Interactivo para ver historial) */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStudentForHistory(student);
                                  }}
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                    stats.faltasCount === 0
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                      : stats.faltasCount === 1
                                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                                      : "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                                  }`}
                                  title="Ver historial mensual detallado del alumno"
                                >
                                  <BarChart3 size={10} />
                                  <span>
                                    {stats.attendedCount}/{stats.totalPossible} este mes
                                    {stats.faltasCount > 0 ? ` (${stats.faltasCount} ${stats.faltasCount === 1 ? 'falta' : 'faltas'})` : " (100%)"}
                                  </span>
                                </button>
                              </div>
                            </div>

                            {/* Botón de Pase de Lista: ✓ Presente / ✗ Falta */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleToggleAsistencia(student)}
                                disabled={savingId === student.id}
                                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm min-h-[38px] cursor-pointer ${
                                  isPresent
                                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                    : "bg-[var(--color-bg-card)] border border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                                }`}
                              >
                                {savingId === student.id ? (
                                  "Guardando..."
                                ) : isPresent ? (
                                  <>
                                    <Check size={15} />
                                    <span>Presente</span>
                                  </>
                                ) : (
                                  <>
                                    <X size={15} className="text-rose-400" />
                                    <span>Falta</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  </>
                )}
                </div>
              )}
            </>
          )}

          {/* ==================================================== */}
          {/* MÓDULO 2: OPEN CLASS & FORMACIONES (INSCRIPCIÓN DOCENTE) */}
          {/* ==================================================== */}
          {activeTab === "open_classes" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 text-xs text-amber-200 leading-relaxed shadow-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Flame size={18} className="text-amber-400" />
                  <strong className="text-white text-sm">Open Classes y Formaciones</strong>
                </div>
                <p>
                  Como docente de Dance Factory puedes apuntarte a cualquier Open Class o Formación eligiendo la fecha en el calendario. Tus bonos cuentan con un <strong>10% de descuento directo</strong>.
                </p>
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-amber-500/20">
                  <span className="text-[11px] text-amber-300 font-semibold">
                    Tu saldo actual: <strong>{teacherStudent?.clases_restantes || 0} clases</strong>
                  </span>
                  <button
                    onClick={() => setActiveTab("comprar_bono")}
                    className="text-[11px] font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 px-3 py-1 rounded-lg transition-all"
                  >
                    + Comprar Bono Docente
                  </button>
                </div>
              </div>

              {/* SELECTOR DE FECHAS EN CALENDARIO (Docentes) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarDays size={14} className="text-amber-400" />
                    <span>Elige el Día al que quieres Asistir</span>
                  </span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none pt-1">
                  {calendarDays.map((day) => {
                    const isSelected = selectedCalendarDay.dateISO === day.dateISO;
                    return (
                      <button
                        key={day.dateISO}
                        onClick={() => setSelectedCalendarDay(day)}
                        className={`py-2.5 px-3.5 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer min-w-[70px] shrink-0 border ${
                          isSelected
                            ? "bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-lg shadow-amber-500/30 scale-105"
                            : "bg-[var(--color-bg-card)] text-slate-300 hover:bg-[var(--color-bg-hover)] border-[var(--color-border)] font-medium"
                        }`}
                      >
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? "text-slate-950" : "text-amber-400"}`}>
                          {day.isToday ? "Hoy" : day.dayShort}
                        </span>
                        <span className="text-lg font-mono font-black leading-tight mt-0.5">
                          {day.dayNumber}
                        </span>
                        <span className="text-[9px] opacity-80 uppercase">
                          {day.monthShort}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clases filtradas por el día seleccionado */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Sesiones para:</span>
                    <span className="text-amber-300 font-extrabold font-mono">
                      {selectedCalendarDay.dayName} {selectedCalendarDay.dayNumber} de {selectedCalendarDay.monthName}
                    </span>
                  </h3>
                </div>

                {allOpenClasses.filter(c => {
                  if (normalizeDay(c.dia_semana) !== normalizeDay(selectedCalendarDay.dayName)) return false;
                  const isRotativa = 
                    c.nombre_clase?.toUpperCase().includes("ROTAT") || 
                    c.profesor?.toUpperCase().includes("ROTAT") ||
                    (c.tipo_clase || "").toUpperCase().includes("ROTAT");
                  if (isRotativa) {
                    const selectedDate = new Date(selectedCalendarDay.dateISO + "T00:00:00");
                    const octoberStart = new Date("2026-10-01T00:00:00");
                    if (selectedDate < octoberStart) return false;
                  }
                  return true;
                }).length === 0 ? (
                  <div className="p-8 text-center space-y-2 bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] shadow-md">
                    <Calendar size={28} className="mx-auto text-slate-500" />
                    <p className="text-xs font-bold text-white">No hay sesiones de Open Class este {selectedCalendarDay.dayName.toLowerCase()}.</p>
                    <p className="text-[11px] text-slate-400">Prueba a seleccionar otro día en el carrusel superior.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {allOpenClasses
                      .filter(c => {
                        if (normalizeDay(c.dia_semana) !== normalizeDay(selectedCalendarDay.dayName)) return false;
                        const isRotativa = 
                          c.nombre_clase?.toUpperCase().includes("ROTAT") || 
                          c.profesor?.toUpperCase().includes("ROTAT") ||
                          (c.tipo_clase || "").toUpperCase().includes("ROTAT");
                        if (isRotativa) {
                          const selectedDate = new Date(selectedCalendarDay.dateISO + "T00:00:00");
                          const octoberStart = new Date("2026-10-01T00:00:00");
                          if (selectedDate < octoberStart) return false;
                        }
                        return true;
                      })
                      .map((clase) => {
                        const isBooked = isAlumnoReservadoEnSesion(
                          teacherStudent?.id || "",
                          clase.id,
                          selectedCalendarDay.dateISO
                        );
                        const isFull = isSesionCompleta(clase, selectedCalendarDay.dateISO);
                        const bookedCount = getSesionReservasCount(clase.id, selectedCalendarDay.dateISO);
                        const maxCap = clase.aforo_maximo || 20;

                        return (
                          <div
                            key={clase.id}
                            className={"p-4 rounded-2xl border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md " + (
                              isBooked
                                ? "bg-gradient-to-r from-emerald-500/15 via-[var(--color-bg-card)] to-[var(--color-bg-card)] border-emerald-500/40"
                                : "bg-[var(--color-bg-card)] border-[var(--color-border)] hover:border-slate-600"
                            )}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase">
                                  {clase.dia_semana} • {clase.hora_inicio} - {clase.hora_fin}
                                </span>
                                <span className={"text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border " + (
                                  isFull 
                                    ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                    : "bg-white/5 text-slate-300 border-white/10"
                                )}>
                                  {bookedCount} / {maxCap} plazas
                                </span>
                              </div>

                              <h3 className="text-sm font-bold font-[family-name:var(--font-heading)] text-white">
                                {clase.nombre_clase}
                              </h3>
                              <p className="text-[11px] text-slate-400">
                                Profesor/a titular: <strong className="text-white">{clase.profesor}</strong> • {clase.sede === "tejar" ? "Studio 1" : "Studio 2"} • {clase.sala || "Sala Principal"}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                              {(() => {
                                const isRotativa = 
                                  clase.nombre_clase?.toUpperCase().includes("ROTAT") || 
                                  clase.profesor?.toUpperCase().includes("ROTAT") ||
                                  (clase.tipo_clase || "").toUpperCase().includes("ROTAT");

                                if (isRotativa) {
                                  return (
                                    <span className="px-3.5 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
                                      <Lock size={13} className="text-amber-400" />
                                      <span>Inscripción en Recepción</span>
                                    </span>
                                  );
                                }

                                if (isBooked) {
                                  return (
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                                        <Check size={14} />
                                        <span>Plaza Reservada</span>
                                      </span>
                                      <button
                                        onClick={() => handleTeacherCancelBooking(clase)}
                                        className="px-2.5 py-1.5 rounded-xl text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  );
                                }

                                if (isFull) {
                                  return (
                                    <span className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 bg-slate-800 border border-slate-700">
                                      Agotado
                                    </span>
                                  );
                                }

                                return (
                                  <button
                                    onClick={() => handleTeacherOpenClassBooking(clase)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
                                  >
                                    <Ticket size={14} />
                                    <span>Reservar Plaza</span>
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* MÓDULO 3: COMPRAR BONOS DOCENTE (10% DTO) */}
          {/* ==================================================== */}
          {activeTab === "comprar_bono" && (
            <div className="space-y-5">
              {/* Banner Descuento Docente */}
              <div className="bg-gradient-to-br from-[var(--color-secondary)]/20 via-[var(--color-bg-card)] to-[#0c1428] border border-[var(--color-secondary)]/40 p-5 rounded-2xl shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-2 text-[var(--color-secondary)] mb-1">
                  <Tag size={20} />
                  <span className="text-xs font-bold uppercase tracking-wider">Tarifas Exclusivas para Profesores</span>
                </div>
                <h2 className="text-xl font-[family-name:var(--font-heading)] text-white tracking-wide">
                  10% de Descuento en Bonos y Formaciones
                </h2>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Como docente de Dance Factory, todos los bonos de Open Class y pases de formación tienen un 10% de descuento directo aplicado en el precio oficial.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider px-1">
                  Selecciona tu Bono Docente
                </h3>

                {bonosDocentes.map((bono) => (
                  <div
                    key={bono.id}
                    className="p-4 sm:p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-secondary)]/60 transition-all shadow-md relative"
                  >
                    {bono.popular && (
                      <span className="absolute -top-2.5 right-4 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                        Recomendado
                      </span>
                    )}

                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <div>
                        <span className="text-[10px] font-bold text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-2 py-0.5 rounded border border-[var(--color-secondary)]/20 mb-1 inline-block">
                          🔥 -10% DTO. DOCENTE
                        </span>
                        <h4 className="text-lg font-[family-name:var(--font-heading)] text-white tracking-wide">{bono.nombre}</h4>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs text-slate-500 line-through block font-mono">
                          {bono.precioOriginal}
                        </span>
                        <span className="text-xl font-bold font-mono text-[var(--color-secondary)] block">
                          {bono.precioDocente}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-4">
                      {bono.desc}
                    </p>

                    <button
                      onClick={() => setSelectedBonoForPayment(bono)}
                      className="w-full bg-[var(--color-secondary)] hover:opacity-90 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-[var(--color-secondary)]/20 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Ticket size={15} />
                      <span>Comprar Bono ({bono.precioDocente})</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Modal Pasarela de Pago Docente (Stripe o Recepción) */}
      {selectedBonoForPayment && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedBonoForPayment(null);
            }
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-gradient-to-b from-[var(--color-bg-card)] to-[#0c1428] border border-[var(--color-secondary)]/40 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 cursor-default"
          >
            <button
              onClick={() => setSelectedBonoForPayment(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center text-center space-y-2 pt-1">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-secondary)]/15 border border-[var(--color-secondary)]/30 text-[var(--color-secondary)] flex items-center justify-center shadow-lg">
                <Ticket size={24} />
              </div>
              <h3 className="text-xl font-[family-name:var(--font-heading)] text-white tracking-wide">
                Comprar Bono Docente
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Profesor/a: <strong className="text-white">{selectedProfesor}</strong>
              </p>
            </div>

            <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-2 text-xs">
              <div className="flex justify-between items-center text-[var(--color-text-secondary)]">
                <span>Bono seleccionado:</span>
                <strong className="text-white">{selectedBonoForPayment.nombre}</strong>
              </div>
              <div className="flex justify-between items-center text-[var(--color-text-secondary)]">
                <span>Subtotal Bono:</span>
                <span className="line-through font-mono">{selectedBonoForPayment.precioOriginal}</span>
              </div>
              <div className="flex justify-between items-center text-[var(--color-secondary)]">
                <span>Descuento Docente (-10%):</span>
                <span className="font-mono font-bold">
                  {(() => {
                    const orig = parseFloat((selectedBonoForPayment.precioOriginal || "0").replace(",", ".").replace(/[^0-9.]/g, "")) || 0;
                    const doc = parseFloat((selectedBonoForPayment.precioDocente || "0").replace(",", ".").replace(/[^0-9.]/g, "")) || (orig * 0.9);
                    const diff = orig - doc;
                    return `-${diff.toFixed(2).replace(".", ",")} € (-10%)`;
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center text-emerald-400">
                <span>Matrícula Anual:</span>
                <span className="font-bold font-mono">0,00 € (Exenta por perfil Docente)</span>
              </div>
              <div className="flex justify-between items-center text-[var(--color-secondary)] font-bold text-sm pt-2 border-t border-white/10">
                <span>Total a pagar:</span>
                <span className="font-mono text-base">{selectedBonoForPayment.precioDocente}</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => handleTeacherPaymentMock("recepcion")}
                disabled={isProcessingPayment}
                className="w-full bg-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/90 text-slate-950 font-bold py-3.5 rounded-2xl text-xs transition-all shadow-lg shadow-[var(--color-secondary)]/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Building2 size={16} />
                <span>Solicitar Pago en Recepción ({selectedBonoForPayment.precioDocente})</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-1 text-center">
              <ShieldCheck size={14} className="text-[var(--color-secondary)] shrink-0" />
              <span>Se registrará en STANDBY para abonar en recepción en efectivo o datáfono</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESUMEN MENSUAL DE LA CLASE */}
      {isClassMonthlyModalOpen && selectedClase && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-left">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg)] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary)] flex items-center justify-center shrink-0">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-heading)] text-base sm:text-lg font-bold text-white">
                    Resumen Mensual de Asistencias
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {selectedClase.nombre_clase} • {selectedClase.dia_semana} {selectedClase.hora_inicio}h ({getMonthNameSpanish((selectedSessionDate || getTodayISO()).substring(5, 7))} {(selectedSessionDate || getTodayISO()).substring(0, 4)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsClassMonthlyModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body: Scrollable Table */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Quick Month Metrics */}
              {(() => {
                const currentMonthPrefix = (selectedSessionDate || getTodayISO()).substring(0, 7);
                const monthSessions = currentClassSessions.filter(s => s.dateISO.startsWith(currentMonthPrefix));
                const pastSessions = monthSessions.filter(s => s.dateISO <= getTodayISO());
                const pastSessionsCount = Math.max(1, pastSessions.length);
                const totalClassAtts = classAllAttendances.filter(a => a.fecha_hora && a.fecha_hora.startsWith(currentMonthPrefix)).length;
                const totalPossibleAll = roster.length * pastSessionsCount;
                const classAttendanceRate = totalPossibleAll > 0 ? Math.round((totalClassAtts / totalPossibleAll) * 100) : 0;

                return (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Alumnos en Lista</span>
                      <span className="text-lg font-mono font-bold text-white mt-0.5 block">{roster.length}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Sesiones Impartidas</span>
                      <span className="text-lg font-mono font-bold text-amber-400 mt-0.5 block">{pastSessions.length} / {monthSessions.length}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Tasa Asistencia Mes</span>
                      <span className="text-lg font-mono font-bold text-emerald-400 mt-0.5 block">{classAttendanceRate}%</span>
                    </div>
                  </div>
                );
              })()}

              {/* Matrix Table */}
              {(() => {
                const currentMonthPrefix = (selectedSessionDate || getTodayISO()).substring(0, 7);
                const monthSessions = currentClassSessions.filter(s => s.dateISO.startsWith(currentMonthPrefix));
                const pastSessions = monthSessions.filter(s => s.dateISO <= getTodayISO());
                const pastSessionsCount = Math.max(1, pastSessions.length);

                return (
                  <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--color-bg)] border-b border-[var(--color-border)] text-[11px] font-bold text-slate-300">
                        <tr>
                          <th className="p-3 font-semibold">Alumno ({roster.length})</th>
                          {monthSessions.map((session) => (
                            <th key={session.dateISO} className="p-2.5 text-center font-mono">
                              <span className="block text-[10px] text-slate-400 uppercase">{session.dayShort}</span>
                              <span className={`text-xs ${session.dateISO === selectedSessionDate ? "text-[var(--color-primary)] font-black" : "text-slate-200"}`}>
                                {session.dayNumber} {session.monthShort}
                              </span>
                            </th>
                          ))}
                          <th className="p-2.5 text-center font-semibold">Total Asist.</th>
                          <th className="p-2.5 text-center font-semibold">Faltas</th>
                          <th className="p-2.5 text-center font-semibold">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {roster.map((student) => {
                          const studentAtts = classAllAttendances.filter(
                            a => a.alumno_id === student.id && a.fecha_hora && a.fecha_hora.startsWith(currentMonthPrefix)
                          );
                          const attendedCount = studentAtts.length;
                          const faltasCount = Math.max(0, pastSessionsCount - attendedCount);
                          const rate = Math.min(100, Math.round((attendedCount / pastSessionsCount) * 100));

                          return (
                            <tr 
                              key={student.id} 
                              onClick={() => setSelectedStudentForHistory(student)}
                              className="hover:bg-white/5 transition-colors cursor-pointer group"
                            >
                              <td className="p-3 font-medium text-white max-w-[160px] truncate group-hover:text-[var(--color-primary)]">
                                {student.nombre_completo}
                              </td>
                              {monthSessions.map((session) => {
                                const isPastOrToday = session.dateISO <= getTodayISO();
                                const attendedSession = classAllAttendances.some(
                                  a => a.alumno_id === student.id && a.fecha_hora && a.fecha_hora.startsWith(session.dateISO)
                                );

                                return (
                                  <td key={session.dateISO} className="p-2 text-center">
                                    {!isPastOrToday ? (
                                      <span className="text-slate-600 text-xs">-</span>
                                    ) : attendedSession ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-black text-xs border border-emerald-500/30">
                                        ✓
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-rose-500/20 text-rose-400 font-black text-xs border border-rose-500/30">
                                        ✗
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="p-2.5 text-center font-mono font-bold text-slate-200">
                                {attendedCount} / {pastSessionsCount}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold">
                                <span className={faltasCount === 0 ? "text-emerald-400" : faltasCount === 1 ? "text-amber-400" : "text-rose-400"}>
                                  {faltasCount}
                                </span>
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                  rate >= 80 
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                                    : rate >= 50 
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" 
                                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                }`}>
                                  {rate}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg)] flex justify-end shrink-0">
              <button
                onClick={() => setIsClassMonthlyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white hover:border-slate-500 transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIAL Y DETALLE DEL ALUMNO */}
      {selectedStudentForHistory && selectedClase && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-left">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg)] shrink-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-[family-name:var(--font-heading)] text-base font-bold text-white truncate">
                  {selectedStudentForHistory.nombre_completo}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] truncate">
                  {selectedStudentForHistory.plan_activo || "Alumno Regular"}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentForHistory(null)}
                className="w-8 h-8 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 ml-2"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Student Stats Summary */}
              {(() => {
                const stats = getStudentMonthlyStats(selectedStudentForHistory.id);
                return (
                  <div className="p-3.5 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Asistencia este mes:</span>
                      <span className="font-mono font-bold text-white">
                        {stats.attendedCount} de {stats.totalPossible} clases ({stats.percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          stats.percent >= 80 ? "bg-emerald-500" : stats.percent >= 50 ? "bg-amber-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${stats.percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] pt-1">
                      <span className="text-slate-400">Total Faltas:</span>
                      <span className={`font-bold ${stats.faltasCount === 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {stats.faltasCount} {stats.faltasCount === 1 ? "falta" : "faltas"}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Sessions Breakdown */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Desglose de Sesiones del Mes
                </span>

                <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                  {currentClassSessions
                    .filter(s => s.dateISO.startsWith((selectedSessionDate || getTodayISO()).substring(0, 7)))
                    .map((session) => {
                      const isPastOrToday = session.dateISO <= getTodayISO();
                      const studentAtt = classAllAttendances.find(
                        a => a.alumno_id === selectedStudentForHistory.id && a.fecha_hora && a.fecha_hora.startsWith(session.dateISO)
                      );

                      return (
                        <div
                          key={session.dateISO}
                          className="p-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <span className="font-bold text-white block">
                              {session.dayName} {session.dayNumber} de {session.monthName}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {selectedClase.hora_inicio} - {selectedClase.hora_fin}h
                            </span>
                          </div>

                          {!isPastOrToday ? (
                            <span className="text-[10px] font-semibold text-slate-500 px-2 py-0.5 rounded bg-slate-800">
                              Próxima
                            </span>
                          ) : studentAtt ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                              <Check size={12} /> Asistió
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-md">
                              <X size={12} /> Falta
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* WhatsApp Follow-up */}
              {selectedStudentForHistory.telefono && (
                <div className="pt-2">
                  <a
                    href={`https://wa.me/34${selectedStudentForHistory.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Hola ${selectedStudentForHistory.nombre_completo}, te escribimos desde Dance Factory en relación a tus clases de ${selectedClase.nombre_clase} (${selectedClase.dia_semana} a las ${selectedClase.hora_inicio}h). Queríamos hacer seguimiento contigo. ¡Un saludo!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <MessageCircle size={15} />
                    <span>Contactar por WhatsApp (+34 {selectedStudentForHistory.telefono})</span>
                  </a>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg)] flex justify-end shrink-0">
              <button
                onClick={() => setSelectedStudentForHistory(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white hover:border-slate-500 transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Modal In-App */}
      <AppModal modal={modal} onClose={() => setModal({ ...modal, isOpen: false })} />

      {/* Fixed Bottom Navigation (Mobile Style - Never Scrolls) */}
      <nav className="bg-[var(--color-bg-card)] border-t border-[var(--color-border)] px-4 py-2.5 pb-[env(safe-area-inset-bottom,0px)] flex justify-around items-center z-50 shadow-2xl shrink-0">
        <button
          onClick={() => {
            setActiveTab("mis_clases");
            setSelectedClase(null);
          }}
          className={`flex flex-col items-center py-1 px-4 transition-colors ${
            activeTab === "mis_clases"
              ? "text-[var(--color-primary)] font-bold"
              : "text-[var(--color-text-secondary)] hover:text-white"
          }`}
        >
          <Calendar size={20} className={activeTab === "mis_clases" ? "scale-110 transition-transform" : ""} />
          <span className="text-[10px] mt-1 font-semibold">Mis Clases</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("open_classes");
            setSelectedClase(null);
          }}
          className={`flex flex-col items-center py-1 px-4 transition-colors ${
            activeTab === "open_classes"
              ? "text-amber-400 font-bold"
              : "text-[var(--color-text-secondary)] hover:text-white"
          }`}
        >
          <Flame size={20} className={activeTab === "open_classes" ? "scale-110 transition-transform" : ""} />
          <span className="text-[10px] mt-1 font-semibold">Open Class</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("comprar_bono");
            setSelectedClase(null);
          }}
          className={`flex flex-col items-center py-1 px-4 transition-colors relative ${
            activeTab === "comprar_bono"
              ? "text-[var(--color-secondary)] font-bold"
              : "text-[var(--color-text-secondary)] hover:text-white"
          }`}
        >
          <span className="absolute -top-1 right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-[8px] font-bold px-1.5 py-0.2 rounded-full shadow-sm">
            -10%
          </span>
          <Tag size={20} className={activeTab === "comprar_bono" ? "scale-110 transition-transform" : ""} />
          <span className="text-[10px] mt-1 font-semibold">Bonos</span>
        </button>
      </nav>

    </div>
  );
}
