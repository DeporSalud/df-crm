"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Filter,
  RefreshCw,
  Search,
  User,
  Users,
  X,
  Building2,
  CheckCircle2,
  Sparkles,
  Ticket,
  GraduationCap
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export interface AttendanceRecord {
  id: string;
  fecha_hora: string;
  alumno_id: string;
  clase_id: string | null;
  alumnos: {
    id?: string;
    nombre_completo?: string;
    dni?: string;
    telefono?: string;
    email?: string;
    plan_activo?: string;
    sede?: string;
    clases_restantes?: number | null;
  } | null;
  clases_cuadrante: {
    id?: string;
    nombre_clase?: string;
    profesor?: string;
    sede?: string;
    sala?: string;
    hora_inicio?: string;
    hora_fin?: string;
  } | null;
}

interface HistoricoEntradasModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string; // Formato YYYY-MM-DD
}

export default function HistoricoEntradasModal({
  isOpen,
  onClose,
  initialDate
}: HistoricoEntradasModalProps) {
  // Función para obtener la fecha de hoy en formato local YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(() => initialDate || getTodayStr());
  const [entrances, setEntrances] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtros interactivos
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterSede, setFilterSede] = useState<"todas" | "tejar" | "castilla">("todas");
  const [filterTipoPlan, setFilterTipoPlan] = useState<"todos" | "bono" | "regular">("todos");

  // Si cambia la fecha inicial desde las props
  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  // Cargar asistencias para la fecha seleccionada
  const loadEntrancesForDate = useCallback(async (dateStr: string) => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // Definir rango del día completo (00:00:00 a 23:59:59)
      const startOfDay = new Date(`${dateStr}T00:00:00`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999`);

      const { data, error } = await supabase
        .from("asistencias")
        .select(`
          id,
          fecha_hora,
          alumno_id,
          clase_id,
          alumnos (
            id,
            nombre_completo,
            dni,
            telefono,
            email,
            plan_activo,
            sede,
            clases_restantes
          ),
          clases_cuadrante (
            id,
            nombre_clase,
            profesor,
            sede,
            hora_inicio,
            hora_fin
          )
        `)
        .gte("fecha_hora", startOfDay.toISOString())
        .lte("fecha_hora", endOfDay.toISOString())
        .order("fecha_hora", { ascending: false });

      if (error) {
        console.error("Error al consultar asistencias:", error);
        setErrorMsg("No se pudieron cargar las entradas de esta fecha.");
        setEntrances([]);
      } else {
        // Mapear de forma segura si la relación devuelve objeto o array
        const normalized: AttendanceRecord[] = (data || []).map((item: any) => ({
          id: item.id,
          fecha_hora: item.fecha_hora,
          alumno_id: item.alumno_id,
          clase_id: item.clase_id,
          alumnos: Array.isArray(item.alumnos) ? item.alumnos[0] : item.alumnos,
          clases_cuadrante: Array.isArray(item.clases_cuadrante) ? item.clases_cuadrante[0] : item.clases_cuadrante
        }));
        setEntrances(normalized);
      }
    } catch (err: any) {
      console.error("Excepción en loadEntrancesForDate:", err);
      setErrorMsg("Error de conexión al obtener asistencias.");
      setEntrances([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Efecto cuando se abre o cambia la fecha seleccionada
  useEffect(() => {
    if (isOpen) {
      loadEntrancesForDate(selectedDate);
    }
  }, [isOpen, selectedDate, loadEntrancesForDate]);

  // Suscripción a eventos en tiempo real si estamos en el día de hoy
  useEffect(() => {
    if (!isOpen) return;

    const handleCheckinEvent = () => {
      const today = getTodayStr();
      if (selectedDate === today) {
        loadEntrancesForDate(today);
      }
    };

    window.addEventListener("df_checkin_success", handleCheckinEvent);
    return () => {
      window.removeEventListener("df_checkin_success", handleCheckinEvent);
    };
  }, [isOpen, selectedDate, loadEntrancesForDate]);

  // Navegación de días
  const handlePrevDay = () => {
    const current = new Date(`${selectedDate}T12:00:00`);
    current.setDate(current.getDate() - 1);
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${d}`);
  };

  const handleNextDay = () => {
    const current = new Date(`${selectedDate}T12:00:00`);
    current.setDate(current.getDate() + 1);
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${d}`);
  };

  const handleGoToday = () => {
    setSelectedDate(getTodayStr());
  };

  // Formato bonito de fecha en español (ej. Viernes, 4 de Septiembre de 2026)
  const formattedDateTitle = useMemo(() => {
    try {
      const parts = selectedDate.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const weekday = d.toLocaleDateString("es-ES", { weekday: "long" });
        const day = d.getDate();
        const month = d.toLocaleDateString("es-ES", { month: "long" });
        const year = d.getFullYear();
        return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} de ${month} de ${year}`;
      }
    } catch {}
    return selectedDate;
  }, [selectedDate]);

  const isTodaySelected = selectedDate === getTodayStr();

  // Filtrado de entradas
  const filteredEntrances = useMemo(() => {
    return entrances.filter((item) => {
      // 1. Filtro por búsqueda (nombre, dni, teléfono)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const studentName = item.alumnos?.nombre_completo?.toLowerCase() || "";
        const dni = item.alumnos?.dni?.toLowerCase() || "";
        const tel = item.alumnos?.telefono?.toLowerCase() || "";
        const claseName = item.clases_cuadrante?.nombre_clase?.toLowerCase() || "";
        const matches = studentName.includes(q) || dni.includes(q) || tel.includes(q) || claseName.includes(q);
        if (!matches) return false;
      }

      // 2. Filtro por Sede
      if (filterSede !== "todas") {
        const sedeAlumno = (item.alumnos?.sede || "").toLowerCase();
        const sedeClase = (item.clases_cuadrante?.sede || "").toLowerCase();
        if (filterSede === "tejar") {
          const isTejar = sedeClase.includes("tejar") || sedeClase.includes("studio") || sedeAlumno.includes("tejar") || sedeAlumno.includes("studio");
          if (!isTejar) return false;
        } else if (filterSede === "castilla") {
          const isCastilla = sedeClase.includes("castilla") || sedeClase.includes("alcorcon") || sedeAlumno.includes("castilla") || sedeAlumno.includes("alcorcon");
          if (!isCastilla) return false;
        }
      }

      // 3. Filtro por Tipo de Plan
      if (filterTipoPlan !== "todos") {
        const plan = (item.alumnos?.plan_activo || "").toLowerCase();
        if (filterTipoPlan === "bono") {
          if (!plan.includes("bono")) return false;
        } else if (filterTipoPlan === "regular") {
          const isReg = plan.includes("regular") || plan.includes("mensual") || plan.includes("ilimitad");
          if (!isReg) return false;
        }
      }

      return true;
    });
  }, [entrances, searchQuery, filterSede, filterTipoPlan]);

  // Métricas del día seleccionado
  const stats = useMemo(() => {
    const total = entrances.length;
    const uniqueStudents = new Set(entrances.map((e) => e.alumno_id).filter(Boolean)).size;

    let bonosCount = 0;
    let regularesCount = 0;
    let tejarCount = 0;
    let castillaCount = 0;

    entrances.forEach((item) => {
      const plan = (item.alumnos?.plan_activo || "").toLowerCase();
      if (plan.includes("bono")) {
        bonosCount++;
      } else if (plan.includes("regular") || plan.includes("mensual") || plan.includes("ilimitad")) {
        regularesCount++;
      }

      const sedeClase = (item.clases_cuadrante?.sede || "").toLowerCase();
      const sedeAlumno = (item.alumnos?.sede || "").toLowerCase();
      if (sedeClase.includes("castilla") || (!sedeClase && (sedeAlumno.includes("castilla") || sedeAlumno.includes("alcorcon")))) {
        castillaCount++;
      } else {
        tejarCount++;
      }
    });

    return {
      total,
      uniqueStudents,
      bonosCount,
      regularesCount,
      tejarCount,
      castillaCount
    };
  }, [entrances]);

  // Exportar histórico del día a CSV con BOM UTF-8
  const handleExportCSV = () => {
    if (filteredEntrances.length === 0) {
      alert("No hay registros para exportar con los filtros seleccionados.");
      return;
    }

    const headers = [
      "Fecha",
      "Hora",
      "Alumno",
      "DNI",
      "Teléfono",
      "Email",
      "Plan Activo",
      "Clases Restantes",
      "Clase Asignada",
      "Profesor",
      "Sede"
    ];

    const rows = filteredEntrances.map((item) => {
      const dateObj = new Date(item.fecha_hora);
      const fecha = dateObj.toLocaleDateString("es-ES");
      const hora = dateObj.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const alumno = item.alumnos?.nombre_completo || "Alumno Sin Nombre";
      const dni = item.alumnos?.dni || "N/A";
      const tel = item.alumnos?.telefono || "N/A";
      const email = item.alumnos?.email || "N/A";
      const plan = item.alumnos?.plan_activo || "Sin Plan";
      const saldo = item.alumnos?.clases_restantes !== null && item.alumnos?.clases_restantes !== undefined
        ? item.alumnos.clases_restantes
        : "N/A";
      const clase = item.clases_cuadrante?.nombre_clase || "Acceso General / Recepción";
      const profesor = item.clases_cuadrante?.profesor || "-";
      
      const sedeClase = (item.clases_cuadrante?.sede || "").toLowerCase();
      const sedeAlumno = (item.alumnos?.sede || "").toLowerCase();
      const sede = sedeClase.includes("castilla") || (!sedeClase && sedeAlumno.includes("castilla"))
        ? "Studio 2 (Paseo Castilla)"
        : "Studio 1 (Plaza El Tejar)";

      return [
        `"${fecha}"`,
        `"${hora}"`,
        `"${alumno.replace(/"/g, '""')}"`,
        `"${dni}"`,
        `"${tel}"`,
        `"${email}"`,
        `"${plan.replace(/"/g, '""')}"`,
        `"${saldo}"`,
        `"${clase.replace(/"/g, '""')}"`,
        `"${profesor.replace(/"/g, '""')}"`,
        `"${sede}"`
      ].join(",");
    });

    // UTF-8 BOM para Excel
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `entradas_dance_factory_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* ========================================================================= */}
        {/* CABECERA PRINCIPAL */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-6 border-b border-[var(--color-border)] bg-[var(--color-bg)]/60 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-[var(--color-primary)]/30 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
              <Clock size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Control de Accesos Diario
                </span>
                {isTodaySelected && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    En Directo (Hoy)
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-0.5 tracking-tight font-[family-name:var(--font-heading)]">
                Histórico de Entradas
              </h2>
            </div>
          </div>

          {/* Acciones Rápidas Superior */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => loadEntrancesForDate(selectedDate)}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-[var(--color-bg)] hover:bg-white/10 text-slate-300 hover:text-white border border-[var(--color-border)] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Refrescar entradas"
            >
              <RefreshCw size={15} className={isLoading ? "animate-spin text-emerald-400" : ""} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={filteredEntrances.length === 0}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-lg shadow-emerald-600/20 active:scale-95"
              title="Exportar a CSV para Excel"
            >
              <Download size={15} />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-[var(--color-bg)] text-slate-400 hover:text-white border border-[var(--color-border)] hover:bg-white/10 transition-colors cursor-pointer ml-1"
              title="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BARRA DE NAVEGACIÓN Y SELECTOR DE FECHAS */}
        {/* ========================================================================= */}
        <div className="p-4 sm:px-6 bg-[var(--color-bg-card)] border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrevDay}
              className="p-2 rounded-xl bg-[var(--color-bg)] hover:bg-white/10 text-slate-300 hover:text-white border border-[var(--color-border)] transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="Día anterior"
            >
              <ChevronLeft size={16} />
              <span className="hidden md:inline">Anterior</span>
            </button>

            {/* Input de Fecha Nativo */}
            <div className="relative flex items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              />
            </div>

            <button
              onClick={handleNextDay}
              className="p-2 rounded-xl bg-[var(--color-bg)] hover:bg-white/10 text-slate-300 hover:text-white border border-[var(--color-border)] transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="Día siguiente"
            >
              <span className="hidden md:inline">Siguiente</span>
              <ChevronRight size={16} />
            </button>

            {!isTodaySelected && (
              <button
                onClick={handleGoToday}
                className="px-3 py-2 rounded-xl bg-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/25 text-[var(--color-secondary)] border border-[var(--color-secondary)]/30 text-xs font-bold transition-all cursor-pointer"
              >
                Volver a Hoy
              </button>
            )}
          </div>

          {/* Título de la fecha activa */}
          <div className="text-right ml-auto">
            <span className="text-xs sm:text-sm font-extrabold text-white block">
              {formattedDateTitle}
            </span>
            <span className="text-[11px] text-[var(--color-text-secondary)] block">
              {stats.total} {stats.total === 1 ? "registro de acceso" : "registros de acceso"} en esta fecha
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TARJETAS DE KPIS Y RESUMEN DEL DÍA */}
        {/* ========================================================================= */}
        <div className="px-4 sm:px-6 pt-4 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 shrink-0 bg-[var(--color-bg)]/40">
          {/* KPI 1: Total Entradas */}
          <div className="p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/20">
              <Clock size={18} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Total Entradas
              </span>
              <strong className="text-base sm:text-lg font-mono font-black text-white block leading-tight">
                {stats.total}
              </strong>
            </div>
          </div>

          {/* KPI 2: Alumnos Únicos */}
          <div className="p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-500/20">
              <Users size={18} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Alumnos Únicos
              </span>
              <strong className="text-base sm:text-lg font-mono font-black text-white block leading-tight">
                {stats.uniqueStudents}
              </strong>
            </div>
          </div>

          {/* KPI 3: Desglose Bonos vs Cuota */}
          <div className="p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-sm shrink-0 border border-purple-500/20">
              <Ticket size={18} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Bonos / Regulares
              </span>
              <div className="flex items-center gap-1.5 leading-tight mt-0.5">
                <span className="text-xs font-mono font-bold text-purple-300">
                  {stats.bonosCount} bonos
                </span>
                <span className="text-[10px] text-slate-500">•</span>
                <span className="text-xs font-mono font-bold text-blue-300">
                  {stats.regularesCount} reg.
                </span>
              </div>
            </div>
          </div>

          {/* KPI 4: Distribución Sedes */}
          <div className="p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0 border border-amber-500/20">
              <Building2 size={18} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Por Sedes
              </span>
              <div className="flex items-center gap-1.5 leading-tight mt-0.5">
                <span className="text-xs font-mono font-bold text-emerald-400" title="Studio 1 Plaza El Tejar">
                  S1: {stats.tejarCount}
                </span>
                <span className="text-[10px] text-slate-500">•</span>
                <span className="text-xs font-mono font-bold text-amber-400" title="Studio 2 Paseo Castilla">
                  S2: {stats.castillaCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BARRA DE FILTROS & BUSCADOR */}
        {/* ========================================================================= */}
        <div className="px-4 sm:px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-card)] flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
          {/* Buscador de texto */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por alumno, DNI o clase..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Selectores de Filtro */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-x-auto">
            {/* Filtro Sede */}
            <div className="flex items-center gap-1 bg-[var(--color-bg)] p-1 rounded-xl border border-[var(--color-border)] shrink-0">
              <button
                onClick={() => setFilterSede("todas")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterSede === "todas"
                    ? "bg-slate-700 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Todas las Sedes
              </button>
              <button
                onClick={() => setFilterSede("tejar")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterSede === "tejar"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Studio 1 (Tejar)
              </button>
              <button
                onClick={() => setFilterSede("castilla")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterSede === "castilla"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Studio 2 (Castilla)
              </button>
            </div>

            {/* Filtro Tipo Plan */}
            <div className="flex items-center gap-1 bg-[var(--color-bg)] p-1 rounded-xl border border-[var(--color-border)] shrink-0">
              <button
                onClick={() => setFilterTipoPlan("todos")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterTipoPlan === "todos"
                    ? "bg-slate-700 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterTipoPlan("regular")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterTipoPlan === "regular"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Regulares
              </button>
              <button
                onClick={() => setFilterTipoPlan("bono")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterTipoPlan === "bono"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Bonos
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* LISTADO / TABLA DE ENTRADAS */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-xs text-slate-400">Consultando asistencias en Supabase...</p>
            </div>
          ) : errorMsg ? (
            <div className="py-12 text-center text-rose-400 text-xs bg-rose-500/10 rounded-2xl border border-rose-500/20 p-6">
              <p className="font-bold">{errorMsg}</p>
              <button
                onClick={() => loadEntrancesForDate(selectedDate)}
                className="mt-3 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : filteredEntrances.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 bg-[var(--color-bg)]/40 rounded-2xl border border-dashed border-[var(--color-border)] p-6">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                <Clock size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  No hay entradas registradas para esta fecha
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  {searchQuery || filterSede !== "todas" || filterTipoPlan !== "todos"
                    ? "No se han encontrado resultados con los filtros actuales."
                    : `No consta ningún acceso en el sistema el día ${formattedDateTitle}.`}
                </p>
              </div>
              {!isTodaySelected && (
                <button
                  onClick={handleGoToday}
                  className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  Consultar accesos de Hoy
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-[var(--color-border)]">
                <span className="col-span-2">Hora y Validación</span>
                <span className="col-span-4">Alumno / Datos</span>
                <span className="col-span-3">Plan Activo / Saldo</span>
                <span className="col-span-3 text-right">Clase / Sede</span>
              </div>

              {filteredEntrances.map((item) => {
                const dateObj = new Date(item.fecha_hora);
                const horaExacta = dateObj.toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                });

                const plan = item.alumnos?.plan_activo || "Sin Plan";
                const planLower = plan.toLowerCase();
                const isRegular = planLower.includes("regular") || planLower.includes("mensual") || planLower.includes("ilimitad");
                const isBono = planLower.includes("bono");

                const claseName = item.clases_cuadrante?.nombre_clase || "Acceso General a Instalaciones";
                const profesorName = item.clases_cuadrante?.profesor;

                const sedeClase = (item.clases_cuadrante?.sede || "").toLowerCase();
                const sedeAlumno = (item.alumnos?.sede || "").toLowerCase();
                const isCastilla = sedeClase.includes("castilla") || (!sedeClase && sedeAlumno.includes("castilla"));

                return (
                  <div
                    key={item.id}
                    className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-emerald-500/40 transition-all flex flex-col md:grid md:grid-cols-12 gap-3 items-start md:items-center text-xs group"
                  >
                    {/* Hora & Check */}
                    <div className="col-span-2 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/25">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <span className="font-mono text-xs font-bold text-emerald-300 block">
                          {horaExacta}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          QR / Escáner
                        </span>
                      </div>
                    </div>

                    {/* Alumno */}
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-[var(--color-primary)] flex items-center justify-center text-white font-black text-xs shrink-0 shadow-md">
                        {(item.alumnos?.nombre_completo || "A")
                          .split(" ")
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <strong className="text-white font-bold text-xs sm:text-sm block truncate group-hover:text-emerald-300 transition-colors">
                          {item.alumnos?.nombre_completo || "Alumno Sin Identificar"}
                        </strong>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>DNI: {item.alumnos?.dni || "N/A"}</span>
                          {item.alumnos?.telefono && (
                            <>
                              <span>•</span>
                              <span>{item.alumnos.telefono}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Plan Activo */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isRegular
                              ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                              : isBono
                              ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                              : "bg-slate-700/40 text-slate-300 border-slate-600/40"
                          }`}
                        >
                          {plan}
                        </span>
                        {isBono && item.alumnos?.clases_restantes !== null && item.alumnos?.clases_restantes !== undefined && (
                          <span className="font-mono text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-semibold">
                            {item.alumnos.clases_restantes} rest.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Clase & Sede */}
                    <div className="col-span-3 md:text-right w-full md:w-auto">
                      <div className="flex md:justify-end items-center gap-1.5 mb-0.5">
                        <span className="font-bold text-white text-xs truncate">
                          {claseName}
                        </span>
                      </div>
                      <div className="flex md:justify-end items-center gap-2 text-[10px] text-slate-400">
                        {profesorName && <span>Prof: {profesorName} •</span>}
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono text-[9px] ${
                            isCastilla
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                              : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                          }`}
                        >
                          {isCastilla ? "Studio 2" : "Studio 1"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* FOOTER DEL MODAL */}
        {/* ========================================================================= */}
        <div className="p-4 sm:px-6 border-t border-[var(--color-border)] bg-[var(--color-bg)]/80 shrink-0 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-white">{filteredEntrances.length}</span>
            <span>de</span>
            <span className="font-mono font-bold text-white">{entrances.length}</span>
            <span>entradas mostradas</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
