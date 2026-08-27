"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSede } from "@/context/SedeContext";
import { Users, Search, Trash2, Edit3, Sparkles, Clock, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import AppModal, { ModalState } from "@/components/AppModal";
import { logActivity } from "@/lib/activityLogger";

interface ClaseCuadrante {
  id: string;
  sede: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  nombre_clase: string;
  profesor: string;
  aforo_maximo: number;
  creado_en?: string;
}

interface RosterStudent {
  id: string;
  nombre_completo: string;
  telefono?: string;
  email?: string;
  dni?: string;
  plan_activo?: string;
  clases_restantes?: number | null;
  estado?: string;
  sede?: string;
}

// Helper function para determinar si una sede pertenece a Studio 1 (Tejar / Móstoles)
const isStudio1 = (sede?: string): boolean => {
  const s = (sede || "").toLowerCase().trim();
  return s === "tejar" || s === "mostoles" || s === "studio" || s === "studio 1";
};

// Helper function para formatear el nombre oficial del Studio
const getStudioDisplayName = (sede?: string): string => {
  return isStudio1(sede) ? "Studio 1 (Plaza El Tejar)" : "Studio 2 (Paseo Castilla)";
};

// Helper function para ordenar los días de la semana
const getDayOrder = (day: string) => {
  const days: Record<string, number> = {
    "LUNES": 1,
    "MARTES": 2,
    "MIÉRCOLES": 3,
    "JUEVES": 4,
    "VIERNES": 5,
    "SÁBADO": 6,
    "DOMINGO": 7
  };
  return days[(day || "").toUpperCase()] || 8;
};

// Validador y detector de conflictos de horarios, aulas y profesores
function checkScheduleConflict(
  newClass: { dia_semana: string; hora_inicio: string; hora_fin: string; sede: string; profesor: string; id?: string | null },
  existingClasses: ClaseCuadrante[]
): { hasConflict: boolean; reason?: string } {
  // 1. Validar que hora_fin sea estrictamente posterior a hora_inicio
  if (!newClass.hora_inicio || !newClass.hora_fin) {
    return { hasConflict: true, reason: "Debes especificar las horas de inicio y fin de la clase." };
  }
  if (newClass.hora_inicio >= newClass.hora_fin) {
    return { hasConflict: true, reason: "La hora de fin debe ser estrictamente posterior a la hora de inicio de la clase." };
  }

  const startA = newClass.hora_inicio;
  const endA = newClass.hora_fin;
  const isNewStudio1 = isStudio1(newClass.sede);
  const newProf = (newClass.profesor || "").trim().toLowerCase();

  // 2. Comprobar solapamiento con clases existentes del mismo día
  for (const c of existingClasses) {
    if (newClass.id && c.id === newClass.id) continue;
    if ((c.dia_semana || "").toUpperCase() !== (newClass.dia_semana || "").toUpperCase()) continue;

    const startB = c.hora_inicio;
    const endB = c.hora_fin;

    // Condición de solapamiento horario: startA < endB && endA > startB
    const overlaps = (startA < endB) && (endA > startB);

    if (overlaps) {
      const isExistingStudio1 = isStudio1(c.sede);

      // Conflicto de Sala / Studio físico
      if (isNewStudio1 === isExistingStudio1) {
        const studioName = isNewStudio1 ? "Studio 1 (Plaza El Tejar)" : "Studio 2 (Paseo Castilla)";
        return {
          hasConflict: true,
          reason: `Conflicto de Sala: Ya existe la clase "${c.nombre_clase}" en ${studioName} el ${c.dia_semana} en horario solapado (${c.hora_inicio} - ${c.hora_fin}).`
        };
      }

      // Conflicto de Profesor (un profesor no puede impartir 2 clases simultáneamente)
      const existingProf = (c.profesor || "").trim().toLowerCase();
      if (newProf && existingProf && newProf === existingProf) {
        return {
          hasConflict: true,
          reason: `Conflicto de Profesor: El docente ${c.profesor} ya tiene asignada la clase "${c.nombre_clase}" el ${c.dia_semana} (${c.hora_inicio} - ${c.hora_fin}) en ${getStudioDisplayName(c.sede)}.`
        };
      }
    }
  }

  return { hasConflict: false };
}

export default function ClasesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clases, setClases] = useState<ClaseCuadrante[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter for profesor, class name, or studio
  const [profesorFilter, setProfesorFilter] = useState("");
  const [studioFilter, setStudioFilter] = useState<"all" | "studio1" | "studio2">("all");

  // Roster modal states
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [rosterClass, setRosterClass] = useState<ClaseCuadrante | null>(null);
  const [rosterStudents, setRosterStudents] = useState<RosterStudent[]>([]);
  const [rosterSearch, setRosterSearch] = useState("");
  const [isRosterLoading, setIsRosterLoading] = useState(false);
  
  // Class enrollment counts map: { [clase_id]: count }
  const [classEnrollmentCounts, setClassEnrollmentCounts] = useState<Record<string, number>>({});
  
  // Modal State for Dialogs / Alerts / Confirmations
  const [modal, setModal] = useState<ModalState>({ isOpen: false, message: "" });

  const { activeSede } = useSede();

  const initialFormState = {
    sede: "tejar",
    dia_semana: "LUNES",
    hora_inicio: "",
    hora_fin: "",
    nombre_clase: "",
    profesor: "",
    aforo_maximo: 15
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchClasesAndEnrollments = async () => {
    setIsLoading(true);
    
    // 1. Fetch Classes
    let query = supabase.from("clases_cuadrante").select("*");
    
    if (activeSede !== "consolidado") {
      if (activeSede === "tejar") {
        query = query.in("sede", ["tejar", "studio", "mostoles"]);
      } else {
        query = query.in("sede", ["castilla", "alcorcon"]);
      }
    }
    
    const { data: clasesData, error } = await query;
      
    if (error) {
      console.error("Error fetching clases:", error);
      setModal({
        isOpen: true,
        title: "Error al cargar cuadrante",
        message: "No se pudieron obtener las clases de la base de datos.",
        type: "warning"
      });
    } else {
      const sortedData = (clasesData || []).sort((a: ClaseCuadrante, b: ClaseCuadrante) => {
        if (getDayOrder(a.dia_semana) !== getDayOrder(b.dia_semana)) {
          return getDayOrder(a.dia_semana) - getDayOrder(b.dia_semana);
        }
        return a.hora_inicio.localeCompare(b.hora_inicio);
      });
      setClases(sortedData);
    }

    // 2. Fetch Enrollment Counts per class
    const { data: enrollments } = await supabase
      .from("alumnos_clases")
      .select("clase_id");

    if (enrollments) {
      const counts: Record<string, number> = {};
      enrollments.forEach((item: { clase_id: string }) => {
        counts[item.clase_id] = (counts[item.clase_id] || 0) + 1;
      });
      setClassEnrollmentCounts(counts);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchClasesAndEnrollments();
  }, [activeSede]);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      ...initialFormState,
      sede: activeSede !== "consolidado" ? (isStudio1(activeSede) ? "tejar" : "castilla") : "tejar",
      aforo_maximo: 15
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (clase: ClaseCuadrante) => {
    setIsEditing(true);
    setEditingId(clase.id);
    setFormData({
      sede: isStudio1(clase.sede) ? "tejar" : "castilla",
      dia_semana: clase.dia_semana,
      hora_inicio: clase.hora_inicio,
      hora_fin: clase.hora_fin,
      nombre_clase: clase.nombre_clase,
      profesor: clase.profesor,
      aforo_maximo: clase.aforo_maximo || 15
    });
    setIsModalOpen(true);
  };

  const handleDeleteClase = (id: string, nombreClase: string) => {
    setModal({
      isOpen: true,
      title: "Eliminar Clase",
      message: `¿Estás seguro de que deseas eliminar permanentemente la clase "${nombreClase}" del cuadrante?\nSe desvincularán todos los alumnos matriculados.`,
      type: "warning",
      showCancel: true,
      confirmText: "Sí, Eliminar",
      onConfirm: async () => {
        await supabase.from("alumnos_clases").delete().eq("clase_id", id);
        const { error } = await supabase.from("clases_cuadrante").delete().eq("id", id);
        
        if (error) {
          console.error("Error al eliminar clase:", error);
          setModal({
            isOpen: true,
            title: "Error al Eliminar",
            message: "Hubo un fallo en la base de datos al intentar eliminar la clase.",
            type: "warning",
            confirmText: "Entendido"
          });
        } else {
          logActivity({
            origen: "recepcion",
            tipo_evento: "edicion_alumno",
            descripcion: `Clase eliminada del cuadrante: ${nombreClase}`,
            usuario_afectado: "Administración",
            sede: "Ambas Sedes"
          });
          fetchClasesAndEnrollments();
          setModal({
            isOpen: true,
            title: "Clase Eliminada",
            message: `La clase "${nombreClase}" ha sido eliminada con éxito.`,
            type: "success",
            confirmText: "Cerrar"
          });
        }
      }
    });
  };

  const handleSaveClase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Validar conflictos de horario, sala y docente
    const conflictResult = checkScheduleConflict(
      {
        ...formData,
        id: isEditing ? editingId : null
      },
      clases
    );

    if (conflictResult.hasConflict) {
      setModal({
        isOpen: true,
        title: "Conflicto de Horario / Sala",
        message: conflictResult.reason || "Conflicto detectado en la programación horaria.",
        type: "warning",
        confirmText: "Revisar Horario"
      });
      return;
    }

    // 2. Validar reducción de aforo por debajo del número de inscritos actuales
    if (isEditing && editingId) {
      const currentEnrolled = classEnrollmentCounts[editingId] || 0;
      if (formData.aforo_maximo < currentEnrolled) {
        setModal({
          isOpen: true,
          title: "Advertencia de Aforo",
          message: `El aforo establecido (${formData.aforo_maximo} plazas) es menor que el número de alumnos inscritos actualmente (${currentEnrolled} alumnos).\nPor favor, da de baja alumnos antes de reducir el aforo.`,
          type: "warning",
          confirmText: "Comprendido"
        });
        return;
      }
    }

    const payload = { ...formData };

    let error;
    if (isEditing && editingId) {
      const { error: updateError } = await supabase.from("clases_cuadrante").update(payload).eq("id", editingId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("clases_cuadrante").insert([payload]);
      error = insertError;
    }

    if (error) {
      console.error("Error saving clase:", error);
      setModal({
        isOpen: true,
        title: "Error al Guardar",
        message: "Hubo un error al guardar la clase en la base de datos.",
        type: "warning",
        confirmText: "Aceptar"
      });
    } else {
      logActivity({
        origen: "recepcion",
        tipo_evento: "edicion_alumno",
        descripcion: isEditing
          ? `Clase actualizada: ${payload.nombre_clase} (${payload.dia_semana} ${payload.hora_inicio}-${payload.hora_fin})`
          : `Nueva clase creada: ${payload.nombre_clase} (${payload.dia_semana} ${payload.hora_inicio}-${payload.hora_fin}) con ${payload.profesor}`,
        usuario_afectado: payload.profesor,
        sede: getStudioDisplayName(payload.sede)
      });

      setIsModalOpen(false);
      fetchClasesAndEnrollments();
      setModal({
        isOpen: true,
        title: "Guardado Exitoso",
        message: isEditing
          ? `La clase "${payload.nombre_clase}" se ha modificado correctamente.`
          : `La clase "${payload.nombre_clase}" se ha añadido al cuadrante.`,
        type: "success",
        confirmText: "Aceptar"
      });
    }
  };

  // Fetch enrolled students for specific class
  const fetchRoster = async (clase: ClaseCuadrante) => {
    setIsRosterLoading(true);

    const { data: enrolledData, error } = await supabase
      .from("alumnos_clases")
      .select(`
        alumno_id,
        alumnos (
          id,
          nombre_completo,
          telefono,
          email,
          dni,
          plan_activo,
          clases_restantes,
          estado,
          sede
        )
      `)
      .eq("clase_id", clase.id);

    if (error) {
      console.error("Error fetching roster:", error);
      setModal({
        isOpen: true,
        title: "Error al Cargar Lista",
        message: "No se pudieron obtener los alumnos inscritos en esta clase.",
        type: "warning",
        confirmText: "Aceptar"
      });
      setIsRosterLoading(false);
      return;
    }

    const students = (enrolledData || [])
      .map((d: any) => d.alumnos)
      .filter((a: any) => a != null) as RosterStudent[];
    students.sort((a, b) => (a.nombre_completo || "").localeCompare(b.nombre_completo || "", "es"));
    setRosterStudents(students);
    setIsRosterLoading(false);
  };

  const handleViewRoster = async (clase: ClaseCuadrante) => {
    setRosterClass(clase);
    setRosterSearch("");
    setIsRosterOpen(true);
    fetchRoster(clase);
  };

  // Remove student from class
  const handleRemoveStudentFromClass = (studentId: string, studentName: string) => {
    if (!rosterClass) return;

    setModal({
      isOpen: true,
      title: "Desmatricular Alumno",
      message: `¿Dar de baja a ${studentName} de la clase "${rosterClass.nombre_clase}"?`,
      type: "warning",
      showCancel: true,
      confirmText: "Dar de Baja",
      onConfirm: async () => {
        const { error } = await supabase
          .from("alumnos_clases")
          .delete()
          .eq("clase_id", rosterClass.id)
          .eq("alumno_id", studentId);

        if (error) {
          setModal({
            isOpen: true,
            title: "Error",
            message: "Error al desasignar el alumno de la clase.",
            type: "warning",
            confirmText: "Entendido"
          });
        } else {
          logActivity({
            origen: "recepcion",
            tipo_evento: "modificacion_perfil",
            descripcion: `Recepción desasignó a ${studentName} de la clase ${rosterClass.nombre_clase}`,
            usuario_afectado: studentName,
            sede: getStudioDisplayName(rosterClass.sede)
          });

          fetchRoster(rosterClass);
          fetchClasesAndEnrollments();
          setModal({
            isOpen: true,
            title: "Alumno Desmatriculado",
            message: `${studentName} ha sido dado de baja de la clase.`,
            type: "success",
            confirmText: "Aceptar"
          });
        }
      }
    });
  };

  // Filter the classes based on profesorFilter and studioFilter
  const filteredClases = clases.filter(c => {
    const matchesSearch = 
      (c.profesor || "").toLowerCase().includes(profesorFilter.toLowerCase()) ||
      (c.nombre_clase || "").toLowerCase().includes(profesorFilter.toLowerCase()) ||
      (c.dia_semana || "").toLowerCase().includes(profesorFilter.toLowerCase());

    const studio1 = isStudio1(c.sede);
    const matchesStudio = 
      studioFilter === "all" ||
      (studioFilter === "studio1" && studio1) ||
      (studioFilter === "studio2" && !studio1);

    return matchesSearch && matchesStudio;
  });

  const filteredRosterStudents = rosterStudents.filter(s =>
    (s.nombre_completo || "").toLowerCase().includes(rosterSearch.toLowerCase()) ||
    (s.telefono || "").toLowerCase().includes(rosterSearch.toLowerCase()) ||
    (s.email || "").toLowerCase().includes(rosterSearch.toLowerCase()) ||
    (s.dni || "").toLowerCase().includes(rosterSearch.toLowerCase())
  );

  return (
    <div>
      {/* Top Header & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-[family-name:var(--font-heading)] text-[var(--color-text-title)] tracking-wide whitespace-nowrap">
            {activeSede === "consolidado" ? "CUADRANTE GLOBAL" : `DANCE FACTORY (${activeSede.toUpperCase()})`}
          </h2>
          <span className="text-[11px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2.5 py-0.5 rounded-full border border-[var(--color-primary)]/20">
            {clases.length} Clases Activas
          </span>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          {/* Studio Quick Filter */}
          <div className="flex items-center gap-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] p-1 rounded-xl">
            <button
              onClick={() => setStudioFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                studioFilter === "all"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-white"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setStudioFilter("studio1")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                studioFilter === "studio1"
                  ? "bg-[var(--color-secondary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-white"
              }`}
            >
              Studio 1 (Tejar)
            </button>
            <button
              onClick={() => setStudioFilter("studio2")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                studioFilter === "studio2"
                  ? "bg-[var(--color-accent)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-white"
              }`}
            >
              Studio 2 (Castilla)
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <input 
              type="text" 
              value={profesorFilter}
              onChange={(e) => setProfesorFilter(e.target.value)}
              placeholder="Buscar clase, día o profesor..." 
              className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-body)] text-xs rounded-xl pl-8 pr-4 py-2 outline-none focus:border-[var(--color-primary)] transition-colors shadow-sm"
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--color-text-secondary)]" />
          </div>

          <button 
            onClick={handleOpenCreate}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-[var(--color-primary)]/20 whitespace-nowrap cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Nueva Clase
          </button>
        </div>
      </div>

      {/* Clases Table */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg-hover)] border-b border-[var(--color-border)]">
                <th className="py-3 px-4 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Día</th>
                <th className="py-3 px-4 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Horario</th>
                <th className="py-3 px-4 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Clase</th>
                <th className="py-3 px-4 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Profesor</th>
                <th className="py-3 px-4 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider text-center">Alumnos Matriculados</th>
                <th className="py-3 px-4 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider text-center">Aforo</th>
                <th className="py-3 px-4 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-xs text-[var(--color-text-secondary)]">
                    Cargando clases...
                  </td>
                </tr>
              ) : filteredClases.length > 0 ? (
                filteredClases.map((item, idx) => {
                  const enrolledCount = classEnrollmentCounts[item.id] || 0;
                  const isFull = enrolledCount >= (item.aforo_maximo || 15);
                  const studio1 = isStudio1(item.sede);

                  return (
                    <tr key={item.id || idx} className="hover:bg-[var(--color-bg-hover)] transition-colors">
                      <td className="py-3 px-4 font-bold text-[var(--color-primary)] text-xs">{item.dia_semana}</td>
                      <td className="py-3 px-4 font-mono text-xs text-[var(--color-text-secondary)]">{item.hora_inicio} - {item.hora_fin}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{item.nombre_clase}</span>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            studio1 
                              ? 'bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border border-[var(--color-secondary)]/20' 
                              : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20'
                          }`}>
                            {studio1 ? 'Studio 1' : 'Studio 2'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--color-text-body)]">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            {item.profesor.split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                          </div>
                          <span className="truncate text-slate-300 font-medium">{item.profesor}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 ${
                          isFull
                            ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/30"
                            : enrolledCount > 0 
                            ? "bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/30" 
                            : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
                        }`}>
                          <Users size={12} />
                          <span>{enrolledCount} / {item.aforo_maximo || 15} plazas</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-title)] font-mono">
                          {item.aforo_maximo || 15}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          {/* BOTÓN VER ALUMNOS INSCRITOS */}
                          <button 
                            onClick={() => handleViewRoster(item)}
                            className="flex items-center gap-1 text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-all text-xs font-bold bg-[var(--color-primary)]/10 px-2.5 py-1 rounded-lg border border-[var(--color-primary)]/30 shadow-sm cursor-pointer"
                            title="Ver listado de alumnos inscritos en esta clase"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Ver Alumnos</span>
                          </button>

                          <button 
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                            title="Editar clase"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button 
                            onClick={() => handleDeleteClase(item.id, item.nombre_clase)}
                            className="p-1 text-[var(--color-danger)] hover:opacity-80 transition-colors cursor-pointer"
                            title="Eliminar clase"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-xs text-[var(--color-text-secondary)]">
                    No hay clases que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Alumnos Matriculados en la Clase */}
      {isRosterOpen && rosterClass && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
             
             {/* Header Modal */}
             <div className="flex justify-between items-center p-5 sm:p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-card)] shrink-0">
               <div>
                 <div className="flex items-center gap-3 flex-wrap">
                   <h3 className="text-xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)] tracking-wide">
                     Alumnos Matriculados
                   </h3>
                   <span className="text-xs font-bold bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-3 py-1 rounded-full border border-[var(--color-primary)]/20">
                     {rosterStudents.length} / {rosterClass.aforo_maximo || 15} Plazas
                   </span>
                 </div>
                 <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                   {rosterClass.nombre_clase} • Profesor/a: <strong className="text-white">{rosterClass.profesor}</strong> • {rosterClass.dia_semana} {rosterClass.hora_inicio} - {rosterClass.hora_fin}h • {getStudioDisplayName(rosterClass.sede)}
                 </p>
               </div>
               
               <button 
                 onClick={() => setIsRosterOpen(false)} 
                 className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
             </div>

             {/* Buscador dentro del modal */}
             {rosterStudents.length > 0 && (
               <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
                 <div className="relative">
                   <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--color-text-secondary)]" />
                   <input
                     type="text"
                     placeholder="Filtrar alumno por nombre, teléfono o email..."
                     value={rosterSearch}
                     onChange={(e) => setRosterSearch(e.target.value)}
                     className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-title)] text-xs rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-[var(--color-primary)]"
                   />
                 </div>
               </div>
             )}
             
             {/* Listado de alumnos */}
             <div className="p-0 overflow-y-auto flex-1">
               {isRosterLoading ? (
                 <div className="p-8 text-center text-xs text-[var(--color-text-secondary)]">Cargando lista de alumnos...</div>
               ) : rosterStudents.length === 0 ? (
                 <div className="p-12 text-center text-xs text-[var(--color-text-secondary)] space-y-2">
                   <Users className="w-8 h-8 text-[var(--color-text-secondary)]/50 mx-auto" />
                   <p>No hay alumnos matriculados en esta clase actualmente.</p>
                 </div>
               ) : (
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="bg-[var(--color-bg-hover)] border-y border-[var(--color-border)]">
                       <th className="py-3 px-6 text-xs font-semibold text-[var(--color-text-secondary)] uppercase">Alumno</th>
                       <th className="py-3 px-6 text-xs font-semibold text-[var(--color-text-secondary)] uppercase">Contacto</th>
                       <th className="py-3 px-6 text-xs font-semibold text-[var(--color-text-secondary)] uppercase">Plan / Saldo</th>
                       <th className="py-3 px-6 text-xs font-semibold text-[var(--color-text-secondary)] uppercase text-right">Acciones</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[var(--color-border)]">
                     {filteredRosterStudents.map(student => (
                       <tr key={student.id} className="hover:bg-[var(--color-bg-hover)] transition-colors">
                         <td className="py-3.5 px-6">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                               {student.nombre_completo.split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                             </div>
                             <div>
                               <span className="font-semibold text-[var(--color-text-title)] text-sm block">{student.nombre_completo}</span>
                               <span className="text-[10px] text-[var(--color-text-secondary)] uppercase">{student.dni || 'Sin DNI'}</span>
                             </div>
                           </div>
                         </td>
                         <td className="py-3.5 px-6 text-xs text-[var(--color-text-secondary)] font-mono">
                           <div>{student.telefono}</div>
                           <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{student.email}</div>
                         </td>
                         <td className="py-3.5 px-6 text-xs">
                           <span className="font-semibold text-[var(--color-text-title)] block">
                             {student.plan_activo || 'Clases Regulares'}
                           </span>
                           <span className="text-[10px] text-[var(--color-text-secondary)]">
                             {student.plan_activo === 'Clases Regulares' || student.clases_restantes === null ? 'Mensualidad Activa' : `${student.clases_restantes} clases restantes`}
                           </span>
                         </td>
                         <td className="py-3.5 px-6 text-right">
                           <button
                             onClick={() => handleRemoveStudentFromClass(student.id, student.nombre_completo)}
                             className="text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 px-2.5 py-1.5 rounded-lg border border-[var(--color-danger)]/20 transition-all font-semibold inline-flex items-center gap-1 cursor-pointer"
                             title="Desmatricular alumno de esta clase"
                           >
                             <Trash2 size={13} />
                             <span>Dar de baja</span>
                           </button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               )}
             </div>
             
             <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-hover)] flex justify-between items-center shrink-0">
               <span className="text-xs text-[var(--color-text-secondary)]">
                 Total Matriculados: <strong className="text-white font-mono">{rosterStudents.length} alumnos</strong>
               </span>
               <button 
                 onClick={() => setIsRosterOpen(false)}
                 className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-5 py-2 rounded-xl text-xs font-semibold transition-colors shadow-md cursor-pointer"
               >
                 Cerrar Listado
               </button>
             </div>
           </div>
         </div>
      )}

      {/* Modal Añadir / Editar Clase */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
              <h3 className="text-xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)]">
                {isEditing ? "Editar Clase" : "Añadir Nueva Clase"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--color-text-secondary)] hover:text-white cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSaveClase} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Sede / Studio *</label>
                  <select 
                    value={formData.sede}
                    onChange={(e) => setFormData({...formData, sede: e.target.value})}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-xl px-3 py-2 outline-none focus:border-[var(--color-primary)] cursor-pointer"
                  >
                    <option value="tejar">Studio 1 Plaza El Tejar</option>
                    <option value="castilla">Studio 2 Paseo Castilla</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Día de la semana *</label>
                  <select 
                    value={formData.dia_semana}
                    onChange={(e) => setFormData({...formData, dia_semana: e.target.value})}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-xl px-3 py-2 outline-none focus:border-[var(--color-primary)] cursor-pointer"
                  >
                    <option value="LUNES">LUNES</option>
                    <option value="MARTES">MARTES</option>
                    <option value="MIÉRCOLES">MIÉRCOLES</option>
                    <option value="JUEVES">JUEVES</option>
                    <option value="VIERNES">VIERNES</option>
                    <option value="SÁBADO">SÁBADO</option>
                    <option value="DOMINGO">DOMINGO</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="w-1/2">
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Inicio *</label>
                  <input 
                    type="time" 
                    value={formData.hora_inicio}
                    onChange={(e) => setFormData({...formData, hora_inicio: e.target.value})}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-xl px-3 py-2 outline-none focus:border-[var(--color-primary)]" 
                    required 
                  />
                </div>
                <div className="w-1/2">
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Fin *</label>
                  <input 
                    type="time" 
                    value={formData.hora_fin}
                    onChange={(e) => setFormData({...formData, hora_fin: e.target.value})}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-xl px-3 py-2 outline-none focus:border-[var(--color-primary)]" 
                    required 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Nombre de la Clase *</label>
                <input 
                  type="text" 
                  value={formData.nombre_clase}
                  onChange={(e) => setFormData({...formData, nombre_clase: e.target.value})}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-xl px-3 py-2 outline-none focus:border-[var(--color-primary)]" 
                  placeholder="Ej. URBAN DANCE INICIACIÓN" 
                  required 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Profesor / Docente *</label>
                  <input 
                    type="text" 
                    value={formData.profesor}
                    onChange={(e) => setFormData({...formData, profesor: e.target.value})}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-xl px-3 py-2 outline-none focus:border-[var(--color-primary)]" 
                    placeholder="Nombre del Profesor" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Aforo Máximo (Plazas) *</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="50" 
                    value={formData.aforo_maximo}
                    onChange={(e) => setFormData({...formData, aforo_maximo: parseInt(e.target.value, 10) || 15})}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-xl px-3 py-2 outline-none focus:border-[var(--color-primary)] font-mono font-bold" 
                    required 
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-border)]">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-[var(--color-primary)]/20 cursor-pointer"
                >
                  {isEditing ? "Guardar Cambios" : "Añadir Clase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AppModal Component for confirmation and alerts */}
      <AppModal modal={modal} onClose={() => setModal(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
}
