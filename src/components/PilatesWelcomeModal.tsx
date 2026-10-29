"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  CalendarCheck2,
  Sparkles,
  AlertCircle,
  X,
  MonitorSmartphone,
  QrCode,
} from "lucide-react";
import {
  PilatesCheckInEvent,
  getPilatesInitials,
} from "@/lib/pilatesService";

interface PilatesWelcomeModalProps {
  event: PilatesCheckInEvent | null;
  onClose: () => void;
  autoCloseMs?: number;
}

export default function PilatesWelcomeModal({
  event,
  onClose,
  autoCloseMs = 9500,
}: PilatesWelcomeModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const programmaticCloseRef = useRef(false);
  const titleId = useId();
  const [imgFailed, setImgFailed] = useState(false);
  const [progressPct, setProgressPct] = useState(100);

  useEffect(() => {
    setImgFailed(false);
    setProgressPct(100);
  }, [event?.eventUid]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (event) {
      programmaticCloseRef.current = false;
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {}
      }
    } else if (dialog.open) {
      programmaticCloseRef.current = true;
      try {
        dialog.close();
      } catch {}
    }
  }, [event]);

  useEffect(() => {
    if (!event) return;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remainingPct = Math.max(0, 100 - (elapsed / autoCloseMs) * 100);
      setProgressPct(remainingPct);
      if (elapsed >= autoCloseMs) {
        clearInterval(interval);
        onClose();
      }
    }, 80);

    return () => clearInterval(interval);
  }, [event, autoCloseMs, onClose]);

  // Light dismiss fallback when clicking backdrop outside dialog bounds
  const handlePointerUp = (e: React.PointerEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    const clickedOutside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;
    if (clickedOutside) {
      onClose();
    }
  };

  const hasValidPhoto = Boolean(event?.fotoUrl && !imgFailed);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => {
        if (dialogRef.current) {
          dialogRef.current.returnValue = "";
        }
        if (programmaticCloseRef.current) {
          programmaticCloseRef.current = false;
          return;
        }
        if (event) {
          onClose();
        }
      }}
      onPointerUp={handlePointerUp}
      className="m-auto w-[94vw] max-w-xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-0 text-[var(--color-text-body)] shadow-2xl backdrop:bg-slate-950/75 backdrop:backdrop-blur-sm"
    >
      {event && (
        <div className="relative overflow-hidden">
          {/* Barra superior de autocierre suave */}
          <div className="h-1.5 w-full bg-[var(--color-bg)]">
            <div
              className={`h-full transition-all duration-100 ${
                event.requiereAvisoAmable ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="p-6 sm:p-7 space-y-5">
            {/* Cabecera Superior: Badge Horario Libre 24h + Botón Cerrar */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/35 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>ACCESO LIBRE 24H REGISTRADO</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1 text-[11px] font-bold text-[var(--color-text-secondary)]">
                  <Sparkles size={12} className="text-teal-500 shrink-0" />
                  <span>Solo Pilates</span>
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar ficha de bienvenida Pilates"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Bloque Central: FOTOGRAFÍA EN GRANDE + Identidad del Alumno */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
              <div
                className={`relative w-44 h-44 shrink-0 rounded-3xl overflow-hidden border-4 shadow-xl ${
                  event.requiereAvisoAmable
                    ? "border-amber-500/60 shadow-amber-500/15"
                    : "border-emerald-500/70 shadow-emerald-500/20"
                } bg-[var(--color-bg)] flex items-center justify-center`}
              >
                {hasValidPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.fotoUrl}
                    alt={`Fotografía de ${event.nombreCompleto}`}
                    onError={() => setImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-teal-600 to-emerald-700 text-white flex flex-col items-center justify-center select-none">
                    <span className="text-5xl font-black tracking-wider font-[family-name:var(--font-heading)]">
                      {getPilatesInitials(event.nombreCompleto)}
                    </span>
                    <span className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-100">
                      Solo Pilates
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left space-y-3 min-w-0">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400 block">
                    Ficha de Entrada en Recepción
                  </span>
                  <h2
                    id={titleId}
                    className="mt-1 text-2xl sm:text-3xl font-extrabold font-[family-name:var(--font-heading)] text-[var(--color-text-title)] leading-snug break-words"
                  >
                    {event.nombreCompleto}
                  </h2>
                </div>

                {/* Metadatos rápidos: Hora exacta y código QR */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 font-mono font-bold text-[var(--color-text-title)]">
                    <Clock size={14} className="text-emerald-500 shrink-0" />
                    <span>{event.horaEntrada}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 font-mono font-bold text-[var(--color-text-secondary)]">
                    <QrCode size={14} className="text-teal-500 shrink-0" />
                    <span>{event.codigoQr}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 font-semibold text-[var(--color-text-secondary)]">
                    <CalendarCheck2 size={14} className="text-emerald-500 shrink-0" />
                    <span>
                      {event.asistenciasMes}{" "}
                      {event.asistenciasMes === 1 ? "asistencia este mes" : "asistencias este mes"}
                    </span>
                  </span>
                </div>

                {/* Tarjeta clara de Estado de Mensualidad / Bono */}
                <div
                  className={`rounded-2xl border p-3.5 text-left ${
                    event.requiereAvisoAmable
                      ? "bg-amber-500/12 border-amber-500/40"
                      : "bg-emerald-500/12 border-emerald-500/35"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {event.requiereAvisoAmable ? (
                      <AlertCircle
                        size={18}
                        className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                      />
                    ) : (
                      <CheckCircle2
                        size={18}
                        className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                      />
                    )}
                    <div className="space-y-0.5 min-w-0">
                      <p
                        className={`text-xs font-extrabold uppercase tracking-wider leading-snug break-words ${
                          event.requiereAvisoAmable
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {event.esBono
                          ? `${event.tipoPlan} · ${event.sesionesRestantes ?? 0}/${
                              event.sesionesTotalesBono ?? 4
                            } sesiones restantes`
                          : `${event.tipoPlan} · ${event.estadoCuota}`}
                      </p>
                      <p className="text-xs text-[var(--color-text-body)] leading-snug break-words">
                        {event.mensajeEstado}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie del Modal: Indicador de Sincronización 2 PCs + Acción */}
            <div className="pt-3 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <MonitorSmartphone size={15} className="text-teal-500 shrink-0" />
                <span className="leading-snug break-words">
                  Sincronizado en vivo en Recepción ({event.origenPc} · {event.fechaCorta})
                </span>
              </div>

              <form method="dialog">
                <button
                  type="submit"
                  autoFocus
                  onClick={(e) => {
                    e.preventDefault();
                    onClose();
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  Entendido · Cerrar Ficha
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
