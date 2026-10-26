"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSede } from "@/context/SedeContext";
import { supabase } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activityLogger";
import AppModal, { ModalState } from "@/components/AppModal";
import {
  TeacherRecord,
  getInitialTeacherRecords,
  fetchAllTeachersFromSupabase,
  saveTeacherToSupabase,
  toggleTeacherAccessInSupabase,
  getNextSuggestedTeacherPin,
  normalizeTeacherName
} from "@/lib/teacherRegistryService";
import {
  GraduationCap,
  Plus,
  Search,
  KeyRound,
  Edit3,
  Power,
  Eye,
  EyeOff,
  Calendar,
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
  Building2,
  Mail,
  Sparkles,
  Copy,
  Check
} from "lucide-react";

interface ClaseSimple {
  id: string;
  nombre_clase: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  profesor: string;
  sede: string;
}

export default function AdminProfesoresPage() {
  const { activeSede } = useSede();
  const [teachers, setTeachers] = useState<TeacherRecord[]>(() => getInitialTeacherRecords(false));
  const [clases, setClases] = useState<ClaseSimple[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"activos" | "inactivos" | "todos">("activos");
  const [showAllPins, setShowAllPins] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal Create / Edit State
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherRecord | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    pin: "",
    especialidad: "",
    email: "",
    telefono: "",
    sede: "castilla",
    active: true
  });

  const [modal, setModal] = useState<ModalState>({ isOpen: false, message: "" });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [loadedTeachers, clasesRes] = await Promise.all([
        fetchAllTeachersFromSupabase(),
        supabase.from("clases_cuadrante").select("id, nombre_clase, dia_semana, hora_inicio, hora_fin, profesor, sede")
      ]);
      setTeachers(loadedTeachers);
      if (!clasesRes.error && clasesRes.data) {
        setClases(clasesRes.data as ClaseSimple[]);
      }
    } catch (err) {
      console.error("Error loading teachers:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const onUpdated = () => loadData();
    window.addEventListener("df_teachers_updated", onUpdated);
    return () => window.removeEventListener("df_teachers_updated", onUpdated);
  }, [loadData]);

  // Exclude master admin accounts from regular faculty count unless viewing "todos"
  const facultyTeachers = useMemo(() => {
    return teachers.filter((t) => !t.isAdmin);
  }, [teachers]);

  const getAssignedClassesForTeacher = useCallback(
    (teacherName: string): ClaseSimple[] => {
      const normT = normalizeTeacherName(teacherName);
      if (!normT) return [];
      return clases.filter((c) => {
        const normP = normalizeTeacherName(c.profesor);
        return normP && (normP === normT || normP.includes(normT) || normT.includes(normP));
      });
    },
    [clases]
  );

  const filteredTeachers = useMemo(() => {
    return facultyTeachers.filter((t) => {
      if (statusFilter === "activos" && !t.active) return false;
      if (statusFilter === "inactivos" && t.active) return false;

      if (activeSede !== "consolidado") {
        const assignedInSede = getAssignedClassesForTeacher(t.name).some((c) =>
          activeSede === "tejar"
            ? ["tejar", "studio", "mostoles"].includes((c.sede || "").toLowerCase())
            : ["castilla", "alcorcon"].includes((c.sede || "").toLowerCase())
        );
        if (t.sede !== "consolidado" && t.sede !== activeSede && !assignedInSede) {
          return false;
        }
      }

      if (searchTerm.trim()) {
        const q = normalizeTeacherName(searchTerm);
        const matchName = normalizeTeacherName(t.name).includes(q);
        const matchSpec = normalizeTeacherName(t.especialidad).includes(q);
        const matchPin = t.pin.includes(searchTerm.trim());
        const matchEmail = t.email.toLowerCase().includes(searchTerm.trim().toLowerCase());
        if (!matchName && !matchSpec && !matchPin && !matchEmail) return false;
      }

      return true;
    });
  }, [facultyTeachers, statusFilter, activeSede, searchTerm, getAssignedClassesForTeacher]);

  const activeCount = useMemo(() => facultyTeachers.filter((t) => t.active).length, [facultyTeachers]);
  const inactiveCount = useMemo(() => facultyTeachers.filter((t) => !t.active).length, [facultyTeachers]);

  const handleOpenCreate = () => {
    const nextPin = getNextSuggestedTeacherPin(teachers);
    setEditingTeacher(null);
    setFormData({
      name: "",
      pin: nextPin,
      especialidad: "Comercial",
      email: "",
      telefono: "",
      sede: activeSede === "tejar" ? "tejar" : "castilla",
      active: true
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (teacher: TeacherRecord) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.displayName || teacher.name,
      pin: teacher.pin,
      especialidad: teacher.especialidad || "",
      email: teacher.email || "",
      telefono: teacher.telefono === "600000000" ? "" : teacher.telefono || "",
      sede: teacher.sede || "castilla",
      active: teacher.active
    });
    setIsFormOpen(true);
  };

  const handleSuggestFreePin = () => {
    const nextPin = getNextSuggestedTeacherPin(teachers);
    setFormData((prev) => ({ ...prev, pin: nextPin }));
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    const res = await saveTeacherToSupabase(
      {
        uuid: editingTeacher?.uuid,
        name: formData.name,
        pin: formData.pin,
        especialidad: formData.especialidad,
        email: formData.email,
        telefono: formData.telefono,
        sede: formData.sede,
        active: formData.active
      },
      teachers
    );
    setIsSaving(false);

    if (!res.success) {
      setModal({
        isOpen: true,
        title: "Revisa los datos",
        message: res.error || "No se pudo guardar la ficha del profesor.",
        type: "warning"
      });
      return;
    }

    logActivity({
      origen: "recepcion",
      tipo_evento: editingTeacher ? "modificacion_usuario" : "creacion_usuario",
      descripcion: editingTeacher
        ? `Actualizado profesor/a ${formData.name.toUpperCase()} (PIN: ${formData.pin})`
        : `Alta de nuevo profesor/a ${formData.name.toUpperCase()} (PIN: ${formData.pin})`,
      usuario_afectado: formData.name.toUpperCase(),
      sede: formData.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
    });

    setIsFormOpen(false);
    await loadData();

    setModal({
      isOpen: true,
      title: editingTeacher ? "Profesor Actualizado" : "Profesor Añadido",
      message: editingTeacher
        ? `Los datos y el código PIN (${formData.pin}) de ${formData.name} están actualizados tanto en el panel como en la App de Alumnos/Profesores.`
        : `${formData.name} ya tiene activo su acceso docente con el código PIN ${formData.pin}. Ahora puedes asignarle sus clases en la sección Clases.`,
      type: "success"
    });
  };

  const handleToggleAccess = (teacher: TeacherRecord) => {
    const nextActive = !teacher.active;
    const assigned = getAssignedClassesForTeacher(teacher.name);

    const executeToggle = async () => {
      const res = await toggleTeacherAccessInSupabase(teacher, nextActive);
      if (!res.success) {
        setModal({
          isOpen: true,
          title: "Error al actualizar acceso",
          message: res.error || "No se pudo cambiar el estado del profesor.",
          type: "warning"
        });
        return;
      }

      logActivity({
        origen: "recepcion",
        tipo_evento: "modificacion_usuario",
        descripcion: `${nextActive ? "Reactivado" : "Revocado"} acceso al portal docente de ${teacher.displayName} (PIN ${teacher.pin})`,
        usuario_afectado: teacher.displayName,
        sede: "Consolidado"
      });

      await loadData();
      setModal({
        isOpen: true,
        title: nextActive ? "Acceso Reactivado" : "Acceso Desactivado",
        message: nextActive
          ? `${teacher.displayName} vuelve a tener activo su acceso con el PIN ${teacher.pin}.`
          : `${teacher.displayName} ya no puede iniciar sesión en el portal de profesores ni aparece en el claustro activo.${
              assigned.length > 0
                ? `\n\nRecuerda reasignar sus ${assigned.length} clase(s) desde la sección Clases si otro profesor las asume.`
                : ""
            }`,
        type: "success"
      });
    };

    if (!nextActive) {
      setModal({
        isOpen: true,
        title: `¿Desactivar acceso de ${teacher.displayName}?`,
        message: `Al desactivar a ${teacher.displayName}, su PIN (${teacher.pin}) quedará bloqueado inmediatamente en la App y en el Portal Docente.${
          assigned.length > 0
            ? `\n\nActualmente figura como profesor/a en ${assigned.length} clase(s) del cuadrante.`
            : ""
        }`,
        type: "warning",
        showCancel: true,
        confirmText: "Sí, Desactivar Acceso",
        onConfirm: executeToggle
      });
    } else {
      executeToggle();
    }
  };

  const handleCopyPin = (teacher: TeacherRecord) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(
        `Hola ${teacher.displayName}, tu código PIN de acceso al Portal de Profesores de Dance Factory es: ${teacher.pin}\nAcceso Web/App: https://app.dancefactoryalcorcon.es/login (pestaña Soy Profesor)`
      );
      setCopiedId(teacher.uuid);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 flex items-center justify-center text-[var(--color-primary)]">
              <GraduationCap size={20} />
            </div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] text-[var(--color-text-title)] tracking-wide">
              Profesores y Accesos (PIN)
            </h1>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Añade nuevos profesores, consulta o cambia su PIN de 4 dígitos y activa o desactiva su acceso a la App en tiempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <Link
            href="/admin/clases"
            className="px-3.5 py-2.5 rounded-xl bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-title)] transition-colors flex items-center gap-2"
          >
            <Calendar size={15} className="text-[var(--color-primary)]" />
            <span>Ir a Clases y Horarios</span>
          </Link>

          <button
            onClick={handleOpenCreate}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            <span>Nuevo Profesor</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Profesores con Acceso Activo
            </p>
            <p className="text-2xl font-extrabold text-[var(--color-text-title)] mt-1">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Clases en Cuadrante
            </p>
            <p className="text-2xl font-extrabold text-[var(--color-text-title)] mt-1">{clases.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 flex items-center justify-center text-[var(--color-primary)]">
            <Calendar size={20} />
          </div>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Accesos Desactivados / Bajas
            </p>
            <p className="text-2xl font-extrabold text-[var(--color-text-title)] mt-1">{inactiveCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert size={20} />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-[var(--color-bg)] border border-[var(--color-border)] p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter("activos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === "activos"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)]"
              }`}
            >
              Activos ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter("inactivos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === "inactivos"
                  ? "bg-rose-600 text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)]"
              }`}
            >
              Desactivados ({inactiveCount})
            </button>
            <button
              onClick={() => setStatusFilter("todos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === "todos"
                  ? "bg-slate-700 text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)]"
              }`}
            >
              Todos ({facultyTeachers.length})
            </button>
          </div>

          <div className="relative flex-1 md:w-72">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, PIN o especialidad..."
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-xs text-[var(--color-text-title)] rounded-xl pl-8 pr-3 py-2 outline-none focus:border-[var(--color-primary)]"
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--color-text-secondary)]" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAllPins((v) => !v)}
            className="px-3 py-2 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] flex items-center gap-1.5 cursor-pointer"
          >
            {showAllPins ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showAllPins ? "Ocultar PINs" : "Mostrar PINs"}</span>
          </button>

          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] cursor-pointer"
            title="Sincronizar con base de datos"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Teachers Table */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg-hover)] border-b border-[var(--color-border)]">
                <th className="py-3 px-4 text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Profesor/a
                </th>
                <th className="py-3 px-3 text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Sede Base
                </th>
                <th className="py-3 px-3 text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Clases Asignadas
                </th>
                <th className="py-3 px-3 text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider text-center">
                  PIN Docente
                </th>
                <th className="py-3 px-3 text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider text-center">
                  Estado
                </th>
                <th className="py-3 px-4 text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-xs text-[var(--color-text-secondary)]">
                    No hay profesores que coincidan con el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((teacher) => {
                  const assignedClasses = getAssignedClassesForTeacher(teacher.name);
                  const initials = teacher.displayName
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase();

                  return (
                    <tr
                      key={teacher.uuid}
                      className={`hover:bg-[var(--color-bg-hover)]/60 transition-colors ${
                        !teacher.active ? "opacity-70" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              teacher.active
                                ? "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-[var(--color-text-title)] truncate max-w-[180px]">
                              {teacher.displayName}
                            </div>
                            <div className="text-[11px] text-[var(--color-text-secondary)] truncate max-w-[180px]">
                              {teacher.especialidad}
                            </div>
                            {teacher.email && (
                              <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                                {teacher.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg)] px-2 py-1 rounded-lg border border-[var(--color-border)]">
                          <Building2 size={11} className="text-[var(--color-primary)] shrink-0" />
                          {teacher.sede === "tejar"
                            ? "S1 · Tejar"
                            : teacher.sede === "castilla"
                            ? "S2 · Castilla"
                            : "Ambas Sedes"}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {assignedClasses.length === 0 ? (
                          <span className="text-[11px] text-slate-500 italic">Sin clases</span>
                        ) : (
                          <div className="space-y-0.5 max-w-[190px]">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-md border border-cyan-500/20">
                              {assignedClasses.length} {assignedClasses.length === 1 ? "clase" : "clases"}
                            </span>
                            <div className="text-[11px] text-[var(--color-text-secondary)] truncate" title={assignedClasses.map((c) => `${c.dia_semana} ${c.hora_inicio} (${c.nombre_clase})`).join(" · ")}>
                              {assignedClasses
                                .map((c) => `${c.dia_semana.slice(0, 3)} ${c.hora_inicio} (${c.nombre_clase})`)
                                .join(" · ")}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] px-2.5 py-1 rounded-xl">
                          <KeyRound size={12} className="text-[var(--color-primary)]" />
                          <span className="font-mono font-bold text-xs tracking-widest text-[var(--color-text-title)]">
                            {showAllPins ? teacher.pin : "••••"}
                          </span>
                          <button
                            onClick={() => handleCopyPin(teacher)}
                            className="ml-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                            title="Copiar mensaje con PIN para enviar al profesor"
                          >
                            {copiedId === teacher.uuid ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {teacher.active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            Sin Acceso
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(teacher)}
                            className="px-2 py-1.5 rounded-lg bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-text-title)] flex items-center gap-1 transition-colors cursor-pointer"
                            title="Editar nombre, PIN o datos"
                          >
                            <Edit3 size={12} />
                            <span>Editar</span>
                          </button>

                          <button
                            onClick={() => handleToggleAccess(teacher)}
                            className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                              teacher.active
                                ? "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400"
                                : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                            }`}
                            title={
                              teacher.active
                                ? "Revocar acceso a la App y Portal Docente"
                                : "Reactivar acceso con su PIN"
                            }
                          >
                            <Power size={12} />
                            <span>{teacher.active ? "Baja" : "Reactivar"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 flex items-center justify-center text-[var(--color-primary)]">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text-title)]">
                    {editingTeacher ? `Editar Profesor: ${editingTeacher.displayName}` : "Alta de Nuevo Profesor/a"}
                  </h2>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    Sincronización instantánea con Portal Docente y App de Alumnos
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">
                  Nombre y Apellido del Profesor/a *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Blanca Elías"
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--color-text-title)] outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)]">
                      Código PIN (4 dígitos) *
                    </label>
                    <button
                      type="button"
                      onClick={handleSuggestFreePin}
                      className="text-[11px] font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={11} />
                      Sugerir libre
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    pattern="\d{4}"
                    value={formData.pin}
                    onChange={(e) =>
                      setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })
                    }
                    placeholder="1016"
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold tracking-widest text-[var(--color-text-title)] outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">
                    Sede Principal
                  </label>
                  <select
                    value={formData.sede}
                    onChange={(e) => setFormData({ ...formData, sede: e.target.value })}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--color-text-title)] outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="castilla">Studio 2 (Paseo Castilla)</option>
                    <option value="tejar">Studio 1 (Plaza El Tejar)</option>
                    <option value="consolidado">Ambas Sedes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">
                    Especialidad / Estilo
                  </label>
                  <input
                    type="text"
                    value={formData.especialidad}
                    onChange={(e) => setFormData({ ...formData, especialidad: e.target.value })}
                    placeholder="Ej. Comercial, Urbano..."
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--color-text-title)] outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1">
                    Correo Electrónico (opcional)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="nombre@dancefactory.es"
                      className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-[var(--color-text-title)] outline-none focus:border-[var(--color-primary)]"
                    />
                    <Mail size={14} className="absolute left-3 top-3 text-[var(--color-text-secondary)]" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                <div>
                  <div className="text-xs font-bold text-[var(--color-text-title)]">
                    Acceso al Portal Docente
                  </div>
                  <div className="text-[11px] text-[var(--color-text-secondary)]">
                    Permite iniciar sesión con su PIN y aparecer en el Claustro Docente
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                />
              </div>

              <div className="flex justify-end items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-secondary)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold shadow-lg shadow-[var(--color-primary)]/20 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? "Guardando..." : editingTeacher ? "Guardar Cambios" : "Crear Profesor y Activar PIN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AppModal modal={modal} onClose={() => setModal({ ...modal, isOpen: false })} />
    </div>
  );
}
