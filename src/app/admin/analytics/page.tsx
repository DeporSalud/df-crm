"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSede } from "@/context/SedeContext";
import { getStudentFee } from "@/lib/studentFees";
import { getHistorialPagos, calcularArqueoPorSede } from "@/lib/pagosService";
import { TrendingUp, Users, Calendar, Award, DollarSign, Wallet } from "lucide-react";

// Sede normalization helpers
const isSedeTejar = (sede?: string): boolean => {
  const s = (sede || "").toLowerCase().trim();
  return s === "tejar" || s === "studio" || s === "mostoles" || s === "studio 1";
};

const isSedeCastilla = (sede?: string): boolean => {
  const s = (sede || "").toLowerCase().trim();
  return s === "castilla" || s === "alcorcon" || s === "studio 2";
};

export default function AnalyticsPage() {
  const { activeSede } = useSede();

  const [stats, setStats] = useState({
    totalAlumnos: 0,
    alumnosActivos: 0,
    totalCheckins: 0,
    totalClases: 0,
    totalProfesores: 0,
    ocupacionMedia: 0,
    ingresosEstimados: 0,
    alumnosTejar: 0,
    alumnosCastilla: 0,
    clasesTejar: 0,
    clasesCastilla: 0,
    totalEnrollments: 0
  });

  const [sedeComparison, setSedeComparison] = useState({
    tejar: { alumnos: 0, clases: 0, ocupacion: 0, capacidad: 0 },
    castilla: { alumnos: 0, clases: 0, ocupacion: 0, capacidad: 0 }
  });

  const [planBreakdown, setPlanBreakdown] = useState<Record<string, number>>({});
  const [topClasses, setTopClasses] = useState<any[]>([]);
  const [teacherLoad, setTeacherLoad] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [financialStats, setFinancialStats] = useState({
    totalRegularCount: 0,
    totalGrossBilling: 0,
    totalAdvanceDeducted: 0,
    totalNetToRemit: 0,
    arqueoTejar: { efectivo: 0, tpv: 0 },
    arqueoCastilla: { efectivo: 0, tpv: 0 }
  });

  const fetchAnalytics = async () => {
    setIsLoading(true);

    try {
      // 1. Fetch ALL Students to maintain comparative numbers & active filters
      const { data: allAlumnosData } = await supabase.from("alumnos").select("*");
      const allAlumnos = allAlumnosData || [];

      // 2. Fetch ALL Classes
      const { data: allClasesData } = await supabase.from("clases_cuadrante").select("*");
      const allClases = allClasesData || [];

      // 3. Fetch ALL Class Enrollments
      const { data: enrollmentsData } = await supabase.from("alumnos_clases").select("clase_id, alumno_id");
      const enrollments = enrollmentsData || [];

      // 4. Fetch Checkins
      const { data: asistenciasData } = await supabase
        .from("asistencias")
        .select("id, fecha_hora, alumno_id, clase_id")
        .order("fecha_hora", { ascending: false })
        .limit(20);

      // --- Sede Comparative Calculations (Always Global & Dynamic) ---
      const tejarAlumnosList = allAlumnos.filter(a => isSedeTejar(a.sede));
      const tejarClasesList = allClases.filter(c => isSedeTejar(c.sede));
      const tejarCapacidad = tejarClasesList.reduce((acc, c) => acc + (c.aforo_maximo || 20), 0);
      const tejarClassIds = new Set(tejarClasesList.map(c => c.id));
      const tejarEnrollmentsCount = enrollments.filter(e => tejarClassIds.has(e.clase_id)).length;
      const tejarOcupacion = tejarCapacidad > 0 
        ? Math.min(100, Math.round((tejarEnrollmentsCount / tejarCapacidad) * 100)) 
        : 0;

      const castillaAlumnosList = allAlumnos.filter(a => isSedeCastilla(a.sede));
      const castillaClasesList = allClases.filter(c => isSedeCastilla(c.sede));
      const castillaCapacidad = castillaClasesList.reduce((acc, c) => acc + (c.aforo_maximo || 20), 0);
      const castillaClassIds = new Set(castillaClasesList.map(c => c.id));
      const castillaEnrollmentsCount = enrollments.filter(e => castillaClassIds.has(e.clase_id)).length;
      const castillaOcupacion = castillaCapacidad > 0 
        ? Math.min(100, Math.round((castillaEnrollmentsCount / castillaCapacidad) * 100)) 
        : 0;

      setSedeComparison({
        tejar: { alumnos: tejarAlumnosList.length, clases: tejarClasesList.length, ocupacion: tejarOcupacion, capacidad: tejarCapacidad },
        castilla: { alumnos: castillaAlumnosList.length, clases: castillaClasesList.length, ocupacion: castillaOcupacion, capacidad: castillaCapacidad }
      });

      // --- Filtered Scope based on activeSede ---
      const alumnos = activeSede === "tejar"
        ? tejarAlumnosList
        : activeSede === "castilla"
        ? castillaAlumnosList
        : allAlumnos;

      const clases = activeSede === "tejar"
        ? tejarClasesList
        : activeSede === "castilla"
        ? castillaClasesList
        : allClases;

      // Filter enrollments strictly matching classes in scope to prevent >100% false ratio
      const classIdsInScope = new Set(clases.map(c => c.id));
      const relevantEnrollments = enrollments.filter(e => classIdsInScope.has(e.clase_id));

      const totalCapacidad = clases.reduce((acc, c) => acc + (c.aforo_maximo || 20), 0);
      const ocupacionMedia = totalCapacidad > 0 
        ? Math.min(100, Math.round((relevantEnrollments.length / totalCapacidad) * 100)) 
        : 0;

      // Metrics calculations for filtered scope
      const totalAlumnos = alumnos.length;
      const alumnosActivos = alumnos.filter(a => (a.estado || "").toLowerCase() === "activo").length;

      // Unique Teachers in scope
      const teachersSet = new Set(clases.map(c => c.profesor).filter(Boolean));
      const totalProfesores = teachersSet.size;

      // Breakdown of plans & Authentic Estimated Monthly Revenues
      const breakdown: Record<string, number> = {};
      let estIngresos = 0;

      alumnos.forEach(a => {
        const plan = a.plan_activo || "Clases Regulares";
        breakdown[plan] = (breakdown[plan] || 0) + 1;
        const feeInfo = getStudentFee(a);
        estIngresos += feeInfo.cuotaBase;
      });

      // Compute popularity of top classes in current scope
      const classCountMap: Record<string, number> = {};
      relevantEnrollments.forEach(e => {
        classCountMap[e.clase_id] = (classCountMap[e.clase_id] || 0) + 1;
      });

      const topClassesList = clases
        .map(c => ({
          ...c,
          enrolled: classCountMap[c.id] || 0,
          occupancyRatio: Math.min(100, Math.round(((classCountMap[c.id] || 0) / (c.aforo_maximo || 20)) * 100))
        }))
        .sort((a, b) => b.enrolled - a.enrolled)
        .slice(0, 6);

      // Compute Teacher load in current scope
      const teacherMap: Record<string, { name: string; classCount: number; studentTotal: number }> = {};
      clases.forEach(c => {
        const teacher = c.profesor || "Sin Asignar";
        if (!teacherMap[teacher]) {
          teacherMap[teacher] = { name: teacher, classCount: 0, studentTotal: 0 };
        }
        teacherMap[teacher].classCount += 1;
        teacherMap[teacher].studentTotal += (classCountMap[c.id] || 0);
      });

      const teacherLoadList = Object.values(teacherMap)
        .sort((a, b) => b.studentTotal - a.studentTotal)
        .slice(0, 6);

      const totalCheckins = (asistenciasData || []).length;
      const totalClases = clases.length;

      setStats({
        totalAlumnos,
        alumnosActivos,
        totalCheckins,
        totalClases,
        totalProfesores,
        ocupacionMedia,
        ingresosEstimados: estIngresos,
        alumnosTejar: tejarAlumnosList.length,
        alumnosCastilla: castillaAlumnosList.length,
        clasesTejar: tejarClasesList.length,
        clasesCastilla: castillaClasesList.length,
        totalEnrollments: relevantEnrollments.length
      });

      setPlanBreakdown(breakdown);
      setTopClasses(topClassesList);
      setTeacherLoad(teacherLoadList);

      // Financial Reconciliation (Real calculations, no masked fallbacks)
      const regularAlumnos = alumnos.filter(s => {
        const plan = (s.plan_activo || "").toLowerCase();
        return !plan.includes("sin plan") && !plan.includes("pendiente");
      });
      const totalReg = regularAlumnos.length;
      const totalGross = regularAlumnos.reduce((acc, s) => acc + getStudentFee(s).cuotaBase, 0);
      const totalAdvanceDeducted = regularAlumnos.reduce((acc, s) => acc + getStudentFee(s).adelanto, 0);
      const totalNet = regularAlumnos.reduce((acc, s) => acc + getStudentFee(s).netoSep, 0);
      
      const allPagos = getHistorialPagos();
      const arqueo = calcularArqueoPorSede(allPagos);

      setFinancialStats({
        totalRegularCount: totalReg,
        totalGrossBilling: totalGross,
        totalAdvanceDeducted: totalAdvanceDeducted,
        totalNetToRemit: totalNet,
        arqueoTejar: { efectivo: arqueo.tejar.totalEfectivo, tpv: arqueo.tejar.totalTPV },
        arqueoCastilla: { efectivo: arqueo.castilla.totalEfectivo, tpv: arqueo.castilla.totalTPV }
      });
    } catch (error) {
      console.error("Error in fetchAnalytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [activeSede]);

  const formatNumber = (num: number) => {
    return (num || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  // Dynamic monthly projections based on real baseline
  const baseAlumnos = stats.totalAlumnos || 0;
  const baseIngresos = financialStats.totalGrossBilling || 0;
  const baseOcupacion = stats.ocupacionMedia || 0;

  const monthlyProjections = [
    { mes: "Sep 2026", label: "Inicio Curso", alumnos: baseAlumnos, ingresos: baseIngresos, ocupacion: baseOcupacion, status: "actual" },
    { mes: "Oct 2026", label: "Captación Otoño", alumnos: Math.round(baseAlumnos * 1.11), ingresos: Math.round(baseIngresos * 1.11), ocupacion: baseOcupacion > 0 ? Math.min(98, baseOcupacion + 4) : 0, status: "proyeccion" },
    { mes: "Nov 2026", label: "Consolidación", alumnos: Math.round(baseAlumnos * 1.19), ingresos: Math.round(baseIngresos * 1.19), ocupacion: baseOcupacion > 0 ? Math.min(98, baseOcupacion + 7) : 0, status: "proyeccion" },
    { mes: "Dic 2026", label: "Campaña Navidad", alumnos: Math.round(baseAlumnos * 1.24), ingresos: Math.round(baseIngresos * 1.24), ocupacion: baseOcupacion > 0 ? Math.min(98, baseOcupacion + 9) : 0, status: "proyeccion" },
    { mes: "Ene 2027", label: "Campaña Año Nuevo", alumnos: Math.round(baseAlumnos * 1.35), ingresos: Math.round(baseIngresos * 1.35), ocupacion: baseOcupacion > 0 ? Math.min(98, baseOcupacion + 12) : 0, status: "proyeccion" },
    { mes: "Feb 2027", label: "Crecimiento", alumnos: Math.round(baseAlumnos * 1.42), ingresos: Math.round(baseIngresos * 1.42), ocupacion: baseOcupacion > 0 ? Math.min(98, baseOcupacion + 14) : 0, status: "proyeccion" },
    { mes: "Mar 2027", label: "Preparación Muestra", alumnos: Math.round(baseAlumnos * 1.49), ingresos: Math.round(baseIngresos * 1.49), ocupacion: baseOcupacion > 0 ? Math.min(98, baseOcupacion + 16) : 0, status: "proyeccion" },
    { mes: "Abr 2027", label: "Pico de Primavera", alumnos: Math.round(baseAlumnos * 1.53), ingresos: Math.round(baseIngresos * 1.53), ocupacion: baseOcupacion > 0 ? Math.min(98, baseOcupacion + 17) : 0, status: "proyeccion" },
    { mes: "May 2027", label: "Ensayos Generales", alumnos: Math.round(baseAlumnos * 1.56), ingresos: Math.round(baseIngresos * 1.56), ocupacion: baseOcupacion > 0 ? Math.min(98, baseOcupacion + 18) : 0, status: "proyeccion" },
    { mes: "Jun 2027", label: "Gala Final Curso", alumnos: Math.round(baseAlumnos * 1.60), ingresos: Math.round(baseIngresos * 1.60), ocupacion: baseOcupacion > 0 ? Math.min(98, baseOcupacion + 20) : 0, status: "proyeccion" }
  ];

  const t1Total = monthlyProjections.slice(0, 3).reduce((acc, m) => acc + m.ingresos, 0);
  const t2Total = monthlyProjections.slice(3, 6).reduce((acc, m) => acc + m.ingresos, 0);
  const t3Total = monthlyProjections.slice(6, 10).reduce((acc, m) => acc + m.ingresos, 0);

  // Cash in drawer filtered by activeSede
  const totalEfectivoCaja = activeSede === "tejar"
    ? financialStats.arqueoTejar.efectivo
    : activeSede === "castilla"
    ? financialStats.arqueoCastilla.efectivo
    : (financialStats.arqueoTejar.efectivo + financialStats.arqueoCastilla.efectivo);

  const totalTPVCaja = activeSede === "tejar"
    ? financialStats.arqueoTejar.tpv
    : activeSede === "castilla"
    ? financialStats.arqueoCastilla.tpv
    : (financialStats.arqueoTejar.tpv + financialStats.arqueoCastilla.tpv);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header & Sede Context Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] text-[var(--color-text-title)] tracking-wide">
            Analítica Financiera y Operativa
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Métricas de ocupación de aulas, rendimiento comparativo entre sedes y liquidación bancaria
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
            {activeSede === "tejar" ? "🏢 Sede: Studio 1 (El Tejar)" : activeSede === "castilla" ? "🏢 Sede: Studio 2 (Castilla)" : "🏢 Vista Consolidada (Ambas Sedes)"}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-[var(--color-text-secondary)] space-y-3">
          <div className="w-10 h-10 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold">Cargando métricas de analítica...</p>
        </div>
      ) : (
        <>
          {/* KPI Principal Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* KPI 1: Alumnos Totales */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-lg relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Alumnos Inscritos</p>
                  <h3 className="text-3xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)] mt-1">{stats.totalAlumnos}</h3>
                </div>
                <div className="p-2.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-xl border border-[var(--color-primary)]/20">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <span className="text-xs text-[var(--color-success)] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse"></span>
                {stats.alumnosActivos} alumnos activos
              </span>
            </div>

            {/* KPI 2: Facturación Recurrente Estimada */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-lg relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Facturación Recurrente</p>
                  <h3 className="text-3xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)] mt-1">
                    {formatNumber(stats.ingresosEstimados)} € <span className="text-xs text-[var(--color-text-secondary)] font-normal">/mes</span>
                  </h3>
                </div>
                <div className="p-2.5 bg-[var(--color-success)]/10 text-[var(--color-success)] rounded-xl border border-[var(--color-success)]/20">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <span className="text-xs text-[var(--color-success)] font-semibold">
                {stats.totalAlumnos > 0 ? `~${Math.round(stats.ingresosEstimados / stats.totalAlumnos)} €/alumno promedio` : "0 €"}
              </span>
            </div>

            {/* KPI 3: Ocupación Media */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-lg relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Ocupación Media</p>
                  <h3 className="text-3xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)] mt-1">{stats.ocupacionMedia}%</h3>
                </div>
                <div className="p-2.5 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] rounded-xl border border-[var(--color-secondary)]/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="w-full h-1.5 bg-[var(--color-bg)] rounded-full overflow-hidden mt-1">
                <div className="h-full bg-[var(--color-secondary)] rounded-full transition-all duration-500" style={{ width: `${stats.ocupacionMedia}%` }}></div>
              </div>
            </div>

            {/* KPI 4: Clases en Cuadrante */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-lg relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Clases Semanales</p>
                  <h3 className="text-3xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)] mt-1">
                    {stats.totalClases} <span className="text-xs text-[var(--color-text-secondary)] font-normal">clases</span>
                  </h3>
                </div>
                <div className="p-2.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-xl border border-[var(--color-accent)]/20">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
              <span className="text-xs text-[var(--color-text-secondary)]">{stats.totalEnrollments} plazas ocupadas</span>
            </div>

            {/* KPI 5: Profesores en Plantilla */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 shadow-lg relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Profesores</p>
                  <h3 className="text-3xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)] mt-1">
                    {stats.totalProfesores} <span className="text-xs text-[var(--color-text-secondary)] font-normal">docentes</span>
                  </h3>
                </div>
                <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                  <Award className="w-5 h-5" />
                </div>
              </div>
              <span className="text-xs text-[var(--color-text-secondary)]">
                Carga: ~{stats.totalProfesores > 0 ? (stats.totalClases / stats.totalProfesores).toFixed(1) : 0} clases/docente
              </span>
            </div>

          </div>

          {/* SECCIÓN FINANCIERA: Conciliación de Cuotas, Remesas y Caja */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-[var(--color-border)] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Auditoría Financiera
                  </span>
                  <h3 className="text-base font-bold font-[family-name:var(--font-heading)] text-[var(--color-text-title)]">
                    Liquidación de Cuotas, Remesas SEPA y Arqueos de Caja
                  </h3>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Consolidación de cobros mensuales, descuento de anticipos de matrícula y recaudación en recepción por sedes.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider block">
                  Facturación Bruta Mensual
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-mono font-bold text-[var(--color-text-title)]">
                    {financialStats.totalGrossBilling.toFixed(2)} €
                  </span>
                </div>
                <span className="text-[10px] text-[var(--color-text-secondary)] mt-1 block">
                  {financialStats.totalRegularCount} cuotas regulares activas
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[var(--color-bg)] border border-emerald-500/30">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                  Anticipos Reserva (-20€/alumno)
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-mono font-bold text-emerald-400">
                    -{financialStats.totalAdvanceDeducted.toFixed(2)} €
                  </span>
                </div>
                <span className="text-[10px] text-[var(--color-text-secondary)] mt-1 block">
                  Abonados en la reserva de plaza
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[var(--color-bg)] border border-amber-500/30">
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                  Neto a Remesar al Banco
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-mono font-bold text-amber-400">
                    {financialStats.totalNetToRemit.toFixed(2)} €
                  </span>
                </div>
                <span className="text-[10px] text-[var(--color-text-secondary)] mt-1 block">
                  Remesa bancaria neta de Septiembre
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[var(--color-bg)] border border-cyan-500/30">
                <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider block">
                  Caja Física en Sedes (Arqueo)
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-mono font-bold text-cyan-400">
                    {totalEfectivoCaja.toFixed(2)} €
                  </span>
                </div>
                <span className="text-[10px] text-[var(--color-text-secondary)] mt-1 block truncate">
                  {activeSede === "tejar" 
                    ? `Studio 1 (Tejar): ${financialStats.arqueoTejar.efectivo.toFixed(2)}€ • TPV: ${financialStats.arqueoTejar.tpv.toFixed(2)}€` 
                    : activeSede === "castilla"
                    ? `Studio 2 (Castilla): ${financialStats.arqueoCastilla.efectivo.toFixed(2)}€ • TPV: ${financialStats.arqueoCastilla.tpv.toFixed(2)}€`
                    : `S1: ${financialStats.arqueoTejar.efectivo.toFixed(2)}€ • S2: ${financialStats.arqueoCastilla.efectivo.toFixed(2)}€`}
                </span>
              </div>

            </div>
          </div>

          {/* SECCIÓN 1: Evolución y Previsión Mes a Mes de la Escuela */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                    Plan de Crecimiento
                  </span>
                  <h3 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-title)]">
                    Desarrollo y Previsión Mes a Mes (Temporada 2026 - 2027)
                  </h3>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Evolución estimada desde el inicio del curso en septiembre 2026 hasta junio 2027
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold shrink-0">
                <span className="flex items-center gap-1.5 text-[var(--color-primary)]">
                  <span className="w-3 h-3 rounded bg-[var(--color-primary)]"></span> Septiembre 2026 (Real)
                </span>
                <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                  <span className="w-3 h-3 rounded bg-[var(--color-secondary)]/40"></span> Proyección Mensual
                </span>
              </div>
            </div>

            {/* Gráfico de Barras Proyección */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 items-end h-56 pt-8 pb-2 border-b border-[var(--color-border)]">
              {monthlyProjections.map((m, idx) => {
                const maxAlumnos = Math.max(250, Math.round(baseAlumnos * 1.8));
                const heightPercent = Math.min(100, Math.round((m.alumnos / maxAlumnos) * 100));
                const isActual = m.status === "actual";

                return (
                  <div key={idx} className="flex flex-col items-center h-full justify-end group relative cursor-pointer">
                    {/* Tooltip Hover */}
                    <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-title)] text-[11px] p-2 rounded-lg shadow-xl z-20 pointer-events-none whitespace-nowrap text-center">
                      <div className="font-bold text-[var(--color-primary)]">{m.mes} ({m.label})</div>
                      <div>{m.alumnos} Alumnos • {formatNumber(m.ingresos)} € • {m.ocupacion}% ocup.</div>
                    </div>

                    {/* Valor superior */}
                    <span className={`text-[10px] font-bold mb-1 ${isActual ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"}`}>
                      {m.alumnos}
                    </span>

                    {/* Barra */}
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-500 group-hover:brightness-125 ${
                        isActual 
                          ? "bg-gradient-to-t from-[var(--color-primary)] to-[var(--color-secondary)] shadow-md shadow-[var(--color-primary)]/20" 
                          : "bg-gradient-to-t from-[var(--color-border)] to-[var(--color-secondary)]/30"
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    ></div>

                    {/* Nombre de mes */}
                    <span className={`text-[10px] font-semibold mt-2 truncate w-full text-center ${isActual ? "text-[var(--color-primary)] font-bold" : "text-[var(--color-text-secondary)]"}`}>
                      {m.mes.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Resumen Facturación Estimada por Trimestres */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider block">Trimestre 1 (Sep - Nov)</span>
                <div className="flex justify-between items-baseline mt-1">
                  <span className="text-xl font-bold text-[var(--color-text-title)] font-mono">{formatNumber(t1Total)} €</span>
                  <span className="text-xs text-[var(--color-success)] font-semibold">
                    {Math.round((monthlyProjections[0].alumnos + monthlyProjections[1].alumnos + monthlyProjections[2].alumnos) / 3)} Alumnos prom.
                  </span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider block">Trimestre 2 (Dic - Feb)</span>
                <div className="flex justify-between items-baseline mt-1">
                  <span className="text-xl font-bold text-[var(--color-text-title)] font-mono">{formatNumber(t2Total)} €</span>
                  <span className="text-xs text-[var(--color-success)] font-semibold">
                    {Math.round((monthlyProjections[3].alumnos + monthlyProjections[4].alumnos + monthlyProjections[5].alumnos) / 3)} Alumnos prom.
                  </span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider block">Trimestre 3 (Mar - Jun)</span>
                <div className="flex justify-between items-baseline mt-1">
                  <span className="text-xl font-bold text-[var(--color-text-title)] font-mono">{formatNumber(t3Total)} €</span>
                  <span className="text-xs text-[var(--color-success)] font-semibold">
                    {Math.round((monthlyProjections[6].alumnos + monthlyProjections[7].alumnos + monthlyProjections[8].alumnos + monthlyProjections[9].alumnos) / 4)} Alumnos prom.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: Rendimiento Comparativo por Sede & Desglose de Tarifas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Comparativa Dinámica por Sedes (Studio 1 vs Studio 2) */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-title)]">
                    Rendimiento Comparativo por Sede
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Distribución consolidada de alumnos y aforo por estudio</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Studio 1 */}
                <div className="p-5 rounded-xl border border-[var(--color-secondary)]/30 bg-[var(--color-secondary)]/5 relative">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--color-secondary)]/20 text-[var(--color-secondary)]">
                        Estudio 1
                      </span>
                      <h4 className="text-sm font-bold text-[var(--color-text-title)] mt-1">Plaza El Tejar</h4>
                    </div>
                    <span className="text-2xl font-bold text-[var(--color-secondary)] font-mono">
                      {sedeComparison.tejar.alumnos} <span className="text-xs font-normal text-[var(--color-text-secondary)]">alumnos</span>
                    </span>
                  </div>
                  
                  <div className="space-y-2 mt-4 text-xs">
                    <div className="flex justify-between text-[var(--color-text-secondary)]">
                      <span>Clases en cuadrante:</span>
                      <span className="font-semibold text-[var(--color-text-title)]">{sedeComparison.tejar.clases} clases</span>
                    </div>
                    <div className="flex justify-between text-[var(--color-text-secondary)]">
                      <span>Ocupación de aforo:</span>
                      <span className="font-semibold text-[var(--color-success)]">{sedeComparison.tejar.ocupacion}%</span>
                    </div>
                    <div className="flex justify-between text-[var(--color-text-secondary)]">
                      <span>Capacidad semanal:</span>
                      <span className="font-semibold text-[var(--color-text-title)]">{sedeComparison.tejar.capacidad} plazas</span>
                    </div>
                  </div>
                </div>

                {/* Studio 2 */}
                <div className="p-5 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 relative">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                        Estudio 2
                      </span>
                      <h4 className="text-sm font-bold text-[var(--color-text-title)] mt-1">Paseo Castilla</h4>
                    </div>
                    <span className="text-2xl font-bold text-[var(--color-accent)] font-mono">
                      {sedeComparison.castilla.alumnos} <span className="text-xs font-normal text-[var(--color-text-secondary)]">alumnos</span>
                    </span>
                  </div>

                  <div className="space-y-2 mt-4 text-xs">
                    <div className="flex justify-between text-[var(--color-text-secondary)]">
                      <span>Clases en cuadrante:</span>
                      <span className="font-semibold text-[var(--color-text-title)]">{sedeComparison.castilla.clases} clases</span>
                    </div>
                    <div className="flex justify-between text-[var(--color-text-secondary)]">
                      <span>Ocupación de aforo:</span>
                      <span className="font-semibold text-[var(--color-success)]">{sedeComparison.castilla.ocupacion}%</span>
                    </div>
                    <div className="flex justify-between text-[var(--color-text-secondary)]">
                      <span>Capacidad semanal:</span>
                      <span className="font-semibold text-[var(--color-text-title)]">{sedeComparison.castilla.capacidad} plazas</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Desglose de Tarifas y Tipos de Plan */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-title)] mb-1">
                Distribución por Tipo de Plan & Tarifa
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mb-6">Estabilidad financiera de ingresos recurrentes vs bonos puntuales</p>

              <div className="space-y-4">
                {Object.entries(planBreakdown).map(([plan, count]) => {
                  const percent = Math.round((count / (stats.totalAlumnos || 1)) * 100);
                  const isRegular = plan.toLowerCase().includes("regular") || plan.toLowerCase().includes("mensual");

                  return (
                    <div key={plan} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[var(--color-text-title)] flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isRegular ? "bg-[var(--color-success)]" : "bg-[var(--color-primary)]"}`}></span>
                          {plan}
                        </span>
                        <span className="text-[var(--color-text-secondary)]">{count} alumnos ({percent}%)</span>
                      </div>
                      <div className="h-2 w-full bg-[var(--color-bg)] rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${isRegular ? "bg-gradient-to-r from-[var(--color-success)] to-emerald-400" : "bg-[var(--color-primary)]"}`} 
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* SECCIÓN 3: Top Clases con Mayor Demanda & Carga Docente de Profesores */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Top Cursos con Mayor Ocupación */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-title)]">
                    Clases y Estilos con Mayor Demanda
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Ranking de los cursos más populares en el ámbito seleccionado</p>
                </div>
              </div>

              <div className="space-y-3">
                {topClasses.map((clase, idx) => {
                  const isTejar = isSedeTejar(clase.sede);

                  return (
                    <div key={clase.id || idx} className="flex justify-between items-center p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold flex items-center justify-center text-xs shrink-0 font-mono">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[var(--color-text-title)]">{clase.nombre_clase}</span>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isTejar ? 'bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border border-[var(--color-secondary)]/20' : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20'
                            }`}>
                              {isTejar ? 'Studio 1' : 'Studio 2'}
                            </span>
                          </div>
                          <span className="text-xs text-[var(--color-text-secondary)] mt-0.5 block">
                            {clase.dia_semana} {clase.hora_inicio} • Prof: {clase.profesor}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-[var(--color-primary)] block font-mono">
                          {clase.enrolled} alumnos
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--color-success)]">
                          {clase.occupancyRatio}% ocupación
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Carga Docente de Profesores */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-title)]">
                    Carga Docente por Profesor
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Distribución de clases asignadas y alumnos por docente</p>
                </div>
              </div>

              <div className="space-y-3">
                {teacherLoad.map((prof, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-purple-500 text-white font-bold flex items-center justify-center text-xs shrink-0 uppercase font-mono">
                        {prof.name.slice(0, 2)}
                      </div>
                      <div>
                        <span className="font-bold text-sm text-[var(--color-text-title)] block">{prof.name}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {prof.classCount} {prof.classCount === 1 ? 'clase a la semana' : 'clases a la semana'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-bold text-[var(--color-text-title)] block font-mono">
                        {prof.studentTotal} alumnos
                      </span>
                      <span className="text-[11px] font-semibold text-[var(--color-primary)]">
                        ~{Math.round(prof.studentTotal / (prof.classCount || 1))} por clase
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
