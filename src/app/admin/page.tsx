"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import TopHeader from "@/components/layout/TopHeader";
import { useSede } from "@/context/SedeContext";
import { supabase } from "@/lib/supabase/client";
import AppModal, { ModalState } from "@/components/AppModal";
import { logActivity } from "@/lib/activityLogger";
import { registrarNuevoPago, cobrarPagoPendiente } from "@/lib/pagosService";
import HistoricoEntradasModal from "@/components/HistoricoEntradasModal";
import OpenClassAsistentesModal from "@/components/OpenClassAsistentesModal";
import { isRegularClassStudent, isTeacherProfile } from "@/lib/matriculaService";
import { 
  Calendar, Users, Clock, Sparkles, CheckCircle2, ChevronRight, 
  CalendarDays, Flame, Building2 
} from "lucide-react";
import {
  getUpcomingCalendarDates,
  createCalendarDayFromISO,
  formatFullCalendarDate,
  CalendarDayItem,
  getSesionReservasCount,
  isSesionCompleta,
  getOpenClassReservas,
  DEFAULT_STUDIO2_OPEN_CLASSES,
  normalizeDay,
  normalizeSede,
  marcarAsistenciaPorAlumnoYSesion,
  marcarAsistenciaPorAlumnoEnFecha
} from "@/lib/openClassService";

const playSuccessSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.log("Audio error", e);
  }
};

const playErrorSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
    osc.frequency.setValueAtTime(140, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.log("Audio error", e);
  }
};

export default function AdminDashboardRecepcion() {
  const { activeSede } = useSede();

  // State for modal
  const [appModal, setAppModal] = useState<ModalState>({ isOpen: false, message: "" });
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);

  // State for pending bono requests in reception
  const [pendingBonoRequests, setPendingBonoRequests] = useState<any[]>([]);

  useEffect(() => {
    const loadPendingBonoRequests = async () => {
      try {
        // 1. Fetch pending requests from Supabase database
        const { data: dbPending } = await supabase
          .from("alumnos")
          .select("*")
          .ilike("plan_activo", "Pendiente:%");

        const dbMapped = (dbPending || []).map(student => {
          const raw = student.plan_activo || "";
          const match = raw.match(/Pendiente:\s*([^(]+)(?:\(([^)]+)\))?/);
          const bonoNombre = match ? match[1].trim() : raw.replace(/^Pendiente:\s*/i, "").trim();
          const extraInfo = match && match[2] ? match[2].trim() : "";
          const isTransfer = raw.toLowerCase().includes("transferencia");

          return {
            id: student.id,
            student_id: student.id,
            student_name: student.nombre_completo,
            student_email: student.email,
            bono_nombre: bonoNombre,
            bono_precio: extraInfo || "En recepción",
            metodo_pago: isTransfer ? "Transferencia Bancaria" : "Recepción",
            fecha: "Hoy",
            estado: isTransfer ? "Pendiente de verificación bancaria" : "Pendiente de cobro en Recepción"
          };
        });

        // 2. Combine with localStorage
        const storedLocal = JSON.parse(localStorage.getItem("pending_bono_requests") || "[]");
        const combined = [...dbMapped];

        storedLocal.forEach((lReq: any) => {
          if (!combined.some(c => c.id === lReq.id || (c.student_email && c.student_email === lReq.student_email))) {
            combined.push(lReq);
          }
        });

        setPendingBonoRequests(combined);
      } catch (e) {
        setPendingBonoRequests([]);
      }
    };

    // Teacher Security Lockouts Loader
    const loadTeacherLockouts = async () => {
      try {
        const { data } = await supabase
          .from("alumnos")
          .select("id, nombre_completo, email, estado, sede, plan_activo")
          .ilike("estado", "%Bloqueado%");

        const dbLocked = [...(data || [])];

        // Also check localStorage for local teacher locks
        if (typeof window !== "undefined") {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("df_sec_lockout_teacher_")) {
              const teacherId = key.replace("df_sec_lockout_teacher_", "");
              try {
                const parsed = JSON.parse(localStorage.getItem(key) || "{}");
                if (parsed.failedCount >= 3 || parsed.isPermanentLock) {
                  if (!dbLocked.some(d => d.id === `docente_${teacherId}` || d.id === teacherId)) {
                    dbLocked.push({
                      id: `docente_${teacherId}`,
                      nombre_completo: `Profesor (${teacherId})`,
                      email: `${teacherId}@dancefactory.es`,
                      estado: "Bloqueado por 3 fallos de PIN",
                      sede: "castilla",
                      plan_activo: "Docente Dance Factory"
                    });
                  }
                }
              } catch (e) {}
            }
          }
        }

        setLockedTeachers(dbLocked);
      } catch (e) {
        setLockedTeachers([]);
      }
    };

    loadPendingBonoRequests();
    loadTeacherLockouts();

    window.addEventListener("storage", loadPendingBonoRequests);
    window.addEventListener("df_pending_bonos_updated", loadPendingBonoRequests);
    window.addEventListener("df_security_lock_updated", loadTeacherLockouts);
    const interval = setInterval(() => {
      loadPendingBonoRequests();
      loadTeacherLockouts();
    }, 2500);

    return () => {
      window.removeEventListener("storage", loadPendingBonoRequests);
      window.removeEventListener("df_pending_bonos_updated", loadPendingBonoRequests);
      window.removeEventListener("df_security_lock_updated", loadTeacherLockouts);
      clearInterval(interval);
    };
  }, []);

  // State for locked teachers requiring Reception unlock
  const [lockedTeachers, setLockedTeachers] = useState<any[]>([]);
  const [tareaFiltro, setTareaFiltro] = useState<"todas" | "seguridad" | "pagos">("todas");

  const totalTareasPendientes = lockedTeachers.length + pendingBonoRequests.length;

  // State for today's classes & check-ins
  const [clasesHoy, setClasesHoy] = useState<any[]>([]);
  const [selectedClaseId, setSelectedClaseId] = useState<string | null>(null);
  const [todayCheckins, setTodayCheckins] = useState<any[]>([]);

  // View mode for left column: regular classes of today vs Open Classes by calendar date
  const [clasesTab, setClasesTab] = useState<"regulares" | "openclass">("regulares");

  // Open Classes & Calendar State
  const calendarDays = useMemo(() => getUpcomingCalendarDates(35), []);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<CalendarDayItem>(() => calendarDays[0]);
  const [allOpenClasses, setAllOpenClasses] = useState<any[]>(DEFAULT_STUDIO2_OPEN_CLASSES);

  // Modal state for viewing attendees of an Open Class session
  const [asistentesModalState, setAsistentesModalState] = useState<{
    isOpen: boolean;
    clase: any | null;
    calendarDay: CalendarDayItem | null;
  }>({
    isOpen: false,
    clase: null,
    calendarDay: null
  });

  // Revision / tick counter to re-render counts on df_reservas_updated
  const [reservasTick, setReservasTick] = useState(0);

  // Filtered Open Classes for the selected calendar date
  const openClassesForSelectedDay = useMemo(() => {
    if (!selectedCalendarDay) return [];
    const normDay = normalizeDay(selectedCalendarDay.dayName);
    return allOpenClasses.filter(c => normalizeDay(c.dia_semana) === normDay);
  }, [allOpenClasses, selectedCalendarDay, reservasTick]);

  // State for metrics
  const [metrics, setMetrics] = useState({
    checkinsCount: 0,
    ocupacionPorcentaje: 0,
    alumnosActivos: 0
  });

  // State for check-in scanner
  const [qrCode, setQrCode] = useState("");
  const [manualSearch, setManualSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [flashState, setFlashState] = useState<'success' | 'error' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const qrInputRef = useRef<HTMLInputElement>(null);

  // Listen to reservation updates across portals
  useEffect(() => {
    const handleReservasUpdated = () => {
      setReservasTick(prev => prev + 1);
    };
    window.addEventListener("df_reservas_updated", handleReservasUpdated);
    window.addEventListener("storage", handleReservasUpdated);
    return () => {
      window.removeEventListener("df_reservas_updated", handleReservasUpdated);
      window.removeEventListener("storage", handleReservasUpdated);
    };
  }, []);

  // Today's day name in Spanish
  const days = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
  const todayStr = days[new Date().getDay()];

  // Fetch today's classes and metrics
  const fetchData = async () => {
    setIsLoading(true);

    // 1. Fetch Today's Classes
    let queryClases = supabase.from("clases_cuadrante").select("*").eq("dia_semana", todayStr);
    if (activeSede !== "consolidado") {
      if (activeSede === "tejar") {
        queryClases = queryClases.in("sede", ["tejar", "studio", "mostoles"]);
      } else {
        queryClases = queryClases.in("sede", ["castilla", "alcorcon"]);
      }
    }
    queryClases = queryClases.order("hora_inicio", { ascending: true });
    const { data: clasesData } = await queryClases;
    
    setClasesHoy(clasesData || []);
    if (clasesData && clasesData.length > 0 && !selectedClaseId) {
      setSelectedClaseId(clasesData[0].id);
    }

    // 2. Fetch Today's Check-ins (Asistencias)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count: realCheckinsCount } = await supabase
      .from("asistencias")
      .select("id", { count: "exact" })
      .gte("fecha_hora", startOfDay.toISOString());

    const { data: asistenciasData } = await supabase
      .from("asistencias")
      .select(`
        id,
        fecha_hora,
        alumnos (nombre_completo, plan_activo, dni),
        clases_cuadrante (nombre_clase, profesor)
      `)
      .gte("fecha_hora", startOfDay.toISOString())
      .order("fecha_hora", { ascending: false })
      .limit(10);

    setTodayCheckins(asistenciasData || []);

    // 3. Fetch Active Students Count
    let queryAlumnos = supabase.from("alumnos").select("id", { count: "exact" }).eq("estado", "Activo");
    if (activeSede !== "consolidado") {
      if (activeSede === "tejar") {
        queryAlumnos = queryAlumnos.in("sede", ["tejar", "studio", "mostoles"]);
      } else {
        queryAlumnos = queryAlumnos.in("sede", ["castilla", "alcorcon"]);
      }
    }
    const { count: alumnosCount } = await queryAlumnos;

    const checkinsCount = realCheckinsCount !== null && realCheckinsCount !== undefined ? realCheckinsCount : (asistenciasData || []).length;
    const totalCapacidad = (clasesData || []).reduce((acc: number, c: any) => acc + (c.aforo_maximo || 15), 0);
    const ocupacionPorcentaje = totalCapacidad > 0 ? Math.min(100, Math.round((checkinsCount / totalCapacidad) * 100)) : 0;

    setMetrics({
      checkinsCount,
      ocupacionPorcentaje,
      alumnosActivos: alumnosCount || 0
    });

    // 4. Fetch Open Classes (Studio 2 Paseo Castilla exclusively)
    try {
      const { data: dbOpenClasses } = await supabase
        .from("clases_cuadrante")
        .select("*")
        .in("sede", ["castilla", "alcorcon"]);

      let openList: any[] = [];
      if (dbOpenClasses && dbOpenClasses.length > 0) {
        openList = dbOpenClasses.filter((c: any) => {
          if (normalizeSede(c.sede) !== "castilla") return false;
          const nameUpper = (c.nombre_clase || "").toUpperCase();
          return c.tipo_clase === "Open Class" || nameUpper.includes("OPEN CLASS") || nameUpper.includes("FORMACI");
        });
      }

      // Merge with DEFAULT_STUDIO2_OPEN_CLASSES if any default class is missing from db
      const existingIds = new Set(openList.map(c => c.id));
      DEFAULT_STUDIO2_OPEN_CLASSES.forEach(defClass => {
        if (!existingIds.has(defClass.id)) {
          openList.push(defClass);
        }
      });

      setAllOpenClasses(openList);
    } catch (err) {
      setAllOpenClasses(DEFAULT_STUDIO2_OPEN_CLASSES);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    if (qrInputRef.current) {
      qrInputRef.current.focus();
    }
  }, [activeSede]);

  // Handle manual student search
  useEffect(() => {
    const searchStudents = async () => {
      if (manualSearch.length < 2) {
        setSearchResults([]);
        return;
      }
      
      let query = supabase
        .from("alumnos")
        .select("*")
        .or(`nombre_completo.ilike.%${manualSearch}%,dni.ilike.%${manualSearch}%`)
        .limit(5);
        
      if (activeSede !== "consolidado") {
        if (activeSede === "tejar") {
          query = query.in("sede", ["tejar", "studio", "mostoles"]);
        } else {
          query = query.in("sede", ["castilla", "alcorcon"]);
        }
      }
        
      const { data } = await query;
      setSearchResults(data || []);
    };
    
    const timeoutId = setTimeout(() => {
      searchStudents();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [manualSearch, activeSede]);

  const triggerError = (msg: string) => {
    playErrorSound();
    setFlashState('error');
    setStatusMessage({ type: 'error', text: msg });
    setTimeout(() => setFlashState(null), 1500);
  };

  const processCheckIn = async (student: any) => {
    if (!selectedClaseId) {
      triggerError('Por favor, selecciona una clase primero.');
      return;
    }

    if (student.estado !== 'Activo') {
      triggerError(`El alumno ${student.nombre_completo} está Inactivo.`);
      return;
    }

    const planLower = (student.plan_activo || "").toLowerCase();
    const isRegularOrUnlimited = 
      planLower.includes("regular") || 
      planLower.includes("mensual") || 
      planLower.includes("ilimitad") || 
      planLower.includes("cuota") ||
      student.clases_restantes === null;

    // 1. Register asistencia (No restamos clases aquí: ya se descontaron al apuntarse en la app)
    const { error: assistError } = await supabase
      .from("asistencias")
      .insert([{
        alumno_id: student.id,
        clase_id: selectedClaseId
      }]);

    if (assistError) {
      triggerError('Error al registrar la asistencia.');
      return;
    }

    // 2. Si la clase seleccionada es una Open Class, sincronizar asistencia en la reserva
    let openClassMarked = false;
    if (selectedClaseId && selectedCalendarDay) {
      openClassMarked = marcarAsistenciaPorAlumnoYSesion(student.id, selectedClaseId, selectedCalendarDay.dateISO);
    }
    if (!openClassMarked) {
      const todayNow = new Date();
      const todayISO = `${todayNow.getFullYear()}-${String(todayNow.getMonth() + 1).padStart(2, "0")}-${String(todayNow.getDate()).padStart(2, "0")}`;
      openClassMarked = marcarAsistenciaPorAlumnoEnFecha(student.id, todayISO);
    }
    if (openClassMarked) {
      window.dispatchEvent(new Event("df_reservas_updated"));
    }

    playSuccessSound();
    setFlashState('success');
    setTimeout(() => setFlashState(null), 1500);

    const remainingTextStr = isRegularOrUnlimited 
      ? 'Mensualidad Regular' 
      : `Bono (${student.clases_restantes ?? 0} clases de saldo)`;

    // Audit log
    logActivity({
      origen: "recepcion",
      tipo_evento: "checkin",
      descripcion: `Validación de acceso QR/NFC en la clase seleccionada (${remainingTextStr})`,
      usuario_afectado: student.nombre_completo,
      sede: activeSede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
    });

    setStatusMessage({ 
      type: 'success', 
      text: `✅ Entrada validada para ${student.nombre_completo}. (${remainingTextStr})` 
    });

    // Reset fields & refetch
    setManualSearch("");
    setSearchResults([]);
    setQrCode("");
    fetchData();
    
    if (qrInputRef.current) {
      qrInputRef.current.focus();
    }
  };

  const findStudentByScannedCode = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return null;

    // 1. Direct UUID match
    if (trimmed.length === 36 && (trimmed.match(/-/g) || []).length === 4) {
      const { data } = await supabase.from("alumnos").select("*").eq("id", trimmed).maybeSingle();
      if (data) return data;
    }

    // 2. Normalize Spanish keyboard scan anomalies (where '-' becomes '/' or '\'') and separators
    const normalized = trimmed.replace(/[/\\':_.]/g, '-').trim();

    // Extract core token without any DF / STUDENT / ALUMNO prefix
    const cleanToken = normalized
      .replace(/^DF-STUDENT-/i, '')
      .replace(/^DF-ALUMNO-/i, '')
      .replace(/^STUDENT-/i, '')
      .replace(/^ALUMNO-/i, '')
      .replace(/^DF-/i, '')
      .trim();

    // Extract pure alphanumeric token (e.g. "790856")
    const pureToken = trimmed.replace(/[^a-zA-Z0-9]/g, '').replace(/^(DFSTUDENT|DFALUMNO|STUDENT|ALUMNO|DF)/i, '').trim();

    // Candidate tokens to test against DB
    const candidates = Array.from(new Set([
      cleanToken,
      pureToken,
      normalized,
      trimmed,
      `DF-${cleanToken}`,
      `DF-${pureToken}`
    ])).filter(Boolean);

    for (const token of candidates) {
      // Exact nfc_token match
      const { data: byNfc } = await supabase
        .from("alumnos")
        .select("*")
        .eq("nfc_token", token)
        .limit(1)
        .maybeSingle();
      if (byNfc) return byNfc;

      // Exact DNI match
      const { data: byDni } = await supabase
        .from("alumnos")
        .select("*")
        .ilike("dni", token)
        .limit(1)
        .maybeSingle();
      if (byDni) return byDni;

      // Exact ID match (only if valid UUID to avoid PostgreSQL operator errors)
      if (token.length === 36 && (token.match(/-/g) || []).length === 4) {
        const { data: byId } = await supabase
          .from("alumnos")
          .select("*")
          .eq("id", token)
          .limit(1)
          .maybeSingle();
        if (byId) return byId;
      }
    }

    // 3. Fallback: ILIKE search on text columns (nfc_token, dni, email, telefono, nombre_completo)
    if (cleanToken && cleanToken.length >= 3) {
      const { data: byIlike } = await supabase
        .from("alumnos")
        .select("*")
        .or(`nfc_token.ilike.%${cleanToken}%,dni.ilike.%${cleanToken}%,email.ilike.%${cleanToken}%,telefono.ilike.%${cleanToken}%`)
        .limit(1)
        .maybeSingle();
      if (byIlike) return byIlike;
    }

    if (pureToken && pureToken.length >= 3 && pureToken !== cleanToken) {
      const { data: byPure } = await supabase
        .from("alumnos")
        .select("*")
        .or(`nfc_token.ilike.%${pureToken}%,dni.ilike.%${pureToken}%,email.ilike.%${pureToken}%,telefono.ilike.%${pureToken}%`)
        .limit(1)
        .maybeSingle();
      if (byPure) return byPure;
    }

    return null;
  };

  const handleQRSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawCode = qrCode.trim();
    if (!rawCode) return;

    const student = await findStudentByScannedCode(rawCode);

    if (!student) {
      triggerError(`Código QR/NFC no reconocido ("${rawCode}"). Alumno no encontrado.`);
      setQrCode("");
      return;
    }

    processCheckIn(student);
  };

  // Estado del puente sincronizado con el escáner global
  const [isBridgeConnected, setIsBridgeConnected] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("df_bridge_connected") === "true";
    }
    return false;
  });

  // Escuchar eventos globales de validación de acceso y estado del lector
  useEffect(() => {
    const handleBridgeStatus = (e: any) => {
      if (e.detail && typeof e.detail.isConnected === "boolean") {
        setIsBridgeConnected(e.detail.isConnected);
      }
    };

    const handleCheckinEvent = (e: any) => {
      const student = e.detail;
      if (student) {
        setFlashState('success');
        setTimeout(() => setFlashState(null), 1500);

        // Sincronizar asistencia en Open Class si procede
        let openClassMarked = false;
        if (selectedClaseId && selectedCalendarDay) {
          openClassMarked = marcarAsistenciaPorAlumnoYSesion(student.id, selectedClaseId, selectedCalendarDay.dateISO);
        }
        if (!openClassMarked) {
          const todayNow = new Date();
          const todayISO = `${todayNow.getFullYear()}-${String(todayNow.getMonth() + 1).padStart(2, "0")}-${String(todayNow.getDate()).padStart(2, "0")}`;
          openClassMarked = marcarAsistenciaPorAlumnoEnFecha(student.id, todayISO);
        }
        if (openClassMarked) {
          window.dispatchEvent(new Event("df_reservas_updated"));
        }

        const planLower = (student.plan_activo || "").toLowerCase();
        const isRegularOrUnlimited = 
          planLower.includes("regular") || 
          planLower.includes("mensual") || 
          planLower.includes("ilimitad") || 
          student.clases_restantes === null;
        const remainingTextStr = isRegularOrUnlimited 
          ? 'Mensualidad Regular' 
          : `Bono (${student.clases_restantes ?? 0} clases de saldo)`;
        setStatusMessage({ 
          type: 'success', 
          text: `✅ Entrada validada para ${student.nombre_completo}. (${remainingTextStr})` 
        });
        fetchData();
      }
    };

    window.addEventListener("df_bridge_status" as any, handleBridgeStatus);
    window.addEventListener("df_checkin_success" as any, handleCheckinEvent);

    return () => {
      window.removeEventListener("df_bridge_status" as any, handleBridgeStatus);
      window.removeEventListener("df_checkin_success" as any, handleCheckinEvent);
    };
  }, []);

  // Sincronizar clase seleccionada en recepción con el escáner global
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (selectedClaseId) {
        sessionStorage.setItem("df_active_reception_clase_id", selectedClaseId);
      } else {
        sessionStorage.removeItem("df_active_reception_clase_id");
      }
    }
  }, [selectedClaseId]);

  const handleCobrarBonoEnRecepcion = async (req: any) => {
    let clasesToAdd = 4;
    if (req.bono_nombre.includes("8")) clasesToAdd = 8;
    else if (req.bono_nombre.includes("10")) clasesToAdd = 10;
    else if (req.bono_nombre.toLowerCase().includes("ilimitad")) clasesToAdd = 999;
    else if (req.bono_nombre.toLowerCase().includes("suelta")) clasesToAdd = 1;
    else if (req.bono_nombre.toLowerCase().includes("formaci") || req.bono_nombre.toLowerCase().includes("especial")) clasesToAdd = 1;

    // 1. Fetch student DB record
    let studentDB = null;
    if (req.student_id) {
      const { data } = await supabase.from("alumnos").select("*").eq("id", req.student_id).single();
      studentDB = data;
    }
    if (!studentDB && req.student_email) {
      const { data } = await supabase.from("alumnos").select("*").eq("email", req.student_email).single();
      studentDB = data;
    }

    // 2. Clear pending status & add remaining classes in Supabase
    if (studentDB) {
      const currentClasses = typeof studentDB.clases_restantes === "number" ? studentDB.clases_restantes : 0;
      const cleanPlan = (req.bono_nombre || "").replace(/\s*\(\+15€\s*Matr[ií]cula\)/i, "").trim();
      const isTeacher = isTeacherProfile(studentDB) || (req.bono_nombre || "").toLowerCase().includes("docente") || (req.student_name || "").toLowerCase().includes("docente");
      const isFirstPurchase = !isTeacher && !isRegularClassStudent(studentDB) && (
        req.bono_nombre?.includes("Matrícula") || 
        req.bono_nombre?.includes("Matricula") || 
        req.is_first_bono || 
        !studentDB.matricula_pagada
      );

      const updateData: Record<string, any> = {
        plan_activo: cleanPlan || req.bono_nombre,
        clases_restantes: currentClasses + clasesToAdd
      };
      if (isFirstPurchase) {
        updateData.matricula_pagada = true;
      }

      await supabase.from("alumnos").update(updateData).eq("id", studentDB.id);
    }

    // 3. Remove from local storage & pending list
    setPendingBonoRequests(prev => {
      const updated = prev.filter(r => r.id !== req.id && r.student_id !== req.student_id);
      if (typeof window !== "undefined") {
        localStorage.setItem("pending_bono_requests", JSON.stringify(updated));
      }
      return updated;
    });

    // 4. Register payment in central financial book (reconcile existing pending transaction or create new)
    let importeNum = 45;
    if (req.bono_precio && typeof req.bono_precio === "string") {
      const cleaned = req.bono_precio.replace(/[^\d.,]/g, '').replace(',', '.');
      if (cleaned && !isNaN(parseFloat(cleaned))) {
        importeNum = parseFloat(cleaned);
      } else {
        const nameLower = (req.bono_nombre || "").toLowerCase();
        const isTeacher = isTeacherProfile(studentDB) || nameLower.includes("docente") || (req.student_name || "").toLowerCase().includes("docente");
        if (nameLower.includes("suelta") || nameLower.includes("1 clase")) importeNum = isTeacher ? 13.50 : 15.00;
        else if (nameLower.includes("formaci") || nameLower.includes("especial")) importeNum = isTeacher ? 31.50 : 35.00;
        else if (nameLower.includes("4")) importeNum = isTeacher ? 40.50 : 45.00;
        else if (nameLower.includes("8")) importeNum = isTeacher ? 51.30 : 57.00;
        else if (nameLower.includes("10")) importeNum = isTeacher ? 71.10 : 79.00;
        else if (nameLower.includes("ilimitad")) importeNum = isTeacher ? 90.00 : 100.00;
        else importeNum = isTeacher ? 40.50 : 45.00;
      }
    }

    const studentId = studentDB?.id || req.student_id;
    const reconciled = studentId ? cobrarPagoPendiente(studentId, {
      metodo_pago: "Efectivo",
      sede: activeSede === "castilla" ? "castilla" : "tejar",
      atendido_por: activeSede === "castilla" ? "Recepción Studio 2" : "Recepción Studio 1",
      importe: importeNum,
      notas: "Activación inmediata en recepción"
    }) : null;

    if (!reconciled) {
      registrarNuevoPago({
        alumno_id: studentId,
        alumno_nombre: req.student_name || "Alumno",
        alumno_dni: studentDB?.dni,
        alumno_telefono: studentDB?.telefono,
        concepto: `Bono: ${req.bono_nombre} (Adquisición Mostrador)`,
        categoria: "bono",
        importe: importeNum,
        metodo_pago: "Efectivo",
        sede: activeSede === "castilla" ? "castilla" : "tejar",
        atendido_por: activeSede === "castilla" ? "Recepción Studio 2" : "Recepción Studio 1",
        notas: "Activación inmediata en recepción"
      });
    }

    // 5. Audit log
    logActivity({
      origen: "recepcion",
      tipo_evento: "cobro_bono",
      descripcion: `Cobro en recepción y activación de ${req.bono_nombre} (${req.bono_precio})`,
      usuario_afectado: req.student_name,
      sede: activeSede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
    });

    setAppModal({
      isOpen: true,
      title: "Cobro Registrado y Bono Activado",
      message: `✓ Pago en Recepción Confirmado:\n\nSe ha cobrado el ${req.bono_nombre} (${req.bono_precio}) a ${req.student_name}.\n\nSe han cargado ${clasesToAdd} clases de forma inmediata en su Carnet Digital.`,
      type: "success",
      confirmText: "¡Excelente!"
    });

    fetchData();
  };

  // Handler to unlock locked teachers
  const handleUnlockTeacher = async (teacher?: any) => {
    try {
      // 1. Reset in Supabase
      if (teacher?.id && teacher.id !== "local_teacher") {
        await supabase
          .from("alumnos")
          .update({ estado: "Activo" })
          .eq("id", teacher.id);
      } else {
        await supabase
          .from("alumnos")
          .update({ estado: "Activo" })
          .ilike("estado", "%Bloqueado%");
      }

      // 2. Reset in localStorage for student-app sync
      if (typeof window !== "undefined") {
        localStorage.removeItem("df_sec_lockout_profesor");
        const teacherIdRaw = (teacher?.id || "").replace("docente_", "");
        if (teacherIdRaw) {
          localStorage.removeItem(`df_sec_lockout_teacher_${teacherIdRaw}`);
        }
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("df_sec_lockout_teacher_")) {
            localStorage.removeItem(key);
          }
        }
        window.dispatchEvent(new Event("df_security_lock_updated"));
      }

      logActivity({
        origen: "recepcion",
        tipo_evento: "seguridad_desbloqueo",
        descripcion: `🔓 DESBLOQUEO DOCENTE: Recepción ha restablecido con éxito el acceso docente (${teacher?.nombre_completo || "Claustro"}).`,
        usuario_afectado: teacher?.nombre_completo || "Claustro Docente",
        sede: activeSede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
      });

      setAppModal({
        isOpen: true,
        title: "Acceso Docente Desbloqueado",
        message: `✓ Acceso Reestablecido con Éxito:\n\nSe ha desbloqueado el terminal para ${teacher?.nombre_completo || "el profesor"}.\n\nYa puede introducir de nuevo su PIN de 4 dígitos en el teclado circular con 3 nuevos intentos.`,
        type: "success",
        confirmText: "Entendido"
      });

      setLockedTeachers([]);
    } catch (err) {
      console.error("Error unlocking teacher:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* TopHeader */}
      <TopHeader 
        title="Dashboard & Recepción" 
        subtitle="Control de accesos en tiempo real, validación QR/NFC y estado de ocupación" 
      />

      {/* ========================================================================= */}
      {/* CENTRO DE TAREAS PENDIENTES DE RECEPCIÓN & ADMINISTRACIÓN (PROMINENTE)   */}
      {/* ========================================================================= */}
      <div className={`p-5 sm:p-6 rounded-2xl border-2 transition-all shadow-2xl ${
        totalTareasPendientes > 0
          ? "bg-gradient-to-br from-amber-950/40 via-[var(--color-bg-card)] to-[var(--color-bg-card)] border-amber-500/50 shadow-amber-950/20"
          : "bg-[var(--color-bg-card)] border-[var(--color-border)]"
      }`}>
        
        {/* Cabecera del Centro de Tareas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              totalTareasPendientes > 0
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-lg shadow-amber-500/20 animate-pulse"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}>
              {totalTareasPendientes > 0 ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-extrabold font-[family-name:var(--font-heading)] text-[var(--color-text-title)] tracking-tight">
                  Centro de Tareas Pendientes
                </h2>
                <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                  totalTareasPendientes > 0
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-bounce"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                }`}>
                  {totalTareasPendientes > 0 ? `${totalTareasPendientes} ${totalTareasPendientes === 1 ? 'tarea urgente' : 'tareas urgentes'}` : "0 pendientes"}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Acciones prioritarias: Validación de transferencias bancarias, cobros presenciales y desbloqueos de seguridad.
              </p>
            </div>
          </div>

          {/* Filtros de Tareas */}
          {totalTareasPendientes > 0 && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] self-start sm:self-auto text-xs">
              <button
                type="button"
                onClick={() => setTareaFiltro("todas")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  tareaFiltro === "todas"
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-white"
                }`}
              >
                Todas ({totalTareasPendientes})
              </button>
              {lockedTeachers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTareaFiltro("seguridad")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    tareaFiltro === "seguridad"
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-red-400 hover:text-red-300"
                  }`}
                >
                  Seguridad ({lockedTeachers.length})
                </button>
              )}
              {pendingBonoRequests.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTareaFiltro("pagos")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    tareaFiltro === "pagos"
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "text-amber-400 hover:text-amber-300"
                  }`}
                >
                  Cobros & Transferencias ({pendingBonoRequests.length})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Lista de Tareas o Estado Vacío */}
        <div className="pt-4">
          {totalTareasPendientes === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-sm font-bold text-white">¡Todo al día en Recepción y Administración!</h4>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-md">
                No hay transferencias pendientes de conciliar, ni cobros en espera ni terminales docentes bloqueados. El sistema está 100% sincronizado.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              
              {/* Tareas de Seguridad: Desbloqueo Docente */}
              {(tareaFiltro === "todas" || tareaFiltro === "seguridad") && lockedTeachers.map((t) => (
                <div 
                  key={t.id}
                  className="p-3 rounded-xl bg-red-950/40 border border-red-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-red-400 transition-all animate-in fade-in group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-xs font-bold text-white group-hover:text-red-300 transition-colors truncate">
                          {t.nombre_completo}
                        </strong>
                        <span className="text-[9.5px] font-mono font-bold text-red-300 bg-red-500/20 px-2 py-0.5 rounded border border-red-500/30">
                          Bloqueo PIN (3 Fallos)
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {t.sede === "tejar" ? "Studio 1 El Tejar" : "Studio 2 Paseo Castilla"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        Email: {t.email} • Requiere desbloqueo presencial
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end shrink-0 pt-1 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => handleUnlockTeacher(t)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🔓 Desbloquear</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Tareas de Pagos: Transferencias y Cobros en Recepción */}
              {(tareaFiltro === "todas" || tareaFiltro === "pagos") && pendingBonoRequests.map((req) => {
                const isTransfer = req.metodo_pago === "Transferencia Bancaria" || (req.bono_precio && req.bono_precio.includes("Transferencia"));

                return (
                  <div
                    key={req.id}
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all animate-in fade-in group ${
                      isTransfer 
                        ? "bg-blue-950/30 border-blue-500/40 hover:border-blue-400" 
                        : "bg-amber-950/30 border-amber-500/40 hover:border-amber-400"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold border ${
                        isTransfer
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      }`}>
                        {isTransfer ? "🏦" : "🏢"}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-xs font-bold text-white group-hover:text-amber-200 transition-colors truncate">
                            {req.student_name}
                          </strong>
                          <span className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded border ${
                            isTransfer
                              ? "text-blue-300 bg-blue-500/20 border-blue-500/30"
                              : "text-amber-300 bg-amber-500/20 border-amber-500/30"
                          }`}>
                            {req.bono_nombre} ({req.bono_precio})
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {isTransfer ? "Santander / Caixa" : "Caja / TPV"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          Email: {req.student_email} • Solicitado: {req.fecha}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end shrink-0 pt-1 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleCobrarBonoEnRecepcion(req)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                          isTransfer
                            ? "bg-blue-400 hover:bg-blue-300 text-slate-950 shadow-blue-400/20"
                            : "bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/20"
                        }`}
                      >
                        {isTransfer ? "✓ Validar y Activar" : "💳 Cobrar y Activar"}
                      </button>
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </div>

      </div>

      {/* Tarjetas KPI Superiores (Resumen Dashboard) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">Check-ins de Hoy</span>
            <h3 className="text-2xl font-bold font-mono text-[var(--color-text-title)] mt-1">{metrics.checkinsCount}</h3>
            <span className="text-[10px] text-[var(--color-success)] font-semibold mt-0.5 inline-block">Validaciones en tiempo real</span>
          </div>
          <div className="p-2.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-xl border border-[var(--color-primary)]/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">Ocupación Media</span>
            <h3 className="text-2xl font-bold font-mono text-cyan-400 mt-1">{metrics.ocupacionPorcentaje}%</h3>
            <span className="text-[10px] text-[var(--color-secondary)] font-semibold mt-0.5 inline-block">Ratios del cuadrante de hoy</span>
          </div>
          <div className="p-2.5 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] rounded-xl border border-[var(--color-secondary)]/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">Alumnos Activos</span>
            <h3 className="text-2xl font-bold font-mono text-amber-400 mt-1">{metrics.alumnosActivos}</h3>
            <span className="text-[10px] text-[var(--color-text-secondary)] mt-0.5 inline-block">Matriculados en la sede activa</span>
          </div>
          <div className="p-2.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-xl border border-[var(--color-accent)]/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>

      </div>

      {/* Grid Principal: Clases de Hoy (Izq) vs. Escáner + Check-ins (Der) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Columna Izquierda: Clases de Hoy vs Open Classes por Fecha */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 sm:p-6 shadow-lg">
            
            {/* Pestañas de Navegación: Cuadrante Hoy vs Open Classes Calendario */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setClasesTab("regulares");
                  if (clasesHoy.length > 0) setSelectedClaseId(clasesHoy[0].id);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer text-center ${
                  clasesTab === "regulares"
                    ? "bg-[var(--color-primary)] text-white shadow-sm font-bold"
                    : "text-[var(--color-text-secondary)] hover:text-white"
                }`}
              >
                Cuadrante Hoy ({todayStr})
              </button>
              <button
                type="button"
                onClick={() => {
                  setClasesTab("openclass");
                  if (openClassesForSelectedDay.length > 0) {
                    setSelectedClaseId(openClassesForSelectedDay[0].id);
                  }
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                  clasesTab === "openclass"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm font-bold"
                    : "text-cyan-400 hover:text-cyan-300"
                }`}
              >
                <span>🌟 Open Classes</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                  Calendario
                </span>
              </button>
            </div>

            {/* ============================================================= */}
            {/* VISTA 1: CLASES REGULARES DE HOY                             */}
            {/* ============================================================= */}
            {clasesTab === "regulares" && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold font-[family-name:var(--font-heading)] text-[var(--color-text-title)] flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Clases de Hoy ({todayStr})
                  </h3>
                  <span className="text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2.5 py-0.5 rounded-full border border-[var(--color-primary)]/20">
                    {clasesHoy.length} clases
                  </span>
                </div>
                
                {clasesHoy.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)] py-4 text-center">No hay clases programadas para hoy en esta sede.</p>
                ) : (
                  <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
                    {clasesHoy.map((clase) => (
                      <div 
                        key={clase.id}
                        onClick={() => setSelectedClaseId(clase.id)}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedClaseId === clase.id 
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 shadow-md' 
                            : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]/50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-sm text-[var(--color-text-title)]">{clase.nombre_clase}</span>
                          <span className="text-xs font-mono font-bold text-[var(--color-secondary)]">
                            {clase.hora_inicio}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] flex justify-between mt-1">
                          <span>Prof: {clase.profesor}</span>
                          <span>Aforo: {clase.aforo_maximo} alumnos</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ============================================================= */}
            {/* VISTA 2: OPEN CLASSES POR FECHA DE CALENDARIO (REQUERIMIENTO R1) */}
            {/* ============================================================= */}
            {clasesTab === "openclass" && (
              <div className="space-y-4">
                {/* Cabecera de Open Classes */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-extrabold font-[family-name:var(--font-heading)] text-white flex items-center gap-1.5">
                      <Sparkles size={16} className="text-cyan-400" />
                      Open Classes por Fecha
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Studio 2 Paseo Castilla • Aforo y reservas nominales
                    </p>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    {openClassesForSelectedDay.length} sesiones
                  </span>
                </div>

                {/* Selector Dinámico de Fechas de Calendario (R1) */}
                <div className="space-y-2 p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1">
                      <Calendar size={13} className="text-cyan-400" />
                      Fecha de Calendario:
                    </span>
                    <input
                      type="date"
                      value={selectedCalendarDay.dateISO}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedCalendarDay(createCalendarDayFromISO(e.target.value));
                        }
                      }}
                      className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-[11px] text-cyan-300 font-mono outline-none focus:border-cyan-400 cursor-pointer"
                    />
                  </div>

                  {/* Carrusel de fechas de calendario próximas */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-1 scrollbar-thin">
                    {calendarDays.map((day) => {
                      const isSelected = selectedCalendarDay.dateISO === day.dateISO;
                      return (
                        <button
                          key={day.dateISO}
                          type="button"
                          onClick={() => setSelectedCalendarDay(day)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex flex-col items-center min-w-[58px] border ${
                            isSelected
                              ? "bg-gradient-to-b from-cyan-500 to-blue-600 text-white border-cyan-300 shadow-md shadow-cyan-500/25 scale-105"
                              : "bg-[var(--color-bg-card)] text-slate-300 border-[var(--color-border)] hover:border-cyan-500/50 hover:text-white"
                          }`}
                        >
                          <span className="text-[9px] uppercase font-mono opacity-80">
                            {day.isToday ? "Hoy" : day.isTomorrow ? "Mañana" : day.dayShort}
                          </span>
                          <span className="text-sm font-black">{day.dayNumber}</span>
                          <span className="text-[9px] uppercase font-mono opacity-80">{day.monthShort}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Resumen de la fecha seleccionada */}
                  <div className="text-center pt-1 border-t border-[var(--color-border)]/60">
                    <span className="text-xs font-extrabold text-cyan-300">
                      📅 {formatFullCalendarDate(selectedCalendarDay)}
                    </span>
                  </div>
                </div>

                {/* Lista de Open Classes de la fecha seleccionada */}
                <div className="space-y-3 max-h-[62vh] overflow-y-auto pr-1">
                  {openClassesForSelectedDay.length === 0 ? (
                    <div className="py-8 px-4 text-center bg-[var(--color-bg)]/60 rounded-xl border border-dashed border-[var(--color-border)] space-y-2">
                      <p className="text-xs font-semibold text-slate-300">
                        No hay Open Classes programadas para los {selectedCalendarDay.dayName.toLowerCase()}s en Studio 2.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Selecciona un Lunes, Martes, Miércoles, Jueves, Viernes o Sábado para ver las sesiones disponibles.
                      </p>
                    </div>
                  ) : (
                    openClassesForSelectedDay.map((clase) => {
                      const reservasCount = getSesionReservasCount(clase.id, selectedCalendarDay.dateISO);
                      const maxCapacity = clase.aforo_maximo || 20;
                      const formattedDate = formatFullCalendarDate(selectedCalendarDay);
                      const isFull = reservasCount >= maxCapacity;
                      const isSelected = selectedClaseId === clase.id;
                      const pct = Math.min(100, Math.round((reservasCount / maxCapacity) * 100));

                      return (
                        <div
                          key={clase.id}
                          onClick={() => {
                            setAsistentesModalState({
                              isOpen: true,
                              clase,
                              calendarDay: selectedCalendarDay
                            });
                          }}
                          className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                            isSelected
                              ? "border-cyan-400 bg-cyan-950/25 shadow-lg shadow-cyan-950/30"
                              : "border-[var(--color-border)] bg-[var(--color-bg)] hover:border-cyan-500/50"
                          }`}
                        >
                          {/* Cabecera de la Clase */}
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <div className="min-w-0">
                              <span className="text-[9.5px] font-mono font-bold text-cyan-400 uppercase tracking-wider block truncate">
                                Studio 2 Paseo Castilla • {clase.sala || "Sala 1"}
                              </span>
                              <h4 className="font-bold text-xs sm:text-sm text-white mt-0.5 truncate">
                                {clase.nombre_clase}
                              </h4>
                            </div>
                            <span className="text-xs font-mono font-bold text-cyan-300 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                              {clase.hora_inicio} - {clase.hora_fin}
                            </span>
                          </div>

                          {/* Docente */}
                          <div className="text-xs text-slate-400 flex items-center justify-between mb-2">
                            <span>Prof: <strong className="text-slate-200">{clase.profesor}</strong></span>
                            <span className="text-[10.5px] text-slate-400">{clase.tipo_clase || "Open Class"}</span>
                          </div>

                          {/* Tarjeta de Fecha Específica Consultada (Acceptance Criteria R1) */}
                          <div className="p-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] mb-2.5 flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">Fecha consultada:</span>
                            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1">
                              <Calendar size={12} className="text-cyan-400" />
                              {formattedDate}
                            </span>
                          </div>

                          {/* Contador Exacto de Plazas y Aforo (Acceptance Criteria R1) */}
                          <div className="space-y-1 mb-3">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-200 text-[11px]">
                                {reservasCount} / {maxCapacity} Reservas para el {formattedDate}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isFull 
                                  ? "bg-red-500/20 text-red-300 border border-red-500/30" 
                                  : reservasCount === 0
                                  ? "bg-cyan-950/60 text-cyan-300 border border-cyan-500/30"
                                  : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              }`}>
                                {isFull ? "Aforo Completo" : reservasCount === 0 ? "0 reservas para este día" : `${maxCapacity - reservasCount} libres`}
                              </span>
                            </div>
                            {/* Barra de Ocupación */}
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isFull ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-cyan-400"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          {/* Botones de Acción (Acceptance Criteria R2) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[var(--color-border)]/60">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAsistentesModalState({
                                  isOpen: true,
                                  clase,
                                  calendarDay: selectedCalendarDay
                                });
                              }}
                              className="py-1.5 px-2.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Users size={13} />
                              <span>{reservasCount === 0 ? "0 reservas para este día" : `Ver Alumnos Apuntados (${reservasCount})`}</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClaseId(clase.id);
                                setStatusMessage({
                                  type: "success",
                                  text: `Clase "${clase.nombre_clase}" seleccionada para el lector de accesos QR/NFC.`
                                });
                              }}
                              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                isSelected
                                  ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20"
                                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                              }`}
                            >
                              {isSelected ? "✓ Activa para Escáner" : "Seleccionar para Escáner"}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Columna Derecha: Escáner QR/NFC, Búsqueda Manual & Fichajes Recientes */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Mensajes de Estado */}
          {statusMessage && (
            <div className={`p-4 rounded-xl border transition-all ${
              statusMessage.type === 'success' 
                ? 'bg-[var(--color-success)]/15 border-[var(--color-success)] text-[var(--color-success)] shadow-lg shadow-[var(--color-success)]/10' 
                : 'bg-[var(--color-danger)]/15 border-[var(--color-danger)] text-[var(--color-danger)] shadow-lg shadow-[var(--color-danger)]/10'
            }`}>
              <p className="font-semibold text-center text-lg">{statusMessage.text}</p>
            </div>
          )}

          {/* Lector QR/NFC con Animación de Destello y Sonido */}
          <div className={`bg-gradient-to-br from-[var(--color-bg-card)] to-[var(--color-bg)] border-2 rounded-xl p-6 shadow-xl text-center relative overflow-hidden transition-all duration-300 ${
            flashState === 'success' ? 'border-[var(--color-success)] ring-4 ring-[var(--color-success)]/30' :
            flashState === 'error' ? 'border-[var(--color-danger)] ring-4 ring-[var(--color-danger)]/30' :
            'border-[var(--color-border)]'
          }`}>
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--color-primary)]/10 rounded-full blur-2xl"></div>
            
            <h2 className="text-xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)] mb-1">Escáner de Recepción</h2>
            <p className="text-[var(--color-text-secondary)] text-xs mb-4">Pasa el código QR o llavero NFC del alumno por el lector</p>
            
            <form onSubmit={handleQRSubmit} className="max-w-sm mx-auto">
              <input 
                ref={qrInputRef}
                type="text"
                value={qrCode}
                onChange={(e) => {
                  const val = e.target.value;
                  setQrCode(val);
                  if (val.includes('\n') || val.includes('\r')) {
                    const cleanVal = val.replace(/[\r\n]/g, '').trim();
                    setQrCode(cleanVal);
                    if (cleanVal) {
                      findStudentByScannedCode(cleanVal).then(student => {
                        if (student) {
                          processCheckIn(student);
                        } else {
                          triggerError(`Código QR/NFC no reconocido ("${cleanVal}"). Alumno no encontrado.`);
                          setQrCode("");
                        }
                      });
                    }
                  }
                }}
                placeholder="Esperando lectura QR/NFC..."
                className="w-full text-center text-lg font-mono tracking-widest bg-[var(--color-bg)] border-2 border-[var(--color-primary)]/50 text-[var(--color-text-title)] rounded-xl px-4 py-3 outline-none focus:border-[var(--color-primary)] focus:shadow-[0_0_20px_rgba(29,78,216,0.3)] transition-all"
                autoFocus
              />
              <button type="submit" className="hidden">Procesar</button>
            </form>
            
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${isBridgeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                <span className={isBridgeConnected ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                  {isBridgeConnected ? 'Lector OBZ RF-70 Conectado (ws://localhost:8080)' : 'Modo Teclado USB / Buscando Lector'}
                </span>
              </div>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <div className="flex items-center gap-1.5 text-[var(--color-success)]">
                <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-ping"></span>
                Audio & Pantalla Activos
              </div>
            </div>
          </div>

          {/* Búsqueda Manual */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-lg">
            <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Búsqueda rápida por nombre o DNI</h3>
            
            <div className="relative">
              <input 
                type="text"
                value={manualSearch}
                onChange={(e) => setManualSearch(e.target.value)}
                placeholder="Escribe el nombre o DNI del alumno..."
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] transition-colors"
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 absolute left-3 top-2.5 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-3 border border-[var(--color-border)] rounded-lg overflow-hidden divide-y divide-[var(--color-border)] bg-[var(--color-bg)]">
                {searchResults.map((student) => {
                  const planLower = (student.plan_activo || "").toLowerCase();
                  const isRegular = planLower.includes("regular") || planLower.includes("mensual") || planLower.includes("ilimitad") || student.clases_restantes === null;

                  return (
                    <div key={student.id} className="flex items-center justify-between p-3 hover:bg-[var(--color-bg-hover)] transition-colors">
                      <div>
                        <p className="font-semibold text-sm text-[var(--color-text-title)]">{student.nombre_completo}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {student.plan_activo} • DNI: {student.dni || 'S/N'} • {isRegular ? 'Mensualidad Activa' : `Saldo: ${student.clases_restantes} clases`}
                        </p>
                      </div>
                      <button 
                        onClick={() => processCheckIn(student)}
                        className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                      >
                        Check-in
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fichajes Recientes de Hoy (Consolidado Dashboard) */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-title)] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Últimas Entradas Registradas Hoy</span>
                </h3>
                <span className="text-[11px] font-normal text-[var(--color-text-secondary)]">
                  Registro en tiempo real ({todayCheckins.length} accesos hoy)
                </span>
              </div>
              <button
                onClick={() => setIsHistoricoModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-secondary)] border border-[var(--color-secondary)]/30 text-xs font-bold transition-all self-start sm:self-auto cursor-pointer shadow-sm active:scale-95"
                title="Abrir histórico detallado y control de accesos diarios"
              >
                <span>📅</span>
                <span>Ver Histórico de Entradas</span>
                <span>→</span>
              </button>
            </div>

            {todayCheckins.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-xs text-[var(--color-text-secondary)]">Aún no se han registrado entradas hoy.</p>
                <button
                  onClick={() => setIsHistoricoModalOpen(true)}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline transition-colors cursor-pointer"
                >
                  Consultar histórico de días anteriores →
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {todayCheckins.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-xs">
                    <div>
                      <span className="font-semibold text-[var(--color-text-title)] block">
                        {item.alumnos?.nombre_completo || "Alumno"}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-secondary)]">
                        {item.clases_cuadrante?.nombre_clase || "Clase"} • {item.alumnos?.plan_activo || "Bono"}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] bg-[var(--color-success)]/10 text-[var(--color-success)] px-2 py-1 rounded-md border border-[var(--color-success)]/20 font-semibold">
                      {new Date(item.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Pop-up Modal In-App Component */}
      <AppModal modal={appModal} onClose={() => setAppModal({ ...appModal, isOpen: false })} />

      {/* Modal Histórico Completo de Entradas y Control Diario */}
      <HistoricoEntradasModal
        isOpen={isHistoricoModalOpen}
        onClose={() => setIsHistoricoModalOpen(false)}
      />

      {/* Modal Desglose Nominal de Alumnos y Asistencia por Sesión Open Class (R2) */}
      <OpenClassAsistentesModal
        isOpen={asistentesModalState.isOpen}
        onClose={() => setAsistentesModalState({ ...asistentesModalState, isOpen: false })}
        clase={asistentesModalState.clase}
        calendarDay={asistentesModalState.calendarDay}
        onReservationChanged={() => {
          setReservasTick(prev => prev + 1);
          fetchData();
        }}
      />
    </div>
  );
}
