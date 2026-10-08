"use client";

import React, { useEffect } from "react";
import { AlertOctagon, X } from "lucide-react";
import { playSawtoothAlarm } from "@/lib/soundUtils";

export interface AccessDeniedOverlayProps {
  isOpen: boolean;
  studentName?: string;
  motivo?: string;
  rawCode?: string;
  onClose: () => void;
  autoCloseMs?: number;
}

export const MANDATED_BLOCKING_TITLE = "⛔ ACCESO DENEGADO: Pasar por mostrador de recepción";

export default function AccessDeniedOverlay({
  isOpen,
  studentName,
  motivo,
  rawCode,
  onClose,
  autoCloseMs = 4000
}: AccessDeniedOverlayProps) {
  useEffect(() => {
    if (!isOpen) return;

    // Disparar sonido Sawtooth de error inmediatamente al abrir
    playSawtoothAlarm();

    // Auto-cierre a los 4 segundos
    const timer = setTimeout(() => {
      onClose();
    }, autoCloseMs);

    // Tecla Escape para cerrar
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, autoCloseMs]);

  if (!isOpen) return null;

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

          {studentName && (
            <div className="pt-2">
              <p className="text-xl sm:text-2xl font-bold text-red-100">
                {studentName}
              </p>
              {motivo && (
                <p className="text-sm sm:text-base text-red-200 font-mono mt-1 px-4 py-1.5 rounded-full bg-black/40 inline-block border border-white/20">
                  {motivo}
                </p>
              )}
            </div>
          )}

          {!studentName && rawCode && (
            <p className="text-sm sm:text-base text-red-200 font-mono mt-1 px-4 py-1.5 rounded-full bg-black/40 inline-block border border-white/20">
              Código escaneado no reconocido: {rawCode}
            </p>
          )}

          {!studentName && !rawCode && motivo && (
            <p className="text-sm sm:text-base text-red-200 font-mono mt-1 px-4 py-1.5 rounded-full bg-black/40 inline-block border border-white/20">
              {motivo}
            </p>
          )}
        </div>

        {/* Botón de Confirmación y Cuenta Atrás */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onClose}
            className="w-full sm:auto px-8 py-3.5 rounded-2xl bg-white text-red-900 font-extrabold text-base hover:bg-red-100 transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider"
          >
            Entendido / Cerrar
          </button>
          <span className="text-xs text-red-200/80 font-mono">
            (Cierre automático en 4 segundos)
          </span>
        </div>
      </div>
    </div>
  );
}
