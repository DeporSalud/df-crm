"use client";

import { useState, useEffect, useRef, useId } from "react";
import TopHeader from "@/components/layout/TopHeader";
import { 
  DollarSign, 
  CreditCard, 
  Coins, 
  Smartphone, 
  Landmark, 
  Building2, 
  Calendar, 
  Filter, 
  Search, 
  Download, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowRight,
  Printer, 
  Receipt, 
  FileSpreadsheet, 
  Sparkles,
  HelpCircle,
  RefreshCw,
  Zap,
  Users,
  Eye,
  Ban,
  FileCode,
  ShieldCheck,
  X
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useSede } from "@/context/SedeContext";
import { getStudentFee, getStudentMonthlyRemittanceFee } from "@/lib/studentFees";
import { 
  isRegularClassStudent, 
  isTeacherProfile, 
  getCurrentSeason, 
  isMatriculaValidForCurrentSeason,
  calculateBonoExpirationDate
} from "@/lib/matriculaService";
import { getEndOfDayMadrid } from "@/lib/timezones";
import { 
  PagoTransaccion, 
  MetodoCobro, 
  SedePago, 
  CategoriaConcepto, 
  CONCEPTOS_RAPIDOS, 
  SEASON_BILLING_MONTHS,
  MONTH_KEYWORDS_BY_NUM,
  getSeasonMonthTitle,
  getDefaultRemesaMonth,
  normalizeSedePago,
  doesPaymentMatchStudent,
  contabilizarRemesaMensualSEPA,
  ContabilizarRemesaResult,
  getHistorialPagos, 
  saveHistorialPagos, 
  generateSeedTransactions, 
  calcularArqueoPorSede, 
  exportarPagosCSV, 
  registrarNuevoPago,
  anularPago
} from "@/lib/pagosService";
import { openGlobalCobro } from "@/components/GlobalCobroModal";
import { getStoredIBAN } from "@/lib/ibanStorage";
import { generateSEPAXml } from "@/lib/sepaGenerator";
import { publishSyncEvent, subscribeSyncEvent } from "@/lib/syncEventBus";

export type MetodoPagoRemesa = "SEPA" | "Stripe" | "Efectivo" | "TPV" | "Transferencia";

export default function PagosYFacturacionPage() {
  const { activeSede } = useSede();
  const confirmDialogRef = useRef<HTMLDialogElement | null>(null);
  const pressedOutsideDialogRef = useRef(false);
  const confirmDialogTitleId = useId();

  // Active View Tab: 'historial' | 'remesas'
  const [activeTab, setActiveTab] = useState<"historial" | "remesas">("historial");

  // Transactions State
  const [pagos, setPagos] = useState<PagoTransaccion[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [assignedClassesMap, setAssignedClassesMap] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Filters for Historial Tab
  const [filterPeriodo, setFilterPeriodo] = useState<string>("all"); // 'all' | 'today' | 'YYYY-MM'
  const [filterSedeLocal, setFilterSedeLocal] = useState<string>("all");
  const [filterMetodo, setFilterMetodo] = useState<string>("all");
  const [filterCategoria, setFilterCategoria] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Receipt Modal State
  const [selectedRecibo, setSelectedRecibo] = useState<PagoTransaccion | null>(null);

  // Remesas Tab State (dynamically selects active/upcoming billing month: day >= 25 -> next month)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getDefaultRemesaMonth());
  const [filterRemesaMetodo, setFilterRemesaMetodo] = useState<string>("all");
  const [paymentMethods, setPaymentMethods] = useState<Record<string, MetodoPagoRemesa>>({});
  const [isAccountingRemesa, setIsAccountingRemesa] = useState(false);
  const [accountedRemesaBanner, setAccountedRemesaBanner] = useState<(ContabilizarRemesaResult & { monthTitle: string }) | null>(null);

  // Load Remesa payment methods
  useEffect(() => {
    try {
      const saved = localStorage.getItem("df_payment_methods");
      if (saved) {
        setPaymentMethods(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleUpdatePaymentMethod = (studentId: string, method: MetodoPagoRemesa) => {
    setPaymentMethods(prev => {
      const updated = { ...prev, [studentId]: method };
      try {
        localStorage.setItem("df_payment_methods", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  // Load Payments, Pending Requests & Students
  const loadData = async () => {
    setIsLoading(true);
    let storedPagos = getHistorialPagos();

    // Fetch live Stripe transactions from API
    try {
      const res = await fetch("/api/stripe/pagos");
      if (res.ok) {
        const json = await res.json();
        if (json.transacciones && Array.isArray(json.transacciones)) {
          const stripeTxs: PagoTransaccion[] = json.transacciones;
          // Re-read fresh localStorage AFTER network await so concurrent writes (desk payments / SEPA remittances) are never clobbered
          const freshStored = getHistorialPagos();
          const localManual = freshStored.filter(p => !p.id.startsWith("stripe_") && !p.numero_recibo.startsWith("STRIPE-"));
          storedPagos = [...stripeTxs, ...localManual];
          if (typeof window !== "undefined") {
            // Persist silently without emitting df_pagos_updated so loadData() never self-loops
            localStorage.setItem("df_pagos_transacciones_v1", JSON.stringify(storedPagos));
          }
        } else {
          storedPagos = getHistorialPagos();
        }
      } else {
        storedPagos = getHistorialPagos();
      }
    } catch (errStripe) {
      console.warn("[Pagos] Error cargando transacciones de Stripe:", errStripe);
      storedPagos = getHistorialPagos();
    }

    setPagos(storedPagos);

    // Fetch Pending Requests (Transfer & Reception) from Supabase
    try {
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
          student_phone: student.telefono,
          bono_nombre: bonoNombre,
          bono_precio: extraInfo || "En recepción",
          metodo_pago: isTransfer ? "Transferencia Bancaria" : "Recepción",
          fecha: "Hoy",
          estado: isTransfer ? "Pendiente de verificación bancaria" : "Pendiente de cobro en Recepción",
          sede: student.sede || "tejar"
        };
      });

      // Pure Supabase Cloud State: ZERO localStorage reliance
      setPendingRequests(dbMapped);
    } catch (e) {
      setPendingRequests([]);
    }

    // Fetch Students
    let queryStudents = supabase.from("alumnos").select("*");
    if (activeSede !== "consolidado") {
      if (activeSede === "tejar") {
        queryStudents = queryStudents.in("sede", ["tejar", "studio", "mostoles"]);
      } else {
        queryStudents = queryStudents.in("sede", ["castilla", "alcorcon"]);
      }
    }
    const { data: studentsData } = await queryStudents;
    setStudents(studentsData || []);

    // Fetch assigned classes
    const { data: enrollments } = await supabase
      .from("alumnos_clases")
      .select(`
        alumno_id,
        clases_cuadrante (
          nombre_clase
        )
      `);

    if (enrollments) {
      const map: Record<string, string[]> = {};
      enrollments.forEach((item: any) => {
        if (!map[item.alumno_id]) map[item.alumno_id] = [];
        if (item.clases_cuadrante?.nombre_clase) {
          map[item.alumno_id].push(item.clases_cuadrante.nombre_clase);
        }
      });
      setAssignedClassesMap(map);
    }

    setIsLoading(false);
  };

  const handleValidarSolicitud = async (req: any) => {
    let clasesToAdd = 4;
    if (req.bono_nombre.includes("8")) clasesToAdd = 8;
    else if (req.bono_nombre.includes("10")) clasesToAdd = 10;
    else if (req.bono_nombre.toLowerCase().includes("ilimitad")) clasesToAdd = 999;
    else if (req.bono_nombre.toLowerCase().includes("suelta")) clasesToAdd = 1;
    else if (req.bono_nombre.toLowerCase().includes("formaci") || req.bono_nombre.toLowerCase().includes("especial")) clasesToAdd = 1;

    let studentDB = null;
    if (req.student_id) {
      const { data } = await supabase.from("alumnos").select("*").eq("id", req.student_id).single();
      studentDB = data;
    }
    if (!studentDB && req.student_email) {
      const { data } = await supabase.from("alumnos").select("*").eq("email", req.student_email).single();
      studentDB = data;
    }

    if (studentDB) {
      const dbPlanStr = String(studentDB.plan_activo || "").toLowerCase();
      const dbEstadoStr = String(studentDB.estado || "").toLowerCase();
      if (!dbPlanStr.includes("pendiente") && !dbEstadoStr.includes("pendiente")) {
        setPendingRequests(prev => prev.filter(r => r.id !== req.id && r.student_id !== req.student_id));
        loadData();
        return;
      }

      const rawCurrentClasses = typeof studentDB.clases_restantes === "number" ? studentDB.clases_restantes : 0;
      const rawExp = calculateBonoExpirationDate(studentDB);
      const isExpired = Boolean(rawExp && Date.now() > getEndOfDayMadrid(rawExp).getTime());
      const currentClasses = isExpired ? 0 : Math.max(0, rawCurrentClasses);

      const cleanPlan = (req.bono_nombre || "").replace(/\s*\(\+[0-9,.]+\s*€?\s*Matr[ií]cula\)/gi, "").trim();
      const isTeacher = isTeacherProfile(studentDB) || (req.bono_nombre || "").toLowerCase().includes("docente") || (req.student_name || "").toLowerCase().includes("docente");
      const isFirstPurchase = !isTeacher && !isRegularClassStudent(studentDB) && (
        req.bono_nombre?.includes("Matrícula") || 
        req.bono_nombre?.includes("Matricula") || 
        req.is_first_bono || 
        !isMatriculaValidForCurrentSeason(studentDB)
      );

      const updateData: Record<string, any> = {
        plan_activo: cleanPlan || req.bono_nombre,
        clases_restantes: clasesToAdd >= 999 ? 999 : currentClasses + clasesToAdd,
        creado_en: new Date().toISOString()
      };
      if (isFirstPurchase) {
        updateData.matricula_pagada = true;
        updateData.matricula_fecha = new Date().toISOString();
        updateData.temporada_matricula = getCurrentSeason();
      }

      let { error: updateErr } = await supabase.from("alumnos").update(updateData).eq("id", studentDB.id);
      if (updateErr && (updateErr.code === "42703" || updateErr.message?.includes("column"))) {
        console.warn("[Pagos] Supabase table doesn't have matricula columns yet, falling back:", updateErr.message);
        const { error: fallbackErr } = await supabase.from("alumnos").update({
          plan_activo: cleanPlan || req.bono_nombre,
          clases_restantes: clasesToAdd >= 999 ? 999 : currentClasses + clasesToAdd,
          creado_en: new Date().toISOString()
        }).eq("id", studentDB.id);
        if (fallbackErr) {
          console.warn("[Pagos] Error in fallback update:", fallbackErr.message);
        }
      } else if (updateErr) {
        console.warn("[Pagos] Error actualizando plan de alumno en Supabase:", updateErr.message);
      }
    }

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

    const isTransfer = (req.metodo_pago || "").toLowerCase().includes("transf");

    registrarNuevoPago({
      alumno_id: studentDB?.id || req.student_id,
      alumno_nombre: req.student_name || "Alumno",
      alumno_dni: studentDB?.dni,
      alumno_telefono: studentDB?.telefono,
      concepto: `Bono: ${req.bono_nombre} (${isTransfer ? "Transferencia Bancaria Confirmada" : "Cobrado Mostrador"})`,
      categoria: "bono",
      importe: importeNum,
      metodo_pago: isTransfer ? "Transferencia" : "Efectivo",
      sede: (studentDB?.sede as SedePago) || "tejar",
      atendido_por: isTransfer ? "Administración / Conciliación Bancaria" : "Recepción Dance Factory",
      notas: "Solicitud validada y clases activadas en el sistema"
    });

    setPendingRequests(prev => prev.filter(r => r.id !== req.id && r.student_id !== req.student_id));
    publishSyncEvent("df_pending_bonos_updated");
    loadData();
  };

  useEffect(() => {
    loadData();

    // Subscribe to real-time events across tabs & devices via canonical syncEventBus
    const unsubscribe = subscribeSyncEvent(
      [
        "df_pagos_updated", 
        "df_pending_bonos_updated", 
        "df_alumnos_updated", 
        "df_student_fees_updated", 
        "df_reservas_updated"
      ],
      () => {
        loadData();
      }
    );

    const handleStorage = () => {
      loadData();
    };
    window.addEventListener("storage", handleStorage);

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadData();
      }
    }, 30000);

    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, [activeSede]);

  // Sync Sede Filter from global SedeContext
  useEffect(() => {
    if (activeSede === "tejar" || activeSede === "castilla") {
      setFilterSedeLocal(activeSede);
    } else {
      setFilterSedeLocal("all");
    }
  }, [activeSede]);

  // Simulate Monthly SEPA Remittance
  const handleSimularRemesaSEPA = () => {
    if (confirm("¿Deseas sincronizar / simular la remesa bancaria SEPA del 1 de Septiembre 2026 en el libro de pagos?")) {
      const freshSeed = generateSeedTransactions();
      saveHistorialPagos(freshSeed);
      setPagos(freshSeed);
      alert("✓ Remesa bancaria SEPA de Septiembre 2026 sincronizada con éxito en el historial de pagos.");
    }
  };

  // Filtered Payments List for Historial Tab
  const todayStr = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

  const normalizeComparable = (val?: string | null) =>
    (val || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  // Regla contable crítica: si p.periodo_mes está definido (ej. "2026-11"), al filtrar por YYYY-MM
  // se compara estrictamente p.periodo_mes === period (para que una remesa de Noviembre contabilizada
  // el 27 de Octubre compute exclusivamente en 2026-11 y jamás ensucie 2026-10).
  const matchesPeriodoContable = (p: PagoTransaccion, period: string): boolean => {
    if (period === "all") return true;
    if (period === "today") return p.fecha_corta === todayStr;
    if (/^\d{4}-\d{2}$/.test(period)) {
      if (p.periodo_mes) {
        return p.periodo_mes === period;
      }
      const [targetYear, targetMonth] = period.split("-");
      const matchesIso = Boolean(p.fecha_hora && p.fecha_hora.startsWith(period));
      const matchesShort = Boolean(
        targetMonth && targetYear && p.fecha_corta && p.fecha_corta.endsWith(`/${targetMonth}/${targetYear}`)
      );
      return matchesIso || matchesShort;
    }
    return true;
  };

  const extraPeriodMonths = Array.from(
    new Set(
      pagos
        .map(p => p.periodo_mes)
        .filter((pm): pm is string => Boolean(pm && /^\d{4}-\d{2}$/.test(pm)))
    )
  )
    .filter(pm => !SEASON_BILLING_MONTHS.some(m => m.value === pm))
    .sort();

  const filteredPagos = pagos.filter(p => {
    if (filterSedeLocal !== "all" && p.sede !== filterSedeLocal) return false;
    if (!matchesPeriodoContable(p, filterPeriodo)) return false;
    if (filterMetodo !== "all" && p.metodo_pago !== filterMetodo) return false;
    if (filterCategoria !== "all" && p.categoria !== filterCategoria) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = (p.alumno_nombre || "").toLowerCase().includes(term);
      const matchDNI = (p.alumno_dni || "").toLowerCase().includes(term);
      const matchRecibo = (p.numero_recibo || "").toLowerCase().includes(term);
      const matchConcepto = (p.concepto || "").toLowerCase().includes(term);
      if (!matchName && !matchDNI && !matchRecibo && !matchConcepto) return false;
    }

    return true;
  });

  // Calculate Metrics
  const totalFacturadoFiltrado = filteredPagos.reduce((acc, p) => acc + (p.estado === "Cobrado" ? p.importe : 0), 0);
  const totalCobrosCount = filteredPagos.length;

  // Arqueo Data (scoped to selected period when filtering Historial by period, or all when "all")
  const pagosForArqueo = filterPeriodo === "all" ? pagos : pagos.filter(p => matchesPeriodoContable(p, filterPeriodo));
  const arqueoObj = calcularArqueoPorSede(pagosForArqueo);
  const arqueoTejar = arqueoObj.tejar;
  const arqueoCastilla = arqueoObj.castilla;

  // Remesas Data
  const regularStudents = students.filter(s => {
    const plan = (s.plan_activo || "").toLowerCase();
    if (plan.includes("sin plan") || plan.includes("pendiente")) return false;
    return plan.includes("regular") || s.plan_activo === "Clases Regulares" || (s.clases_restantes === null && !plan.includes("bono"));
  });

  // Cross-reference desk payments (Efectivo / TPV / Bizum / Transferencia en mostrador):
  // Verifies if a student has already paid their monthly regular fee at reception for selectedMonth
  const getDeskPaymentForStudent = (student: any): PagoTransaccion | undefined => {
    if (!student) return undefined;
    const [yearNum, monthNum] = selectedMonth.split("-");
    const keywords = MONTH_KEYWORDS_BY_NUM[monthNum || ""] || [];

    return pagos.find(p => {
      // Must be a confirmed / completed transaction
      if (p.estado !== "Cobrado" && (p as any).estado !== "Completado" && (p as any).estado !== "Pagado") {
        return false;
      }

      // Must be a reception desk or manual non-automated remittance transaction
      const isDeskOrManual = 
        p.metodo_pago !== "SEPA" || 
        (p.atendido_por && p.atendido_por.toLowerCase().includes("recep")) ||
        !p.id.startsWith("sepa_");
      if (!isDeskOrManual) return false;

      // Canonical sibling-safe identity check: strict UUID match when both IDs exist, fallback to normalized full name only if an ID is missing
      if (!doesPaymentMatchStudent(p, student)) return false;

      // Match monthly fee category or concept
      const isMonthlyFee = 
        p.categoria === "mensualidad" ||
        (p.concepto && (p.concepto.toLowerCase().includes("mensual") || p.concepto.toLowerCase().includes("cuota")));
      if (!isMonthlyFee) return false;

      // Strict period check when periodo_mes is defined
      if (p.periodo_mes) {
        return p.periodo_mes === selectedMonth;
      }

      // Fallback when periodo_mes is not defined
      const isSameMonth = 
        (p.fecha_hora && p.fecha_hora.startsWith(selectedMonth)) ||
        (p.fecha_corta && yearNum && monthNum && p.fecha_corta.endsWith(`/${monthNum}/${yearNum}`)) ||
        (p.concepto && p.concepto.toLowerCase().includes(selectedMonth.toLowerCase()));

      const matchesKeyword = keywords.some(k => p.concepto && p.concepto.toLowerCase().includes(k));

      return Boolean(isSameMonth || matchesKeyword);
    });
  };

  // Cross-reference SEPA remittance receipts already accounted in the app for selectedMonth
  const getSepaAccountedPaymentForStudent = (student: any): PagoTransaccion | undefined => {
    if (!student) return undefined;

    return pagos.find(p => {
      if (p.estado !== "Cobrado") return false;
      if (p.categoria !== "mensualidad") return false;

      const isSepaRemesa =
        p.metodo_pago === "SEPA" &&
        p.id.startsWith("sepa_") &&
        !(p.atendido_por && p.atendido_por.toLowerCase().includes("recep"));
      if (!isSepaRemesa) return false;

      // Canonical sibling-safe identity check: strict UUID match when both IDs exist, fallback to normalized full name only if an ID is missing
      if (!doesPaymentMatchStudent(p, student)) return false;

      if (p.periodo_mes) {
        return p.periodo_mes === selectedMonth;
      }
      return p.id.startsWith(`sepa_${selectedMonth}_`) || (selectedMonth === "2026-09" && p.id.startsWith("sepa_sep_"));
    });
  };

  // Determine Remittance Eligibility Status for a Student
  const getStudentRemittanceStatus = (student: any): {
    status: "eligible" | "sepa_accounted" | "desk_paid" | "cash_method" | "other_method";
    label: string;
    deskPayment?: PagoTransaccion;
    sepaPayment?: PagoTransaccion;
  } => {
    // 1. Strict desk payment check: already paid at reception
    const deskPayment = getDeskPaymentForStudent(student);
    if (deskPayment) {
      return {
        status: "desk_paid",
        label: "Cobrado Mostrador — Excluido",
        deskPayment
      };
    }

    // 2. Strict method check: Efectivo is completely excluded from SEPA debit files
    const currentMethod = paymentMethods[student.id] || "SEPA";
    if (currentMethod === "Efectivo") {
      return {
        status: "cash_method",
        label: "Efectivo / Mostrador"
      };
    }

    // 3. Other non-SEPA direct debit methods (Stripe, TPV, Transferencia)
    if (currentMethod !== "SEPA") {
      return {
        status: "other_method",
        label: currentMethod
      };
    }

    // 4. Already accounted in app incomes via SEPA remittance for selectedMonth
    const sepaPayment = getSepaAccountedPaymentForStudent(student);
    if (sepaPayment) {
      return {
        status: "sepa_accounted",
        label: "Contabilizado en Ingresos",
        sepaPayment
      };
    }

    // 5. Eligible & pending to account in app incomes
    return {
      status: "eligible",
      label: "Listo para Remesa"
    };
  };

  const filteredRemesaStudents = regularStudents.filter(s => {
    const matchesSearch = 
      (s.nombre_completo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.dni || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.telefono || "").includes(searchTerm);

    const normalizedStudentSede = normalizeSedePago(s.sede);
    const matchesSede = filterSedeLocal === "all" || normalizedStudentSede === filterSedeLocal || s.sede === filterSedeLocal;
    const studentMetodo: MetodoPagoRemesa = paymentMethods[s.id] || "SEPA";
    const matchesMetodo = filterRemesaMetodo === "all" || studentMetodo === filterRemesaMetodo;

    return matchesSearch && matchesSede && matchesMetodo;
  });

  // Multi-month Remesas Calculations
  const isSepMonth = selectedMonth === "2026-09" || selectedMonth.toLowerCase().includes("sep");
  const getStudentRemittanceData = (student: any) => {
    const fee = getStudentFee(student);
    const anticipo = isSepMonth ? fee.adelanto : 0;
    const neto = isSepMonth ? fee.netoSep : fee.cuotaBase;
    return {
      cuotaBase: fee.cuotaBase,
      anticipo,
      neto,
      claseNombre: fee.claseNombre
    };
  };

  // SEPA XML Export includes all domiciled SEPA students for the month (both pending 'eligible' AND already 'sepa_accounted')
  // while strictly excluding 'desk_paid', 'cash_method', and 'other_method'
  const sepaExportStudents = filteredRemesaStudents.filter(s => {
    const remStatus = getStudentRemittanceStatus(s);
    return remStatus.status === "eligible" || remStatus.status === "sepa_accounted";
  });

  // Pending SEPA students to dump into the app's income ledger (strictly 'eligible' only -> 0 duplicates)
  const pendingSepaToAccountStudents = filteredRemesaStudents.filter(s => {
    return getStudentRemittanceStatus(s).status === "eligible";
  });

  const sepaAccountedStudentsCount = filteredRemesaStudents.filter(s => getStudentRemittanceStatus(s).status === "sepa_accounted").length;
  const deskPaidStudentsCount = filteredRemesaStudents.filter(s => getStudentRemittanceStatus(s).status === "desk_paid").length;
  const cashMethodStudentsCount = filteredRemesaStudents.filter(s => getStudentRemittanceStatus(s).status === "cash_method").length;
  const totalExcludedCount = filteredRemesaStudents.length - sepaExportStudents.length;

  const totalRegularCount = regularStudents.length;
  const totalNetToRemit = regularStudents.reduce((acc, s) => acc + getStudentRemittanceData(s).neto, 0);
  const totalSepaNetToRemit = sepaExportStudents.reduce((acc, s) => acc + getStudentRemittanceData(s).neto, 0);
  const totalGrossBilling = regularStudents.reduce((acc, s) => acc + getStudentFee(s).cuotaBase, 0);

  // Breakdown for Confirmation Modal (pending to account)
  const pendingSepaTotalNet = pendingSepaToAccountStudents.reduce((acc, s) => acc + getStudentRemittanceData(s).neto, 0);
  const pendingTejarStudents = pendingSepaToAccountStudents.filter(s => normalizeSedePago(s.sede) === "tejar");
  const pendingCastillaStudents = pendingSepaToAccountStudents.filter(s => normalizeSedePago(s.sede) === "castilla");
  const pendingTejarNet = pendingTejarStudents.reduce((acc, s) => acc + getStudentRemittanceData(s).neto, 0);
  const pendingCastillaNet = pendingCastillaStudents.reduce((acc, s) => acc + getStudentRemittanceData(s).neto, 0);
  const selectedMonthTitle = getSeasonMonthTitle(selectedMonth);

  const openConfirmContabilizarModal = () => {
    if (pendingSepaToAccountStudents.length === 0) return;
    const dlg = confirmDialogRef.current;
    if (dlg && !dlg.open) {
      dlg.showModal();
    }
  };

  const closeConfirmContabilizarModal = () => {
    const dlg = confirmDialogRef.current;
    if (dlg && dlg.open) {
      dlg.close();
    }
  };

  const handleConfirmContabilizarRemesa = () => {
    if (isAccountingRemesa || pendingSepaToAccountStudents.length === 0) return;
    setIsAccountingRemesa(true);
    try {
      const batchItems = pendingSepaToAccountStudents.map(s => {
        const feeData = getStudentRemittanceData(s);
        const assignedNames = (assignedClassesMap[s.id] || []).join(" / ") || feeData.claseNombre || "Clases Regulares";
        return {
          alumno_id: s.id,
          alumno_nombre: s.nombre_completo || "Alumno Dance Factory",
          alumno_dni: s.dni || undefined,
          alumno_telefono: s.telefono || undefined,
          sede: s.sede,
          importe: feeData.neto,
          cuota_base: feeData.cuotaBase,
          anticipo: feeData.anticipo,
          clase_nombre: assignedNames
        };
      });

      const result = contabilizarRemesaMensualSEPA(batchItems, selectedMonth);
      setPagos(getHistorialPagos());
      setAccountedRemesaBanner({
        ...result,
        monthTitle: selectedMonthTitle
      });
      closeConfirmContabilizarModal();
    } finally {
      setIsAccountingRemesa(false);
    }
  };

  const handleGoToAccountedHistorial = (periodoMes: string) => {
    setFilterPeriodo(periodoMes);
    setFilterMetodo("all");
    setFilterCategoria("all");
    setActiveTab("historial");
  };

  const handleExportSEPA = () => {
    handleExportSEPAXML();
  };

  const handleExportSEPAXML = () => {
    if (sepaExportStudents.length === 0 && filteredRemesaStudents.length > 0) {
      if (!confirm(`No hay alumnos con domiciliación SEPA pendientes para ${selectedMonth} (todos los alumnos están excluidos por pago previo en mostrador o método Efectivo). ¿Deseas generar igualmente el fichero XML de control vacío con CtrlSum 0.00€?`)) {
        return;
      }
    }

    const enrichedSepaStudents = sepaExportStudents.map(s => {
      const feeData = getStudentRemittanceData(s);
      const assignedNames = (assignedClassesMap[s.id] || []).join(" / ") || feeData.claseNombre || s.plan_activo || "Cuota Regular";
      return {
        ...s,
        cuota_base: feeData.cuotaBase,
        adelanto: feeData.anticipo,
        clase: assignedNames
      };
    });

    const sepaResult = generateSEPAXml(
      enrichedSepaStudents, 
      selectedMonth, 
      paymentMethods, 
      assignedClassesMap,
      pagos
    );
    const xmlContent = typeof sepaResult === "string" ? sepaResult : sepaResult.xml;
    const blob = new Blob([xmlContent], { type: "application/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `remesa_sepa_iso20022_${selectedMonth}_dance_factory_${activeSede}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert(
      `✓ Fichero bancario SEPA XML generado con éxito (pain.008.001.02):\n\n` +
      `• Recibos incluidos en remesa: ${sepaResult.txCount}\n` +
      `• Importe total remesado: ${sepaResult.totalAmount.toFixed(2)} €\n` +
      `• Alumnos excluidos por pago previo en mostrador: ${deskPaidStudentsCount}\n` +
      `• Alumnos excluidos por método Efectivo: ${cashMethodStudentsCount}\n` +
      `• Total alumnos blindados de cobro duplicado: ${totalExcludedCount}`
    );
  };

  const handleExportSEPACsv = () => {
    const headers = [
      "Nombre Completo", 
      "DNI", 
      "Sede", 
      "Clase Asignada", 
      "Cuota Base (€)", 
      "Anticipo Abonado (€)", 
      "Neto a Remesar (€)", 
      "Metodo de Pago", 
      "Estado Remesa",
      "Detalle Cobro / Recibo"
    ];
    const rows = filteredRemesaStudents.map(s => {
      const data = getStudentRemittanceData(s);
      const metodo = paymentMethods[s.id] || "SEPA";
      const remStatus = getStudentRemittanceStatus(s);
      const estadoStr = remStatus.status === "eligible" 
        ? "Listo para remesar" 
        : remStatus.status === "sepa_accounted"
          ? "Contabilizado en Ingresos (SEPA)"
          : remStatus.status === "desk_paid" 
            ? "Excluido - Pagado en Mostrador" 
            : "Excluido - Método " + metodo;
      const deskDetail = remStatus.deskPayment 
        ? `${remStatus.deskPayment.metodo_pago} (${remStatus.deskPayment.importe.toFixed(2)}€ el ${remStatus.deskPayment.fecha_corta})` 
        : remStatus.sepaPayment
          ? `SEPA ${remStatus.sepaPayment.numero_recibo} (${remStatus.sepaPayment.importe.toFixed(2)}€)`
          : "";
      const normSede = normalizeSedePago(s.sede);

      return [
        `"${s.nombre_completo || ''}"`,
        `"${s.dni || 'PENDIENTE'}"`,
        `"${normSede === 'tejar' ? 'Studio 1 Plaza El Tejar' : 'Studio 2 Paseo Castilla'}"`,
        `"${(assignedClassesMap[s.id] || []).join(' / ') || data.claseNombre || 'Clase Regular'}"`,
        data.cuotaBase.toFixed(2),
        (-data.anticipo).toFixed(2),
        data.neto.toFixed(2),
        `"${metodo}"`,
        `"${estadoStr}"`,
        `"${deskDetail}"`
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `remesa_resumen_${selectedMonth}_dance_factory_${activeSede}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAnularPago = (pagoId: string, alumnoNombre: string) => {
    if (confirm(`¿Estás seguro de que deseas anular el cobro de ${alumnoNombre}?`)) {
      anularPago(pagoId);
      setPagos(getHistorialPagos());
    }
  };

  const getMetodoIcon = (metodo: MetodoCobro | MetodoPagoRemesa) => {
    switch (metodo) {
      case "Efectivo": return <Coins size={14} className="text-emerald-400" />;
      case "TPV": return <CreditCard size={14} className="text-cyan-400" />;
      case "Bizum": return <Smartphone size={14} className="text-rose-400" />;
      case "SEPA": return <Landmark size={14} className="text-amber-400" />;
      case "Stripe": return <CreditCard size={14} className="text-indigo-400" />;
      default: return <Landmark size={14} className="text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* TopHeader */}
      <TopHeader 
        title="Pagos, Facturación & Remesas SEPA" 
        subtitle="Control de ingresos de caja, historial de cobros y emisión de remesas bancarias" 
      />

      {/* Tarjetas KPI de Resumen Financiero y Arqueo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">Total Facturado</span>
          <h3 className="text-2xl font-bold font-mono text-emerald-400 mt-1">{totalFacturadoFiltrado.toFixed(2)} €</h3>
          <span className="text-[10px] text-[var(--color-text-secondary)]">{totalCobrosCount} transacciones registradas</span>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">Caja Studio 1 (El Tejar)</span>
          <h3 className="text-2xl font-bold font-mono text-cyan-400 mt-1">{arqueoTejar.totalRecaudado.toFixed(2)} €</h3>
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            Efectivo: {arqueoTejar.totalEfectivo.toFixed(2)}€ • TPV: {arqueoTejar.totalTPV.toFixed(2)}€
            {arqueoTejar.totalSEPA > 0 ? ` • SEPA: ${arqueoTejar.totalSEPA.toFixed(2)}€` : ""}
          </span>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">Caja Studio 2 (Castilla)</span>
          <h3 className="text-2xl font-bold font-mono text-amber-400 mt-1">{arqueoCastilla.totalRecaudado.toFixed(2)} €</h3>
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            Efectivo: {arqueoCastilla.totalEfectivo.toFixed(2)}€ • TPV: {arqueoCastilla.totalTPV.toFixed(2)}€
            {arqueoCastilla.totalSEPA > 0 ? ` • SEPA: ${arqueoCastilla.totalSEPA.toFixed(2)}€` : ""}
          </span>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">Previsión Remesa SEPA {selectedMonth}</span>
          <h3 className="text-2xl font-bold font-mono text-purple-400 mt-1">{totalSepaNetToRemit.toFixed(2)} €</h3>
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            {sepaExportStudents.length} domiciliados ({sepaAccountedStudentsCount} contabilizados • {totalExcludedCount} excluidos)
          </span>
        </div>
      </div>
      
      {/* Top Action Header & Tab Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-[var(--color-border)]">
        
        {/* Unified Module Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm overflow-x-auto max-w-full shrink-0">
          <button
            onClick={() => setActiveTab("historial")}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === "historial"
                ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/30"
                : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            <Receipt size={15} className="shrink-0" />
            <span>Historial de Cobros</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
              {pagos.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("remesas")}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === "remesas"
                ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/30"
                : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            <Landmark size={15} className="shrink-0" />
            <span>Remesas Bancarias SEPA</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 font-mono">
              {totalRegularCount}
            </span>
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-start lg:justify-end">
          {activeTab === "historial" && (
            <button
              onClick={() => exportarPagosCSV(filteredPagos)}
              className="px-3.5 py-2 rounded-xl bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] text-xs font-bold text-slate-300 hover:text-white border border-[var(--color-border)] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap shrink-0"
            >
              <Download size={14} className="shrink-0" />
              <span>Exportar CSV</span>
            </button>
          )}

          {activeTab === "remesas" && (
            <div className="flex items-center gap-2 flex-wrap justify-start lg:justify-end">
              <span 
                className="hidden 2xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] font-semibold cursor-help whitespace-nowrap shrink-0"
                title="Blindaje de Cobros: Los alumnos con método 'Efectivo' o que ya hayan liquidado su mensualidad en mostrador quedan automáticamente excluidos de este fichero bancario y del volcado contable para evitar cobros duplicados."
              >
                <HelpCircle size={13} className="text-amber-400 shrink-0" />
                <span>Shield Doble Cobro Activo</span>
              </span>

              <button
                type="button"
                onClick={openConfirmContabilizarModal}
                disabled={pendingSepaToAccountStudents.length === 0}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-md whitespace-nowrap shrink-0 ${
                  pendingSepaToAccountStudents.length > 0
                    ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25 cursor-pointer"
                    : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 cursor-default"
                }`}
                title={
                  pendingSepaToAccountStudents.length > 0
                    ? `Registrar los ${pendingSepaToAccountStudents.length} recibos SEPA de ${selectedMonthTitle} en el Historial de Ingresos`
                    : sepaAccountedStudentsCount > 0
                      ? `Todos los recibos SEPA de ${selectedMonthTitle} ya están contabilizados en Ingresos`
                      : "No hay recibos SEPA pendientes de contabilizar en este mes"
                }
              >
                <CheckCircle2 size={14} className="shrink-0" />
                <span>
                  {pendingSepaToAccountStudents.length === 0 && sepaAccountedStudentsCount > 0
                    ? `Remesa Contabilizada (${sepaAccountedStudentsCount})`
                    : `Contabilizar Remesa en Ingresos (${pendingSepaToAccountStudents.length})`}
                </span>
              </button>

              <button
                onClick={handleExportSEPACsv}
                className="px-3 py-2 rounded-xl bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] text-xs font-bold text-slate-300 hover:text-white border border-[var(--color-border)] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                title="Exportar resumen de remesas en CSV"
              >
                <FileSpreadsheet size={14} className="text-emerald-400 shrink-0" />
                <span>Resumen CSV</span>
              </button>
              <button
                onClick={handleExportSEPAXML}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-amber-400/20 cursor-pointer whitespace-nowrap shrink-0"
                title="Descargar Fichero XML ISO 20022 pain.008.001.02 Norma 19 (Excluye alumnos de Efectivo y pagos en mostrador)"
              >
                <Download size={14} className="shrink-0" />
                <span>Descargar SEPA XML ({sepaExportStudents.length})</span>
              </button>
            </div>
          )}

          <button
            onClick={() => openGlobalCobro()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:brightness-110 text-white text-xs font-extrabold transition-all shadow-md shadow-[var(--color-primary)]/30 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus size={15} className="shrink-0" />
            <span>Cobrar en Recepción</span>
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* TAB 1: HISTORIAL COMPLETO DE COBROS */}
      {/* ========================================================================= */}
      {activeTab === "historial" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Pending Requests & Transfer Reconciliations Alert Banner */}
          {pendingRequests.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 shadow-lg shadow-amber-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    {pendingRequests.length} Solicitud(es) de Bono / Transferencia Pendientes de Validación
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Requiere confirmación contable</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {pendingRequests.map((req, idx) => (
                  <div
                    key={req.id || idx}
                    className="p-3 rounded-xl bg-[var(--color-bg)]/80 border border-amber-500/20 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-white truncate">{req.student_name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                          {req.metodo_pago}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {req.bono_nombre} • <span className="text-emerald-400 font-bold">{req.bono_precio}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleValidarSolicitud(req)}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      <CheckCircle2 size={13} />
                      <span>Validar e Ingresar</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3.5 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            
            {/* Search input */}
            <div className="relative w-full md:w-80">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por alumno, DNI, recibo o concepto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs focus:outline-none focus:border-[var(--color-primary)] placeholder:text-slate-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
              
              {/* Period Filter */}
              <select
                value={filterPeriodo}
                onChange={(e) => setFilterPeriodo(e.target.value)}
                className="bg-[var(--color-bg)] text-[var(--color-text-title)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="all">📅 Todo el Historial</option>
                <option value="today">⚡ Solo Hoy ({todayStr})</option>
                {SEASON_BILLING_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.historialLabel}
                  </option>
                ))}
                {extraPeriodMonths.map((pm) => (
                  <option key={pm} value={pm}>
                    🗓️ {getSeasonMonthTitle(pm)}
                  </option>
                ))}
              </select>

              {/* Sede Filter */}
              <select
                value={filterSedeLocal}
                onChange={(e) => setFilterSedeLocal(e.target.value)}
                className="bg-[var(--color-bg)] text-[var(--color-text-title)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="all">🏢 Todas las Sedes</option>
                <option value="tejar">Studio 1 (El Tejar)</option>
                <option value="castilla">Studio 2 (Castilla)</option>
              </select>

              {/* Method Filter */}
              <select
                value={filterMetodo}
                onChange={(e) => setFilterMetodo(e.target.value)}
                className="bg-[var(--color-bg)] text-[var(--color-text-title)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="all">💳 Todos los Métodos</option>
                <option value="Efectivo">💵 Efectivo</option>
                <option value="TPV">💳 Tarjeta (TPV)</option>
                <option value="Bizum">📱 Bizum</option>
                <option value="SEPA">🏛️ Domiciliación SEPA</option>
                <option value="Stripe">⚡ Pasarela Stripe</option>
                <option value="Transferencia">🏦 Transferencia</option>
              </select>

              {/* Category Filter */}
              <select
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="bg-[var(--color-bg)] text-[var(--color-text-title)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="all">📦 Todos los Conceptos</option>
                <option value="mensualidad">Mensualidad</option>
                <option value="bono">Bonos de Clases</option>
                <option value="matricula">Matrícula / Reserva</option>
                <option value="merchandising">Ropa / Merchandising</option>
                <option value="clase_suelta">Clase Suelta</option>
              </select>

            </div>

          </div>

          {/* Payments Table */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg">
            <div tabIndex={0} role="region" aria-label="Tabla de historial de cobros" className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Alumno</th>
                    <th className="py-3.5 px-4">Concepto</th>
                    <th className="py-3.5 px-4">Sede</th>
                    <th className="py-3.5 px-4">Método</th>
                    <th className="py-3.5 px-4 text-right">Importe</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]/50 text-xs">
                  {filteredPagos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Coins size={32} className="mx-auto mb-2 opacity-40 text-slate-500" />
                        <p className="font-semibold">No se han encontrado pagos con los filtros seleccionados.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPagos.map((pago) => (
                      <tr 
                        key={pago.id} 
                        onClick={() => setSelectedRecibo(pago)}
                        className="hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                      >
                        
                        <td className="py-3 px-4">
                          <span className="font-bold text-[var(--color-text-title)] block">{pago.alumno_nombre}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{pago.alumno_dni || pago.alumno_telefono || "Mostrador"}</span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-200 block truncate max-w-xs">{pago.concepto}</span>
                          <span className="text-[10px] uppercase font-bold text-[var(--color-secondary)]">
                            {pago.categoria}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                            pago.sede === "tejar"
                              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}>
                            {pago.sede === "tejar" ? "Studio 1" : "Studio 2"}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                            {getMetodoIcon(pago.metodo_pago)}
                            <span>{pago.metodo_pago}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className={`font-mono font-bold text-sm ${pago.estado === 'Anulado' ? 'text-slate-500 line-through' : 'text-emerald-400'}`}>
                            +{pago.importe.toFixed(2)} €
                          </span>
                          {pago.estado === "Anulado" && (
                            <span className="block text-[9px] font-bold text-rose-400 uppercase">Anulado</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedRecibo(pago)}
                              className="p-1.5 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors"
                              title="Ver / Imprimir Recibo Oficial"
                            >
                              <Receipt size={14} />
                            </button>
                            {pago.estado === "Cobrado" && (
                              <button
                                onClick={() => handleAnularPago(pago.id, pago.alumno_nombre)}
                                className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors"
                                title="Anular Transacción"
                              >
                                <Ban size={14} />
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: REMESAS BANCARIAS SEPA & DOMICILIACIONES */}
      {/* ========================================================================= */}
      {activeTab === "remesas" && (
        <div className="space-y-4 animate-in fade-in duration-200">

          {/* Success Banner after accounting SEPA remittance in Incomes */}
          {accountedRemesaBanner && (
            <div className="bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-lg shadow-emerald-500/10 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/40">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-emerald-300 text-sm">
                      Remesa de {accountedRemesaBanner.monthTitle} contabilizada en Ingresos
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">
                      +{accountedRemesaBanner.totalAmountCreated.toFixed(2)} € ({accountedRemesaBanner.createdCount} recibos)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Studio 1 (El Tejar): <span className="font-bold text-white">{accountedRemesaBanner.tejarCount}</span> recibos ({accountedRemesaBanner.tejarAmount.toFixed(2)} €) • Studio 2 (Castilla): <span className="font-bold text-white">{accountedRemesaBanner.castillaCount}</span> recibos ({accountedRemesaBanner.castillaAmount.toFixed(2)} €). Imputado estrictamente en <span className="font-mono text-emerald-300">{accountedRemesaBanner.periodoMes}</span>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => handleGoToAccountedHistorial(accountedRemesaBanner.periodoMes)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/25 cursor-pointer"
                >
                  <span>Ver en Historial de Cobros</span>
                  <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setAccountedRemesaBanner(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                  aria-label="Cerrar aviso de remesa contabilizada"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
          
          {/* SEPA Cross-Billing & Double-Charge Shield Banner */}
          <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <Zap size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-amber-300 text-sm">Blindaje Anti-Doble Cargo SEPA</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                    Activo
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Los alumnos con método <span className="font-bold text-white">"Efectivo"</span> ({cashMethodStudentsCount}) o que ya hayan liquidado su mensualidad en mostrador ({deskPaidStudentsCount}) quedan <span className="text-amber-300 font-semibold underline">estrictamente excluidos</span> del fichero bancario SEPA XML y del volcado contable para eliminar cualquier riesgo de cobro duplicado.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] bg-slate-900/80 px-3.5 py-2 rounded-xl border border-white/10 self-stretch sm:self-auto justify-center">
              <div className="text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Domiciliados</span>
                <span className="font-extrabold text-emerald-400 text-sm">{sepaExportStudents.length}</span>
              </div>
              <div className="h-6 w-px bg-white/10 mx-1"></div>
              <div className="text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Contabilizados</span>
                <span className="font-extrabold text-cyan-400 text-sm">{sepaAccountedStudentsCount}</span>
              </div>
              <div className="h-6 w-px bg-white/10 mx-1"></div>
              <div className="text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Excluidos</span>
                <span className="font-extrabold text-amber-400 text-sm">{totalExcludedCount}</span>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3.5 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            
            <div className="relative w-full md:w-80">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar alumno regular o DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs focus:outline-none focus:border-[var(--color-primary)] placeholder:text-slate-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
              
              <div className="flex items-center gap-2 bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 rounded-xl text-xs">
                <Calendar size={13} className="text-amber-400" />
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-[var(--color-primary)] font-bold text-xs outline-none cursor-pointer"
                >
                  {SEASON_BILLING_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.remesaLabel}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={filterRemesaMetodo}
                onChange={(e) => setFilterRemesaMetodo(e.target.value)}
                className="bg-[var(--color-bg)] text-[var(--color-text-title)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="all">💳 Vía: Todas</option>
                <option value="SEPA">🏛️ Solo Domiciliación SEPA</option>
                <option value="Stripe">⚡ Solo Stripe</option>
                <option value="Efectivo">💵 Solo Efectivo / Recepción</option>
              </select>

            </div>

          </div>

          {/* Table */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg">
            <div tabIndex={0} role="region" aria-label="Tabla de remesas bancarias SEPA" className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 whitespace-nowrap">Alumno / DNI</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Sede / Clase</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">Cuota Base</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">
                      {isSepMonth ? "Anticipo Sep" : "Anticipo Mes"}
                    </th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">Neto a Remesar</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Vía de Cobro</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]/50 text-xs">
                  {filteredRemesaStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Users size={32} className="mx-auto mb-2 opacity-40 text-slate-500" />
                        <p className="font-semibold">No hay alumnos regulares en este filtro.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRemesaStudents.map((student) => {
                      const feeData = getStudentRemittanceData(student);
                      const currentMethod = paymentMethods[student.id] || "SEPA";
                      const assignedNames = (assignedClassesMap[student.id] || []).join(" / ") || feeData.claseNombre || "Clases Regulares";
                      const remStatus = getStudentRemittanceStatus(student);
                      const normSede = normalizeSedePago(student.sede);

                      return (
                        <tr key={student.id} className="hover:bg-[var(--color-bg-hover)] transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-[var(--color-text-title)] block">{student.nombre_completo}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{student.dni || "Sin DNI"}</span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-200 block truncate max-w-xs">{assignedNames}</span>
                            <span className="text-[10px] text-slate-400">
                              {normSede === "tejar" ? "Studio 1 (Tejar)" : "Studio 2 (Castilla)"}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="font-mono font-semibold text-slate-300 whitespace-nowrap inline-block">
                              {feeData.cuotaBase.toFixed(2)} €
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {feeData.anticipo > 0 ? (
                              <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 whitespace-nowrap inline-block">
                                -{feeData.anticipo.toFixed(2)} €
                              </span>
                            ) : (
                              <span className="font-mono text-slate-500 text-xs whitespace-nowrap inline-block">
                                0,00 €
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className={`font-mono font-black text-sm px-2.5 py-1 rounded-xl border whitespace-nowrap inline-block ${
                              remStatus.status === "eligible"
                                ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                                : remStatus.status === "sepa_accounted"
                                  ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
                                  : remStatus.status === "desk_paid"
                                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                    : "text-slate-400 bg-slate-500/10 border-slate-500/20"
                            }`}>
                              {feeData.neto.toFixed(2)} €
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <select
                              value={currentMethod}
                              onChange={(e) => handleUpdatePaymentMethod(student.id, e.target.value as MetodoPagoRemesa)}
                              className="bg-[var(--color-bg)] text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-[var(--color-border)] outline-none cursor-pointer"
                            >
                              <option value="SEPA">🏛️ Domiciliación SEPA</option>
                              <option value="Stripe">⚡ Pasarela Stripe</option>
                              <option value="Efectivo">💵 Efectivo / Mostrador</option>
                              <option value="TPV">💳 Datáfono TPV</option>
                              <option value="Transferencia">🏦 Transferencia</option>
                            </select>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {remStatus.status === "desk_paid" ? (
                              <span 
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 cursor-help whitespace-nowrap"
                                title={`Cuota de ${selectedMonth} ya liquidada en recepción (${remStatus.deskPayment?.metodo_pago}) el ${remStatus.deskPayment?.fecha_corta}. Excluido estrictamente del SEPA XML y del volcado contable.`}
                              >
                                <CheckCircle2 size={11} className="text-amber-400 shrink-0" />
                                <span>Cobrado Mostrador — Excluido</span>
                              </span>
                            ) : remStatus.status === "sepa_accounted" ? (
                              <span 
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30 cursor-help whitespace-nowrap"
                                title={`Recibo SEPA ${remStatus.sepaPayment?.numero_recibo || ""} ya contabilizado en Ingresos para ${selectedMonth}. Incluido en descarga SEPA XML y protegido frente a duplicados.`}
                              >
                                <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                                <span>Contabilizado en Ingresos</span>
                              </span>
                            ) : remStatus.status === "cash_method" ? (
                              <span 
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-500/10 px-2.5 py-1 rounded-full border border-slate-500/20 cursor-help whitespace-nowrap"
                                title="Alumno con pago presencial en Efectivo. Excluido estrictamente de la remesa bancaria."
                              >
                                <Coins size={11} className="text-slate-400 shrink-0" />
                                <span>Efectivo (Excluido SEPA)</span>
                              </span>
                            ) : remStatus.status === "other_method" ? (
                              <span 
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 whitespace-nowrap"
                                title={`Cobro gestionado por ${remStatus.label}. Excluido de remesa bancaria.`}
                              >
                                <span>Excluido ({remStatus.label})</span>
                              </span>
                            ) : (
                              <span 
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/25 whitespace-nowrap"
                                title="Listo para contabilizar en ingresos e incluir en el fichero SEPA XML ISO 20022"
                              >
                                <CheckCircle2 size={11} className="shrink-0" /> Listo para Remesa
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* CONFIRMATION MODAL: CONTABILIZAR REMESA SEPA EN INGRESOS */}
      <dialog
        ref={confirmDialogRef}
        aria-labelledby={confirmDialogTitleId}
        onPointerDown={(e) => {
          const dlg = confirmDialogRef.current;
          if (!dlg) return;
          const r = dlg.getBoundingClientRect();
          pressedOutsideDialogRef.current =
            e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        }}
        onPointerUp={(e) => {
          const dlg = confirmDialogRef.current;
          if (!dlg || !pressedOutsideDialogRef.current) return;
          const r = dlg.getBoundingClientRect();
          const releasedOutside =
            e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
          if (releasedOutside) {
            closeConfirmContabilizarModal();
          }
          pressedOutsideDialogRef.current = false;
        }}
        className="m-auto p-0 bg-transparent border-0 max-w-lg w-[calc(100%-2rem)] text-white overscroll-contain backdrop:bg-black/80 backdrop:backdrop-blur-sm backdrop:overflow-hidden backdrop:overscroll-contain"
      >
        <div className="bg-[#0e1628] border border-[var(--color-border)] rounded-3xl p-6 space-y-5 shadow-2xl relative text-white">
          <button
            type="button"
            onClick={closeConfirmContabilizarModal}
            className="absolute top-5 right-5 p-2 rounded-full bg-[var(--color-bg)] text-slate-400 hover:text-white border border-[var(--color-border)] transition-colors cursor-pointer"
            aria-label="Cerrar confirmación de remesa"
          >
            <X size={16} />
          </button>

          <div className="flex items-start gap-3.5 border-b border-white/10 pb-4 pr-8">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Landmark size={22} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                Volcado Contable de Remesa SEPA
              </span>
              <h2
                id={confirmDialogTitleId}
                className="text-lg font-extrabold tracking-wide font-[family-name:var(--font-heading)] text-white mt-0.5"
              >
                Contabilizar Remesa • {selectedMonthTitle}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Periodo de imputación contable: <span className="font-mono font-bold text-slate-200">{selectedMonth}</span>
              </p>
            </div>
          </div>

          {/* Summary KPI Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Recibos a Contabilizar
              </span>
              <span className="text-2xl font-mono font-extrabold text-white mt-1 block">
                {pendingSepaToAccountStudents.length}
              </span>
              <span className="text-[10px] text-slate-400">
                Alumnos domiciliados pendientes
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
                Importe Total Neto
              </span>
              <span className="text-2xl font-mono font-extrabold text-emerald-400 mt-1 block">
                {pendingSepaTotalNet.toFixed(2)} €
              </span>
              <span className="text-[10px] text-emerald-200/80">
                Ingreso directo en Historial
              </span>
            </div>
          </div>

          {/* Breakdown Studio 1 / Studio 2 */}
          <div className="rounded-2xl bg-[var(--color-bg)]/80 border border-[var(--color-border)] p-3.5 space-y-2.5 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Desglose por Sede
            </span>
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span className="text-slate-300 font-semibold">Studio 1 (Plaza El Tejar)</span>
              <span className="font-mono font-bold text-cyan-400">
                {pendingTejarStudents.length} recibos • {pendingTejarNet.toFixed(2)} €
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-300 font-semibold">Studio 2 (Paseo Castilla)</span>
              <span className="font-mono font-bold text-amber-400">
                {pendingCastillaStudents.length} recibos • {pendingCastillaNet.toFixed(2)} €
              </span>
            </div>
          </div>

          {/* Anti-duplicate & accounting notice */}
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3.5 flex items-start gap-2.5 text-[11px] text-slate-200 leading-relaxed">
            <ShieldCheck size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300">Blindaje Anti-Duplicados Activo:</strong> Se excluyen automáticamente los cobros en mostrador ({deskPaidStudentsCount}), pagos en efectivo ({cashMethodStudentsCount}) y recibos SEPA ya volcados ({sepaAccountedStudentsCount}). Los recibos computarán exclusivamente en <span className="font-mono font-bold text-white">{selectedMonth}</span> y podrás seguir descargando el fichero <span className="font-bold text-white">SEPA XML</span> en cualquier momento.
            </div>
          </div>

          <div className="pt-1 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
            <button
              type="button"
              autoFocus
              onClick={closeConfirmContabilizarModal}
              className="px-4 py-2.5 rounded-xl bg-[var(--color-bg)] hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isAccountingRemesa || pendingSepaToAccountStudents.length === 0}
              onClick={handleConfirmContabilizarRemesa}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/25 cursor-pointer"
            >
              <CheckCircle2 size={15} className="shrink-0" />
              <span>
                {isAccountingRemesa ? "Contabilizando..." : "Confirmar y Contabilizar Ingresos"}
              </span>
            </button>
          </div>
        </div>
      </dialog>

      {/* RECEIPT MODAL */}
      {selectedRecibo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-[#0e1628] border border-[var(--color-border)] rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl relative text-white">
            
            <button
              onClick={() => setSelectedRecibo(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-[var(--color-bg)] text-slate-400 hover:text-white border border-[var(--color-border)] transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center space-y-1 border-b border-white/10 pb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white flex items-center justify-center font-[family-name:var(--font-heading)] text-lg mx-auto mb-1">
                DF
              </div>
              <h2 className="text-lg font-extrabold tracking-wide font-[family-name:var(--font-heading)]">DANCE FACTORY</h2>
              <p className="text-[10px] text-slate-400 font-mono">
                {selectedRecibo.sede === "tejar" ? "Studio 1: Plaza El Tejar, Alcorcón" : "Studio 2: Paseo Castilla, Alcorcón"}
              </p>
              <div className="pt-2">
                <span className="text-xs font-mono font-bold text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-3 py-0.5 rounded-full border border-[var(--color-secondary)]/30">
                  RECIBO OFICIAL: {selectedRecibo.numero_recibo}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Fecha y Hora:</span>
                <span className="font-mono font-semibold">{selectedRecibo.fecha_corta} • {selectedRecibo.hora_corta}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Alumno / Titular:</span>
                <span className="font-bold text-white">{selectedRecibo.alumno_nombre}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Concepto:</span>
                <span className="font-semibold text-right max-w-[220px]">{selectedRecibo.concepto}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Método de Cobro:</span>
                <span className="font-bold text-cyan-400">{selectedRecibo.metodo_pago}</span>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-emerald-500/30 flex items-center justify-between mt-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Total Abonado</span>
                <span className="text-2xl font-mono font-extrabold text-emerald-400">
                  {selectedRecibo.importe.toFixed(2)} €
                </span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Printer size={15} />
                <span>Imprimir Recibo</span>
              </button>
              <button
                onClick={() => setSelectedRecibo(null)}
                className="px-4 py-2.5 rounded-xl bg-[var(--color-bg)] hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
