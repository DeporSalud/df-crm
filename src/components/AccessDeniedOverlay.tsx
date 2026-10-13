"use client";

import React, { useEffect } from "react";
import { AlertOctagon, X } from "lucide-react";
import { playSawtoothAlarm } from "@/lib/soundUtils";
import { openGlobalCobro } from "@/components/GlobalCobroModal";

export interface AccessDeniedOverlayProps {
  isOpen?: boolean;
  open?: boolean;
  studentName?: string;
  student?: any;
  reason?: string;
  motivo?: string;
  rawCode?: string;
  actionType?: 'cobro_cuota' | 'recargar_bono' | string;
  onAction?: (actionType?: string) => void;
  onClose: () => void;
  autoCloseMs?: number;
}

export const MANDATED_BLOCKING_TITLE = "⛔ ACCESO DENEGADO: Pasar por mostrador de recepción";

export function evaluateAccessDeniedResolution(student?: any, reason?: string) {
  let actionType: 'cobro_cuota' | 'recargar_bono' | 'asignar_plan' | null = null;
  let actionLabel: string | null = null;

  const r = String(reason || (student?.cuota_impagada ? 'CUOTA_IMPAGADA' : '')).toUpperCase();
  if (r.includes('CUOTA') || r.includes('IMPAGAD') || student?.cuota_impagada) {
    actionType = 'cobro_cuota';
    actionLabel = 'Cobrar cuota pendiente en 1 clic';
  } else if (
    r.includes('BONO') || 
    (student?.plan_activo && student.plan_activo.toLowerCase().includes('bono') && (student.clases_restantes ?? 0) <= 0)
  ) {
    actionType = 'recargar_bono';
    actionLabel = 'Recargar bono en 1 clic';
  } else if (r.includes('SIN_PLAN') || (student?.plan_activo && student.plan_activo.toLowerCase().includes('sin plan'))) {
    actionType = 'asignar_plan';
    actionLabel = 'Asignar plan regular en 1 clic';
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
  const isVisible = Boolean(open ?? isOpen);
  const resolvedStudentName = student?.nombre_completo || studentName;
  const resolution = evaluateAccessDeniedResolution(student, reason || motivo);
  const effectiveActionType = actionType || resolution.actionType;
  const hasInteractiveAction = Boolean(effectiveActionType);

  useEffect(() => {
    if (!isVisible) return;

    // Disparar sonido Sawtooth de error inmediatamente al abrir
    playSawtoothAlarm();

    // Si existen acciones interactivas en 1 clic, pausar/cancelar el auto-cierre
    let timer: NodeJS.Timeout | null = null;
    if (!hasInteractiveAction) {
      timer = setTimeout(() => {
        onClose();
      }, autoCloseMs);
    }

    // Tecla Escape para cerrar
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible, onClose, autoCloseMs, hasInteractiveAction]);

  if (!isVisible) return null;

  const displayMotivo = motivo || (reason ? (reason === "CUOTA_IMPAGADA" ? "Cuota pendiente de pago" : reason === "BONO_AGOTADO" ? "Bono agotado (0 clases restantes)" : reason) : undefined);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-50 bg-red-600/90 animate-pulse flex flex-col items-center justify-center text-white p-4 sm:p-6 backdrop-blur-md select-none"
      onClick={onClose}
    >
      <div
        className="max-w-2xl w-full bg-red-950/95 border-4 border-white/90 rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title="Cerrar (Esc)"
        >
          <X size={24} />
        </button>

        {/* Icono de Alerta de Alta Visibilidad */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full bg-red-500/30 border-4 border-white flex items-center justify-center shadow-lg">
          <AlertOctagon size={48} className="text-white animate-bounce" />
        </div>

        {/* Título Mandatorio Exacto */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white font-[family-name:var(--font-heading)] uppercase drop-shadow-md">
            {MANDATED_BLOCKING_TITLE}
          </h1>

          {resolvedStudentName && (
            <div className="pt-2">
              <p className="text-xl sm:text-2xl font-bold text-red-100">
                {resolvedStudentName}
              </p>
              {displayMotivo && (
                <p className="text-sm sm:text-base text-red-200 font-mono mt-1 px-4 py-1.5 rounded-full bg-black/40 inline-block border border-white/20">
                  {displayMotivo}
                </p>
              )}
            </div>
          )}

          {!resolvedStudentName && rawCode && (
            <p className="text-sm sm:text-base text-red-200 font-mono mt-1 px-4 py-1.5 rounded-full bg-black/40 inline-block border border-white/20">
              Código escaneado no reconocido: {rawCode}
            </p>
          )}

          {!resolvedStudentName && !rawCode && displayMotivo && (
            <p className="text-sm sm:text-base text-red-200 font-mono mt-1 px-4 py-1.5 rounded-full bg-black/40 inline-block border border-white/20">
              {displayMotivo}
            </p>
          )}
        </div>

        {/* Botones de Acción de Resolución en 1 Clic (R4) */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          {effectiveActionType === 'cobro_cuota' && (
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onAction) {
                  onAction('cobro_cuota');
                } else {
                  openGlobalCobro(student);
                }
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
            >
              💳 Cobrar cuota pendiente en 1 clic
            </button>
          )}

          {effectiveActionType === 'recargar_bono' && (
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onAction) {
                  onAction('recargar_bono');
                } else {
                  openGlobalCobro(student);
                }
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
            >
              🎟️ Recargar bono en 1 clic
            </button>
          )}

          {effectiveActionType === 'asignar_plan' && (
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onAction) {
                  onAction('asignar_plan');
                } else {
                  openGlobalCobro(student);
                }
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
            >
              📋 Asignar plan regular en 1 clic
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full sm:auto px-8 py-3.5 rounded-2xl bg-white text-red-900 font-extrabold text-base hover:bg-red-100 transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider"
          >
            Entendido / Cerrar
          </button>
        </div>

        {/* Indicador de Temporizador */}
        <div className="pt-1">
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

