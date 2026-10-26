"use client";

import React, { useEffect, useState, useId, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon, X, Search, Link2, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { playSawtoothAlarm, playSuccessChime } from "@/lib/soundUtils";
import { openGlobalCobro } from "@/components/GlobalCobroModal";
import { supabase } from "@/lib/supabase/client";
import { getHistorialPagos, saveHistorialPagos } from "@/lib/pagosService";
import { publishSyncEvent } from "@/lib/syncEventBus";
import { logActivity } from "@/lib/activityLogger";
import { isTeacherProfile } from "@/lib/accessControlService";
import {
  resolveClassForCheckIn,
  reconcileBonoConsumptionOnCheckIn,
  marcarAsistenciaPorAlumnoYSesion,
  formatSedeName,
  TEACHER_DB_ID_MAP
} from "@/lib/openClassService";
import { appendLinkedAltAuth } from "@/lib/teacherRegistryService";

export interface AccessDeniedOverlayProps {
  isOpen?: boolean;
  open?: boolean;
  studentName?: string;
  student?: any;
  reason?: string;
  motivo?: string;
  rawCode?: string;
  actionType?: "cobro_cuota" | "recargar_bono" | "asignar_plan" | "vincular_alumno" | string;
  onAction?: (actionType?: string) => void;
  onClose: () => void;
  autoCloseMs?: number;
}

export const MANDATED_BLOCKING_TITLE = "⛔ ACCESO DENEGADO: Pasar por mostrador de recepción";

// Singleton claim so multiple scanner widgets mounted in the same page never stack two red modals
let activeOverlayClaimId: string | null = null;

function normalizeTextForSearch(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function extractCleanTokenFromRawCode(rawCode?: string): string {
  const trimmed = (rawCode || "").trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/^DF-TEACHER-/i, "")
    .replace(/^DF-PROFESOR-/i, "")
    .replace(/^TEACHER-/i, "")
    .replace(/^PROFESOR-/i, "")
    .replace(/^DF-STUDENT-/i, "")
    .replace(/^DF-ALUMNO-/i, "")
    .replace(/^STUDENT-/i, "")
    .replace(/^ALUMNO-/i, "")
    .replace(/^DF-/i, "")
    .trim();
}

export function evaluateAccessDeniedResolution(student?: any, reason?: string) {
  let actionType: "cobro_cuota" | "recargar_bono" | "asignar_plan" | "vincular_alumno" | null = null;
  let actionLabel: string | null = null;

  const r = String(reason || (student?.cuota_impagada ? "CUOTA_IMPAGADA" : "")).toUpperCase();
  if (r.includes("CUOTA") || r.includes("IMPAGAD") || student?.cuota_impagada) {
    actionType = "cobro_cuota";
    actionLabel = "Cobrar cuota pendiente en 1 clic";
  } else if (
    r.includes("BONO") ||
    (student?.plan_activo && student.plan_activo.toLowerCase().includes("bono") && (student.clases_restantes ?? 0) <= 0)
  ) {
    actionType = "recargar_bono";
    actionLabel = "Recargar bono en 1 clic";
  } else if (r.includes("SIN_PLAN") || (student?.plan_activo && student.plan_activo.toLowerCase().includes("sin plan"))) {
    actionType = "asignar_plan";
    actionLabel = "Asignar plan regular en 1 clic";
  } else if (r.includes("NO_ENCONTRADO") || r.includes("NO RECONOCIDO") || (!student && r)) {
    actionType = "vincular_alumno";
    actionLabel = "Vincular código a alumna matriculada";
  }

  return {
    isOpen: true,
    student,
    reason,
    actionType,
    actionLabel,
    canResolveIn1Click: actionType !== null,
    autoClosePausedOnAction: actionType !== null
  };
}

export default function AccessDeniedOverlay({
  isOpen,
  open,
  studentName,
  student,
  reason,
  motivo,
  rawCode,
  actionType,
  onAction,
  onClose,
  autoCloseMs = 4000
}: AccessDeniedOverlayProps) {
  const router = useRouter();
  const instanceId = useId();
  const searchInputId = useId();
  const searchHintId = useId();

  const isVisible = Boolean(open ?? isOpen);
  const [isPrimaryInstance, setIsPrimaryInstance] = useState(false);

  const resolvedStudentName = student?.nombre_completo || studentName;
  const upperReason = String(reason || motivo || (student?.cuota_impagada ? "CUOTA_IMPAGADA" : "")).toUpperCase();
  const resolution = evaluateAccessDeniedResolution(student, reason || motivo);
  const effectiveActionType = actionType || resolution.actionType;

  const isCuotaCase =
    effectiveActionType === "cobro_cuota" ||
    upperReason.includes("CUOTA") ||
    upperReason.includes("IMPAGAD") ||
    Boolean(student?.cuota_impagada);

  const isSinPlanOrUnrecognized =
    effectiveActionType === "asignar_plan" ||
    effectiveActionType === "vincular_alumno" ||
    upperReason.includes("SIN_PLAN") ||
    upperReason.includes("SIN PLAN") ||
    upperReason.includes("NO_ENCONTRADO") ||
    upperReason.includes("NO RECONOCIDO") ||
    (!student && Boolean(rawCode));

  const hasInteractiveAction = Boolean(effectiveActionType || isCuotaCase || isSinPlanOrUnrecognized || rawCode || student);

  // Instant student linker state
  const [linkQuery, setLinkQuery] = useState("");
  const [directoryStudents, setDirectoryStudents] = useState<any[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairFeedback, setRepairFeedback] = useState<string | null>(null);

  const handleGlobalClose = () => {
    if (activeOverlayClaimId === instanceId) {
      activeOverlayClaimId = null;
    }
    publishSyncEvent("df_checkin_denied_close", { timestamp: Date.now() });
    onClose();
  };

  useEffect(() => {
    if (!isVisible) {
      if (activeOverlayClaimId === instanceId) {
        activeOverlayClaimId = null;
      }
      setIsPrimaryInstance(false);
      setLinkQuery("");
      setRepairFeedback(null);
      setIsRepairing(false);
      return;
    }

    if (activeOverlayClaimId === null || activeOverlayClaimId === instanceId) {
      activeOverlayClaimId = instanceId;
      setIsPrimaryInstance(true);
    } else {
      setIsPrimaryInstance(false);
      return;
    }

    return () => {
      if (activeOverlayClaimId === instanceId) {
        activeOverlayClaimId = null;
      }
    };
  }, [isVisible, instanceId]);

  useEffect(() => {
    if (!isVisible || !isPrimaryInstance) return;

    // Disparar sonido Sawtooth de error inmediatamente al abrir
    playSawtoothAlarm();

    let timer: NodeJS.Timeout | null = null;
    if (!hasInteractiveAction) {
      timer = setTimeout(() => {
        handleGlobalClose();
      }, autoCloseMs);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleGlobalClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, isPrimaryInstance, autoCloseMs, hasInteractiveAction]);

  // Load active enrolled students directory when linker panel is shown
  useEffect(() => {
    if (!isVisible || !isPrimaryInstance || !isSinPlanOrUnrecognized) return;

    let cancelled = false;
    const loadDirectory = async () => {
      setIsLoadingDirectory(true);
      try {
        const { data } = await supabase
          .from("alumnos")
          .select("*, alumnos_clases(*)")
          .order("nombre_completo", { ascending: true });

        if (!cancelled && data) {
          setDirectoryStudents(data);
        }
      } catch (err) {
        console.warn("[AccessDeniedOverlay] Error cargando directorio de alumnos:", err);
      } finally {
        if (!cancelled) setIsLoadingDirectory(false);
      }
    };

    loadDirectory();
    return () => {
      cancelled = true;
    };
  }, [isVisible, isPrimaryInstance, isSinPlanOrUnrecognized]);

  // Filter and prioritize enrolled students with active plans
  const matchingEnrolledStudents = useMemo(() => {
    const q = normalizeTextForSearch(linkQuery);
    const fallbackFirstWord =
      !q && student?.nombre_completo && !student.nombre_completo.includes("@")
        ? normalizeTextForSearch(student.nombre_completo.split(/\s+/)[0])
        : "";
    const effectiveQuery = q.length >= 2 ? q : fallbackFirstWord.length >= 3 ? fallbackFirstWord : "";
    if (!effectiveQuery) return [];

    const queryTokens = effectiveQuery.split(/\s+/).filter(Boolean);

    return directoryStudents
      .filter((candidate) => {
        if (!candidate?.id) return false;
        if (student?.id && candidate.id === student.id) return false;
        if (isTeacherProfile(candidate)) return false;

        const haystack = normalizeTextForSearch(
          `${candidate.nombre_completo || ""} ${candidate.email || ""} ${candidate.dni || ""} ${candidate.nfc_token || ""} ${candidate.telefono || ""}`
        );
        return queryTokens.every((tok) => haystack.includes(tok));
      })
      .sort((a, b) => {
        const aHasPlan =
          (Array.isArray(a.alumnos_clases) && a.alumnos_clases.length > 0) ||
          (a.plan_activo && !String(a.plan_activo).toLowerCase().includes("sin plan"));
        const bHasPlan =
          (Array.isArray(b.alumnos_clases) && b.alumnos_clases.length > 0) ||
          (b.plan_activo && !String(b.plan_activo).toLowerCase().includes("sin plan"));
        if (aHasPlan !== bHasPlan) return aHasPlan ? -1 : 1;
        return String(a.nombre_completo || "").localeCompare(String(b.nombre_completo || ""), "es");
      })
      .slice(0, 6);
  }, [directoryStudents, linkQuery, student]);

  // Helper: execute immediate green check-in after 1-click self-repair
  const executeAuthorizedCheckIn = async (authorizedStudent: any, repairNote: string) => {
    let preferredClaseId: string | null = null;
    let activeSede = authorizedStudent?.sede || "castilla";
    if (typeof window !== "undefined") {
      preferredClaseId = sessionStorage.getItem("df_active_reception_clase_id");
      const savedSede = localStorage.getItem("df_active_sede");
      if (savedSede === "tejar" || savedSede === "castilla") {
        activeSede = savedSede;
      }
    }

    const resolved = await resolveClassForCheckIn(authorizedStudent, activeSede, preferredClaseId);

    const asistenciaPayload: Record<string, any> = {
      alumno_id: authorizedStudent.id,
      fecha_hora: new Date().toISOString(),
      ...(resolved.claseId ? { clase_id: resolved.claseId } : {})
    };

    await supabase.from("asistencias").insert([asistenciaPayload]);
    await reconcileBonoConsumptionOnCheckIn(authorizedStudent, resolved.claseId, resolved.horaInicio);

    if (resolved.isOpenClass && resolved.claseId) {
      const todayNow = new Date();
      const todayISO = `${todayNow.getFullYear()}-${String(todayNow.getMonth() + 1).padStart(2, "0")}-${String(todayNow.getDate()).padStart(2, "0")}`;
      marcarAsistenciaPorAlumnoYSesion(authorizedStudent.id, resolved.claseId, todayISO);
      publishSyncEvent("df_reservas_updated", {
        alumnoId: authorizedStudent.id,
        claseId: resolved.claseId,
        sessionDate: todayISO
      });
    }

    playSuccessChime();

    await logActivity({
      origen: "recepcion",
      tipo_evento: "checkin",
      descripcion: `${repairNote} • Entrada autorizada (${resolved.claseNombre || "Acceso a instalaciones"})`,
      usuario_afectado: authorizedStudent.nombre_completo,
      sede: resolved.sede ? formatSedeName(resolved.sede) : formatSedeName(activeSede)
    });

    await publishSyncEvent("df_alumnos_updated", { studentId: authorizedStudent.id, timestamp: Date.now() });
    await publishSyncEvent("df_checkin_success", {
      ...authorizedStudent,
      alumno: authorizedStudent,
      resolvedClass: resolved,
      resolved,
      autoRepaired: true,
      repairNote
    });

    handleGlobalClose();
  };

  // 1-Click Self-Repair A: Clear Unpaid Notice & Authorize Entry
  const handleClearUnpaidAndAuthorize = async () => {
    if (!student?.id || isRepairing) return;
    setIsRepairing(true);
    setRepairFeedback(null);

    try {
      // 1. Clean Supabase student record (gracefully ignoring optional columns if not in schema)
      const updatePayload: Record<string, any> = {
        estado: "Activo",
        cuota_impagada: false
      };
      let { error: dbErr } = await supabase.from("alumnos").update(updatePayload).eq("id", student.id);
      while (dbErr && (dbErr.code === "PGRST204" || dbErr.code === "42703") && dbErr.message) {
        const colMatch = dbErr.message.match(/'([^']+)' column/) || dbErr.message.match(/column "([^"]+)"/);
        if (colMatch && colMatch[1] && colMatch[1] in updatePayload) {
          delete updatePayload[colMatch[1]];
          if (Object.keys(updatePayload).length === 0) break;
          const retry = await supabase.from("alumnos").update(updatePayload).eq("id", student.id);
          dbErr = retry.error;
        } else {
          await supabase.from("alumnos").update({ estado: "Activo" }).eq("id", student.id);
          break;
        }
      }

      // 2. Clean localStorage df_cuotas_impagadas & df_pagos_transacciones_v1
      if (typeof window !== "undefined") {
        const normName = (student.nombre_completo || "").toLowerCase().trim();
        try {
          const rawImp = localStorage.getItem("df_cuotas_impagadas");
          if (rawImp) {
            const parsed: string[] = JSON.parse(rawImp);
            const cleaned = parsed.filter(
              (item) => item !== student.id && item.toLowerCase().trim() !== normName
            );
            localStorage.setItem("df_cuotas_impagadas", JSON.stringify(cleaned));
          }
        } catch {}

        try {
          const allPagos = getHistorialPagos();
          let modified = false;
          const updatedPagos = allPagos.map((p: any) => {
            const matchesStudent =
              p.alumno_id === student.id ||
              (p.alumno_nombre && p.alumno_nombre.toLowerCase().trim() === normName);
            const isBlockingState =
              p.estado === "Impagado" ||
              p.estado === "Devuelto" ||
              (p.estado === "Pendiente" && (p.categoria === "mensualidad" || p.categoria === "cuota"));

            if (matchesStudent && isBlockingState) {
              modified = true;
              return {
                ...p,
                estado: "Cobrado" as const,
                notas: p.notas
                  ? `${p.notas} | Aviso de impago retirado en recepción`
                  : "Regularizado y autorizado en recepción"
              };
            }
            return p;
          });
          if (modified) {
            saveHistorialPagos(updatedPagos);
          }
        } catch {}
      }

      const cleanStudent = {
        ...student,
        estado: "Activo",
        cuota_impagada: false,
        estado_pago: "Al día"
      };

      await executeAuthorizedCheckIn(cleanStudent, "Aviso de impago retirado en 1 clic desde recepción");
    } catch (err: any) {
      console.error("[AccessDeniedOverlay] Error quitando aviso de impago:", err);
      setRepairFeedback("No se pudo completar la operación: " + (err?.message || "Error de red"));
      setIsRepairing(false);
    }
  };

  // 1-Click Self-Repair B: Link Scanned Code / Duplicate Account to Enrolled Student & Authorize Entry
  const handleLinkAndAuthorize = async (targetStudent: any) => {
    if (!targetStudent?.id || isRepairing) return;
    setIsRepairing(true);
    setRepairFeedback(null);

    try {
      const cleanScanned = extractCleanTokenFromRawCode(rawCode);
      const isScannedUuid = cleanScanned.length === 36 && (cleanScanned.match(/-/g) || []).length === 4;
      const duplicateStudent = student?.id && student.id !== targetStudent.id ? student : null;

      // Determine new primary nfc_token while preserving previous card/token in DF_ALT_AUTH
      let nextNfcToken = targetStudent.nfc_token || null;
      if (cleanScanned && !isScannedUuid) {
        nextNfcToken = cleanScanned;
      } else if (!nextNfcToken && duplicateStudent?.nfc_token) {
        nextNfcToken = duplicateStudent.nfc_token;
      }

      const altEmails: string[] = [];
      const altTokens: string[] = [];
      const altIds: string[] = [];

      if (duplicateStudent?.email && duplicateStudent.email.toLowerCase() !== (targetStudent.email || "").toLowerCase()) {
        altEmails.push(duplicateStudent.email.toLowerCase().trim());
      }
      if (targetStudent.nfc_token && targetStudent.nfc_token !== nextNfcToken) {
        altTokens.push(String(targetStudent.nfc_token));
      }
      if (duplicateStudent?.nfc_token && duplicateStudent.nfc_token !== nextNfcToken) {
        altTokens.push(String(duplicateStudent.nfc_token));
      }
      if (cleanScanned && cleanScanned !== nextNfcToken) {
        altTokens.push(cleanScanned);
      }
      if (duplicateStudent?.id) {
        altIds.push(duplicateStudent.id);
      }
      if (isScannedUuid && cleanScanned !== targetStudent.id) {
        altIds.push(cleanScanned);
      }

      const updatedDireccion = appendLinkedAltAuth(targetStudent.direccion, {
        emails: altEmails,
        tokens: altTokens,
        ids: altIds
      });

      const targetPlanLower = String(targetStudent.plan_activo || "").toLowerCase();
      const isTargetRegular =
        targetPlanLower.includes("regular") ||
        targetPlanLower.includes("mensual") ||
        targetPlanLower.includes("ilimitad");

      const updateTargetPayload: Record<string, any> = {
        estado: "Activo",
        nfc_token: nextNfcToken,
        direccion: updatedDireccion,
        ...(isTargetRegular && targetStudent.clases_restantes === 0 ? { clases_restantes: null } : {}),
        ...(!targetStudent.email && duplicateStudent?.email ? { email: duplicateStudent.email.trim().toLowerCase() } : {})
      };

      const { error: updErr } = await supabase
        .from("alumnos")
        .update(updateTargetPayload)
        .eq("id", targetStudent.id);

      if (updErr) {
        throw updErr;
      }

      // Safely merge & delete empty "Sin Plan Activo" duplicate profile if applicable
      if (duplicateStudent?.id) {
        const dupPlan = String(duplicateStudent.plan_activo || "").toLowerCase();
        const isProtectedId = Object.values(TEACHER_DB_ID_MAP).includes(duplicateStudent.id);
        const dupHasActivePlan =
          Boolean(dupPlan) && !dupPlan.includes("sin plan") && !dupPlan.includes("pendiente");

        if (!isProtectedId && !isTeacherProfile(duplicateStudent) && !dupHasActivePlan) {
          // Move any prior attendances or class links before deleting duplicate
          await supabase
            .from("asistencias")
            .update({ alumno_id: targetStudent.id })
            .eq("alumno_id", duplicateStudent.id);

          await supabase
            .from("alumnos_clases")
            .delete()
            .eq("alumno_id", duplicateStudent.id);

          await supabase
            .from("alumnos")
            .delete()
            .eq("id", duplicateStudent.id);
        }
      }

      const mergedStudent = {
        ...targetStudent,
        ...updateTargetPayload
      };

      await executeAuthorizedCheckIn(
        mergedStudent,
        `Código/cuenta vinculado en 1 clic a ${targetStudent.nombre_completo}`
      );
    } catch (err: any) {
      console.error("[AccessDeniedOverlay] Error vinculando código a alumno:", err);
      setRepairFeedback("Error al vincular la ficha: " + (err?.message || "Revisa la conexión"));
      setIsRepairing(false);
    }
  };

  const handleOpenFichaAlumnos = () => {
    const cleanToken = extractCleanTokenFromRawCode(rawCode);
    const queryTarget = resolvedStudentName || cleanToken || "";
    handleGlobalClose();
    router.push(
      `/admin/alumnos?search=${encodeURIComponent(queryTarget)}&sede=consolidado`
    );
  };

  if (!isVisible || !isPrimaryInstance) return null;

  const displayMotivo =
    motivo ||
    (reason
      ? reason === "CUOTA_IMPAGADA"
        ? "Cuota pendiente de pago"
        : reason === "BONO_AGOTADO"
        ? "Bono agotado (0 clases restantes)"
        : reason
      : undefined);

  const studentDisplayId = student?.nfc_token || (student?.id ? String(student.id).slice(0, 8).toUpperCase() : null);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-50 bg-red-700/90 flex flex-col items-center justify-center text-white p-3 sm:p-6 backdrop-blur-md overflow-y-auto overscroll-contain"
      onClick={handleGlobalClose}
    >
      <div
        className="max-w-2xl w-full bg-red-950/95 border-4 border-white/90 rounded-3xl p-5 sm:p-8 shadow-2xl text-center space-y-5 relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleGlobalClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title="Cerrar (Esc)"
          aria-label="Cerrar alerta de acceso denegado"
        >
          <X size={24} />
        </button>

        {/* Icono de Alerta de Alta Visibilidad */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-red-500/30 border-4 border-white flex items-center justify-center shadow-lg">
          <AlertOctagon size={40} className="text-white animate-bounce" />
        </div>

        {/* Título Mandatorio Exacto + Transparencia de Lectura */}
        <div className="space-y-2.5">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white font-[family-name:var(--font-heading)] uppercase drop-shadow-md">
            {MANDATED_BLOCKING_TITLE}
          </h1>

          {resolvedStudentName && (
            <div className="pt-1 space-y-1.5">
              <p className="text-xl sm:text-2xl font-extrabold text-white">
                {resolvedStudentName}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-mono">
                {studentDisplayId && (
                  <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-red-100 font-bold">
                    ID Ficha: {studentDisplayId}
                  </span>
                )}
                {student?.email && (
                  <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-red-100">
                    {student.email}
                  </span>
                )}
              </div>
            </div>
          )}

          {displayMotivo && (
            <div>
              <p className="text-xs sm:text-sm text-red-100 font-mono px-4 py-1.5 rounded-full bg-black/45 inline-block border border-white/25 font-bold">
                {displayMotivo}
              </p>
            </div>
          )}

          {/* Barra de Transparencia: Código exacto leído + Acceso directo a Alumnos */}
          <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
            {rawCode && (
              <span className="text-xs font-mono font-bold text-amber-200 px-3 py-1.5 rounded-xl bg-black/50 border border-amber-400/30">
                Código leído: {rawCode}
              </span>
            )}
            <button
              type="button"
              onClick={handleOpenFichaAlumnos}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/30 transition-all cursor-pointer"
            >
              <ExternalLink size={13} />
              <span>Abrir ficha en Alumnos</span>
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* AUTO-REPARACIÓN EN 1 CLIC: VINCULAR CÓDIGO / CUENTA A ALUMNA ACTIVA */}
        {/* =================================================================== */}
        {isSinPlanOrUnrecognized && (
          <div
            data-ignore-scanner="true"
            className="bg-slate-950/85 border-2 border-amber-400/50 rounded-2xl p-4 sm:p-5 text-left space-y-3 shadow-inner"
          >
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                <Link2 size={16} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-amber-300">
                  🔗 Vincular este código/cuenta a una alumna matriculada
                </h2>
                <p id={searchHintId} className="text-xs text-slate-300 leading-relaxed mt-0.5">
                  Si la alumna entró con otro correo distinto al de su madre/padre o usa tarjeta nueva, búscala por nombre para fusionar su código y autorizar la entrada en verde al instante:
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={searchInputId}
                className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block"
              >
                Buscar alumna matriculada por nombre, email o ID
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id={searchInputId}
                  name="student_link_query"
                  type="search"
                  data-ignore-scanner="true"
                  autoFocus
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  aria-describedby={searchHintId}
                  value={linkQuery}
                  onChange={(e) => setLinkQuery(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && !e.nativeEvent.isComposing && matchingEnrolledStudents.length === 1) {
                      e.preventDefault();
                      handleLinkAndAuthorize(matchingEnrolledStudents[0]);
                    }
                  }}
                  placeholder="Ej: Verónica, Leyre, Ivanna..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-600 focus:border-amber-400 focus:outline-none text-white text-base placeholder:text-slate-500"
                />
              </div>
            </div>

            {isLoadingDirectory && (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <Loader2 size={14} className="animate-spin text-amber-400" />
                <span>Cargando listado de alumnas matriculadas...</span>
              </div>
            )}

            {!isLoadingDirectory && matchingEnrolledStudents.length > 0 && (
              <div className="max-h-52 overflow-y-auto overscroll-contain space-y-2 pr-1">
                {matchingEnrolledStudents.map((cand) => {
                  const candPlan = cand.plan_activo || "Sin Plan Activo";
                  const candSinPlan = candPlan.toLowerCase().includes("sin plan");
                  return (
                    <div
                      key={cand.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-900/95 border border-slate-700 hover:border-emerald-400/60 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-sm font-bold text-white truncate">
                            {cand.nombre_completo}
                          </strong>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-200">
                            ID: {cand.nfc_token || String(cand.id).slice(0, 6)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-1 text-[11px]">
                          <span
                            className={`font-bold px-2 py-0.5 rounded-full ${
                              candSinPlan
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {candPlan}
                          </span>
                          {cand.email && (
                            <span className="text-slate-400 truncate">{cand.email}</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isRepairing}
                        onClick={() => handleLinkAndAuthorize(cand)}
                        className="shrink-0 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wide transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isRepairing ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={15} />
                        )}
                        <span>Vincular y Autorizar</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {!isLoadingDirectory && linkQuery.trim().length >= 2 && matchingEnrolledStudents.length === 0 && (
              <p className="text-xs text-slate-400 py-1">
                No se encontró ninguna ficha con «{linkQuery}». Prueba con el apellido o pulsa «Abrir ficha en Alumnos».
              </p>
            )}
          </div>
        )}

        {repairFeedback && (
          <div className="p-3 rounded-xl bg-black/50 border border-amber-400/50 text-amber-200 text-xs font-semibold">
            {repairFeedback}
          </div>
        )}

        {/* Botones de Acción de Resolución en 1 Clic (R4) */}
        <div className="pt-1 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
          {isCuotaCase && student?.id && (
            <button
              type="button"
              disabled={isRepairing}
              onClick={handleClearUnpaidAndAuthorize}
              className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-slate-950 font-black text-sm sm:text-base transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {isRepairing ? <Loader2 size={18} className="animate-spin" /> : null}
              <span>✓ Quitar aviso de impago y autorizar entrada</span>
            </button>
          )}

          {effectiveActionType === "cobro_cuota" && (
            <button
              type="button"
              disabled={isRepairing}
              onClick={() => {
                handleGlobalClose();
                if (onAction) {
                  onAction("cobro_cuota");
                } else {
                  openGlobalCobro(student);
                }
              }}
              className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-sm sm:text-base transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
            >
              💳 Cobrar cuota pendiente en 1 clic
            </button>
          )}

          {effectiveActionType === "recargar_bono" && (
            <button
              type="button"
              disabled={isRepairing}
              onClick={() => {
                handleGlobalClose();
                if (onAction) {
                  onAction("recargar_bono");
                } else {
                  openGlobalCobro(student);
                }
              }}
              className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-sm sm:text-base transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
            >
              🎟️ Recargar bono en 1 clic
            </button>
          )}

          {effectiveActionType === "asignar_plan" && student && (
            <button
              type="button"
              disabled={isRepairing}
              onClick={() => {
                handleGlobalClose();
                if (onAction) {
                  onAction("asignar_plan");
                } else {
                  openGlobalCobro(student);
                }
              }}
              className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-sm sm:text-base transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
            >
              📋 Asignar plan regular en 1 clic
            </button>
          )}

          <button
            type="button"
            onClick={handleGlobalClose}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-white text-red-900 font-extrabold text-sm sm:text-base hover:bg-red-100 transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider"
          >
            Entendido / Cerrar
          </button>
        </div>

        {/* Indicador de Temporizador */}
        <div>
          {hasInteractiveAction ? (
            <span className="text-xs text-amber-200/90 font-mono">
              (Cierre automático pausado para resolución en 1 clic)
            </span>
          ) : (
            <span className="text-xs text-red-200/80 font-mono">
              (Cierre automático en 4 segundos)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
