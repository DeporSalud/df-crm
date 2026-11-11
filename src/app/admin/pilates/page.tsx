"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  Lock,
  Unlock,
  Sparkles,
  Users,
  CalendarCheck2,
  CheckCircle2,
  Wallet,
  Search,
  Plus,
  QrCode,
  Download,
  Upload,
  FileSpreadsheet,
  CreditCard,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Bell,
  MonitorSmartphone,
  ShieldCheck,
  AlertCircle,
  Camera,
  X,
  Play,
  RefreshCw,
  Clock,
  History,
  LogOut,
} from "lucide-react";
import { isRealtimeSyncConnected, subscribeSyncEvent } from "@/lib/syncEventBus";
import {
  PILATES_PLAN_PRESETS,
  PILATES_SESSION_DURATION_MINUTES,
  PilatesActiveRoomSession,
  PilatesAttendance,
  PilatesImportPreview,
  PilatesMetodoPago,
  PilatesPayment,
  PilatesPlanType,
  PilatesSecurityConfig,
  PilatesStudent,
  compressPilatesPhoto,
  deletePilatesPayment,
  deletePilatesStudent,
  downloadPilatesCsvTemplate,
  exportPilatesAttendancesCsv,
  exportPilatesPaymentsCsv,
  finalizarSesionSalaPilates,
  getCurrentYearMonth,
  getDesktopNotificationPermission,
  getPilatesActiveRoomSessions,
  getPilatesAttendances,
  getPilatesDashboardKpis,
  getPilatesInitials,
  getPilatesPayments,
  getPilatesSecurityConfig,
  getPilatesStudents,
  getTodayISO,
  importPilatesStudentsBatch,
  initPilatesCrossPcSync,
  isPilatesSessionUnlocked,
  lockPilatesSession,
  parsePilatesImportFile,
  processPilatesScan,
  registrarCobroPilates,
  requestPilatesDesktopNotifications,
  savePilatesSecurityConfig,
  savePilatesStudent,
  syncPilatesFromCloudIfEnabled,
  updatePilatesMasterPin,
  verifyPilatesPin,
} from "@/lib/pilatesService";

type PilatesSubTab = "alumnos" | "historial" | "facturacion" | "importar" | "recepcion";
type StudentFilter = "activos" | "bajas" | "all" | "bonos" | "pendientes";
type HistoryDateFilter = "hoy" | "ayer" | "7dias" | "todas" | "fecha";

const BILLING_MONTHS = [
  { value: "2026-09", label: "Septiembre 2026" },
  { value: "2026-10", label: "Octubre 2026" },
  { value: "2026-11", label: "Noviembre 2026" },
  { value: "2026-12", label: "Diciembre 2026" },
  { value: "2027-01", label: "Enero 2027" },
  { value: "2027-02", label: "Febrero 2027" },
  { value: "2027-03", label: "Marzo 2027" },
  { value: "2027-04", label: "Abril 2027" },
  { value: "2027-05", label: "Mayo 2027" },
  { value: "2027-06", label: "Junio 2027" },
];

export default function SoloPilatesPage() {
  // --- Security / Lock State ---
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCheckingLock, setIsCheckingLock] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [showPinText, setShowPinText] = useState(false);
  const [pinError, setPinError] = useState("");

  // --- Navigation & Data State ---
  const [activeTab, setActiveTab] = useState<PilatesSubTab>("alumnos");
  const [students, setStudents] = useState<PilatesStudent[]>([]);
  const [payments, setPayments] = useState<PilatesPayment[]>([]);
  const [attendances, setAttendances] = useState<PilatesAttendance[]>([]);
  const [securityCfg, setSecurityCfg] = useState<PilatesSecurityConfig>(() =>
    getPilatesSecurityConfig()
  );
  const [realtimeOnline, setRealtimeOnline] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: "success" | "amber";
    text: string;
  } | null>(null);

  // --- Filters ---
  const [searchQuery, setSearchQuery] = useState("");
  const [studentFilter, setStudentFilter] = useState<StudentFilter>("activos");
  const [visibleLimit, setVisibleLimit] = useState<number>(60);
  const [showTarifarioCard, setShowTarifarioCard] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [historyDateFilter, setHistoryDateFilter] = useState<HistoryDateFilter>("hoy");
  const [historyCustomDate, setHistoryCustomDate] = useState<string>(() => getTodayISO());
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");
  const [selectedBillingMonth, setSelectedBillingMonth] = useState<string>(() => {
    const cur = getCurrentYearMonth();
    return BILLING_MONTHS.some((m) => m.value === cur) ? cur : "2026-11";
  });

  // --- Native <dialog> Refs & Accessible Heading IDs ---
  const studentDialogRef = useRef<HTMLDialogElement | null>(null);
  const studentDialogTitleId = useId();

  const qrDialogRef = useRef<HTMLDialogElement | null>(null);
  const qrDialogTitleId = useId();
  const qrCanvasWrapperRef = useRef<HTMLDivElement | null>(null);

  const cobroDialogRef = useRef<HTMLDialogElement | null>(null);
  const cobroDialogTitleId = useId();

  const deleteDialogRef = useRef<HTMLDialogElement | null>(null);
  const deleteDialogTitleId = useId();

  // --- Student Form State ---
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formApellidos, setFormApellidos] = useState("");
  const [formDni, setFormDni] = useState("");
  const [formTelefono, setFormTelefono] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formFotoUrl, setFormFotoUrl] = useState("");
  const [formPlan, setFormPlan] = useState<PilatesPlanType>("Suelo · 8 Clases (Mañana)");
  const [formImporte, setFormImporte] = useState<string>("48");
  const [formSesiones, setFormSesiones] = useState<string>("8");
  const [formMetodoPago, setFormMetodoPago] = useState<PilatesMetodoPago>("TPV");
  const [formIban, setFormIban] = useState("");
  const [formEstado, setFormEstado] = useState<"Activo" | "Baja">("Activo");
  const [formEstadoCuota, setFormEstadoCuota] = useState<"Al día" | "Renovación Pendiente">("Al día");
  const [formCodigoQr, setFormCodigoQr] = useState("");
  const [formNotasSalud, setFormNotasSalud] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);

  // --- QR Modal Target ---
  const [qrStudent, setQrStudent] = useState<PilatesStudent | null>(null);

  // --- Cobro / Renewal Form State ---
  const [cobroStudentId, setCobroStudentId] = useState("");
  const [cobroPlan, setCobroPlan] = useState<PilatesPlanType>("Suelo · 8 Clases (Mañana)");
  const [cobroImporte, setCobroImporte] = useState("48");
  const [cobroMetodo, setCobroMetodo] = useState<PilatesMetodoPago>("TPV");
  const [cobroPeriodo, setCobroPeriodo] = useState<string>(() => getCurrentYearMonth());
  const [cobroSesionesExtra, setCobroSesionesExtra] = useState("8");
  const [cobroNotas, setCobroNotas] = useState("");

  // --- Delete Confirmation Target ---
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "student" | "payment";
    id: string;
    label: string;
  } | null>(null);

  // --- CSV / Excel Importer State ---
  const [importPreview, setImportPreview] = useState<PilatesImportPreview | null>(null);
  const [importMode, setImportMode] = useState<"skip_duplicates" | "upsert">("skip_duplicates");
  const [importError, setImportError] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // --- Security Config Form State ---
  const [pcAliasInput, setPcAliasInput] = useState("");
  const [currentPinForChange, setCurrentPinForChange] = useState("");
  const [newPinForChange, setNewPinForChange] = useState("");
  const [pinChangeMsg, setPinChangeMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const showBanner = useCallback((text: string, tone: "success" | "amber" = "success") => {
    setFeedbackBanner({ tone, text });
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev?.text === text ? null : prev));
    }, 5500);
  }, []);

  const refreshAllPilatesData = useCallback(() => {
    setStudents(getPilatesStudents());
    setPayments(getPilatesPayments());
    setAttendances(getPilatesAttendances());
    const cfg = getPilatesSecurityConfig();
    setSecurityCfg(cfg);
    setPcAliasInput((prev) => prev || cfg.pcAlias);
    setRealtimeOnline(isRealtimeSyncConnected());
    setNotifPermission(getDesktopNotificationPermission());
  }, []);

  useEffect(() => {
    initPilatesCrossPcSync();
    setIsUnlocked(isPilatesSessionUnlocked());
    setIsCheckingLock(false);
    refreshAllPilatesData();

    syncPilatesFromCloudIfEnabled().then(() => {
      refreshAllPilatesData();
    });

    const unsubUpdates = subscribeSyncEvent(
      ["df_pilates_updated", "df_pilates_checkin"],
      () => {
        refreshAllPilatesData();
      }
    );

    const handleRealtimeStatus = (e: any) => {
      const connected = Boolean(e?.detail?.connected);
      setRealtimeOnline(connected);
    };
    const handleLockChange = () => {
      setIsUnlocked(isPilatesSessionUnlocked());
    };

    window.addEventListener("df_realtime_status" as any, handleRealtimeStatus);
    window.addEventListener("df_pilates_lock_changed" as any, handleLockChange);

    const statusPoll = setInterval(() => {
      setRealtimeOnline(isRealtimeSyncConnected());
    }, 2500);

    // Reloj en vivo cada 1 segundo para la cuenta atrás de 50 minutos y salida automática de sala
    const roomTimer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      unsubUpdates();
      window.removeEventListener("df_realtime_status" as any, handleRealtimeStatus);
      window.removeEventListener("df_pilates_lock_changed" as any, handleLockChange);
      clearInterval(statusPoll);
      clearInterval(roomTimer);
    };
  }, [refreshAllPilatesData]);

  // --- Sesiones Activas en Sala Ahora (50 minutos exactos desde entrada QR / manual) ---
  const activeRoomSessions: PilatesActiveRoomSession[] = useMemo(
    () => getPilatesActiveRoomSessions(nowMs),
    [attendances, students, nowMs]
  );

  const activeRoomByStudentId = useMemo(() => {
    const map = new Map<string, PilatesActiveRoomSession>();
    for (const sess of activeRoomSessions) {
      map.set(sess.attendance.alumno_id, sess);
    }
    return map;
  }, [activeRoomSessions]);

  // --- Derived Metrics & Filtered Lists ---
  const kpis = useMemo(
    () =>
      getPilatesDashboardKpis(
        selectedBillingMonth === "all" ? getCurrentYearMonth() : selectedBillingMonth,
        nowMs
      ),
    [students, attendances, payments, selectedBillingMonth, nowMs]
  );

  const filteredHistoryAttendances = useMemo(() => {
    const todayIso = getTodayISO();
    const yesterdayDate = new Date(nowMs - 24 * 60 * 60 * 1000);
    const yesterdayIso = `${yesterdayDate.getFullYear()}-${String(
      yesterdayDate.getMonth() + 1
    ).padStart(2, "0")}-${String(yesterdayDate.getDate()).padStart(2, "0")}`;
    const sevenDaysAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    const q = historySearchQuery.trim().toLowerCase();

    return attendances.filter((a) => {
      if (historyDateFilter === "hoy" && a.fecha_iso !== todayIso) return false;
      if (historyDateFilter === "ayer" && a.fecha_iso !== yesterdayIso) return false;
      if (historyDateFilter === "fecha" && historyCustomDate && a.fecha_iso !== historyCustomDate) {
        return false;
      }
      if (historyDateFilter === "7dias") {
        const t = new Date(a.fecha_hora).getTime();
        if (isNaN(t) || t < sevenDaysAgoMs) return false;
      }
      if (!q) return true;
      return (
        a.alumno_nombre.toLowerCase().includes(q) ||
        a.codigo_qr.toLowerCase().includes(q) ||
        a.tipo_plan.toLowerCase().includes(q) ||
        a.fecha_iso.includes(q)
      );
    });
  }, [attendances, historyDateFilter, historyCustomDate, historySearchQuery, nowMs]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (studentFilter === "activos" && s.estado === "Baja") return false;
      if (studentFilter === "bonos" && (!s.es_bono || s.estado === "Baja")) return false;
      if (
        studentFilter === "pendientes" &&
        !(
          s.estado === "Activo" &&
          (s.estado_cuota === "Renovación Pendiente" ||
            (s.es_bono && (s.sesiones_restantes ?? 0) <= 0))
        )
      ) {
        return false;
      }
      if (studentFilter === "bajas" && s.estado !== "Baja") return false;

      if (!q) return true;
      return (
        s.nombre_completo.toLowerCase().includes(q) ||
        s.dni.toLowerCase().includes(q) ||
        s.telefono.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.codigo_qr.toLowerCase().includes(q) ||
        (s.num_socio || "").toLowerCase().includes(q) ||
        (s.notas_salud || "").toLowerCase().includes(q)
      );
    });
  }, [students, searchQuery, studentFilter]);

  const visibleStudents = useMemo(
    () => filteredStudents.slice(0, visibleLimit),
    [filteredStudents, visibleLimit]
  );

  const bajasCount = useMemo(
    () => students.filter((s) => s.estado === "Baja").length,
    [students]
  );

  const filteredPayments = useMemo(() => {
    if (selectedBillingMonth === "all") return payments;
    return payments.filter((p) => p.periodo_mes === selectedBillingMonth);
  }, [payments, selectedBillingMonth]);

  const billingSummaryByMethod = useMemo(() => {
    const totals: Record<PilatesMetodoPago, number> = {
      Efectivo: 0,
      TPV: 0,
      Transferencia: 0,
      SEPA: 0,
    };
    let grandTotal = 0;
    for (const p of filteredPayments) {
      const amt = Number(p.importe) || 0;
      totals[p.metodo_pago] = (totals[p.metodo_pago] || 0) + amt;
      grandTotal += amt;
    }
    return { totals, grandTotal };
  }, [filteredPayments]);

  const pendingRenewalStudents = useMemo(
    () =>
      students.filter(
        (s) =>
          s.estado === "Activo" &&
          (s.estado_cuota === "Renovación Pendiente" ||
            (s.es_bono && (s.sesiones_restantes ?? 0) <= 0))
      ),
    [students]
  );

  // --- Handlers: Security Lock ---
  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    if (verifyPilatesPin(pinInput)) {
      setIsUnlocked(true);
      setPinInput("");
      refreshAllPilatesData();
    } else {
      setPinError(
        "Clave privada incorrecta. Este apartado es de acceso exclusivo para Dirección de Solo Pilates."
      );
    }
  };

  const handleLockClick = () => {
    lockPilatesSession();
    setIsUnlocked(false);
    setPinInput("");
    setPinError("");
  };

  // --- Handlers: Student Dialog ---
  const openCreateStudentModal = () => {
    setEditingStudentId(null);
    setFormNombre("");
    setFormApellidos("");
    setFormDni("");
    setFormTelefono("");
    setFormEmail("");
    setFormFotoUrl("");
    setFormPlan("Suelo · 8 Clases (Mañana)");
    setFormImporte("48");
    setFormSesiones("8");
    setFormMetodoPago("TPV");
    setFormIban("");
    setFormEstado("Activo");
    setFormEstadoCuota("Al día");
    setFormCodigoQr("");
    setFormNotasSalud("");
    studentDialogRef.current?.showModal();
  };

  const openEditStudentModal = (student: PilatesStudent) => {
    setEditingStudentId(student.id);
    setFormNombre(student.nombre);
    setFormApellidos(student.apellidos);
    setFormDni(student.dni);
    setFormTelefono(student.telefono);
    setFormEmail(student.email);
    setFormFotoUrl(student.foto_url);
    setFormPlan(student.tipo_plan);
    setFormImporte(String(student.importe_cuota));
    setFormSesiones(String(student.sesiones_restantes ?? 4));
    setFormMetodoPago(student.metodo_pago);
    setFormIban(student.iban);
    setFormEstado(student.estado);
    setFormEstadoCuota(
      student.estado_cuota === "Renovación Pendiente" ? "Renovación Pendiente" : "Al día"
    );
    setFormCodigoQr(student.codigo_qr);
    setFormNotasSalud(student.notas_salud);
    studentDialogRef.current?.showModal();
  };

  const handlePlanChangeInForm = (nextPlan: PilatesPlanType) => {
    setFormPlan(nextPlan);
    const preset = PILATES_PLAN_PRESETS.find((p) => p.id === nextPlan);
    if (preset) {
      setFormImporte(String(preset.importeSugerido));
      if (preset.esBono && preset.sesionesIncluidas) {
        setFormSesiones(String(preset.sesionesIncluidas));
      }
    }
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const dataUrl = await compressPilatesPhoto(file, 260, 0.82);
      setFormFotoUrl(dataUrl);
    } catch {
      showBanner("No se pudo procesar la fotografía seleccionada.", "amber");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSaveStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) return;

    const preset =
      PILATES_PLAN_PRESETS.find((p) => p.id === formPlan) || PILATES_PLAN_PRESETS[0];

    const saved = await savePilatesStudent({
      id: editingStudentId || undefined,
      codigo_qr: formCodigoQr.trim() || undefined,
      nombre: formNombre,
      apellidos: formApellidos,
      dni: formDni,
      telefono: formTelefono,
      email: formEmail,
      foto_url: formFotoUrl,
      tipo_plan: formPlan,
      importe_cuota: parseFloat(formImporte) || preset.importeSugerido,
      sesiones_restantes: preset.esBono ? Math.max(0, parseInt(formSesiones, 10) || 0) : null,
      metodo_pago: formMetodoPago,
      iban: formIban,
      estado: formEstado,
      estado_cuota: formEstado === "Baja" ? "Baja" : formEstadoCuota,
      notas_salud: formNotasSalud,
    });

    studentDialogRef.current?.close();
    refreshAllPilatesData();
    showBanner(
      editingStudentId
        ? `Ficha actualizada: ${saved.nombre_completo} (${saved.codigo_qr})`
        : `Alta completada en Solo Pilates: ${saved.nombre_completo} · QR ${saved.codigo_qr}`
    );
  };

  // --- Handlers: QR Viewer & Download ---
  const openQrViewerModal = (student: PilatesStudent) => {
    setQrStudent(student);
    setTimeout(() => {
      qrDialogRef.current?.showModal();
    }, 0);
  };

  const handleDownloadQrPng = () => {
    if (!qrStudent || !qrCanvasWrapperRef.current) return;
    const qrCanvas = qrCanvasWrapperRef.current.querySelector("canvas");
    if (!qrCanvas) return;

    // Componer tarjeta limpia lista para enviar por WhatsApp o imprimir
    const cardCanvas = document.createElement("canvas");
    cardCanvas.width = 600;
    cardCanvas.height = 760;
    const ctx = cardCanvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, 600, 760);

    ctx.fillStyle = "#0d9488";
    ctx.fillRect(0, 0, 600, 110);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SOLO PILATES · ACCESO 24H", 300, 66);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(140, 155, 320, 320);
    ctx.drawImage(qrCanvas, 165, 180, 270, 270);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(qrStudent.nombre_completo.slice(0, 34), 300, 540);

    ctx.fillStyle = "#5eead4";
    ctx.font = "bold 24px monospace";
    ctx.fillText(qrStudent.codigo_qr, 300, 588);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "18px sans-serif";
    ctx.fillText(`${qrStudent.tipo_plan} · Horario Flexible 24h`, 300, 645);

    const url = cardCanvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `QR_${qrStudent.codigo_qr}_${qrStudent.nombre_completo.replace(/\s+/g, "_")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // --- Handlers: Test Live 2-PC QR Scan ---
  const handleTriggerLiveScan = async (student: PilatesStudent) => {
    const res = await processPilatesScan(student.codigo_qr, { bypassDebounce: true });
    setNowMs(Date.now());
    refreshAllPilatesData();
    if (res.event) {
      showBanner(
        `Entrada registrada (${PILATES_SESSION_DURATION_MINUTES} min en sala): ${res.event.nombreCompleto} (${res.event.codigoQr})`
      );
    }
  };

  const handleEarlyExitFromRoom = (attendanceId: string, alumnoNombre: string) => {
    finalizarSesionSalaPilates(attendanceId);
    setNowMs(Date.now());
    refreshAllPilatesData();
    showBanner(
      `${alumnoNombre} ha salido de la sala activa (su entrada permanece guardada en el Historial del día).`
    );
  };

  // --- Handlers: Cobros & Renovaciones ---
  const openCobroModal = (student?: PilatesStudent) => {
    const target = student || students[0];
    if (!target) {
      showBanner("Registra o importa primero al menos un alumno en Solo Pilates.", "amber");
      return;
    }
    const preset =
      PILATES_PLAN_PRESETS.find((p) => p.id === target.tipo_plan) || PILATES_PLAN_PRESETS[0];

    setCobroStudentId(target.id);
    setCobroPlan(target.tipo_plan);
    setCobroImporte(String(target.importe_cuota || preset.importeSugerido));
    setCobroMetodo(target.metodo_pago || "TPV");
    setCobroPeriodo(
      selectedBillingMonth === "all" ? getCurrentYearMonth() : selectedBillingMonth
    );
    setCobroSesionesExtra(String(preset.sesionesIncluidas || 4));
    setCobroNotas("");
    cobroDialogRef.current?.showModal();
  };

  const handleCobroStudentSelect = (id: string) => {
    setCobroStudentId(id);
    const st = students.find((s) => s.id === id);
    if (st) {
      const preset =
        PILATES_PLAN_PRESETS.find((p) => p.id === st.tipo_plan) || PILATES_PLAN_PRESETS[0];
      setCobroPlan(st.tipo_plan);
      setCobroImporte(String(st.importe_cuota || preset.importeSugerido));
      setCobroMetodo(st.metodo_pago);
      if (preset.sesionesIncluidas) {
        setCobroSesionesExtra(String(preset.sesionesIncluidas));
      }
    }
  };

  const handleCobroPlanChange = (plan: PilatesPlanType) => {
    setCobroPlan(plan);
    const preset = PILATES_PLAN_PRESETS.find((p) => p.id === plan);
    if (preset) {
      setCobroImporte(String(preset.importeSugerido));
      if (preset.sesionesIncluidas) {
        setCobroSesionesExtra(String(preset.sesionesIncluidas));
      }
    }
  };

  const handleCobroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cobroStudentId) return;
    const preset =
      PILATES_PLAN_PRESETS.find((p) => p.id === cobroPlan) || PILATES_PLAN_PRESETS[0];

    const result = await registrarCobroPilates({
      studentId: cobroStudentId,
      tipoPlan: cobroPlan,
      importe: parseFloat(cobroImporte) || preset.importeSugerido,
      metodoPago: cobroMetodo,
      periodoMes: cobroPeriodo,
      sesionesExtra: preset.esBono ? parseInt(cobroSesionesExtra, 10) || 4 : null,
      notas: cobroNotas,
    });

    cobroDialogRef.current?.close();
    refreshAllPilatesData();
    if (result) {
      showBanner(
        `Cobro contabilizado en Solo Pilates: ${result.payment.numero_recibo} · ${result.payment.importe.toFixed(
          2
        )} € (${result.updatedStudent.nombre_completo})`
      );
    }
  };

  // --- Handlers: Delete Confirmation Dialog ---
  const askDeleteStudent = (student: PilatesStudent) => {
    setDeleteTarget({
      kind: "student",
      id: student.id,
      label: `${student.nombre_completo} (${student.codigo_qr})`,
    });
    setTimeout(() => deleteDialogRef.current?.showModal(), 0);
  };

  const askDeletePayment = (payment: PilatesPayment) => {
    setDeleteTarget({
      kind: "payment",
      id: payment.id,
      label: `${payment.numero_recibo} · ${payment.alumno_nombre} (${payment.importe.toFixed(2)} €)`,
    });
    setTimeout(() => deleteDialogRef.current?.showModal(), 0);
  };

  const confirmDeleteAction = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "student") {
      await deletePilatesStudent(deleteTarget.id);
      showBanner(`Ficha eliminada de Solo Pilates: ${deleteTarget.label}`, "amber");
    } else {
      deletePilatesPayment(deleteTarget.id);
      showBanner(`Recibo eliminado de Solo Pilates: ${deleteTarget.label}`, "amber");
    }
    deleteDialogRef.current?.close();
    setDeleteTarget(null);
    refreshAllPilatesData();
  };

  // --- Handlers: CSV / Excel Import ---
  const processSelectedImportFile = async (file: File) => {
    setImportError("");
    try {
      const preview = await parsePilatesImportFile(file);
      if (preview.validCandidates.length === 0) {
        setImportError(
          "No se encontraron filas válidas en el archivo. Revisa que tenga cabecera (nombre, dni, telefono, plan...)."
        );
        setImportPreview(null);
        return;
      }
      setImportPreview(preview);
    } catch (err: any) {
      setImportError(err?.message || "No se pudo leer el archivo seleccionado.");
      setImportPreview(null);
    }
  };

  const handleConfirmBatchImport = async () => {
    if (!importPreview || importPreview.validCandidates.length === 0) return;
    const summary = await importPilatesStudentsBatch(
      importPreview.validCandidates,
      importMode
    );
    setImportPreview(null);
    refreshAllPilatesData();
    setActiveTab("alumnos");
    showBanner(
      `Importación completada en 1 clic: ${summary.created} altas nuevas, ${summary.updated} actualizadas y ${summary.skipped} duplicados omitidos.`
    );
  };

  // --- Handlers: 2-PC Reception & PIN Security ---
  const handleSaveReceptionSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = savePilatesSecurityConfig({
      pcAlias: pcAliasInput.trim() || "PC Recepción 1",
    });
    setSecurityCfg(updated);
    showBanner(`Identificador de puesto guardado: ${updated.pcAlias}`);
  };

  const handleToggleReceptionCard = (allow: boolean) => {
    const updated = savePilatesSecurityConfig({ allowReceptionWelcomeCard: allow });
    setSecurityCfg(updated);
    showBanner(
      allow
        ? "Activado: La ficha grande de bienvenida saltará en los 2 PCs al escanear."
        : "Modo discreto: La ficha de bienvenida solo se abrirá dentro de Solo Pilates."
    );
  };

  const handleRequestNotifications = async () => {
    const perm = await requestPilatesDesktopNotifications();
    setNotifPermission(perm);
    if (perm === "granted") {
      showBanner("Avisos nativos de escritorio activados para segundo plano.");
    } else {
      showBanner(
        "Revisa los permisos de notificaciones del navegador para activar avisos emergentes.",
        "amber"
      );
    }
  };

  const handlePinChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = updatePilatesMasterPin(currentPinForChange, newPinForChange);
    if (res.ok) {
      setPinChangeMsg({
        ok: true,
        text: "Clave privada de Dirección Solo Pilates actualizada correctamente.",
      });
      setCurrentPinForChange("");
      setNewPinForChange("");
      refreshAllPilatesData();
    } else {
      setPinChangeMsg({
        ok: false,
        text: res.error || "No se pudo actualizar la clave privada.",
      });
    }
  };

  if (isCheckingLock) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-9 h-9 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ==========================================================================
  // PANTALLA DE BLOQUEO PRIVADO EXCLUSIVO DE ENRIQUE (SOLO PILATES)
  // ==========================================================================
  if (!isUnlocked) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center py-6 px-2 animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2.5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-teal-500/25">
              <Lock size={28} />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/12 border border-teal-500/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              <ShieldCheck size={14} />
              <span>Unidad Independiente · Deporsalud S.L.</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-[family-name:var(--font-heading)] text-[var(--color-text-title)] leading-snug break-words">
              Acceso Privado Solo Pilates
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Este módulo está aislado de la Escuela de Baile. Introduce la clave privada de
              Enrique para consultar fichas, cuotas, bonos y facturación de Pilates.
            </p>
          </div>

          <form action="/admin/pilates" method="POST" onSubmit={handleUnlockSubmit} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Clave Privada de Dirección Pilates
              </legend>
              <div className="relative">
                <input
                  type={showPinText ? "text" : "password"}
                  name="pilates_master_pin"
                  id="pilates_master_pin"
                  autoComplete="current-password"
                  autoFocus
                  required
                  data-ignore-scanner="true"
                  placeholder="Introduce tu PIN privado..."
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (pinError) setPinError("");
                  }}
                  className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3.5 pr-11 text-sm font-mono font-bold tracking-widest text-[var(--color-text-title)] outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPinText((v) => !v)}
                  aria-label={showPinText ? "Ocultar clave privada" : "Mostrar clave privada"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] cursor-pointer"
                >
                  {showPinText ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </fieldset>

            {pinError && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-500/40 bg-rose-500/12 p-3 text-xs font-semibold text-rose-600 dark:text-rose-300 leading-snug break-words"
              >
                {pinError}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold py-3.5 px-4 text-sm shadow-lg shadow-teal-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Unlock size={17} />
              <span>Desbloquear Gestión Solo Pilates</span>
            </button>
          </form>

          <div className="pt-3 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)] text-center leading-relaxed">
            El lector QR 24h en mostrador sigue operativo automáticamente en los 2 ordenadores de
            recepción aunque este panel permanezca bloqueado.
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // PANEL DESBLOQUEADO DE GESTIÓN INTEGRAL SOLO PILATES
  // ==========================================================================
  const formSelectedPreset =
    PILATES_PLAN_PRESETS.find((p) => p.id === formPlan) || PILATES_PLAN_PRESETS[0];
  const cobroSelectedPreset =
    PILATES_PLAN_PRESETS.find((p) => p.id === cobroPlan) || PILATES_PLAN_PRESETS[0];

  return (
    <div className="space-y-6 pb-28 animate-in fade-in duration-200">
      {/* Cabecera Ejecutiva */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 sm:p-6 shadow-lg">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/15 border border-teal-500/35 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              <Sparkles size={13} className="shrink-0" />
              <span>Unidad Privada · Deporsalud S.L.</span>
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold border ${
                realtimeOnline
                  ? "bg-emerald-500/12 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/12 border-amber-500/30 text-amber-600 dark:text-amber-400"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  realtimeOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <span>
                {realtimeOnline
                  ? "2 PCs Sincronizados en Vivo (<150ms)"
                  : "Sincronización Local Activa"}
              </span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-[family-name:var(--font-heading)] text-[var(--color-text-title)] leading-snug break-words">
            Solo Pilates · Control y Facturación 24h
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Censo, códigos QR de acceso libre 24h, bonos y contabilidad 100% separados de la
            Escuela de Baile.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openCreateStudentModal}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold px-4 py-2.5 text-xs shadow-md transition-colors cursor-pointer"
          >
            <Plus size={16} className="shrink-0" />
            <span>Nuevo Alumno Pilates</span>
          </button>

          <button
            type="button"
            onClick={handleLockClick}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-title)] font-bold px-4 py-2.5 text-xs transition-colors cursor-pointer"
          >
            <Lock size={15} className="text-amber-500 shrink-0" />
            <span>Bloquear Pilates</span>
          </button>
        </div>
      </div>

      {/* Banner de Feedback en Línea (Cero window.alert) */}
      {feedbackBanner && (
        <div
          role="status"
          className={`rounded-2xl border p-4 flex items-center justify-between gap-3 text-xs font-bold shadow-md ${
            feedbackBanner.tone === "amber"
              ? "bg-amber-500/12 border-amber-500/40 text-amber-700 dark:text-amber-300"
              : "bg-emerald-500/12 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          <span className="leading-snug break-words">{feedbackBanner.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            aria-label="Cerrar aviso"
            className="p-1 rounded-lg hover:bg-black/10 cursor-pointer shrink-0"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 4 KPIs Exclusivos Solo Pilates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Alumnos en Alta (Activos)
              </p>
              <h2 className="mt-1 text-3xl font-extrabold font-[family-name:var(--font-heading)] text-[var(--color-text-title)]">
                {kpis.alumnosActivos}
              </h2>
            </div>
            <div className="rounded-xl bg-teal-500/15 border border-teal-500/30 p-2.5 text-teal-600 dark:text-teal-400">
              <Users size={20} />
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            {kpis.totalRegistrados} socios totales ({bajasCount} en Baja)
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/35 bg-[var(--color-bg-card)] p-5 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                En Sala Ahora (Sesión 50 min)
              </p>
              <div className="mt-1 flex items-baseline gap-2.5">
                <h2 className="text-3xl font-extrabold font-[family-name:var(--font-heading)] text-[var(--color-text-title)]">
                  {activeRoomSessions.length}
                </h2>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {activeRoomSessions.length === 1 ? "alumno en clase" : "alumnos en clase"}
                </span>
              </div>
            </div>
            <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-2.5 text-emerald-600 dark:text-emerald-400">
              <Clock size={20} />
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            Salida auto. a los 50 min ·{" "}
            <button
              type="button"
              onClick={() => setActiveTab("historial")}
              className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Hoy: {kpis.asistenciasHoy} entradas
            </button>
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Cuotas y Bonos al Día
              </p>
              <h2 className="mt-1 text-3xl font-extrabold font-[family-name:var(--font-heading)] text-[var(--color-text-title)]">
                {kpis.cuotasAlDia}
              </h2>
            </div>
            <div className="rounded-xl bg-sky-500/15 border border-sky-500/30 p-2.5 text-sky-600 dark:text-sky-400">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            {kpis.renovacionesPendientes} con renovación pendiente
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Ingresos Mes Pilates
              </p>
              <h2 className="mt-1 text-3xl font-extrabold font-[family-name:var(--font-heading)] text-[var(--color-text-title)]">
                <span className="whitespace-nowrap inline-block">
                  {kpis.ingresosMes.toFixed(2)} €
                </span>
              </h2>
            </div>
            <div className="rounded-xl bg-amber-500/15 border border-amber-500/30 p-2.5 text-amber-600 dark:text-amber-400">
              <Wallet size={20} />
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            Tarifas Oficiales EZG Pilates Sept. 2026
          </p>
        </div>
      </div>

      {/* Control de Sala en Vivo · Salida Automática a los 50 Minutos (Acordado con Enrique) */}
      <div className="rounded-3xl border border-emerald-500/35 bg-[var(--color-bg-card)] p-4 sm:p-5 shadow-md space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/35 p-2.5 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Control de Sala en Vivo · Temporizador 50 Minutos
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      activeRoomSessions.length > 0 ? "bg-emerald-500 animate-ping" : "bg-slate-400"
                    }`}
                  />
                  <span>
                    {activeRoomSessions.length}{" "}
                    {activeRoomSessions.length === 1 ? "presente ahora" : "presentes ahora"}
                  </span>
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                Cada alumno que ficha con su QR o al que se le marca entrada permanece{" "}
                <strong className="text-[var(--color-text-title)]">50 minutos en sala</strong> y
                sale automáticamente al terminar su clase (quedando guardado en el{" "}
                <button
                  type="button"
                  onClick={() => setActiveTab("historial")}
                  className="font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  Historial de Asistencias
                </button>
                ).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("historial")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] px-3.5 py-2 text-xs font-bold text-[var(--color-text-title)] cursor-pointer"
            >
              <History size={14} className="text-teal-500 shrink-0" />
              <span>
                Historial Hoy ({kpis.asistenciasHoy}) · Ayer ({kpis.asistenciasAyer})
              </span>
            </button>
          </div>
        </div>

        {activeRoomSessions.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-[var(--color-text-secondary)]">
              No hay alumnos con sesión de 50 minutos activa en este instante. Cuando alguien pase el
              QR o pulses <strong>Escanear / Entrada</strong> aparecerá aquí con su cuenta atrás de
              50 minutos.
            </span>
            <span className="font-mono font-bold text-[var(--color-text-title)] whitespace-nowrap">
              Entradas registradas hoy: {kpis.asistenciasHoy}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {activeRoomSessions.map((sess) => {
              const { attendance, student, remainingFormatted, progressPct, horaSalidaPrevista } =
                sess;
              const remainingPct = Math.max(0, Math.min(100, 100 - progressPct));
              return (
                <div
                  key={attendance.id}
                  className="rounded-2xl border border-emerald-500/35 bg-[var(--color-bg)] p-3.5 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-500/40 bg-[var(--color-bg-card)] shrink-0 flex items-center justify-center">
                        {student?.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={student.foto_url}
                            alt={attendance.alumno_nombre}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                            {getPilatesInitials(attendance.alumno_nombre)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-[var(--color-text-title)] leading-snug break-words">
                          {attendance.alumno_nombre}
                        </p>
                        <p className="text-[11px] font-mono text-[var(--color-text-secondary)]">
                          {attendance.codigo_qr} · Entrada {attendance.hora_corta}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        title="Tiempo restante para salida automática de sala (50 min)"
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/15 border border-emerald-500/35 px-2.5 py-1 font-mono text-xs font-extrabold text-emerald-700 dark:text-emerald-300"
                      >
                        <Clock size={12} className="shrink-0" />
                        <span>{remainingFormatted}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleEarlyExitFromRoom(attendance.id, attendance.alumno_nombre)
                        }
                        title="Finalizar estancia en sala ahora (se conserva en el Historial del día)"
                        aria-label={`Finalizar estancia en sala de ${attendance.alumno_nombre}`}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:bg-rose-500/15 p-1.5 text-[var(--color-text-secondary)] hover:text-rose-500 cursor-pointer"
                      >
                        <LogOut size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Barra de progreso de los 50 minutos */}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-[var(--color-bg-card)] overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${remainingPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[var(--color-text-secondary)]">
                      <span>{attendance.tipo_plan}</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        Sale auto. {horaSalidaPrevista}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cuadro Oficial de Tarifas EZG Pilates (A partir del 1 de Septiembre) */}
      <div className="rounded-3xl border border-teal-500/35 bg-[var(--color-bg-card)] p-4 sm:p-5 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Cartel Oficial · EZG Pilates (A partir del 1 de Septiembre)
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-[var(--color-text-title)]">
              Cuadro Oficial de Tarifas EZG Pilates (Suelo · Máquina · Combinados · Extras)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowTarifarioCard((v) => !v)}
            className="self-start sm:self-auto rounded-xl border border-teal-500/35 bg-teal-500/10 hover:bg-teal-500/20 px-3.5 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 cursor-pointer"
          >
            {showTarifarioCard ? "Ocultar Tarifario" : "Ver Tarifas Oficiales EZG Pilates"}
          </button>
        </div>

        {showTarifarioCard && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 text-xs">
            {/* Bloque 1: Clases de Suelo */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5 space-y-2">
              <p className="font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400 border-b border-[var(--color-border)] pb-1.5">
                Clases de Suelo
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-text-title)]">4 Clases</span>
                  <span className="font-mono font-bold text-[var(--color-text-body)] whitespace-nowrap">
                    Mañana 32€ · Tarde 35€
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-text-title)]">8 Clases</span>
                  <span className="font-mono font-bold text-[var(--color-text-body)] whitespace-nowrap">
                    Mañana 48€ · Tarde 53€
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-text-title)]">12 Clases</span>
                  <span className="font-mono font-bold text-[var(--color-text-body)] whitespace-nowrap">
                    Mañana 76€ · Tarde 82€
                  </span>
                </div>
              </div>
            </div>

            {/* Bloque 2: Clases Máquina */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5 space-y-2">
              <p className="font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400 border-b border-[var(--color-border)] pb-1.5">
                Clases Máquina
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-text-title)]">4 Clases</span>
                  <span className="font-mono font-bold text-[var(--color-text-body)] whitespace-nowrap">
                    Mañana 55€ · Tarde 58€
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-text-title)]">8 Clases</span>
                  <span className="font-mono font-bold text-[var(--color-text-body)] whitespace-nowrap">
                    Mañana 83€ · Tarde 93€
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-text-title)]">12 Clases</span>
                  <span className="font-mono font-bold text-[var(--color-text-body)] whitespace-nowrap">
                    Mañana 113€ · Tarde 123€
                  </span>
                </div>
              </div>
            </div>

            {/* Bloque 3: Suelo + Máquina */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5 space-y-2">
              <p className="font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400 border-b border-[var(--color-border)] pb-1.5">
                Combinados Suelo + Máquina
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-text-title)]">1 Suelo + 1 Máq. (8 cl.)</span>
                  <span className="font-mono font-bold text-[var(--color-text-body)] whitespace-nowrap">
                    65€ / 68€
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-text-title)]">2 Suelo + 1 Máq. (12 cl.)</span>
                  <span className="font-mono font-bold text-[var(--color-text-body)] whitespace-nowrap">
                    90€ / 97€
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-text-title)]">1 Suelo + 2 Máq. (12 cl.)</span>
                  <span className="font-mono font-bold text-[var(--color-text-body)] whitespace-nowrap">
                    102€ / 114€
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-text-title)]">3 Suelo + 1 Máq. (16 cl.)</span>
                  <span className="font-mono font-bold text-[var(--color-text-body)] whitespace-nowrap">
                    105€ / 116€
                  </span>
                </div>
              </div>
            </div>

            {/* Bloque 4: Clases Sueltas y Extras */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5 space-y-2">
              <p className="font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400 border-b border-[var(--color-border)] pb-1.5">
                Clases Sueltas, Reserva y Parking
              </p>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--color-text-secondary)]">Clase Suelta Suelo / Máq.</span>
                  <span className="font-mono font-bold text-[var(--color-text-title)] whitespace-nowrap">
                    12€ / 17€
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--color-text-secondary)]">Reserva Mes (1/curso)</span>
                  <span className="font-mono font-bold text-[var(--color-text-title)] whitespace-nowrap">
                    15€ (+3€ var.)
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--color-text-secondary)]">Matrícula (App + QR Gratis)</span>
                  <span className="font-mono font-bold text-[var(--color-text-title)] whitespace-nowrap">
                    30€
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--color-text-secondary)]">Parking 1h · Bono 4h / 8h</span>
                  <span className="font-mono font-bold text-[var(--color-text-title)] whitespace-nowrap">
                    1,30€ · 4€ / 8€
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selector de Subpestañas Responsivo (Móvil 390px y Desktop) */}
      <div
        role="tablist"
        aria-label="Secciones de Solo Pilates"
        className="grid grid-cols-2 lg:grid-cols-5 gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2 shadow-sm"
      >
        {(
          [
            { id: "alumnos", label: `Alumnos Pilates (${students.length})` },
            { id: "historial", label: `Historial Asistencias (${kpis.asistenciasHoy} hoy)` },
            { id: "facturacion", label: `Cuotas y Facturación (${payments.length})` },
            { id: "importar", label: "Importar Alumnos (1 Clic)" },
            { id: "recepcion", label: "Recepción 2 PCs y Clave" },
          ] as Array<{ id: PilatesSubTab; label: string }>
        ).map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3 py-2.5 text-xs font-bold text-center leading-snug break-words transition-colors duration-75 cursor-pointer ${
                isSelected
                  ? "bg-teal-600 text-white shadow-md"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* SUBPESTAÑA 1: ALUMNOS PILATES                                        */}
      {/* ==================================================================== */}
      {activeTab === "alumnos" && (
        <div className="space-y-4">
          {/* Barra de búsqueda y filtros */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <form
              action="/admin/pilates"
              method="GET"
              onSubmit={(e) => e.preventDefault()}
              className="relative flex-1"
            >
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
              />
              <input
                type="search"
                name="q"
                aria-label="Buscar alumno de Pilates por nombre, DNI, teléfono, objetivo médico o código QR"
                placeholder="Buscar por nombre, DNI, móvil, código PIL-1319 o motivo (Recomendación médica, Embarazada...)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleLimit(60);
                }}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-10 pr-4 py-2.5 text-xs text-[var(--color-text-title)] outline-none focus:border-teal-500"
              />
            </form>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "activos", label: `En Alta (${kpis.alumnosActivos})` },
                  { id: "bajas", label: `Bajas (${bajasCount})` },
                  { id: "all", label: `Todos (${students.length})` },
                  { id: "bonos", label: "Bonos" },
                  { id: "pendientes", label: "Renovación Pendiente" },
                ] as Array<{ id: StudentFilter; label: string }>
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setStudentFilter(f.id);
                    setVisibleLimit(60);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    studentFilter === f.id
                      ? "bg-teal-600 text-white"
                      : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-title)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/12 border border-teal-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
                <Users size={26} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[var(--color-text-title)]">
                  {students.length === 0
                    ? "Todavía no hay alumnos cargados en Solo Pilates"
                    : "Ningún alumno coincide con el filtro seleccionado"}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto leading-relaxed">
                  Puedes crear fichas individuales con foto y QR o importar todo el listado de
                  Enrique desde Excel / XML / CSV en un solo clic.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={openCreateStudentModal}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold px-4 py-2.5 text-xs cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Crear Primer Alumno Pilates</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("importar")}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-title)] font-bold px-4 py-2.5 text-xs cursor-pointer"
                >
                  <Upload size={15} />
                  <span>Importar Excel / XML / CSV en 1 Clic</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Barra informativa de censo activo / histórico */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-[var(--color-text-secondary)]">
                <span>
                  Mostrando{" "}
                  <strong className="text-[var(--color-text-title)]">
                    {visibleStudents.length}
                  </strong>{" "}
                  de{" "}
                  <strong className="text-[var(--color-text-title)]">
                    {filteredStudents.length}
                  </strong>{" "}
                  alumnos en este filtro · Censo EZG Pilates:{" "}
                  <strong className="text-teal-600 dark:text-teal-400">
                    {kpis.alumnosActivos} en Alta
                  </strong>{" "}
                  y{" "}
                  <strong className="text-[var(--color-text-title)]">
                    {bajasCount} en Baja
                  </strong>{" "}
                  ({students.length} socios)
                </span>
              </div>

              {/* Tabla Desktop (>= md) */}
              <div className="hidden md:block rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden shadow-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      <th className="py-3.5 pl-4 pr-2">Alumno / Tipo Alumno (Salud)</th>
                      <th className="py-3.5 px-2">Contacto / DNI</th>
                      <th className="py-3.5 px-2">Tarifa EZG Pilates</th>
                      <th className="py-3.5 px-2">Cuota</th>
                      <th className="py-3.5 px-2">Socio QR</th>
                      <th className="py-3.5 px-2">Estado / Alta</th>
                      <th className="py-3.5 pl-2 pr-4 text-right whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] text-xs">
                    {visibleStudents.map((s) => {
                      const needsRenewal =
                        s.estado === "Activo" &&
                        (s.estado_cuota === "Renovación Pendiente" ||
                          (s.es_bono && (s.sesiones_restantes ?? 0) <= 0));
                      const activeSess = activeRoomByStudentId.get(s.id);

                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-[var(--color-bg-hover)]/60 transition-colors"
                        >
                          <td className="py-3 pl-4 pr-2 max-w-[235px]">
                            <button
                              type="button"
                              onClick={() => openEditStudentModal(s)}
                              title="Hacer clic para abrir ficha del alumno y adjuntar foto"
                              className="flex items-center gap-2.5 text-left group cursor-pointer w-full"
                            >
                              <div className="w-11 h-11 rounded-2xl overflow-hidden border border-[var(--color-border)] group-hover:border-teal-500 bg-[var(--color-bg)] shrink-0 flex items-center justify-center transition-colors">
                                {s.foto_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={s.foto_url}
                                    alt={s.nombre_completo}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-xs font-extrabold text-teal-600 dark:text-teal-400">
                                    {getPilatesInitials(s.nombre_completo)}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-[var(--color-text-title)] group-hover:text-teal-600 dark:group-hover:text-teal-400 leading-snug break-words transition-colors">
                                  {s.nombre_completo}
                                </p>
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                  {activeSess && (
                                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 px-2 py-0.5 text-[10px] font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                                      <Clock size={10} className="shrink-0" />
                                      <span>En sala ({activeSess.remainingFormatted})</span>
                                    </span>
                                  )}
                                  {s.notas_salud && (
                                    <span className="inline-flex items-center rounded-lg bg-teal-500/12 border border-teal-500/25 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300 leading-snug break-words">
                                      {s.notas_salud}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          </td>
                          <td className="py-3 px-2 max-w-[165px]">
                            <p className="font-mono font-semibold text-[var(--color-text-body)]">
                              {s.dni || "Sin DNI"}
                            </p>
                            <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug break-all">
                              {s.telefono || s.email || "Sin teléfono"}
                            </p>
                            {s.telefono && s.email && (
                              <p className="text-[10px] text-[var(--color-text-secondary)] leading-snug break-all">
                                {s.email}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-2 max-w-[165px]">
                            <p className="font-bold text-[var(--color-text-title)] leading-snug break-words">
                              {s.tipo_plan}
                            </p>
                            <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                              {s.es_bono
                                ? `${s.sesiones_restantes ?? 0}/${
                                    s.sesiones_totales_bono ?? 8
                                  } sesiones disponibles`
                                : `Acceso Libre 24h · ${s.metodo_pago}`}
                            </p>
                          </td>
                          <td className="py-3 px-2 font-mono font-bold text-[var(--color-text-title)]">
                            <span className="whitespace-nowrap inline-block">
                              {s.importe_cuota.toFixed(2)} €
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <button
                              type="button"
                              onClick={() => openQrViewerModal(s)}
                              className="inline-flex items-center gap-1 rounded-xl border border-teal-500/35 bg-teal-500/10 px-2 py-1 font-mono text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 whitespace-nowrap cursor-pointer"
                            >
                              <QrCode size={12} className="shrink-0" />
                              <span className="whitespace-nowrap">{s.codigo_qr}</span>
                            </button>
                          </td>
                          <td className="py-3 px-2">
                            <div className="space-y-0.5">
                              {s.estado === "Baja" ? (
                                <span className="inline-flex items-center rounded-full bg-slate-500/15 border border-slate-500/30 px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-text-secondary)] whitespace-nowrap">
                                  Baja
                                </span>
                              ) : needsRenewal ? (
                                <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/35 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                                  Renovación
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/35 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                                  Alta · Al día
                                </span>
                              )}
                              {s.fecha_alta && (
                                <p className="text-[10px] font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                                  Alta: {s.fecha_alta}
                                </p>
                              )}
                              {s.estado === "Baja" && s.fecha_baja && (
                                <p className="text-[10px] font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                                  Baja: {s.fecha_baja}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pl-2 pr-4">
                            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleTriggerLiveScan(s)}
                                title="Probar Escaneo QR 24h en los 2 PCs"
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1.5 text-[11px] cursor-pointer"
                              >
                                <Play size={12} />
                                <span>Escanear</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openCobroModal(s)}
                                title="Cobrar o Renovar Bono / Mensualidad"
                                className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-title)] font-bold px-2.5 py-1.5 text-[11px] cursor-pointer"
                              >
                                <CreditCard size={12} className="text-teal-500" />
                                <span>Cobrar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditStudentModal(s)}
                                aria-label={`Editar ficha de ${s.nombre_completo}`}
                                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] cursor-pointer"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => askDeleteStudent(s)}
                                aria-label={`Eliminar ficha de ${s.nombre_completo}`}
                                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-rose-500/15 p-1.5 text-[var(--color-text-secondary)] hover:text-rose-500 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Vista Tarjetas Móvil (< md, 390px Cero Scroll Horizontal) */}
              <div className="md:hidden space-y-3">
                {visibleStudents.map((s) => {
                  const needsRenewal =
                    s.estado === "Activo" &&
                    (s.estado_cuota === "Renovación Pendiente" ||
                      (s.es_bono && (s.sesiones_restantes ?? 0) <= 0));
                  const activeSess = activeRoomByStudentId.get(s.id);

                  return (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-3 shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => openEditStudentModal(s)}
                        className="flex items-center gap-3 text-left w-full cursor-pointer"
                      >
                        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)] shrink-0 flex items-center justify-center">
                          {s.foto_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.foto_url}
                              alt={s.nombre_completo}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-extrabold text-teal-600 dark:text-teal-400">
                              {getPilatesInitials(s.nombre_completo)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-extrabold text-[var(--color-text-title)] leading-snug break-words">
                            {s.nombre_completo}
                          </p>
                          <p className="text-xs font-mono text-[var(--color-text-secondary)]">
                            {s.codigo_qr} · {s.dni || s.telefono || "Sin DNI"}
                          </p>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {activeSess && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 px-2 py-0.5 text-[10px] font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                                <Clock size={10} className="shrink-0" />
                                <span>En sala ({activeSess.remainingFormatted})</span>
                              </span>
                            )}
                            {s.notas_salud && (
                              <span className="inline-flex items-center rounded-lg bg-teal-500/12 border border-teal-500/25 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300 leading-snug break-words">
                                {s.notas_salud}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 leading-snug break-words mt-1">
                            {s.tipo_plan} ·{" "}
                            <span className="whitespace-nowrap inline-block">
                              {s.importe_cuota.toFixed(2)} €
                            </span>
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center justify-between gap-2 text-xs pt-2 border-t border-[var(--color-border)]">
                        <span className="text-[var(--color-text-secondary)]">
                          {s.fecha_alta ? `Alta: ${s.fecha_alta}` : "Horario Libre 24h"}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            s.estado === "Baja"
                              ? "bg-slate-500/15 text-[var(--color-text-secondary)]"
                              : needsRenewal
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {s.estado === "Baja"
                            ? `Baja${s.fecha_baja ? ` (${s.fecha_baja})` : ""}`
                            : needsRenewal
                            ? "Renovación Pendiente"
                            : "Alta · Al día"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleTriggerLiveScan(s)}
                          className="rounded-xl bg-emerald-600 text-white font-bold py-2 px-3 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Play size={13} />
                          <span>Probar QR</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openQrViewerModal(s)}
                          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-title)] font-bold py-2 px-3 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <QrCode size={13} />
                          <span>Tarjeta QR</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openCobroModal(s)}
                          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-title)] font-bold py-2 px-3 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CreditCard size={13} />
                          <span>Cobrar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditStudentModal(s)}
                          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-title)] font-bold py-2 px-3 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 size={13} />
                          <span>Editar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paginación ligera para listado de 1.317 alumnos */}
              {filteredStudents.length > visibleLimit && (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Mostrando <strong className="text-[var(--color-text-title)]">{visibleStudents.length}</strong> de{" "}
                    <strong className="text-[var(--color-text-title)]">{filteredStudents.length}</strong> alumnos
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVisibleLimit((prev) => prev + 100)}
                      className="rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold px-4 py-2 text-xs cursor-pointer"
                    >
                      Cargar 100 más
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibleLimit(filteredStudents.length)}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-title)] font-bold px-4 py-2 text-xs cursor-pointer"
                    >
                      Ver los {filteredStudents.length} alumnos
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBPESTAÑA 1.5: HISTORIAL DE ASISTENCIAS (HOY, AYER Y FECHAS)        */}
      {/* ==================================================================== */}
      {activeTab === "historial" && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 sm:p-5 space-y-4 shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Registro Permanente de Entradas · Solo Pilates
                </span>
                <h2 className="text-lg font-extrabold text-[var(--color-text-title)]">
                  Historial de Asistencias (Hoy, Ayer y Días Anteriores)
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Aunque los alumnos salgan automáticamente de la sala activa a los{" "}
                  <strong>50 minutos</strong>, todas las entradas quedan guardadas aquí para que
                  puedas comprobar qué alumnos vinieron hoy, ayer o cualquier día sin preguntar a los
                  profesores.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={filteredHistoryAttendances.length === 0}
                  onClick={() =>
                    exportPilatesAttendancesCsv(
                      filteredHistoryAttendances,
                      historyDateFilter === "fecha" ? historyCustomDate : historyDateFilter
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] disabled:opacity-45 px-3.5 py-2 text-xs font-bold text-[var(--color-text-title)] cursor-pointer"
                >
                  <Download size={14} className="text-teal-500 shrink-0" />
                  <span>Exportar Historial CSV ({filteredHistoryAttendances.length})</span>
                </button>
              </div>
            </div>

            {/* Filtros de fecha (Hoy, Ayer, Últimos 7 días, Todas, Fecha exacta) + Buscador */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-[var(--color-border)]">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "hoy", label: `Hoy (${kpis.asistenciasHoy})` },
                    { id: "ayer", label: `Ayer (${kpis.asistenciasAyer})` },
                    { id: "7dias", label: "Últimos 7 días" },
                    { id: "todas", label: `Todas (${attendances.length})` },
                    { id: "fecha", label: "Elegir día" },
                  ] as Array<{ id: HistoryDateFilter; label: string }>
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setHistoryDateFilter(f.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      historyDateFilter === f.id
                        ? "bg-teal-600 text-white"
                        : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-title)]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}

                {historyDateFilter === "fecha" && (
                  <input
                    type="date"
                    aria-label="Seleccionar fecha del historial de asistencias"
                    value={historyCustomDate}
                    onChange={(e) => setHistoryCustomDate(e.target.value)}
                    className="rounded-xl border border-teal-500/40 bg-[var(--color-bg)] px-3 py-1.5 text-xs font-mono font-bold text-[var(--color-text-title)] outline-none focus:border-teal-500"
                  />
                )}
              </div>

              <div className="relative flex-1 max-w-md">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
                />
                <input
                  type="search"
                  aria-label="Buscar en el historial de asistencias por nombre o código QR"
                  placeholder="Buscar si vino un alumno (ej. Pepita), DNI o PIL-XXXX..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3.5 py-2 text-xs text-[var(--color-text-title)] outline-none focus:border-teal-500"
                />
              </div>
            </div>
          </div>

          {filteredHistoryAttendances.length === 0 ? (
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/12 border border-teal-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
                <History size={22} />
              </div>
              <p className="text-sm font-bold text-[var(--color-text-title)]">
                No hay asistencias registradas para el filtro seleccionado
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto">
                Cada vez que un alumno pase su código QR en recepción o se le marque entrada,
                quedará guardado aquí con fecha y hora exacta de entrada.
              </p>
            </div>
          ) : (
            <>
              {/* Tabla Desktop de Historial */}
              <div className="hidden md:block rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden shadow-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      <th className="py-3.5 px-4">Fecha / Hora Entrada</th>
                      <th className="py-3.5 px-3">Alumno Pilates</th>
                      <th className="py-3.5 px-3">Socio QR</th>
                      <th className="py-3.5 px-3">Plan / Saldo tras entrada</th>
                      <th className="py-3.5 px-3">Estado Sesión (50 min)</th>
                      <th className="py-3.5 px-4 text-right">Mostrador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] text-xs">
                    {filteredHistoryAttendances.map((att) => {
                      const entryMs = new Date(att.fecha_hora).getTime();
                      const elapsedMs = nowMs - entryMs;
                      const isStillInRoom =
                        !att.salida_anticipada &&
                        !isNaN(entryMs) &&
                        elapsedMs >= 0 &&
                        elapsedMs < PILATES_SESSION_DURATION_MINUTES * 60 * 1000;
                      const activeSess = activeRoomByStudentId.get(att.alumno_id);
                      const salidaAutoHora =
                        att.hora_salida_prevista ||
                        (!isNaN(entryMs)
                          ? new Date(
                              entryMs + PILATES_SESSION_DURATION_MINUTES * 60 * 1000
                            ).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
                          : "—");

                      return (
                        <tr key={att.id} className="hover:bg-[var(--color-bg-hover)]/50">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-[var(--color-text-title)]">
                              {att.hora_corta}
                            </span>
                            <span className="block text-[11px] font-mono text-[var(--color-text-secondary)]">
                              {att.fecha_iso}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-bold text-[var(--color-text-title)] leading-snug break-words">
                            {att.alumno_nombre}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                            {att.codigo_qr}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-semibold text-[var(--color-text-title)] leading-snug break-words">
                              {att.tipo_plan}
                            </p>
                            <p className="text-[11px] text-[var(--color-text-secondary)]">
                              {typeof att.sesiones_restantes_tras_entrada === "number"
                                ? `${att.sesiones_restantes_tras_entrada} sesiones restantes tras entrada`
                                : "Acceso mensual"}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            {isStillInRoom && activeSess ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 px-2.5 py-0.5 text-[11px] font-mono font-extrabold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                                <Clock size={12} className="shrink-0" />
                                <span>En sala ({activeSess.remainingFormatted})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/12 border border-slate-500/25 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">
                                <CheckCircle2 size={12} className="text-teal-500 shrink-0" />
                                <span>Sesión 50m completada (salió {salidaAutoHora})</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-[11px] text-[var(--color-text-secondary)]">
                            {att.origen_pc}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tarjetas Móvil de Historial (< md) */}
              <div className="md:hidden space-y-2.5">
                {filteredHistoryAttendances.map((att) => {
                  const entryMs = new Date(att.fecha_hora).getTime();
                  const elapsedMs = nowMs - entryMs;
                  const isStillInRoom =
                    !att.salida_anticipada &&
                    !isNaN(entryMs) &&
                    elapsedMs >= 0 &&
                    elapsedMs < PILATES_SESSION_DURATION_MINUTES * 60 * 1000;
                  const activeSess = activeRoomByStudentId.get(att.alumno_id);
                  const salidaAutoHora =
                    att.hora_salida_prevista ||
                    (!isNaN(entryMs)
                      ? new Date(
                          entryMs + PILATES_SESSION_DURATION_MINUTES * 60 * 1000
                        ).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
                      : "—");

                  return (
                    <div
                      key={att.id}
                      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                          {att.codigo_qr} · {att.fecha_iso}
                        </span>
                        <span className="font-mono text-xs font-extrabold text-[var(--color-text-title)]">
                          Entrada {att.hora_corta}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[var(--color-text-title)] leading-snug break-words">
                        {att.alumno_nombre}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        {att.tipo_plan}
                      </p>
                      <div className="flex items-center justify-between pt-1.5 border-t border-[var(--color-border)] text-[11px]">
                        {isStillInRoom && activeSess ? (
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ⏱ En sala ({activeSess.remainingFormatted})
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-secondary)]">
                            ✓ Salió auto. {salidaAutoHora} (50 min)
                          </span>
                        )}
                        <span className="text-[var(--color-text-secondary)]">{att.origen_pc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBPESTAÑA 2: CUOTAS, BONOS Y FACTURACIÓN EXCLUSIVA PILATES          */}
      {/* ==================================================================== */}
      {activeTab === "facturacion" && (
        <div className="space-y-5">
          {/* Controles superiores de periodo y acciones */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <label
                htmlFor="pilates_periodo_select"
                className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]"
              >
                Periodo Contable:
              </label>
              <select
                id="pilates_periodo_select"
                name="periodo_mes"
                value={selectedBillingMonth}
                onChange={(e) => setSelectedBillingMonth(e.target.value)}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2 text-xs font-bold text-[var(--color-text-title)] outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="all">Todos los meses</option>
                {BILLING_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openCobroModal()}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold px-4 py-2.5 text-xs cursor-pointer"
              >
                <Plus size={15} />
                <span>Registrar Cobro / Renovación</span>
              </button>
              <button
                type="button"
                disabled={filteredPayments.length === 0}
                onClick={() =>
                  exportPilatesPaymentsCsv(filteredPayments, selectedBillingMonth)
                }
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] disabled:opacity-45 text-[var(--color-text-title)] font-bold px-4 py-2.5 text-xs cursor-pointer"
              >
                <Download size={15} />
                <span>Exportar CSV Pilates</span>
              </button>
            </div>
          </div>

          {/* Resumen de Arqueo por Método de Pago */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {(["Efectivo", "TPV", "Transferencia", "SEPA"] as PilatesMetodoPago[]).map(
              (metodo) => (
                <div
                  key={metodo}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    {metodo}
                  </p>
                  <p className="mt-1 text-xl font-extrabold font-mono text-[var(--color-text-title)]">
                    <span className="whitespace-nowrap inline-block">
                      {billingSummaryByMethod.totals[metodo].toFixed(2)} €
                    </span>
                  </p>
                </div>
              )
            )}
            <div className="col-span-2 lg:col-span-1 rounded-2xl border border-teal-500/35 bg-teal-500/10 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">
                Total Periodo
              </p>
              <p className="mt-1 text-xl font-extrabold font-mono text-[var(--color-text-title)]">
                <span className="whitespace-nowrap inline-block">
                  {billingSummaryByMethod.grandTotal.toFixed(2)} €
                </span>
              </p>
            </div>
          </div>

          {/* Bandeja rápida de alumnos con renovación pendiente */}
          {pendingRenewalStudents.length > 0 && (
            <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                <AlertCircle size={16} />
                <span>
                  Renovaciones Pendientes en Solo Pilates ({pendingRenewalStudents.length})
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {pendingRenewalStudents.map((st) => (
                  <div
                    key={st.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--color-text-title)] leading-snug break-words">
                        {st.nombre_completo}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        {st.tipo_plan} ·{" "}
                        {st.es_bono
                          ? `${st.sesiones_restantes ?? 0} sesiones restantes`
                          : "Mensualidad pendiente"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCobroModal(st)}
                      className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-3 py-1.5 text-xs shrink-0 cursor-pointer"
                    >
                      Renovar 1 Clic
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Libro de Cobros Solo Pilates */}
          {filteredPayments.length === 0 ? (
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-10 text-center space-y-2">
              <p className="text-sm font-bold text-[var(--color-text-title)]">
                Sin cobros registrados en este periodo de Solo Pilates
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Los ingresos que registres aquí quedan aislados de la caja y remesas SEPA de
                Escuela de Baile.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:block rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden shadow-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      <th className="py-3.5 px-4">Recibo</th>
                      <th className="py-3.5 px-3">Fecha / Periodo</th>
                      <th className="py-3.5 px-3">Alumno Pilates</th>
                      <th className="py-3.5 px-3">Concepto</th>
                      <th className="py-3.5 px-3">Método</th>
                      <th className="py-3.5 px-3 text-right">Importe</th>
                      <th className="py-3.5 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] text-xs">
                    {filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-[var(--color-bg-hover)]/50">
                        <td className="py-3 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">
                          {p.numero_recibo}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-[var(--color-text-title)]">
                            {p.fecha_corta}
                          </span>
                          <span className="block text-[11px] font-mono text-[var(--color-text-secondary)]">
                            Periodo {p.periodo_mes}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-[var(--color-text-title)] leading-snug break-words">
                          {p.alumno_nombre}
                        </td>
                        <td className="py-3 px-3 text-[var(--color-text-body)] leading-snug break-words max-w-md">
                          {p.concepto}
                        </td>
                        <td className="py-3 px-3">
                          <span className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-text-title)]">
                            {p.metodo_pago}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                          <span className="whitespace-nowrap inline-block">
                            {p.importe.toFixed(2)} €
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => askDeletePayment(p)}
                            aria-label={`Eliminar recibo ${p.numero_recibo}`}
                            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-rose-500/15 p-1.5 text-[var(--color-text-secondary)] hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-2.5">
                {filteredPayments.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                        {p.numero_recibo}
                      </span>
                      <span className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {p.importe.toFixed(2)} €
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[var(--color-text-title)] leading-snug break-words">
                      {p.alumno_nombre}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-snug break-words">
                      {p.concepto}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)] pt-1 border-t border-[var(--color-border)]">
                      <span>
                        {p.fecha_corta} · {p.metodo_pago}
                      </span>
                      <button
                        type="button"
                        onClick={() => askDeletePayment(p)}
                        className="text-rose-500 font-bold cursor-pointer"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBPESTAÑA 3: IMPORTADOR MASIVO EXCEL / CSV EN 1 CLIC                */}
      {/* ==================================================================== */}
      {activeTab === "importar" && (
        <div className="space-y-5">
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 space-y-5 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[var(--color-text-title)]">
                  Importador Inicial de Alumnos en 1 Clic (Excel / CSV)
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                  Sube el listado actual de Pilates (.csv, .xlsx o .tsv). El sistema reconoce
                  automáticamente columnas en español y genera el código QR PIL-XXXX para cada
                  alumno.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadPilatesCsvTemplate}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-500/40 bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold px-4 py-2.5 text-xs shrink-0 cursor-pointer"
              >
                <FileSpreadsheet size={16} />
                <span>Descargar Plantilla CSV Ejemplo</span>
              </button>
            </div>

            {/* Zona Drag & Drop + File Selector estilizado con ::file-selector-button */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFile(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) processSelectedImportFile(dropped);
              }}
              className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors space-y-3 ${
                isDraggingFile
                  ? "border-teal-500 bg-teal-500/10"
                  : "border-[var(--color-border)] bg-[var(--color-bg)]"
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
                <Upload size={22} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-[var(--color-text-title)]">
                  Arrastra aquí tu archivo Excel (.xlsx) o CSV (.csv)
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Detecta automáticamente: nombre, apellidos, dni, teléfono, email, tarifa/bono,
                  cuota y sesiones restantes.
                </p>
              </div>
              <div className="pt-1 flex justify-center">
                <input
                  type="file"
                  name="pilates_import_file"
                  aria-label="Seleccionar archivo CSV, XML o Excel de alumnos de Pilates"
                  accept=".csv,.tsv,.xlsx,.xml,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) processSelectedImportFile(f);
                  }}
                  className="text-xs text-[var(--color-text-secondary)] file:mr-3 file:rounded-xl file:border-0 file:bg-teal-600 file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-teal-500 file:cursor-pointer"
                />
              </div>
            </div>

            {importError && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-500/40 bg-rose-500/12 p-3.5 text-xs font-semibold text-rose-600 dark:text-rose-300"
              >
                {importError}
              </div>
            )}

            {importPreview && (
              <div className="space-y-4 pt-2 border-t border-[var(--color-border)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-extrabold text-[var(--color-text-title)]">
                      Vista Previa: {importPreview.fileName} (
                      {importPreview.validCandidates.length} fichas detectadas)
                    </h3>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {importPreview.duplicateCount} posibles duplicados por DNI/Email ·{" "}
                      {importPreview.skippedEmptyRows} filas vacías ignoradas
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Modo de tratamiento de duplicados"
                      name="import_duplicate_mode"
                      value={importMode}
                      onChange={(e) =>
                        setImportMode(e.target.value as "skip_duplicates" | "upsert")
                      }
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-bold text-[var(--color-text-title)]"
                    >
                      <option value="skip_duplicates">Omitir duplicados existentes</option>
                      <option value="upsert">Actualizar fichas duplicadas</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleConfirmBatchImport}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2.5 text-xs shadow-md cursor-pointer"
                    >
                      <CheckCircle2 size={15} />
                      <span>
                        Importar {importPreview.validCandidates.length} Alumnos en 1 Clic
                      </span>
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--color-border)] overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[var(--color-bg)] border-b border-[var(--color-border)] text-[11px] font-bold uppercase text-[var(--color-text-secondary)]">
                        <th className="py-2.5 px-3">Fila</th>
                        <th className="py-2.5 px-3">Alumno</th>
                        <th className="py-2.5 px-3">DNI / Teléfono</th>
                        <th className="py-2.5 px-3">Plan / Bono</th>
                        <th className="py-2.5 px-3">Cuota</th>
                        <th className="py-2.5 px-3">Validación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {importPreview.validCandidates.slice(0, 25).map((c) => (
                        <tr key={c.rowNumber}>
                          <td className="py-2.5 px-3 font-mono text-[var(--color-text-secondary)]">
                            #{c.rowNumber}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[var(--color-text-title)] leading-snug break-words">
                            {c.nombre_completo}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[var(--color-text-body)]">
                            {c.dni || "—"} {c.telefono ? `· ${c.telefono}` : ""}
                          </td>
                          <td className="py-2.5 px-3 text-[var(--color-text-body)]">
                            {c.tipo_plan}
                            {c.es_bono ? ` (${c.sesiones_restantes} ses.)` : ""}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[var(--color-text-title)] whitespace-nowrap">
                            {c.importe_cuota.toFixed(2)} €
                          </td>
                          <td className="py-2.5 px-3">
                            {c.isDuplicate ? (
                              <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                Duplicado detectado
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                Listo para crear QR
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBPESTAÑA 4: RECEPCIÓN 2 PCS EN VIVO, SEGUNDO PLANO Y CLAVE PRIVADA */}
      {/* ==================================================================== */}
      {activeTab === "recepcion" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Bloque A: Sincronización 2 Ordenadores + Avisos Segundo Plano */}
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 space-y-5 shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Mostrador Doble · Tiempo Real
                </span>
                <h2 className="text-lg font-extrabold text-[var(--color-text-title)] mt-0.5">
                  Sincronización Simultánea en 2 PCs (&lt;150ms)
                </h2>
              </div>
              <MonitorSmartphone size={22} className="text-teal-500 shrink-0" />
            </div>

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[var(--color-text-title)]">
                  Canal Supabase Realtime Broadcast:
                </span>
                <span
                  className={`font-mono font-bold px-2.5 py-0.5 rounded-full ${
                    realtimeOnline
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {realtimeOnline ? "CONECTADO EN VIVO" : "MODO LOCAL"}
                </span>
              </div>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Cuando el lector QR USB conectado al <strong>PC 1</strong> lee la tarjeta de un
                alumno de Pilates, la ficha con fotografía grande se abre al instante tanto en el{" "}
                <strong>PC 1</strong> como en el <strong>PC 2</strong> de recepción sin duplicar
                asistencias.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRequestNotifications}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold px-3.5 py-2 text-xs cursor-pointer"
                >
                  <Bell size={14} />
                  <span>
                    {notifPermission === "granted"
                      ? "Avisos Escritorio Activos ✓"
                      : "Activar Avisos en Segundo Plano"}
                  </span>
                </button>

                {students[0] && (
                  <button
                    type="button"
                    onClick={() => handleTriggerLiveScan(students[0])}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-title)] font-bold px-3.5 py-2 text-xs cursor-pointer"
                  >
                    <RefreshCw size={14} className="text-emerald-500" />
                    <span>Emitir Prueba a los 2 PCs</span>
                  </button>
                )}
              </div>
            </div>

            <form
              action="/admin/pilates"
              method="POST"
              onSubmit={handleSaveReceptionSettings}
              className="space-y-3"
            >
              <fieldset className="space-y-2">
                <legend className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Nombre identificativo de este ordenador
                </legend>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="pc_alias"
                    value={pcAliasInput}
                    onChange={(e) => setPcAliasInput(e.target.value)}
                    placeholder="Ej: PC Recepción 1 (Lector USB)"
                    className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2 text-xs text-[var(--color-text-title)] outline-none focus:border-teal-500"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] px-4 py-2 text-xs font-bold text-[var(--color-text-title)] cursor-pointer"
                  >
                    Guardar Puesto
                  </button>
                </div>
              </fieldset>
            </form>

            <label className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5 cursor-pointer">
              <input
                type="checkbox"
                name="allow_reception_welcome"
                checked={securityCfg.allowReceptionWelcomeCard}
                onChange={(e) => handleToggleReceptionCard(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-teal-600"
              />
              <span className="text-xs leading-relaxed text-[var(--color-text-body)]">
                <strong className="block text-[var(--color-text-title)]">
                  Mostrar Ficha Grande de Bienvenida en Recepción General
                </strong>
                Permite que al escanear el QR aparezca la foto y estado del bono en pantalla en
                los 2 PCs aunque el módulo privado de Enrique siga bloqueado con PIN.
              </span>
            </label>
          </div>

          {/* Bloque B: Cambio de Clave Privada de Enrique + Últimas Entradas 24h */}
          <div className="space-y-5">
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 space-y-4 shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Seguridad Exclusiva Dirección
                  </span>
                  <h2 className="text-lg font-extrabold text-[var(--color-text-title)] mt-0.5">
                    Clave Privada de Enrique (Solo Pilates)
                  </h2>
                </div>
                <ShieldCheck size={22} className="text-amber-500 shrink-0" />
              </div>

              <form
                action="/admin/pilates"
                method="POST"
                onSubmit={handlePinChangeSubmit}
                className="space-y-3"
              >
                <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <legend className="sr-only">Actualizar clave privada Solo Pilates</legend>
                  <div>
                    <label
                      htmlFor="current_pilates_pin"
                      className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
                    >
                      Clave Actual
                    </label>
                    <input
                      id="current_pilates_pin"
                      name="current_pin"
                      type="password"
                      required
                      data-ignore-scanner="true"
                      value={currentPinForChange}
                      onChange={(e) => setCurrentPinForChange(e.target.value)}
                      placeholder="PIN actual"
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs font-mono text-[var(--color-text-title)] outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="new_pilates_pin"
                      className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
                    >
                      Nueva Clave Privada
                    </label>
                    <input
                      id="new_pilates_pin"
                      name="new_pin"
                      type="password"
                      required
                      minLength={4}
                      maxLength={16}
                      data-ignore-scanner="true"
                      value={newPinForChange}
                      onChange={(e) => setNewPinForChange(e.target.value)}
                      placeholder="Mínimo 4 dígitos"
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs font-mono text-[var(--color-text-title)] outline-none focus:border-teal-500"
                    />
                  </div>
                </fieldset>

                {pinChangeMsg && (
                  <p
                    className={`text-xs font-bold ${
                      pinChangeMsg.ok
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {pinChangeMsg.text}
                  </p>
                )}

                <button
                  type="submit"
                  className="rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold px-4 py-2.5 text-xs cursor-pointer"
                >
                  Guardar Nueva Clave Privada
                </button>
              </form>
            </div>

            {/* Registro reciente de accesos 24h Pilates */}
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 space-y-3 shadow-md">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-text-title)]">
                Últimos Accesos 24h Registrados ({attendances.length})
              </h3>
              {attendances.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Aún no hay entradas registradas hoy en Solo Pilates.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {attendances.slice(0, 8).map((att) => (
                    <div
                      key={att.id}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-[var(--color-text-title)] leading-snug break-words">
                          {att.alumno_nombre}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                          {att.codigo_qr} · {att.tipo_plan} ({att.origen_pc})
                        </p>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {att.hora_corta}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL NATIVO <dialog>: ALTA / EDICIÓN DE ALUMNO PILATES + FOTO       */}
      {/* ==================================================================== */}
      <dialog
        ref={studentDialogRef}
        aria-labelledby={studentDialogTitleId}
        className="m-auto w-[95vw] max-w-2xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-0 text-[var(--color-text-body)] shadow-2xl backdrop:bg-slate-950/75 backdrop:backdrop-blur-sm"
      >
        <form
          action="/admin/pilates"
          method="POST"
          onSubmit={handleSaveStudentSubmit}
          className="p-6 sm:p-7 space-y-5"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Solo Pilates · Ficha Individual 24h
              </span>
              <h2
                id={studentDialogTitleId}
                className="text-xl font-extrabold text-[var(--color-text-title)] mt-0.5"
              >
                {editingStudentId ? "Editar Ficha de Alumno Pilates" : "Nuevo Alumno Solo Pilates"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => studentDialogRef.current?.close()}
              aria-label="Cerrar formulario de alumno"
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] cursor-pointer"
            >
              <X size={17} />
            </button>
          </div>

          {/* Bloque de Fotografía Grande para Recepción */}
          <fieldset className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <legend className="px-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Fotografía de Recepción (Vista Grande al Escanear QR)
            </legend>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-teal-500/50 bg-[var(--color-bg-card)] shrink-0 flex items-center justify-center">
                {formFotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={formFotoUrl}
                    alt="Vista previa alumno"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera size={28} className="text-[var(--color-text-secondary)]" />
                )}
              </div>
              <div className="flex-1 space-y-2 w-full">
                <input
                  type="file"
                  name="foto_archivo"
                  accept="image/*"
                  aria-label="Subir fotografía del alumno"
                  onChange={handlePhotoFileChange}
                  className="w-full text-xs text-[var(--color-text-secondary)] file:mr-3 file:rounded-xl file:border-0 file:bg-teal-600 file:px-3.5 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-teal-500 file:cursor-pointer"
                />
                <div className="flex gap-2">
                  <input
                    type="url"
                    name="foto_url_externa"
                    value={formFotoUrl.startsWith("data:") ? "" : formFotoUrl}
                    onChange={(e) => setFormFotoUrl(e.target.value)}
                    placeholder="O pegar enlace https:// de foto opcional..."
                    className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs text-[var(--color-text-title)] outline-none focus:border-teal-500"
                  />
                  {formFotoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormFotoUrl("")}
                      className="rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-rose-500 cursor-pointer"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                {photoUploading && (
                  <p className="text-[11px] text-teal-500 font-semibold">
                    Optimizando fotografía para sincronización instantánea...
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          {/* Datos Personales */}
          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <legend className="sr-only">Datos personales del alumno</legend>
            <div>
              <label
                htmlFor="pil_nombre"
                className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
              >
                Nombre *
              </label>
              <input
                id="pil_nombre"
                name="nombre"
                type="text"
                required
                data-ignore-scanner="true"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Ej: Elena"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs text-[var(--color-text-title)] outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label
                htmlFor="pil_apellidos"
                className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
              >
                Apellidos
              </label>
              <input
                id="pil_apellidos"
                name="apellidos"
                type="text"
                data-ignore-scanner="true"
                value={formApellidos}
                onChange={(e) => setFormApellidos(e.target.value)}
                placeholder="Ej: Martínez Gómez"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs text-[var(--color-text-title)] outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label
                htmlFor="pil_dni"
                className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
              >
                DNI / NIE
              </label>
              <input
                id="pil_dni"
                name="dni"
                type="text"
                data-ignore-scanner="true"
                value={formDni}
                onChange={(e) => setFormDni(e.target.value)}
                placeholder="50881234Z"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs font-mono text-[var(--color-text-title)] outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label
                htmlFor="pil_telefono"
                className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
              >
                Teléfono Móvil
              </label>
              <input
                id="pil_telefono"
                name="telefono"
                type="tel"
                data-ignore-scanner="true"
                value={formTelefono}
                onChange={(e) => setFormTelefono(e.target.value)}
                placeholder="600 123 456"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs text-[var(--color-text-title)] outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label
                htmlFor="pil_email"
                className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
              >
                Email
              </label>
              <input
                id="pil_email"
                name="email"
                type="email"
                data-ignore-scanner="true"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="alumna@correo.es"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs text-[var(--color-text-title)] outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label
                htmlFor="pil_qr"
                className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
              >
                Código QR 24h (Automático si vacío)
              </label>
              <input
                id="pil_qr"
                name="codigo_qr"
                type="text"
                data-ignore-scanner="true"
                value={formCodigoQr}
                onChange={(e) => setFormCodigoQr(e.target.value)}
                placeholder="Autogenerado PIL-XXXX"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs font-mono text-[var(--color-text-title)] outline-none focus:border-teal-500"
              />
            </div>
          </fieldset>

          {/* Plan, Importe y Estado */}
          <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 border-t border-[var(--color-border)]">
            <legend className="sr-only">Modalidad de tarifa o bono Pilates</legend>
            <div className="sm:col-span-2">
              <label
                htmlFor="pil_plan"
                className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
              >
                Modalidad / Bono Solo Pilates
              </label>
              <select
                id="pil_plan"
                name="tipo_plan"
                value={formPlan}
                onChange={(e) => handlePlanChangeInForm(e.target.value as PilatesPlanType)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs font-bold text-[var(--color-text-title)] outline-none focus:border-teal-500"
              >
                {PILATES_PLAN_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.importeSugerido} €)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="pil_importe"
                className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
              >
                Importe (€)
              </label>
              <input
                id="pil_importe"
                name="importe_cuota"
                type="number"
                step="0.01"
                min="0"
                required
                value={formImporte}
                onChange={(e) => setFormImporte(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs font-mono font-bold text-[var(--color-text-title)] outline-none focus:border-teal-500"
              />
            </div>

            {formSelectedPreset.esBono && (
              <div>
                <label
                  htmlFor="pil_sesiones"
                  className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
                >
                  Sesiones Disponibles
                </label>
                <input
                  id="pil_sesiones"
                  name="sesiones_restantes"
                  type="number"
                  min="0"
                  max="100"
                  value={formSesiones}
                  onChange={(e) => setFormSesiones(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs font-mono font-bold text-[var(--color-text-title)] outline-none focus:border-teal-500"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="pil_metodo"
                className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
              >
                Método de Pago Habitual
              </label>
              <select
                id="pil_metodo"
                name="metodo_pago"
                value={formMetodoPago}
                onChange={(e) => setFormMetodoPago(e.target.value as PilatesMetodoPago)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs font-bold text-[var(--color-text-title)] outline-none focus:border-teal-500"
              >
                <option value="TPV">TPV (Tarjeta)</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="SEPA">Domiciliación SEPA</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="pil_estado_cuota"
                className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
              >
                Situación de Cuota
              </label>
              <select
                id="pil_estado_cuota"
                name="estado_cuota"
                value={formEstado === "Baja" ? "Baja" : formEstadoCuota}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "Baja") {
                    setFormEstado("Baja");
                  } else {
                    setFormEstado("Activo");
                    setFormEstadoCuota(val as "Al día" | "Renovación Pendiente");
                  }
                }}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs font-bold text-[var(--color-text-title)] outline-none focus:border-teal-500"
              >
                <option value="Al día">Al día</option>
                <option value="Renovación Pendiente">Renovación Pendiente</option>
                <option value="Baja">Baja Temporal / Inactivo</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="pil_notas"
                className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
              >
                Observaciones de Salud / Posturales / Horario Habitual
              </label>
              <textarea
                id="pil_notas"
                name="notas_salud"
                rows={2}
                data-ignore-scanner="true"
                value={formNotasSalud}
                onChange={(e) => setFormNotasSalud(e.target.value)}
                placeholder="Ej: Cuidado cervical, prefiere reformer mañanas..."
                className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2 text-xs text-[var(--color-text-title)] outline-none focus:border-teal-500"
              />
            </div>
          </fieldset>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => studentDialogRef.current?.close()}
              className="w-full sm:w-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold px-5 py-2.5 text-xs shadow-md cursor-pointer"
            >
              {editingStudentId ? "Guardar Cambios en Ficha" : "Crear Ficha y Generar QR 24h"}
            </button>
          </div>
        </form>
      </dialog>

      {/* ==================================================================== */}
      {/* MODAL NATIVO <dialog>: VISOR Y DESCARGA DE TARJETA QR PIL-XXXX       */}
      {/* ==================================================================== */}
      <dialog
        ref={qrDialogRef}
        aria-labelledby={qrDialogTitleId}
        className="m-auto w-[92vw] max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-0 text-[var(--color-text-body)] shadow-2xl backdrop:bg-slate-950/75 backdrop:backdrop-blur-sm"
      >
        {qrStudent && (
          <div className="p-6 text-center space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Pase Personal QR · Horario Libre 24h
              </span>
              <button
                type="button"
                onClick={() => qrDialogRef.current?.close()}
                aria-label="Cerrar visor de código QR"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <h2
              id={qrDialogTitleId}
              className="text-xl font-extrabold text-[var(--color-text-title)] leading-snug break-words"
            >
              {qrStudent.nombre_completo}
            </h2>

            <div
              ref={qrCanvasWrapperRef}
              className="mx-auto inline-flex items-center justify-center rounded-3xl bg-white p-5 shadow-inner border border-slate-200"
            >
              <QRCodeCanvas
                value={qrStudent.codigo_qr}
                size={210}
                level="H"
                marginSize={2}
              />
            </div>

            <div>
              <p className="font-mono text-lg font-extrabold text-teal-600 dark:text-teal-400">
                {qrStudent.codigo_qr}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {qrStudent.tipo_plan} · Lectura instantánea en los 2 PCs
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleDownloadQrPng}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold px-4 py-2.5 text-xs cursor-pointer"
              >
                <Download size={15} />
                <span>Descargar PNG</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  qrDialogRef.current?.close();
                  handleTriggerLiveScan(qrStudent);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 text-xs cursor-pointer"
              >
                <Play size={15} />
                <span>Probar Escaneo 24h</span>
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* ==================================================================== */}
      {/* MODAL NATIVO <dialog>: COBRO / RENOVACIÓN EN 1 CLIC                  */}
      {/* ==================================================================== */}
      <dialog
        ref={cobroDialogRef}
        aria-labelledby={cobroDialogTitleId}
        className="m-auto w-[94vw] max-w-lg rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-0 text-[var(--color-text-body)] shadow-2xl backdrop:bg-slate-950/75 backdrop:backdrop-blur-sm"
      >
        <form
          action="/admin/pilates"
          method="POST"
          onSubmit={handleCobroSubmit}
          className="p-6 space-y-4"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] pb-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Facturación Aislada · Solo Pilates
              </span>
              <h2
                id={cobroDialogTitleId}
                className="text-lg font-extrabold text-[var(--color-text-title)] mt-0.5"
              >
                Registrar Cobro o Renovación de Bono
              </h2>
            </div>
            <button
              type="button"
              onClick={() => cobroDialogRef.current?.close()}
              aria-label="Cerrar ventana de cobro"
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-1.5 text-[var(--color-text-secondary)] cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <fieldset className="space-y-3">
            <legend className="sr-only">Detalles del cobro Solo Pilates</legend>
            <div>
              <label
                htmlFor="cobro_alumno"
                className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
              >
                Alumno Solo Pilates
              </label>
              <select
                id="cobro_alumno"
                name="student_id"
                value={cobroStudentId}
                onChange={(e) => handleCobroStudentSelect(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs font-bold text-[var(--color-text-title)]"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre_completo} ({s.codigo_qr})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="cobro_plan"
                  className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
                >
                  Plan / Bono a Renovar
                </label>
                <select
                  id="cobro_plan"
                  name="tipo_plan"
                  value={cobroPlan}
                  onChange={(e) => handleCobroPlanChange(e.target.value as PilatesPlanType)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-xs font-bold text-[var(--color-text-title)]"
                >
                  {PILATES_PLAN_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="cobro_importe"
                  className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
                >
                  Importe a Cobrar (€)
                </label>
                <input
                  id="cobro_importe"
                  name="importe"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={cobroImporte}
                  onChange={(e) => setCobroImporte(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-xs font-mono font-bold text-[var(--color-text-title)]"
                />
              </div>

              <div>
                <label
                  htmlFor="cobro_metodo"
                  className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
                >
                  Método de Pago
                </label>
                <select
                  id="cobro_metodo"
                  name="metodo_pago"
                  value={cobroMetodo}
                  onChange={(e) => setCobroMetodo(e.target.value as PilatesMetodoPago)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-xs font-bold text-[var(--color-text-title)]"
                >
                  <option value="TPV">TPV (Tarjeta)</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="SEPA">Domiciliación SEPA</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="cobro_periodo"
                  className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
                >
                  Mes Contable
                </label>
                <select
                  id="cobro_periodo"
                  name="periodo_mes"
                  value={cobroPeriodo}
                  onChange={(e) => setCobroPeriodo(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-xs font-bold text-[var(--color-text-title)]"
                >
                  {BILLING_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {cobroSelectedPreset.esBono && (
              <div>
                <label
                  htmlFor="cobro_sesiones_extra"
                  className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
                >
                  Sesiones a sumar al bono
                </label>
                <input
                  id="cobro_sesiones_extra"
                  name="sesiones_extra"
                  type="number"
                  min="1"
                  max="50"
                  value={cobroSesionesExtra}
                  onChange={(e) => setCobroSesionesExtra(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2 text-xs font-mono font-bold text-[var(--color-text-title)]"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="cobro_notas"
                className="block text-[11px] font-bold uppercase text-[var(--color-text-secondary)] mb-1"
              >
                Notas opcionales del recibo
              </label>
              <input
                id="cobro_notas"
                name="notas"
                type="text"
                data-ignore-scanner="true"
                value={cobroNotas}
                onChange={(e) => setCobroNotas(e.target.value)}
                placeholder="Ej: Pagado en mostrador mañana"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2 text-xs text-[var(--color-text-title)]"
              />
            </div>
          </fieldset>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => cobroDialogRef.current?.close()}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-xs font-bold text-[var(--color-text-secondary)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-5 py-2.5 text-xs shadow-md cursor-pointer"
            >
              Confirmar Cobro y Activar Al Día
            </button>
          </div>
        </form>
      </dialog>

      {/* ==================================================================== */}
      {/* MODAL NATIVO <dialog>: CONFIRMACIÓN SEGURA DE BORRADO                */}
      {/* ==================================================================== */}
      <dialog
        ref={deleteDialogRef}
        aria-labelledby={deleteDialogTitleId}
        className="m-auto w-[92vw] max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-[var(--color-text-body)] shadow-2xl backdrop:bg-slate-950/75 backdrop:backdrop-blur-sm"
      >
        <div className="space-y-4">
          <h2
            id={deleteDialogTitleId}
            className="text-lg font-extrabold text-[var(--color-text-title)]"
          >
            ¿Confirmar eliminación en Solo Pilates?
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed break-words">
            Vas a eliminar permanentemente <strong>{deleteTarget?.label}</strong> del registro de
            Solo Pilates.
          </p>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              autoFocus
              onClick={() => {
                deleteDialogRef.current?.close();
                setDeleteTarget(null);
              }}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-xs font-bold text-[var(--color-text-title)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmDeleteAction}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold px-4 py-2 text-xs cursor-pointer"
            >
              Sí, Eliminar
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
