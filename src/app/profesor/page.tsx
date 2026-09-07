"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { 
  UserCheck, Check, Clock, Users, ShieldAlert, Sparkles, Calendar, Search, 
  Lock, LogOut, KeyRound, ArrowLeft, ChevronRight, Flame, Ticket, GraduationCap, 
  CreditCard, Building2, Trash2, AlertTriangle, Tag, CheckCircle2, ShieldCheck, X,
  CalendarDays
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
  OpenClassReserva
} from "@/lib/openClassService";

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
  "1011": { name: "NIL BARBERÁ" }
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
  
  // Open Classes & Calendar State
  const calendarDays = getUpcomingCalendarDates(30);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<CalendarDayItem>(calendarDays[0]);
  const [allOpenClasses, setAllOpenClasses] = useState<any[]>([]);
  const [teacherEnrolledClassIds, setTeacherEnrolledClassIds] = useState<string[]>([]);
  const [openClassReservasVersion, setOpenClassReservasVersion] = useState<number>(0);
  
  // Checkout
  const [selectedBonoForPayment, setSelectedBonoForPayment] = useState<any | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ isOpen: false, message: "" });

  const isOpenClass = (clase: any) => {
    if (!clase) return false;
    const name = (clase.nombre_clase || "").toLowerCase();
    const type = (clase.tipo_clase || "").toLowerCase();
    return type.includes("open") || name.includes("open") || name.includes("comercial");
  };

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
    if (pinInput.length >= 4) return;
    setPinError("");
    const newPin = pinInput + digit;
    setPinInput(newPin);

    if (newPin.length === 4) {
      validatePin(newPin);
    }
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
    setAllOpenClasses([]);
    setTeacherEnrolledClassIds([]);
    setSelectedBonoForPayment(null);
    setIsProcessingPayment(false);
    setSavingId(null);
    setModal({ isOpen: false, message: "" });
  };

  // Get or create Teacher student profile in `alumnos` table
  const fetchTeacherStudentProfile = async () => {
    if (!selectedProfesor) return;

    let { data: existing } = await supabase
      .from("alumnos")
      .select("*")
      .ilike("nombre_completo", `%${selectedProfesor}%`)
      .maybeSingle();

    if (!existing) {
      // Auto-provision teacher student profile with special teacher plan
      const newTeacherRecord = {
        nombre_completo: selectedProfesor,
        email: `${selectedProfesor.toLowerCase().replace(/[\s\./]/g, "")}@dancefactory.es`,
        telefono: "600000000",
        plan_activo: "Docente (10% Dto)",
        clases_restantes: 0,
        estado: "Activo",
        sede: "castilla",
        nfc_token: `PROF-${Math.floor(1000 + Math.random() * 9000)}`
      };

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
      const { data, error } = await supabase
        .from("clases_cuadrante")
        .select("*");

      if (error) {
        console.error("Error fetching clases cuadrante:", error);
      }

      if (data && data.length > 0) {
        const normalizedSelected = normalizeText(selectedProfesor);
        const filtered = data.filter(c => 
          normalizeText(c.profesor).includes(normalizedSelected)
        );

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
  const loadRosterForDate = async (clase: any, dateIso: string) => {
    if (!clase?.id) {
      setRoster([]);
      setAsistenciasRegistradas([]);
      return;
    }

    try {
      if (isOpenClass(clase)) {
        const sessionReservas = getReservasPorClaseYSesion(clase.id, dateIso);
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

        const { data: asistencias } = await supabase
          .from("asistencias")
          .select("alumno_id, id, fecha_hora")
          .eq("clase_id", clase.id)
          .gte("fecha_hora", dateIso + "T00:00:00")
          .lte("fecha_hora", dateIso + "T23:59:59");

        const markedIds = (asistencias || []).map(a => a.alumno_id);
        setAsistenciasRegistradas(markedIds);
      } else {
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
              estado
            )
          `)
          .eq("clase_id", clase.id);

        if (enrollError) {
          console.error("Error fetching enrolled students:", enrollError);
        }

        const studentList = enrolled ? enrolled.map((e: any) => e.alumnos).filter(a => a != null) : [];
        studentList.sort((a: any, b: any) => (a.nombre_completo || "").localeCompare(b.nombre_completo || "", "es"));
        setRoster(studentList);

        const { data: asistencias } = await supabase
          .from("asistencias")
          .select("alumno_id, id, fecha_hora")
          .eq("clase_id", clase.id)
          .gte("fecha_hora", dateIso + "T00:00:00")
          .lte("fecha_hora", dateIso + "T23:59:59");

        const markedIds = (asistencias || []).map(a => a.alumno_id);
        setAsistenciasRegistradas(markedIds);
      }
    } catch (err) {
      console.error("Error in loadRosterForDate:", err);
    }
  };

  const handleSelectClase = (clase: any) => {
    setSelectedClase(clase);
    setRosterSearch("");
    const defaultDate = calendarDays.find(d => normalizeDay(d.dayName) === normalizeDay(clase.dia_semana))?.dateISO || new Date().toISOString().split("T")[0];
    setSelectedSessionDate(defaultDate);
    loadRosterForDate(clase, defaultDate);
  };

  const handleChangeSessionDate = (newDateIso: string) => {
    if (!selectedClase) return;
    setSelectedSessionDate(newDateIso);
    loadRosterForDate(selectedClase, newDateIso);
  };

  useEffect(() => {
    const handleReservasUpdated = () => {
      setOpenClassReservasVersion(v => v + 1);
      if (selectedClase && selectedSessionDate) {
        loadRosterForDate(selectedClase, selectedSessionDate);
      }
    };
    window.addEventListener("df_reservas_updated", handleReservasUpdated);
    window.addEventListener("storage", handleReservasUpdated);
    return () => {
      window.removeEventListener("df_reservas_updated", handleReservasUpdated);
      window.removeEventListener("storage", handleReservasUpdated);
    };
  }, [selectedClase, selectedSessionDate]);

  // 4. Digital Roll Call Toggle
  const handleToggleAsistencia = async (student: any) => {
    if (!selectedClase?.id) return;
    setSavingId(student.id);
    const targetDate = selectedSessionDate || new Date().toISOString().split("T")[0];

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
          .eq("clase_id", selectedClase.id)
          .gte("fecha_hora", targetDate + "T00:00:00")
          .lte("fecha_hora", targetDate + "T23:59:59");

        setAsistenciasRegistradas(prev => prev.filter(id => id !== student.id));

        logActivity({
          origen: "profesor",
          tipo_evento: "asistencia_profesor",
          descripcion: `Profesor ${selectedProfesor} desmarcó asistencia (falta) a ${student.nombre_completo} en ${selectedClase.nombre_clase}`,
          usuario_afectado: student.nombre_completo,
          sede: isStudio1(selectedClase.sede) ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
        });
      } else {
        if (!isRegular && typeof student.clases_restantes === "number" && student.clases_restantes > 0) {
          const newBalance = Math.max(0, student.clases_restantes - 1);
          await supabase
            .from("alumnos")
            .update({ clases_restantes: newBalance })
            .eq("id", student.id);

          setDeductedStudentIds(prev => new Set(prev).add(student.id));
        }

        await supabase.from("asistencias").insert([{
          alumno_id: student.id,
          clase_id: selectedClase.id,
          fecha_hora: targetDate + "T" + (selectedClase.hora_inicio || "18:00") + ":00.000Z"
        }]);

        setAsistenciasRegistradas(prev => [...prev, student.id]);

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

    crearReservaOpenClass({
      alumno_id: teacherStudent.id,
      alumno_nombre: `${selectedProfesor} (Docente)`,
      clase,
      calendarDay: selectedCalendarDay
    });

    setOpenClassReservasVersion(v => v + 1);

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
      message: `Te has inscrito correctamente en ${clase.nombre_clase} con ${clase.profesor}.\n\n📅 Fecha: ${selectedCalendarDay.dayName} ${selectedCalendarDay.dayNumber} de ${selectedCalendarDay.monthName}\n⏰ Horario: ${clase.hora_inicio} - ${clase.hora_fin}h\n🚪 Sala: ${clase.sala || "Sala Principal"}\n\nYa apareces en la lista de asistencia del docente titular para esa sesión.`,
      type: "success"
    });
  };

  // Cancel Booking as a Teacher
  const handleTeacherCancelBooking = async (clase: any) => {
    if (!teacherStudent?.id) return;
    const all = getOpenClassReservas();
    const found = all.find(r => 
      r.alumno_id === teacherStudent.id && 
      r.clase_id === clase.id && 
      r.fecha_iso === selectedCalendarDay.dateISO && 
      r.estado === "Confirmada"
    );

    if (found) {
      cancelarReservaOpenClass(found.id);

      const hasUnlimited = (teacherStudent.plan_activo || "").toLowerCase().includes("ilimitad");
      if (!hasUnlimited && typeof teacherStudent.clases_restantes === "number") {
        const newCount = teacherStudent.clases_restantes + 1;
        setTeacherStudent((prev: any) => ({ ...prev, clases_restantes: newCount }));
        try {
          await supabase.from("alumnos").update({ clases_restantes: newCount }).eq("id", teacherStudent.id);
        } catch (e) {}
      }

      setOpenClassReservasVersion(v => v + 1);

      setModal({
        isOpen: true,
        title: "Reserva Cancelada",
        message: `Has cancelado tu inscripción para ${clase.nombre_clase} el ${selectedCalendarDay.dayName} ${selectedCalendarDay.dayNumber} de ${selectedCalendarDay.monthName}. Se ha reintegrado 1 clase a tu saldo docente.`,
        type: "info"
      });
    }
  };

  const handleMarkAllPresent = async () => {
    if (!selectedClase?.id || roster.length === 0) return;
    setSavingId("ALL");

    try {
      const studentsToMark = roster.filter(s => !asistenciasRegistradas.includes(s.id));
      const newCheckins = [];

      for (const student of studentsToMark) {
        const isRegular = isRegularMembership(student.plan_activo, student.clases_restantes);

        if (!isRegular && typeof student.clases_restantes === "number" && student.clases_restantes > 0) {
          const newBalance = Math.max(0, student.clases_restantes - 1);
          await supabase
            .from("alumnos")
            .update({ clases_restantes: newBalance })
            .eq("id", student.id);

          setDeductedStudentIds(prev => new Set(prev).add(student.id));
        }

        newCheckins.push({
          alumno_id: student.id,
          clase_id: selectedClase.id,
          fecha_hora: new Date().toISOString()
        });
      }

      if (newCheckins.length > 0) {
        await supabase.from("asistencias").insert(newCheckins);
        setAsistenciasRegistradas(roster.map(s => s.id));

        // Audit log
        logActivity({
          origen: "profesor",
          tipo_evento: "asistencia_profesor",
          descripcion: `Profesor ${selectedProfesor} hizo pase de lista masivo (${roster.length} alumnos) en ${selectedClase.nombre_clase}`,
          usuario_afectado: `${selectedProfesor} (Masivo)`,
          sede: isStudio1(selectedClase.sede) ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
        });
      }
    } catch (err) {
      console.error("Error in handleMarkAllPresent:", err);
    } finally {
      setSavingId(null);
      if (selectedClase && selectedSessionDate) {
        loadRosterForDate(selectedClase, selectedSessionDate);
      }
    }
  };

  // 5. Teacher Open Class Enrollment Handler
  const handleTeacherApuntarme = async (clase: any) => {
    if (!teacherStudent?.id) return;

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

    if (typeof window !== "undefined") {
      try {
        // Save to pending_bono_requests for Reception Dashboard
        const storedLocal = JSON.parse(localStorage.getItem("pending_bono_requests") || "[]");
        const newReq = {
          id: "req_docente_" + Date.now(),
          student_id: teacherStudent.id,
          student_name: `${selectedProfesor} (Docente)`,
          student_email: teacherStudent.email || `${selectedProfesor.toLowerCase().replace(/\s+/g, '.')}@dancefactory.es`,
          bono_nombre: selectedBonoForPayment.nombre,
          bono_precio: selectedBonoForPayment.precioDocente,
          fecha: "Hoy (Docente)",
          estado: "Pendiente de cobro en Recepción"
        };
        localStorage.setItem("pending_bono_requests", JSON.stringify([newReq, ...storedLocal]));

        // Log transaction in central ledger
        const rawPayments = localStorage.getItem("df_pagos_transacciones_v1");
        const allPayments = rawPayments ? JSON.parse(rawPayments) : [];
        const now = new Date();
        const pendingTx = {
          id: "pago_docente_pending_" + Date.now(),
          numero_recibo: "PEND-" + now.getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000),
          fecha_hora: now.toISOString(),
          fecha_corta: now.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }),
          hora_corta: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          alumno_id: teacherStudent.id,
          alumno_nombre: `${selectedProfesor} (Docente)`,
          alumno_dni: teacherStudent.dni || "Docente DF",
          alumno_telefono: teacherStudent.telefono || "-",
          concepto: `${selectedBonoForPayment.nombre} (-10% dto Docente)`,
          categoria: "bono",
          importe: selectedBonoForPayment.precioNum,
          metodo_pago: "Pendiente Recepción",
          sede: "castilla",
          atendido_por: "Solicitud Portal Profesor",
          notas: `Solicitud de bono docente con 10% dto en standby para abonar en recepción`,
          estado: "Pendiente"
        };
        localStorage.setItem("df_pagos_transacciones_v1", JSON.stringify([pendingTx, ...allPayments]));
        window.dispatchEvent(new Event("df_pagos_updated"));
      } catch (e) {
        console.error("Error saving pending teacher bono request:", e);
      }
    }

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

  const filteredRoster = roster.filter(s => 
    s.nombre_completo?.toLowerCase().includes(rosterSearch.toLowerCase())
  );

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
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <h2 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Todas tus Clases Asignadas
                    </h2>
                    <span className="text-xs font-semibold text-[var(--color-primary)]">
                      {clasesProfesor.length} {clasesProfesor.length === 1 ? 'clase' : 'clases'}
                    </span>
                  </div>

                  {isLoading ? (
                    <div className="p-8 text-center text-xs text-[var(--color-text-secondary)]">Cargando tus clases...</div>
                  ) : clasesProfesor.length === 0 ? (
                    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 text-center text-xs text-[var(--color-text-secondary)] shadow-sm">
                      No tienes clases regulares asignadas como docente principal actualmente.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 w-full">
                      {clasesProfesor.map(clase => {
                        const studio1 = isStudio1(clase.sede);

                        return (
                          <button
                            key={clase.id}
                            onClick={() => setSelectedClase(clase)}
                            className="w-full text-left p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-primary)] transition-all shadow-lg hover:shadow-xl group"
                          >
                            <div className="flex justify-between items-center gap-2 mb-1.5">
                              <span className="text-xs font-mono font-bold text-[var(--color-primary)] truncate">
                                {clase.dia_semana} • {clase.hora_inicio} - {clase.hora_fin}h
                              </span>
                              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${
                                studio1 ? 'bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border border-[var(--color-secondary)]/20' : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20'
                              }`}>
                                {studio1 ? 'Studio 1' : 'Studio 2'}
                              </span>
                            </div>

                            <div className="flex justify-between items-end gap-2">
                              <div>
                                <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-title)] tracking-wide">{clase.nombre_clase}</h3>
                                <span className="text-xs text-[var(--color-text-secondary)] block mt-0.5">Aforo máximo: {clase.aforo_maximo} plazas</span>
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
                    className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] hover:text-white bg-[var(--color-bg)] px-3 py-2 rounded-xl border border-[var(--color-border)] mb-4 transition-all"
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
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">Control de asistencia en tiempo real</p>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0">
                      <span className="text-xs font-bold text-[var(--color-success)] bg-[var(--color-success)]/10 px-3 py-1.5 rounded-full border border-[var(--color-success)]/20 shrink-0">
                        {asistenciasRegistradas.length} / {roster.length} Presentes
                      </span>

                      {roster.length > 0 && (
                        <button
                          onClick={handleMarkAllPresent}
                          disabled={savingId === "ALL"}
                          className="text-xs font-bold bg-[var(--color-primary)] text-white px-3 py-1.5 rounded-xl hover:brightness-110 transition-all shadow-sm shrink-0"
                        >
                          Marcar Todos
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Open Class Session Date Switcher */}
                  {isOpenClass(selectedClase) && (
                    <div className="space-y-2 bg-[var(--color-bg)] p-3.5 rounded-2xl border border-[var(--color-border)] shadow-md mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <CalendarDays size={13} className="text-amber-400" />
                          <span>Sesión a Pasar Lista:</span>
                        </span>
                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          {roster.length} inscritos / {selectedClase.aforo_maximo || 20} max
                        </span>
                      </div>

                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
                        {calendarDays
                          .filter(d => normalizeDay(d.dayName) === normalizeDay(selectedClase.dia_semana))
                          .map((day) => {
                            const isSelected = selectedSessionDate === day.dateISO;
                            return (
                              <button
                                key={day.dateISO}
                                onClick={() => handleChangeSessionDate(day.dateISO)}
                                className={`py-2 px-3 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer min-w-[65px] shrink-0 border text-center ${
                                  isSelected
                                    ? "bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-md scale-105"
                                    : "bg-[var(--color-bg-card)] text-slate-300 hover:bg-[var(--color-bg-hover)] border-[var(--color-border)]"
                                }`}
                              >
                                <span className={`text-[9px] uppercase font-bold tracking-wider ${isSelected ? "text-slate-950" : "text-amber-400"}`}>
                                  {day.isToday ? "Hoy" : day.dayShort}
                                </span>
                                <span className="text-base font-mono font-black leading-tight">
                                  {day.dayNumber}
                                </span>
                                <span className="text-[8px] opacity-80 uppercase">
                                  {day.monthShort}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

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

                  {roster.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--color-text-secondary)]">
                      {isOpenClass(selectedClase)
                        ? "No hay alumnos ni profesores inscritos para esta sesión."
                        : "No hay alumnos matriculados en esta clase."}
                    </div>
                  ) : filteredRoster.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--color-text-secondary)]">
                      No se encontraron alumnos coincidentes con la búsqueda &quot;{rosterSearch}&quot;.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[450px] overflow-y-auto pr-0.5 w-full">
                      {filteredRoster.map(student => {
                        const isPresent = asistenciasRegistradas.includes(student.id);
                        const isRegular = isRegularMembership(student.plan_activo, student.clases_restantes);
                        const isBonoExhausted = !isRegular && typeof student.clases_restantes === "number" && student.clases_restantes <= 0;
                        const hasPendingPayment = student.estado === "Pendiente" || student.plan_activo?.includes("Pendiente");

                        return (
                          <div 
                            key={student.id} 
                            className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 transition-all w-full ${
                              isPresent 
                                ? "bg-[var(--color-success)]/10 border-[var(--color-success)]/40" 
                                : "bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
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
                                    <span>Bono Agotado (0 clases)</span>
                                  </span>
                                )}
                                {hasPendingPayment && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md shrink-0">
                                    <Clock size={11} className="text-amber-400" />
                                    <span>Pago Pendiente</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 block truncate">
                                <strong className={isBonoExhausted ? "text-[var(--color-danger)]" : student.clases_restantes === 1 ? "text-amber-400" : "text-[var(--color-success)]"}>
                                  {isRegular ? "Mensualidad Activa" : `${student.clases_restantes ?? 0} ${(student.clases_restantes === 1) ? "clase" : "clases"}`}
                                </strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleToggleAsistencia(student)}
                                disabled={savingId === student.id}
                                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm min-h-[40px] cursor-pointer ${
                                  isPresent
                                    ? "bg-[var(--color-success)] text-white hover:brightness-110"
                                    : "bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-title)] hover:border-[var(--color-primary)]"
                                }`}
                              >
                                {savingId === student.id ? (
                                  "Guardando..."
                                ) : isPresent ? (
                                  <>
                                    <Check size={16} /> Presente
                                  </>
                                ) : (
                                  "Marcar"
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
