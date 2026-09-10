"use client";

import { useState, useEffect } from "react";
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
  FileCode
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useSede } from "@/context/SedeContext";
import { getStudentFee, getStudentMonthlyRemittanceFee } from "@/lib/studentFees";
import { isRegularClassStudent, isTeacherProfile } from "@/lib/matriculaService";
import { 
  PagoTransaccion, 
  MetodoCobro, 
  SedePago, 
  CategoriaConcepto, 
  CONCEPTOS_RAPIDOS, 
  getHistorialPagos, 
  saveHistorialPagos, 
  generateSeedTransactions, 
  calcularArqueoPorSede, 
  exportarPagosCSV, 
  registrarNuevoPago,
  anularPago
} from "@/lib/pagosService";
import { openGlobalCobro } from "@/components/GlobalCobroModal";
import { getStoredIBAN } from "../alumnos/page";

export type MetodoPagoRemesa = "SEPA" | "Stripe" | "Efectivo" | "TPV" | "Transferencia";

/**
 * Generates official Spanish Banking Standard ISO 20022 Direct Debit XML (pain.008.001.02 / Norma 19).
 */
function generateSEPAXml(
  studentsList: any[],
  monthStr: string,
  paymentMethodsMap: Record<string, MetodoPagoRemesa>,
  assignedClasses: Record<string, string[]>
): string {
  const isSepMonth = monthStr === "2026-09" || monthStr.toLowerCase().includes("sep");
  const sepaStudents = studentsList.filter(s => (paymentMethodsMap[s.id] || "SEPA") === "SEPA");
  const targetStudents = sepaStudents.length > 0 ? sepaStudents : studentsList;

  const now = new Date();
  const msgId = `DF-MSG-${monthStr.replace(/-/g, "")}-${Date.now().toString().slice(-6)}`;
  const pmtInfId = `DF-PMT-${monthStr.replace(/-/g, "")}-01`;
  const creDtTm = now.toISOString().split(".")[0];
  const reqdColltnDt = `${monthStr}-01`;

  let totalAmount = 0;
  targetStudents.forEach(s => {
    const fee = getStudentFee(s);
    const amount = isSepMonth ? fee.netoSep : fee.cuotaBase;
    totalAmount += amount;
  });

  const escapeXml = (str: string = "") => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // strip diacritics
  };

  const sanitizeIBAN = (iban?: string, dni?: string) => {
    if (iban && iban.trim()) {
      return iban.replace(/[\s\-]/g, "").toUpperCase();
    }
    const cleanDni = (dni || "00000000").replace(/[^0-9]/g, "").padStart(8, "0");
    return `ES91210004184502${cleanDni.slice(0, 8)}`;
  };

  const txXml = targetStudents.map((s, idx) => {
    const fee = getStudentFee(s);
    const amount = isSepMonth ? fee.netoSep : fee.cuotaBase;
    const endToEndId = `DF-REC-${monthStr.replace(/-/g, "")}-${String(idx + 1).padStart(4, "0")}`;
    const mandateId = `MND-${(s.dni || s.id || `STU${idx + 1}`).replace(/[^a-zA-Z0-9]/g, "")}`;
    const studentName = escapeXml(s.nombre_completo || "ALUMNO DANCE FACTORY");
    const iban = sanitizeIBAN(s.iban || getStoredIBAN(s.id), s.dni);
    const classInfo = escapeXml((assignedClasses[s.id] || []).join(" / ") || fee.claseNombre || "Cuota Regular");

    return `      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>${endToEndId}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="EUR">${amount.toFixed(2)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${mandateId}</MndtId>
            <DtOfSgntr>${monthStr}-01</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId>
            <Othr>
              <Id>NOTPROVIDED</Id>
            </Othr>
          </FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${studentName}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id>
            <IBAN>${iban}</IBAN>
          </Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>Cuota Mensual Dance Factory - ${monthStr} - ${classInfo}</Ustrd>
        </RmtInf>
      </DrctDbtTxInf>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>${targetStudents.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>DANCE FACTORY SL</Nm>
        <Id>
          <OrgId>
            <Othr>
              <Id>B88888888</Id>
            </Othr>
          </OrgId>
        </Id>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${pmtInfId}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${targetStudents.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Cd>CORE</Cd>
        </LclInstrm>
        <SeqTp>RCUR</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${reqdColltnDt}</ReqdColltnDt>
      <Cdtr>
        <Nm>DANCE FACTORY SL</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>ES9121000418450200051332</IBAN>
        </Id>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>
          <BIC>CAIXESBBXXX</BIC>
        </FinInstnId>
      </CdtrAgt>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>ES02000B88888888</Id>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>
${txXml}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
}

export default function PagosYFacturacionPage() {
  const { activeSede } = useSede();

  // Active View Tab: 'historial' | 'remesas'
  const [activeTab, setActiveTab] = useState<"historial" | "remesas">("historial");

  // Transactions State
  const [pagos, setPagos] = useState<PagoTransaccion[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [assignedClassesMap, setAssignedClassesMap] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Filters for Historial Tab
  const [filterPeriodo, setFilterPeriodo] = useState<string>("all"); // 'all' | 'today' | '2026-09'
  const [filterSedeLocal, setFilterSedeLocal] = useState<string>("all");
  const [filterMetodo, setFilterMetodo] = useState<string>("all");
  const [filterCategoria, setFilterCategoria] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Receipt Modal State
  const [selectedRecibo, setSelectedRecibo] = useState<PagoTransaccion | null>(null);

  // Remesas Tab State
  const [selectedMonth, setSelectedMonth] = useState("2026-09");
  const [filterRemesaMetodo, setFilterRemesaMetodo] = useState<string>("all");
  const [paymentMethods, setPaymentMethods] = useState<Record<string, MetodoPagoRemesa>>({});

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
    const storedPagos = getHistorialPagos();
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

      const storedLocal = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("pending_bono_requests") || "[]") : [];
      const combined = [...dbMapped];
      storedLocal.forEach((lReq: any) => {
        if (!combined.some(c => c.id === lReq.id || (c.student_email && c.student_email === lReq.student_email))) {
          combined.push(lReq);
        }
      });

      setPendingRequests(combined);
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

      const { error: updateErr } = await supabase.from("alumnos").update(updateData).eq("id", studentDB.id);
      if (updateErr) {
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

    setPendingRequests(prev => {
      const updated = prev.filter(r => r.id !== req.id && r.student_id !== req.student_id);
      if (typeof window !== "undefined") {
        localStorage.setItem("pending_bono_requests", JSON.stringify(updated));
        window.dispatchEvent(new Event("df_pending_bonos_updated"));
      }
      return updated;
    });

    loadData();
  };

  useEffect(() => {
    loadData();

    // Listen to real-time payment & pending updates
    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener("df_pagos_updated", handleUpdate);
    window.addEventListener("df_pending_bonos_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    const interval = setInterval(loadData, 3000);

    return () => {
      window.removeEventListener("df_pagos_updated", handleUpdate);
      window.removeEventListener("df_pending_bonos_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
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

  const filteredPagos = pagos.filter(p => {
    if (filterSedeLocal !== "all" && p.sede !== filterSedeLocal) return false;
    if (filterPeriodo === "today" && p.fecha_corta !== todayStr) return false;
    if (filterPeriodo === "2026-09" && p.periodo_mes !== "2026-09" && !p.fecha_corta.includes("/09/2026")) return false;
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

  // Arqueo Data
  const arqueoObj = calcularArqueoPorSede(pagos);
  const arqueoTejar = arqueoObj.tejar;
  const arqueoCastilla = arqueoObj.castilla;

  // Remesas Data
  const regularStudents = students.filter(s => {
    const plan = (s.plan_activo || "").toLowerCase();
    if (plan.includes("sin plan") || plan.includes("pendiente")) return false;
    return plan.includes("regular") || s.plan_activo === "Clases Regulares" || (s.clases_restantes === null && !plan.includes("bono"));
  });

  const filteredRemesaStudents = regularStudents.filter(s => {
    const matchesSearch = 
      (s.nombre_completo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.dni || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.telefono || "").includes(searchTerm);

    const matchesSede = filterSedeLocal === "all" || s.sede === filterSedeLocal;
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

  const totalRegularCount = regularStudents.length;
  const totalNetToRemit = regularStudents.reduce((acc, s) => acc + getStudentRemittanceData(s).neto, 0);
  const totalGrossBilling = regularStudents.reduce((acc, s) => acc + getStudentFee(s).cuotaBase, 0);

  const handleExportSEPA = () => {
    handleExportSEPAXML();
  };

  const handleExportSEPAXML = () => {
    const xmlContent = generateSEPAXml(filteredRemesaStudents, selectedMonth, paymentMethods, assignedClassesMap);
    const blob = new Blob([xmlContent], { type: "application/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `remesa_sepa_iso20022_${selectedMonth}_dance_factory_${activeSede}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportSEPACsv = () => {
    const sepaStudents = filteredRemesaStudents.filter(s => (paymentMethods[s.id] || "SEPA") === "SEPA");
    const targetList = sepaStudents.length > 0 ? sepaStudents : filteredRemesaStudents;
    const headers = ["Nombre Completo", "DNI", "Sede", "Clase Asignada", "Cuota Base (€)", "Anticipo Abonado (€)", "Neto a Remesar (€)", "Metodo de Pago", "Estado"];
    const rows = targetList.map(s => {
      const data = getStudentRemittanceData(s);
      const metodo = paymentMethods[s.id] || "SEPA";
      return [
        `"${s.nombre_completo || ''}"`,
        `"${s.dni || 'PENDIENTE'}"`,
        `"${s.sede === 'tejar' ? 'Studio 1 Plaza El Tejar' : 'Studio 2 Paseo Castilla'}"`,
        `"${(assignedClassesMap[s.id] || []).join(' / ') || data.claseNombre || 'Clase Regular'}"`,
        data.cuotaBase.toFixed(2),
        (-data.anticipo).toFixed(2),
        data.neto.toFixed(2),
        `"${metodo}"`,
        '"Listo para procesar"'
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
          <span className="text-[10px] text-[var(--color-text-secondary)]">Efectivo: {arqueoTejar.totalEfectivo.toFixed(2)}€ • TPV: {arqueoTejar.totalTPV.toFixed(2)}€</span>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">Caja Studio 2 (Castilla)</span>
          <h3 className="text-2xl font-bold font-mono text-amber-400 mt-1">{arqueoCastilla.totalRecaudado.toFixed(2)} €</h3>
          <span className="text-[10px] text-[var(--color-text-secondary)]">Efectivo: {arqueoCastilla.totalEfectivo.toFixed(2)}€ • TPV: {arqueoCastilla.totalTPV.toFixed(2)}€</span>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">Previsión Remesa {selectedMonth}</span>
          <h3 className="text-2xl font-bold font-mono text-purple-400 mt-1">{totalNetToRemit.toFixed(2)} €</h3>
          <span className="text-[10px] text-[var(--color-text-secondary)]">{totalRegularCount} alumnos regulares</span>
        </div>
      </div>
      
      {/* Top Action Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border)]">
        
        {/* Unified Module Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm">
          <button
            onClick={() => setActiveTab("historial")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "historial"
                ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/30"
                : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            <Receipt size={15} />
            <span>Historial de Cobros</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
              {pagos.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("remesas")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "remesas"
                ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/30"
                : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            <Landmark size={15} />
            <span>Remesas Bancarias SEPA</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 font-mono">
              {totalRegularCount}
            </span>
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {activeTab === "historial" && (
            <button
              onClick={() => exportarPagosCSV(filteredPagos)}
              className="px-3.5 py-2 rounded-xl bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] text-xs font-bold text-slate-300 hover:text-white border border-[var(--color-border)] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download size={14} />
              <span>Exportar CSV</span>
            </button>
          )}

          {activeTab === "remesas" && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportSEPACsv}
                className="px-3 py-2 rounded-xl bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] text-xs font-bold text-slate-300 hover:text-white border border-[var(--color-border)] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Exportar resumen de remesas en CSV"
              >
                <FileSpreadsheet size={14} className="text-emerald-400" />
                <span>Resumen CSV</span>
              </button>
              <button
                onClick={handleExportSEPAXML}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-amber-400/20 cursor-pointer"
                title="Descargar Fichero XML ISO 20022 pain.008.001.02 Norma 19"
              >
                <Download size={14} />
                <span>Descargar SEPA XML (ISO 20022)</span>
              </button>
            </div>
          )}

          <button
            onClick={() => openGlobalCobro()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:brightness-110 text-white text-xs font-extrabold transition-all shadow-md shadow-[var(--color-primary)]/30 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
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
                <option value="2026-09">🍂 Septiembre 2026</option>
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
            <div className="overflow-x-auto">
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
                  <option value="2026-09">Septiembre 2026 (Cuota Ajustada -20€)</option>
                  <option value="2026-10">Octubre 2026 (Cuota Completa)</option>
                  <option value="2026-11">Noviembre 2026 (Cuota Completa)</option>
                  <option value="2026-12">Diciembre 2026 (Cuota Completa)</option>
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
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Alumno / DNI</th>
                    <th className="py-3.5 px-4">Sede / Clase</th>
                    <th className="py-3.5 px-4 text-center">Cuota Base</th>
                    <th className="py-3.5 px-4 text-center">
                      {isSepMonth ? "Anticipo Sep" : "Anticipo Mes"}
                    </th>
                    <th className="py-3.5 px-4 text-center">Neto a Remesar</th>
                    <th className="py-3.5 px-4">Vía de Cobro</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
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

                      return (
                        <tr key={student.id} className="hover:bg-[var(--color-bg-hover)] transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-[var(--color-text-title)] block">{student.nombre_completo}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{student.dni || "Sin DNI"}</span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-200 block truncate max-w-xs">{assignedNames}</span>
                            <span className="text-[10px] text-slate-400">
                              {student.sede === "tejar" ? "Studio 1 (Tejar)" : "Studio 2 (Castilla)"}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className="font-mono font-semibold text-slate-300">
                              {feeData.cuotaBase.toFixed(2)} €
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {feeData.anticipo > 0 ? (
                              <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                -{feeData.anticipo.toFixed(2)} €
                              </span>
                            ) : (
                              <span className="font-mono text-slate-500 text-xs">
                                0,00 €
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className="font-mono font-black text-sm text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/30">
                              {feeData.neto.toFixed(2)} €
                            </span>
                          </td>

                          <td className="py-3 px-4">
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

                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 size={11} /> Listo
                            </span>
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
