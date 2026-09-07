"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  QrCode, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Clock, 
  User, 
  Wifi, 
  WifiOff, 
  Search, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  Maximize2
} from "lucide-react";
import { useScannerBridge } from "@/hooks/useScannerBridge";
import { supabase } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activityLogger";
import { useSede } from "@/context/SedeContext";
import HistoricoEntradasModal from "@/components/HistoricoEntradasModal";
import { marcarAsistenciaPorAlumnoYSesion, marcarAsistenciaPorAlumnoEnFecha } from "@/lib/openClassService";

export interface ScanEntranceEvent {
  id: string;
  studentId: string;
  nombreCompleto: string;
  planActivo: string;
  clasesRestantes: number | null;
  estado: string;
  hora: string;
  fecha: string;
  status: "success" | "error" | "denied";
  mensaje?: string;
  nfcToken?: string;
}

export default function GlobalScannerWidget() {
  const { activeSede } = useSede();
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Floating Entrance Toast Notification state
  const [currentNotification, setCurrentNotification] = useState<ScanEntranceEvent | null>(null);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Recent entrances list (persisted in session)
  const [recentEntrances, setRecentEntrances] = useState<ScanEntranceEvent[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("df_recent_entrances_today");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  // Antirepetición rápida (evitar dobles lecturas en menos de 3s)
  const lastScanCodeRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  // Guardar en sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("df_recent_entrances_today", JSON.stringify(recentEntrances.slice(0, 30)));
      } catch {}
    }
  }, [recentEntrances]);

  // Función para buscar alumno con limpieza exhaustiva de tokens
  const findStudent = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return null;

    // 1. UUID exacto
    if (trimmed.length === 36 && (trimmed.match(/-/g) || []).length === 4) {
      const { data } = await supabase.from("alumnos").select("*").eq("id", trimmed).maybeSingle();
      if (data) return data;
    }

    // 2. Normalizar separadores y anomalías de teclado español ('/' o '\'')
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
      // nfc_token
      const { data: byNfc } = await supabase.from("alumnos").select("*").eq("nfc_token", token).limit(1).maybeSingle();
      if (byNfc) return byNfc;

      // dni
      const { data: byDni } = await supabase.from("alumnos").select("*").ilike("dni", token).limit(1).maybeSingle();
      if (byDni) return byDni;

      // id exacto
      if (token.length === 36 && (token.match(/-/g) || []).length === 4) {
        const { data: byId } = await supabase.from("alumnos").select("*").eq("id", token).limit(1).maybeSingle();
        if (byId) return byId;
      }
    }

    // Fallback ILIKE
    if (cleanToken && cleanToken.length >= 3) {
      const { data: byLike } = await supabase
        .from("alumnos")
        .select("*")
        .or(`nfc_token.ilike.%${cleanToken}%,dni.ilike.%${cleanToken}%,email.ilike.%${cleanToken}%,telefono.ilike.%${cleanToken}%`)
        .limit(1)
        .maybeSingle();
      if (byLike) return byLike;
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

  // Procesamiento central del escaneo
  const handleGlobalScan = useCallback(async (rawScannedCode: string) => {
    const raw = rawScannedCode.trim();
    if (!raw) return;

    const nowTime = Date.now();
    // Bloquear duplicado idéntico en menos de 2.5s
    if (raw === lastScanCodeRef.current && (nowTime - lastScanTimeRef.current) < 2500) {
      return;
    }
    lastScanCodeRef.current = raw;
    lastScanTimeRef.current = nowTime;

    setIsProcessing(true);

    const horaActual = new Date().toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const fechaActual = new Date().toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    try {
      const student = await findStudent(raw);

      if (!student) {
        playFeedbackSound("error");
        const errorEvt: ScanEntranceEvent = {
          id: "scan_" + Date.now(),
          studentId: "",
          nombreCompleto: "Código No Reconocido",
          planActivo: "Sin registrar",
          clasesRestantes: null,
          estado: "Desconocido",
          hora: horaActual,
          fecha: fechaActual,
          status: "error",
          mensaje: `Código escaneado: ${raw}`,
          nfcToken: raw
        };
        showNotification(errorEvt);
        return;
      }

      // Validar si está Activo
      if (student.estado !== "Activo") {
        playFeedbackSound("error");
        const deniedEvt: ScanEntranceEvent = {
          id: "scan_" + Date.now(),
          studentId: student.id,
          nombreCompleto: student.nombre_completo,
          planActivo: student.plan_activo || "Sin plan",
          clasesRestantes: student.clases_restantes,
          estado: student.estado || "Inactivo",
          hora: horaActual,
          fecha: fechaActual,
          status: "denied",
          mensaje: `Acceso denegado: Alumno ${student.estado || "Inactivo"}`
        };
        showNotification(deniedEvt);
        return;
      }

      // 3. Check-in Válido: Vincular clase activa (si la hay en recepción o por horario)
      let targetClaseId: string | null = null;
      if (typeof window !== "undefined") {
        targetClaseId = sessionStorage.getItem("df_active_reception_clase_id");
      }

      if (!targetClaseId) {
        try {
          const dias = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
          const hoyDia = dias[new Date().getDay()];
          const nowTimeStr = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

          const { data: currentClases } = await supabase
            .from("clases_cuadrante")
            .select("id, hora_inicio, hora_fin")
            .eq("dia_semana", hoyDia)
            .lte("hora_inicio", nowTimeStr)
            .gte("hora_fin", nowTimeStr)
            .limit(1);

          if (currentClases && currentClases.length > 0) {
            targetClaseId = currentClases[0].id;
          }
        } catch {}
      }

      const asistenciaPayload: any = {
        alumno_id: student.id,
        fecha_hora: new Date().toISOString(),
        ...(targetClaseId ? { clase_id: targetClaseId } : {})
      };

      const { error: assistError } = await supabase.from("asistencias").insert([asistenciaPayload]);

      if (assistError) {
        console.warn("[GlobalScanner] Nota de inserción asistencia:", assistError.message);
      }

      // Sincronizar asistencia en Open Class si el alumno tiene reserva para hoy o para la clase activa
      try {
        const todayNow = new Date();
        const y = todayNow.getFullYear();
        const m = String(todayNow.getMonth() + 1).padStart(2, "0");
        const d = String(todayNow.getDate()).padStart(2, "0");
        const todayISO = `${y}-${m}-${d}`;
        let markedOpenClass = false;
        if (targetClaseId) {
          markedOpenClass = marcarAsistenciaPorAlumnoYSesion(student.id, targetClaseId, todayISO);
        }
        if (!markedOpenClass) {
          markedOpenClass = marcarAsistenciaPorAlumnoEnFecha(student.id, todayISO);
        }
        if (markedOpenClass && typeof window !== "undefined") {
          window.dispatchEvent(new Event("df_reservas_updated"));
        }
      } catch (e) {}

      // 4. Feedback Sonoro y Notificación Visual
      playFeedbackSound("success");

      const planLower = (student.plan_activo || "").toLowerCase();
      const isRegular = planLower.includes("regular") || planLower.includes("mensual") || planLower.includes("ilimitad") || student.clases_restantes === null;
      const saldoInfo = !isRegular 
        ? `Bono (${student.clases_restantes ?? 0} clases de saldo)` 
        : "Cuota Regular Mensual";

      // Log en auditoría
      await logActivity({
        origen: "recepcion",
        tipo_evento: "checkin",
        descripcion: `Validación automática escáner QR/NFC (${saldoInfo})`,
        usuario_afectado: student.nombre_completo,
        sede: activeSede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
      });

      // Disparar evento para que páginas abiertas se enteren
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("df_checkin_success", { detail: student }));
      }

      const successEvt: ScanEntranceEvent = {
        id: "scan_" + Date.now(),
        studentId: student.id,
        nombreCompleto: student.nombre_completo,
        planActivo: student.plan_activo || "Clases Regulares",
        clasesRestantes: student.clases_restantes,
        estado: "Activo",
        hora: horaActual,
        fecha: fechaActual,
        status: "success",
        mensaje: saldoInfo
      };

      showNotification(successEvt);
      setRecentEntrances(prev => [successEvt, ...prev.slice(0, 29)]);

    } catch (err) {
      console.error("[GlobalScanner] Error durante el proceso de escaneo:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [activeSede]);

  const showNotification = (evt: ScanEntranceEvent) => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setCurrentNotification(evt);
    // Mostrar por 8 segundos y desvanecer
    notificationTimeoutRef.current = setTimeout(() => {
      setCurrentNotification(null);
    }, 8000);
  };

  // Conexión oficial al puente WebSocket de hardware (OBZ RF-70 o puente Windows en ws://localhost:8080)
  const { isConnected: isBridgeConnected, playFeedbackSound } = useScannerBridge({
    onScan: handleGlobalScan,
    wsUrl: "ws://localhost:8080"
  });

  // Notificar estado del puente a otras pantallas
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("df_bridge_connected", String(isBridgeConnected));
      window.dispatchEvent(new CustomEvent("df_bridge_status", { detail: { isConnected: isBridgeConnected } }));
    }
  }, [isBridgeConnected]);

  // Canal B: Teclado Hardware Wedge (interceptar si el escáner escribe caracteres directamente)
  useEffect(() => {
    let keyBuffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");

      // Si el tiempo entre teclas es muy rápido (< 50ms), es característico de un lector hardware
      const isFastScan = (now - lastKeyTime) < 60;
      lastKeyTime = now;

      if (e.key === "Enter") {
        if (keyBuffer.trim().length >= 4) {
          const codeToProcess = keyBuffer.trim();
          keyBuffer = "";
          // Si estaba en un input y el texto coincide con el buffer de escaneo, no enviar formulario
          if (isFastScan || codeToProcess.toUpperCase().startsWith("DF")) {
            e.preventDefault();
            e.stopPropagation();
            handleGlobalScan(codeToProcess);
          }
        } else {
          keyBuffer = "";
        }
        return;
      }

      // Solo acumular teclas de caracteres imprimibles
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!isInput || isFastScan) {
          keyBuffer += e.key;
        }
      }

      // Resetear buffer si pasa más de 400ms sin teclas
      setTimeout(() => {
        if (Date.now() - lastKeyTime > 400 && keyBuffer.length > 0) {
          keyBuffer = "";
        }
      }, 450);
    };

    // Canal C: Custom Events y postMessage desde el puente
    const handleCustomScanEvent = (e: any) => {
      if (e.detail) {
        const code = typeof e.detail === "string" ? e.detail : e.detail.code || e.detail.qr;
        if (code) handleGlobalScan(code);
      }
    };

    const handleMessageEvent = (e: MessageEvent) => {
      try {
        if (e.data && (e.data.type === "SCANNER_READ" || e.data.type === "DF_SCAN")) {
          const code = e.data.code || e.data.data || e.data.qr;
          if (code) handleGlobalScan(code);
        }
      } catch {}
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("df_scanner_read" as any, handleCustomScanEvent);
    window.addEventListener("message", handleMessageEvent);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("df_scanner_read" as any, handleCustomScanEvent);
      window.removeEventListener("message", handleMessageEvent);
    };
  }, [handleGlobalScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleGlobalScan(manualInput.trim());
      setManualInput("");
    }
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TARJETA FLOTANTE DE NOTIFICACIÓN DE ENTRADA (POPUP AUTOMÁTICO AL ESCANEAR) */}
      {/* ========================================================================= */}
      {currentNotification && (
        <div className="fixed bottom-24 right-6 sm:right-24 z-50 max-w-sm w-[90vw] sm:w-80 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${
            currentNotification.status === "success" 
              ? "bg-slate-950/95 border-emerald-500/50 shadow-emerald-500/20" 
              : currentNotification.status === "denied"
              ? "bg-slate-950/95 border-amber-500/50 shadow-amber-500/20"
              : "bg-slate-950/95 border-rose-500/50 shadow-rose-500/20"
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0 shadow-md ${
                  currentNotification.status === "success"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : currentNotification.status === "denied"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`}>
                  {currentNotification.status === "success" ? (
                    <CheckCircle2 size={22} className="text-emerald-400" />
                  ) : currentNotification.status === "denied" ? (
                    <AlertTriangle size={22} className="text-amber-400" />
                  ) : (
                    <X size={22} className="text-rose-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-1 ${
                    currentNotification.status === "success"
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                      : currentNotification.status === "denied"
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                      : "bg-rose-500/15 text-rose-400 border border-rose-500/25"
                  }`}>
                    {currentNotification.status === "success" ? "✓ ACCESO CONCEDIDO" : currentNotification.status === "denied" ? "⚠️ ACCESO DENEGADO" : "✕ ERROR DE LECTURA"}
                  </span>
                  <h4 className="text-sm font-bold text-white truncate">
                    {currentNotification.nombreCompleto}
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5 truncate">
                    {currentNotification.mensaje || currentNotification.planActivo}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCurrentNotification(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <Clock size={12} className="text-slate-500" />
                {currentNotification.hora}
              </span>
              <button
                onClick={() => {
                  setCurrentNotification(null);
                  setIsOpenModal(true);
                }}
                className="text-amber-400 hover:underline font-sans font-bold"
              >
                Ver registro completo →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. BOTÓN FLOTANTE DEL ESCÁNER DE RECEPCIÓN (ACCESIBLE EN TODO EL CRM) */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 right-24 z-40 flex items-center">
        <button
          onClick={() => setIsOpenModal(true)}
          className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-[#10192e] text-white flex items-center justify-center shadow-2xl border transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer group relative ${
            isBridgeConnected 
              ? "border-emerald-500/50 shadow-emerald-500/20 hover:border-emerald-400" 
              : "border-amber-500/50 shadow-amber-500/20 hover:border-amber-400"
          }`}
          title={isBridgeConnected ? "Lector QR Conectado (ws://localhost:8080) • Activo en todas las pantallas" : "Lector QR en Espera (Modo USB) • Clic para ver registro"}
        >
          {/* Indicador LED de conexión con el puente Windows */}
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            {isBridgeConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-slate-900 ${
                isBridgeConnected ? "bg-emerald-400" : "bg-amber-400"
              }`}
            ></span>
          </span>

          <QrCode 
            size={24} 
            className={`transition-transform group-hover:scale-110 ${
              isBridgeConnected ? "text-emerald-300" : "text-amber-300"
            }`} 
          />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL COMPLETO DE CONTROL DE ACCESOS Y REGISTRO EN VIVO */}
      {/* ========================================================================= */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-secondary)]">
                  RECEPCIÓN GLOBAL • DANCE FACTORY
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
                  <QrCode size={20} className="text-emerald-400" />
                  <span>Control de Accesos & Escáner</span>
                </h2>
              </div>
              <button
                onClick={() => setIsOpenModal(false)}
                className="p-2 rounded-full bg-[var(--color-bg)] text-slate-400 hover:text-white border border-[var(--color-border)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Estado del Puente de Windows */}
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
              isBridgeConnected 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-amber-500/10 border-amber-500/30 text-amber-300"
            }`}>
              <div className="flex items-center gap-2.5">
                {isBridgeConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
                <div>
                  <strong className="block">
                    {isBridgeConnected ? "Puente Lector QR Conectado" : "Puente Lector en Espera"}
                  </strong>
                  <span className="text-[10px] text-slate-400">
                    {isBridgeConnected 
                      ? "Escucha activa en ws://localhost:8080 y emulación USB"
                      : "Reintentando conexión automática con el puente local (ws://localhost:8080)"}
                  </span>
                </div>
              </div>
              <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-black/30 font-bold">
                {isBridgeConnected ? "ONLINE" : "STANDBY"}
              </span>
            </div>

            {/* Test Manual / Entrada por Teclado */}
            <form onSubmit={handleManualSubmit} className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                Comprobación Manual o Lector de Mano
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Escanear o teclear código QR, DNI o Token..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className="w-full pl-3.5 pr-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!manualInput.trim() || isProcessing}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Validar
                </button>
              </div>
            </form>

            {/* Registro de Entradas en Vivo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Entradas Recientes de Hoy
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                  {recentEntrances.length} registros
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-white/5">
                {recentEntrances.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No se han registrado lecturas en esta sesión todavía.
                  </div>
                ) : (
                  recentEntrances.map((item) => (
                    <div key={item.id} className="pt-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          item.status === "success" 
                            ? "bg-emerald-500/20 text-emerald-400" 
                            : item.status === "denied" 
                            ? "bg-amber-500/20 text-amber-400" 
                            : "bg-rose-500/20 text-rose-400"
                        }`}>
                          {item.status === "success" ? "✓" : "✕"}
                        </div>
                        <div className="min-w-0">
                          <strong className="text-white block truncate text-xs">
                            {item.nombreCompleto}
                          </strong>
                          <span className="text-[10px] text-slate-400 truncate block">
                            {item.planActivo}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                        {item.hora}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setIsOpenModal(false);
                  setIsHistoricoModalOpen(true);
                }}
                className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-colors cursor-pointer"
                title="Abrir histórico diario y control de accesos"
              >
                <span>📅 Ver Histórico Completo →</span>
              </button>

              <button
                onClick={() => setIsOpenModal(false)}
                className="px-4 py-2 rounded-xl bg-[var(--color-bg)] hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 transition-colors cursor-pointer"
              >
                Cerrar Panel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Histórico Diario y Control de Accesos */}
      <HistoricoEntradasModal
        isOpen={isHistoricoModalOpen}
        onClose={() => setIsHistoricoModalOpen(false)}
      />
    </>
  );
}
