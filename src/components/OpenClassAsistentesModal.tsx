"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  X, Users, UserCheck, Calendar, Clock, MapPin, 
  Search, AlertCircle, CheckCircle2, UserPlus, Phone, 
  Mail, ShieldAlert, Sparkles, RefreshCw, AlertTriangle
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { 
  OpenClassReserva, 
  CalendarDayItem, 
  formatFullCalendarDate, 
  cancelarReservaOpenClass, 
  confirmarAsistenciaReservaOpenClass,
  getReservasPorClaseYSesion,
  getReservasAlumno,
  crearReservaOpenClass,
  isAlumnoReservadoEnSesion,
  normalizeClaseId
} from "@/lib/openClassService";
import { logActivity } from "@/lib/activityLogger";

interface OpenClassAsistentesModalProps {
  isOpen: boolean;
  onClose: () => void;
  clase: any | null;
  calendarDay: CalendarDayItem | null;
  onReservationChanged?: () => void;
}

export default function OpenClassAsistentesModal({
  isOpen,
  onClose,
  clase,
  calendarDay,
  onReservationChanged
}: OpenClassAsistentesModalProps) {
  const [reservas, setReservas] = useState<OpenClassReserva[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Manual Add Student to session state
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addSearchResults, setAddSearchResults] = useState<any[]>([]);
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState<any | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Confirmation dialog for cancellation
  const [confirmCancelModal, setConfirmCancelModal] = useState<{
    isOpen: boolean;
    reserva: OpenClassReserva | null;
  }>({
    isOpen: false,
    reserva: null
  });

  const loadReservas = async () => {
    if (!clase || !calendarDay) return;
    const list = getReservasPorClaseYSesion(clase.id, calendarDay.dateISO);
    setReservas(list);

    // Asynchronously enrich with latest student data from Supabase if students modified profile
    const studentIds = list.map(r => r.alumno_id).filter(Boolean);
    if (studentIds.length > 0) {
      try {
        const { data: latestStudents } = await supabase
          .from("alumnos")
          .select("id, nombre_completo, email, telefono, dni, plan_activo")
          .in("id", studentIds);

        if (latestStudents && latestStudents.length > 0) {
          const map = new Map(latestStudents.map(s => [s.id, s]));
          setReservas(prev => prev.map(r => {
            const s = map.get(r.alumno_id);
            if (!s) return r;
            return {
              ...r,
              alumno_nombre: s.nombre_completo || r.alumno_nombre,
              alumno_email: s.email || r.alumno_email,
              alumno_telefono: s.telefono || r.alumno_telefono,
              alumno_dni: s.dni || r.alumno_dni,
              alumno_plan: s.plan_activo || r.alumno_plan
            };
          }));
        }
      } catch (e) {
        // Fallback to existing snapshot
      }
    }
  };

  useEffect(() => {
    if (isOpen && clase && calendarDay) {
      loadReservas();
      setStatusMessage(null);
      setSearchTerm("");
      setIsAddingStudent(false);
      setSelectedStudentToAdd(null);
    }
  }, [isOpen, clase?.id, calendarDay?.dateISO]);

  // Listen to cross-component reservation changes
  useEffect(() => {
    const handleUpdated = () => {
      loadReservas();
    };
    window.addEventListener("df_reservas_updated", handleUpdated);
    window.addEventListener("storage", handleUpdated);
    return () => {
      window.removeEventListener("df_reservas_updated", handleUpdated);
      window.removeEventListener("storage", handleUpdated);
    };
  }, [clase?.id, calendarDay?.dateISO]);

  // Handle manual student search for adding to session
  useEffect(() => {
    const searchStudents = async () => {
      if (addSearch.trim().length < 2) {
        setAddSearchResults([]);
        return;
      }
      try {
        const { data } = await supabase
          .from("alumnos")
          .select("*")
          .or(`nombre_completo.ilike.%${addSearch}%,dni.ilike.%${addSearch}%,email.ilike.%${addSearch}%`)
          .limit(5);
        setAddSearchResults(data || []);
      } catch (e) {
        setAddSearchResults([]);
      }
    };

    const timeout = setTimeout(searchStudents, 250);
    return () => clearTimeout(timeout);
  }, [addSearch]);

  const filteredReservas = useMemo(() => {
    if (!searchTerm.trim()) return reservas;
    const normalizeStr = (s: string | undefined | null) =>
      (s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const q = normalizeStr(searchTerm);
    return reservas.filter(r => 
      normalizeStr(r.alumno_nombre).includes(q) ||
      normalizeStr(r.alumno_email).includes(q) ||
      normalizeStr(r.alumno_telefono).includes(q) ||
      normalizeStr(r.alumno_dni).includes(q) ||
      normalizeStr(r.alumno_plan).includes(q)
    );
  }, [reservas, searchTerm]);

  if (!isOpen || !clase || !calendarDay) return null;

  const totalCapacidad = clase.aforo_maximo || 20;
  const totalReservados = reservas.length;
  const plazasLibres = Math.max(0, totalCapacidad - totalReservados);
  const porcentajeOcupacion = Math.min(100, Math.round((totalReservados / totalCapacidad) * 100));
  const formattedDate = formatFullCalendarDate(calendarDay);

  // Play sound
  const playSound = (success: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      if (success) {
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(140, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  };

  // Confirm attendance directly from list
  const handleConfirmAsistencia = async (reserva: OpenClassReserva) => {
    setIsLoading(true);
    try {
      // 1. Insert into Supabase asistencias if valid ID
      if (reserva.alumno_id) {
        const hora = (clase?.hora_inicio || reserva.hora_inicio || "19:00").trim();
        const sessionDate = (calendarDay?.dateISO || reserva.fecha_iso).trim();
        const classUUID = normalizeClaseId(reserva.clase_id);
        await supabase
          .from("asistencias")
          .insert([{
            alumno_id: reserva.alumno_id,
            clase_id: classUUID,
            fecha_hora: `${sessionDate}T${hora}:00.000Z`
          }]);
      }

      // 2. Mark attendance in service
      confirmarAsistenciaReservaOpenClass(reserva.id);

      playSound(true);
      setStatusMessage({
        type: "success",
        text: `✅ Asistencia confirmada para ${reserva.alumno_nombre} en la sesión del ${formattedDate}.`
      });

      logActivity({
        origen: "recepcion",
        tipo_evento: "checkin",
        descripcion: `Confirmación de asistencia presencial en Open Class: "${reserva.nombre_clase}" (${formattedDate})`,
        usuario_afectado: reserva.alumno_nombre,
        sede: "Studio 2 Paseo Castilla"
      });

      loadReservas();
      if (onReservationChanged) onReservationChanged();
    } catch (err: any) {
      playSound(false);
      setStatusMessage({
        type: "error",
        text: `Error al confirmar asistencia: ${err.message || "Error desconocido"}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Prompt cancellation
  const promptCancelReserva = (reserva: OpenClassReserva) => {
    setConfirmCancelModal({
      isOpen: true,
      reserva
    });
  };

  // Execute cancellation with balance refund
  const handleExecuteCancelarReserva = async () => {
    const reserva = confirmCancelModal.reserva;
    if (!reserva) return;

    setCancellingId(reserva.id);
    setConfirmCancelModal({ isOpen: false, reserva: null });

    try {
      // 1. Cancel in service (returns false if already cancelled)
      const didCancel = cancelarReservaOpenClass(reserva.id);
      if (!didCancel) {
        setStatusMessage({
          type: "error",
          text: `La reserva de ${reserva.alumno_nombre} ya figuraba como cancelada. No se ha modificado el saldo.`
        });
        loadReservas();
        return;
      }

      // 2. Reintegrate class to student's balance in Supabase
      if (reserva.alumno_id) {
        const { data: studentDB } = await supabase
          .from("alumnos")
          .select("*")
          .eq("id", reserva.alumno_id)
          .maybeSingle();

        if (studentDB) {
          const planLower = (studentDB.plan_activo || "").toLowerCase();
          const isUnlimited = planLower.includes("ilimitad");
          
          if (!isUnlimited) {
            const currentSaldo = typeof studentDB.clases_restantes === "number" ? studentDB.clases_restantes : 0;
            const updatedSaldo = currentSaldo + 1;
            await supabase
              .from("alumnos")
              .update({ clases_restantes: updatedSaldo })
              .eq("id", studentDB.id);
          }
        }

        // Clean up alumnos_clases only if no other active reservations remain for this class across any date
        try {
          const targetClassId = normalizeClaseId(reserva.clase_id);
          const otherActive = getReservasAlumno(reserva.alumno_id).filter(
            r => normalizeClaseId(r.clase_id) === targetClassId && r.id !== reserva.id && (r.estado === "Confirmada" || r.estado === "Asistida")
          );
          if (otherActive.length === 0) {
            await supabase
              .from("alumnos_clases")
              .delete()
              .eq("alumno_id", reserva.alumno_id)
              .eq("clase_id", targetClassId);
          }
        } catch (e) {}
      }

      // 3. Log activity
      logActivity({
        origen: "recepcion",
        tipo_evento: "cancelacion_reserva",
        descripcion: `Cancelación presencial en Recepción: "${reserva.nombre_clase}" (${formattedDate}). Se ha reintegrado 1 clase al saldo del alumno.`,
        usuario_afectado: reserva.alumno_nombre,
        sede: "Studio 2 Paseo Castilla"
      });

      playSound(true);
      setStatusMessage({
        type: "success",
        text: `✓ Reserva cancelada para ${reserva.alumno_nombre}. Se ha devuelto 1 clase a su saldo de bono.`
      });

      loadReservas();
      if (onReservationChanged) onReservationChanged();
    } catch (err: any) {
      playSound(false);
      setStatusMessage({
        type: "error",
        text: `Error al cancelar la reserva: ${err.message || "Error desconocido"}`
      });
    } finally {
      setCancellingId(null);
    }
  };

  // Presential enrollment from reception
  const handleAddStudentToSession = async () => {
    if (!selectedStudentToAdd) return;
    setIsSubmittingAdd(true);

    try {
      const planLower = (selectedStudentToAdd.plan_activo || "").toLowerCase();
      const isUnlimited = planLower.includes("ilimitad");
      const currentBalance = typeof selectedStudentToAdd.clases_restantes === "number" ? selectedStudentToAdd.clases_restantes : 0;

      // Check if student is already booked
      if (isAlumnoReservadoEnSesion(selectedStudentToAdd.id, clase.id, calendarDay.dateISO)) {
        playSound(false);
        setStatusMessage({
          type: "error",
          text: `El alumno ${selectedStudentToAdd.nombre_completo} ya tiene una reserva confirmada para esta sesión del ${formattedDate}.`
        });
        setIsSubmittingAdd(false);
        return;
      }

      // Check session capacity
      if (reservas.length >= totalCapacidad) {
        playSound(false);
        setStatusMessage({
          type: "error",
          text: `Aforo completo (${totalCapacidad}/${totalCapacidad}). No quedan plazas libres para la sesión del ${formattedDate}.`
        });
        setIsSubmittingAdd(false);
        return;
      }

      if (!isUnlimited && currentBalance <= 0) {
        playSound(false);
        setStatusMessage({
          type: "error",
          text: `El alumno ${selectedStudentToAdd.nombre_completo} no tiene saldo suficiente de clases (${currentBalance}). Requiere compra de bono previa.`
        });
        setIsSubmittingAdd(false);
        return;
      }

      // Create reservation
      crearReservaOpenClass({
        alumno_id: selectedStudentToAdd.id,
        alumno_nombre: selectedStudentToAdd.nombre_completo,
        alumno_email: selectedStudentToAdd.email,
        alumno_telefono: selectedStudentToAdd.telefono,
        alumno_dni: selectedStudentToAdd.dni,
        alumno_plan: selectedStudentToAdd.plan_activo,
        clase,
        calendarDay
      });

      // Deduct class if not unlimited
      if (!isUnlimited) {
        await supabase
          .from("alumnos")
          .update({ clases_restantes: Math.max(0, currentBalance - 1) })
          .eq("id", selectedStudentToAdd.id);
      }

      // Sync with alumnos_clases in Supabase if not already linked
      try {
        const classUUID = normalizeClaseId(clase.id);
        const { data: existingLink } = await supabase
          .from("alumnos_clases")
          .select("alumno_id")
          .eq("alumno_id", selectedStudentToAdd.id)
          .eq("clase_id", classUUID)
          .maybeSingle();

        if (!existingLink) {
          await supabase.from("alumnos_clases").insert([{
            alumno_id: selectedStudentToAdd.id,
            clase_id: classUUID
          }]);
        }
      } catch (e) {}

      playSound(true);
      setStatusMessage({
        type: "success",
        text: `✅ ${selectedStudentToAdd.nombre_completo} ha sido inscrito con éxito en la sesión del ${formattedDate}.`
      });

      logActivity({
        origen: "recepcion",
        tipo_evento: "reserva_presencial",
        descripcion: `Inscripción presencial en Recepción: "${clase.nombre_clase}" (${formattedDate})`,
        usuario_afectado: selectedStudentToAdd.nombre_completo,
        sede: "Studio 2 Paseo Castilla"
      });

      setIsAddingStudent(false);
      setSelectedStudentToAdd(null);
      setAddSearch("");
      loadReservas();
      if (onReservationChanged) onReservationChanged();
    } catch (err: any) {
      playSound(false);
      setStatusMessage({
        type: "error",
        text: `No se pudo inscribir al alumno: ${err.message || "Error desconocido"}`
      });
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-bg)] via-[var(--color-bg-card)] to-[var(--color-bg)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] border border-[var(--color-secondary)]/30">
                  Open Class • Studio 2 Paseo Castilla
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30">
                  {clase.hora_inicio} - {clase.hora_fin}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black font-[family-name:var(--font-heading)] text-[var(--color-text-title)] truncate">
                {clase.nombre_clase}
              </h2>

              <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)] mt-1 flex-wrap">
                <span>Docente: <strong className="text-white">{clase.profesor}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1 font-semibold text-cyan-400">
                  <Calendar size={13} />
                  {formattedDate}
                </span>
                <span>•</span>
                <span>{clase.sala || "Sala 1"}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700/60 shrink-0"
              aria-label="Cerrar modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* KPI Bar: Plazas Ocupadas / Aforo */}
          <div className="mt-4 pt-3 border-t border-[var(--color-border)]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black font-mono text-cyan-400">{totalReservados}</span>
                <span className="text-sm font-bold text-slate-400 font-mono">/ {totalCapacidad}</span>
                <span className="text-xs text-slate-400 ml-1">plazas ocupadas</span>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                plazasLibres === 0 
                  ? "bg-red-500/20 text-red-300 border border-red-500/30" 
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}>
                {plazasLibres === 0 ? "Aforo Completo" : `${plazasLibres} plazas disponibles`}
              </span>
            </div>

            {/* Ocupancy Progress Bar */}
            <div className="w-full sm:w-48 bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/60">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  porcentajeOcupacion >= 100 
                    ? "bg-red-500" 
                    : porcentajeOcupacion >= 80 
                    ? "bg-amber-400" 
                    : "bg-gradient-to-r from-cyan-500 to-[var(--color-primary)]"
                }`}
                style={{ width: `${porcentajeOcupacion}%` }}
              />
            </div>
          </div>
        </div>

        {/* Status Notification Message */}
        {statusMessage && (
          <div className={`mx-5 mt-4 p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border animate-in fade-in ${
            statusMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
              : "bg-red-950/40 border-red-500/50 text-red-300"
          }`}>
            <span>{statusMessage.text}</span>
            <button 
              type="button" 
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Action / Search Bar */}
        <div className="p-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Quick Search filter */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, DNI, teléfono o plan..."
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-[var(--color-primary)] transition-all"
            />
          </div>

          {/* Button to toggle add student */}
          <button
            type="button"
            onClick={() => setIsAddingStudent(!isAddingStudent)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              isAddingStudent 
                ? "bg-slate-700 text-slate-200 hover:bg-slate-600" 
                : "bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white shadow-md shadow-[var(--color-primary)]/20"
            }`}
          >
            <UserPlus size={15} />
            <span>{isAddingStudent ? "Cerrar Alta" : "Inscribir Alumno Presencial"}</span>
          </button>
        </div>

        {/* Section: Add Student Presentially */}
        {isAddingStudent && (
          <div className="mx-5 mb-3 p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-secondary)]/40 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <UserPlus size={14} className="text-[var(--color-secondary)]" />
                Inscripción Presencial en Esta Sesión ({formattedDate})
              </h4>
              <span className="text-[10px] text-slate-400">Descuenta 1 clase de bono</span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder="Escribe el nombre o DNI del alumno para inscribir..."
                className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-[var(--color-secondary)]"
              />
            </div>

            {addSearchResults.length > 0 && (
              <div className="border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)] max-h-36 overflow-y-auto bg-[var(--color-bg-card)]">
                {addSearchResults.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedStudentToAdd(s)}
                    className={`p-2.5 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      selectedStudentToAdd?.id === s.id 
                        ? "bg-[var(--color-primary)]/20 text-white border-l-4 border-[var(--color-primary)]" 
                        : "hover:bg-slate-800/60 text-slate-200"
                    }`}
                  >
                    <div>
                      <strong className="text-white">{s.nombre_completo}</strong>
                      <span className="text-slate-400 text-[11px] ml-2">DNI: {s.dni || "S/N"}</span>
                    </div>
                    <span className="text-[11px] font-mono text-cyan-400">
                      Saldo: {s.clases_restantes ?? 0} clases
                    </span>
                  </div>
                ))}
              </div>
            )}

            {selectedStudentToAdd && (
              <div className="pt-2 flex items-center justify-between border-t border-[var(--color-border)]">
                <span className="text-xs text-emerald-300 font-semibold">
                  Seleccionado: {selectedStudentToAdd.nombre_completo} ({selectedStudentToAdd.plan_activo || "Bono"} • {selectedStudentToAdd.clases_restantes ?? 0} clases)
                </span>
                <button
                  type="button"
                  disabled={isSubmittingAdd}
                  onClick={handleAddStudentToSession}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingAdd ? "Inscribiendo..." : "Confirmar Inscripción"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Attendees List (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 pt-1 space-y-2.5">
          {reservas.length === 0 ? (
            /* Friendly Empty State for 0 reservations (Required by AC) */
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-3 bg-[var(--color-bg)]/40 rounded-xl border border-dashed border-[var(--color-border)]">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                <Users size={26} />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">0 reservas para este día</h4>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-sm">
                  Todavía no hay alumnos apuntados para la sesión del <strong className="text-white">{formattedDate}</strong>. Todas las plazas ({totalCapacidad}) están disponibles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingStudent(true)}
                className="mt-2 px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold hover:bg-[var(--color-primary)]/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <UserPlus size={15} />
                <span>Inscribir Primer Alumno</span>
              </button>
            </div>
          ) : filteredReservas.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No se encontraron alumnos con el criterio de búsqueda "{searchTerm}".
            </div>
          ) : (
            filteredReservas.map((reserva, idx) => {
              const isAssisted = reserva.asistido || reserva.estado === "Asistida";

              return (
                <div
                  key={reserva.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isAssisted 
                      ? "bg-emerald-950/25 border-emerald-500/40 hover:border-emerald-500/60" 
                      : "bg-[var(--color-bg)] border-[var(--color-border)] hover:border-cyan-500/40"
                  }`}
                >
                  {/* Student Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                      isAssisted 
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                        : "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                    }`}>
                      {idx + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">
                          {reserva.alumno_nombre}
                        </span>

                        {/* Status Badge */}
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                          isAssisted 
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                            : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                        }`}>
                          {isAssisted ? (
                            <>
                              <CheckCircle2 size={11} />
                              Asistencia Validada
                            </>
                          ) : (
                            <>
                              <Clock size={11} />
                              Reserva Confirmada
                            </>
                          )}
                        </span>
                      </div>

                      {/* Contact & Plan details */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                        {reserva.alumno_plan && (
                          <span className="text-amber-300/90 font-medium">
                            Plan: {reserva.alumno_plan}
                          </span>
                        )}
                        {reserva.alumno_telefono && (
                          <span>• Tel: {reserva.alumno_telefono}</span>
                        )}
                        {reserva.alumno_email && (
                          <span>• {reserva.alumno_email}</span>
                        )}
                        {reserva.alumno_dni && (
                          <span>• DNI: {reserva.alumno_dni}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 pt-1 sm:pt-0">
                    {!isAssisted && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleConfirmAsistencia(reserva)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                        title="Validar asistencia presencial del alumno"
                      >
                        <UserCheck size={14} />
                        <span>Confirmar Asistencia</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={cancellingId === reserva.id}
                      onClick={() => promptCancelReserva(reserva)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95 disabled:opacity-50"
                      title="Cancelar reserva y reintegrar 1 clase al saldo"
                    >
                      <X size={13} />
                      <span>Cancelar</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sincronizado en tiempo real con la app de alumnos (`df_reservas_updated`)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors cursor-pointer self-end sm:self-auto"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>

      {/* Nested Confirm Cancellation Dialog */}
      {confirmCancelModal.isOpen && confirmCancelModal.reserva && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--color-bg-card)] border border-amber-500/40 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">¿Cancelar Reserva Presencial?</h3>
                <p className="text-xs text-slate-400">
                  {confirmCancelModal.reserva.alumno_nombre}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Estás a punto de cancelar la reserva para la sesión de <strong>"{confirmCancelModal.reserva.nombre_clase}"</strong> del <strong>{formattedDate}</strong>.
              <br /><br />
              Se <strong className="text-emerald-400">reintegrará automáticamente 1 clase</strong> al saldo de bono del alumno en el sistema y se liberará 1 plaza en el aforo.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmCancelModal({ isOpen: false, reserva: null })}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleExecuteCancelarReserva}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 cursor-pointer"
              >
                Sí, Cancelar y Reembolsar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
