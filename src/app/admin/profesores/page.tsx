"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useSede } from "@/context/SedeContext";
import { supabase } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activityLogger";
import AppModal, { ModalState } from "@/components/AppModal";
import { getAllTeachersInSchedule } from "@/lib/classScheduleUtils";
import {
  TeacherRecord,
  getInitialTeacherRecords,
  fetchAllTeachersFromSupabase,
  saveTeacherToSupabase,
  toggleTeacherAccessInSupabase,
  getNextSuggestedTeacherPin,
  normalizeTeacherName,
} from "@/lib/teacherRegistryService";
import {
  TeacherDocCategory,
  TeacherDocumentMeta,
  TeacherDocCountSummary,
  TEACHER_DOC_CATEGORIES,
  getCurrentYearMonthISO,
  getSuggestedDocTitle,
  formatPeriodoMesSpanish,
  formatFileSize,
  getCategoryLabel,
  fetchTeacherDocuments,
  fetchAllTeacherDocumentCounts,
  uploadTeacherDocument,
  openOrDownloadTeacherDocument,
  deleteTeacherDocument,
} from "@/lib/teacherDocumentsService";
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
  Check,
  FolderOpen,
  FileText,
  Upload,
  Download,
  Trash2,
  Loader2,
  X,
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
  const [docCountsByUuid, setDocCountsByUuid] = useState<Record<string, TeacherDocCountSummary>>({});
  const [docCountsByPin, setDocCountsByPin] = useState<Record<string, TeacherDocCountSummary>>({});
  const [totalDocsCount, setTotalDocsCount] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"activos" | "inactivos" | "todos">("activos");
  const [showAllPins, setShowAllPins] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Native <dialog> Modal State (Create / Edit / Gestión Documental)
  const profileDialogRef = useRef<HTMLDialogElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [profileTab, setProfileTab] = useState<"ficha" | "documentos">("ficha");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherRecord | null>(null);
  const [dialogFeedback, setDialogFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    pin: "",
    especialidad: "",
    email: "",
    telefono: "",
    sede: "castilla",
    active: true,
  });

  // Document Management State inside Teacher Profile
  const [teacherDocs, setTeacherDocs] = useState<TeacherDocumentMeta[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState<boolean>(false);
  const [docFilterCat, setDocFilterCat] = useState<"todos" | "nomina" | "contrato" | "otros">("todos");
  const [docCategoria, setDocCategoria] = useState<TeacherDocCategory>("nomina");
  const [docPeriodoMes, setDocPeriodoMes] = useState<string>(() => getCurrentYearMonthISO());
  const [docTitulo, setDocTitulo] = useState<string>(() =>
    getSuggestedDocTitle("nomina", getCurrentYearMonthISO())
  );
  const [docTitleManuallyEdited, setDocTitleManuallyEdited] = useState<boolean>(false);
  const [docNotas, setDocNotas] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [busyDocActionId, setBusyDocActionId] = useState<string | null>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>({ isOpen: false, message: "" });

  const refreshDocCounts = useCallback(async () => {
    const counts = await fetchAllTeacherDocumentCounts();
    setDocCountsByUuid(counts.byUuid);
    setDocCountsByPin(counts.byPin);
    setTotalDocsCount(counts.totalDocs);
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [loadedTeachers, clasesRes, counts] = await Promise.all([
        fetchAllTeachersFromSupabase(),
        supabase
          .from("clases_cuadrante")
          .select("id, nombre_clase, dia_semana, hora_inicio, hora_fin, profesor, sede"),
        fetchAllTeacherDocumentCounts(),
      ]);
      setTeachers(loadedTeachers);
      if (!clasesRes.error && clasesRes.data) {
        setClases(clasesRes.data as ClaseSimple[]);
      }
      setDocCountsByUuid(counts.byUuid);
      setDocCountsByPin(counts.byPin);
      setTotalDocsCount(counts.totalDocs);
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

  // Manage native <dialog> showModal() / close() lifecycle + light-dismiss fallback
  useEffect(() => {
    const dialog = profileDialogRef.current;
    if (!dialog) return;

    if (isFormOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isFormOpen]);

  useEffect(() => {
    const dialog = profileDialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      dialog.returnValue = "";
      setIsFormOpen(false);
      setConfirmDeleteDocId(null);
      setDialogFeedback(null);
    };

    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
    };

    dialog.addEventListener("close", handleNativeClose);
    dialog.addEventListener("pointerdown", onPointerDown);
    dialog.addEventListener("pointerup", onPointerUp);
    return () => {
      dialog.removeEventListener("close", handleNativeClose);
      dialog.removeEventListener("pointerdown", onPointerDown);
      dialog.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const loadTeacherDocs = useCallback(async (teacher: TeacherRecord) => {
    setIsDocsLoading(true);
    try {
      const list = await fetchTeacherDocuments({
        uuid: teacher.uuid,
        pin: teacher.pin,
        name: teacher.name,
      });
      setTeacherDocs(list);
    } finally {
      setIsDocsLoading(false);
    }
  }, []);

  const getDocSummaryForTeacher = useCallback(
    (teacher: TeacherRecord): TeacherDocCountSummary => {
      return (
        docCountsByUuid[teacher.uuid] ||
        docCountsByPin[teacher.pin] || { total: 0, nominas: 0 }
      );
    },
    [docCountsByUuid, docCountsByPin]
  );

  // Exclude master admin accounts from regular faculty count
  const facultyTeachers = useMemo(() => {
    return teachers.filter((t) => !t.isAdmin);
  }, [teachers]);

  const getAssignedClassesForTeacher = useCallback(
    (teacherName: string): ClaseSimple[] => {
      const normT = normalizeTeacherName(teacherName);
      if (!normT) return [];
      return clases.filter((c) => {
        return getAllTeachersInSchedule(c).some((tName) => {
          const normP = normalizeTeacherName(tName);
          return Boolean(normP && (normP === normT || normP.includes(normT) || normT.includes(normP)));
        });
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

  const resetDocUploadForm = useCallback(() => {
    const defMes = getCurrentYearMonthISO();
    setDocCategoria("nomina");
    setDocPeriodoMes(defMes);
    setDocTitulo(getSuggestedDocTitle("nomina", defMes));
    setDocTitleManuallyEdited(false);
    setDocNotas("");
    setSelectedFile(null);
    setConfirmDeleteDocId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleOpenCreate = () => {
    const nextPin = getNextSuggestedTeacherPin(teachers);
    setEditingTeacher(null);
    setProfileTab("ficha");
    setDialogFeedback(null);
    setFormData({
      name: "",
      pin: nextPin,
      especialidad: "Comercial",
      email: "",
      telefono: "",
      sede: activeSede === "tejar" ? "tejar" : "castilla",
      active: true,
    });
    setTeacherDocs([]);
    resetDocUploadForm();
    setIsFormOpen(true);
  };

  const handleOpenTeacherProfile = (
    teacher: TeacherRecord,
    initialTab: "ficha" | "documentos" = "ficha"
  ) => {
    setEditingTeacher(teacher);
    setProfileTab(initialTab);
    setDialogFeedback(null);
    setDocFilterCat("todos");
    setFormData({
      name: teacher.displayName || teacher.name,
      pin: teacher.pin,
      especialidad: teacher.especialidad || "",
      email: teacher.email || "",
      telefono: teacher.telefono === "600000000" ? "" : teacher.telefono || "",
      sede: teacher.sede || "castilla",
      active: teacher.active,
    });
    resetDocUploadForm();
    setIsFormOpen(true);
    loadTeacherDocs(teacher);
  };

  const handleCloseDialog = () => {
    setIsFormOpen(false);
  };

  const handleSuggestFreePin = () => {
    const nextPin = getNextSuggestedTeacherPin(teachers);
    setFormData((prev) => ({ ...prev, pin: nextPin }));
  };

  const handleCategoriaChange = (nextCat: TeacherDocCategory) => {
    setDocCategoria(nextCat);
    if (!docTitleManuallyEdited) {
      setDocTitulo(getSuggestedDocTitle(nextCat, docPeriodoMes));
    }
  };

  const handlePeriodoChange = (nextMes: string) => {
    setDocPeriodoMes(nextMes);
    if (!docTitleManuallyEdited) {
      setDocTitulo(getSuggestedDocTitle(docCategoria, nextMes));
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setDialogFeedback(null);
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
        active: formData.active,
      },
      teachers
    );
    setIsSaving(false);

    if (!res.success) {
      setDialogFeedback({
        type: "error",
        text: res.error || "No se pudo guardar la ficha del profesor.",
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
      sede: formData.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla",
    });

    const wasEditing = Boolean(editingTeacher);
    setIsFormOpen(false);
    await loadData();

    setModal({
      isOpen: true,
      title: wasEditing ? "Profesor Actualizado" : "Profesor Añadido",
      message: wasEditing
        ? `Los datos y el código PIN (${formData.pin}) de ${formData.name} están actualizados tanto en el panel como en la App de Alumnos/Profesores.`
        : `${formData.name} ya tiene activo su acceso docente con el código PIN ${formData.pin}. Ya puedes asignarle clases o subir sus nóminas y documentos.`,
      type: "success",
    });
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher || isUploadingDoc) return;

    if (!selectedFile) {
      setDialogFeedback({
        type: "error",
        text: "Selecciona primero el archivo PDF o imagen que quieres asociar al profesor.",
      });
      return;
    }

    setDialogFeedback(null);
    setIsUploadingDoc(true);

    const res = await uploadTeacherDocument({
      profesorUuid: editingTeacher.uuid,
      profesorPin: editingTeacher.pin,
      profesorNombre: editingTeacher.name,
      categoria: docCategoria,
      titulo: docTitulo,
      periodoMes: docPeriodoMes || undefined,
      file: selectedFile,
      notas: docNotas,
      subidoPor: "Dirección Dance Factory",
    });

    setIsUploadingDoc(false);

    if (!res.success || !res.doc) {
      setDialogFeedback({
        type: "error",
        text: res.error || "No se pudo subir el documento.",
      });
      return;
    }

    logActivity({
      origen: "recepcion",
      tipo_evento: "modificacion_usuario",
      descripcion: `Subido documento '${res.doc.titulo}' (${res.doc.nombre_archivo}) al perfil de ${editingTeacher.displayName}`,
      usuario_afectado: editingTeacher.displayName,
      sede: "Consolidado",
    });

    resetDocUploadForm();
    await Promise.all([loadTeacherDocs(editingTeacher), refreshDocCounts()]);
    setDialogFeedback({
      type: "success",
      text: `Documento "${res.doc.titulo}" subido correctamente. Ya está disponible en el Portal del Profesor de ${editingTeacher.displayName}.`,
    });
  };

  const handleOpenOrDownloadDoc = async (doc: TeacherDocumentMeta, mode: "view" | "download") => {
    if (busyDocActionId) return;
    setBusyDocActionId(`${doc.id}_${mode}`);
    setDialogFeedback(null);
    const res = await openOrDownloadTeacherDocument(doc.id, mode);
    setBusyDocActionId(null);
    if (!res.success) {
      setDialogFeedback({
        type: "error",
        text: res.error || "No se pudo abrir el documento.",
      });
    }
  };

  const handleConfirmDeleteDoc = async (doc: TeacherDocumentMeta) => {
    if (!editingTeacher || busyDocActionId) return;
    setBusyDocActionId(`${doc.id}_delete`);
    setDialogFeedback(null);

    const res = await deleteTeacherDocument(doc.id);
    setBusyDocActionId(null);
    setConfirmDeleteDocId(null);

    if (!res.success) {
      setDialogFeedback({
        type: "error",
        text: res.error || "No se pudo eliminar el documento.",
      });
      return;
    }

    logActivity({
      origen: "recepcion",
      tipo_evento: "modificacion_usuario",
      descripcion: `Eliminado documento '${doc.titulo}' del perfil de ${editingTeacher.displayName}`,
      usuario_afectado: editingTeacher.displayName,
      sede: "Consolidado",
    });

    await Promise.all([loadTeacherDocs(editingTeacher), refreshDocCounts()]);
    setDialogFeedback({
      type: "success",
      text: `Documento "${doc.titulo}" eliminado correctamente.`,
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
          type: "warning",
        });
        return;
      }

      logActivity({
        origen: "recepcion",
        tipo_evento: "modificacion_usuario",
        descripcion: `${nextActive ? "Reactivado" : "Revocado"} acceso al portal docente de ${teacher.displayName} (PIN ${teacher.pin})`,
        usuario_afectado: teacher.displayName,
        sede: "Consolidado",
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
        type: "success",
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
        onConfirm: executeToggle,
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

  const visibleTeacherDocs = useMemo(() => {
    if (docFilterCat === "nomina") return teacherDocs.filter((d) => d.categoria === "nomina");
    if (docFilterCat === "contrato") return teacherDocs.filter((d) => d.categoria === "contrato");
    if (docFilterCat === "otros")
      return teacherDocs.filter((d) => d.categoria !== "nomina" && d.categoria !== "contrato");
    return teacherDocs;
  }, [teacherDocs, docFilterCat]);

  const getDocBadgeClasses = (cat: string) => {
    switch (cat) {
      case "nomina":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "contrato":
        return "bg-blue-500/15 text-blue-400 border-blue-500/30";
      case "dni_identidad":
        return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
      case "seguro_certificado":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      default:
        return "bg-slate-500/15 text-slate-300 border-slate-500/30";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 flex items-center justify-center text-[var(--color-primary)]">
              <GraduationCap size={20} aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] text-[var(--color-text-title)] tracking-wide">
              Profesores, Accesos y Nóminas
            </h1>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Gestiona el claustro docente, su PIN de acceso y su carpeta documental privada (nóminas mensuales, contratos y certificados).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <Link
            href="/admin/clases"
            className="px-3.5 py-2.5 rounded-xl bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-title)] transition-colors flex items-center gap-2"
          >
            <Calendar size={15} className="text-[var(--color-primary)]" aria-hidden="true" />
            <span>Ir a Clases y Horarios</span>
          </Link>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 cursor-pointer active:scale-95"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Nuevo Profesor</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Profesores Activos
            </p>
            <p className="text-2xl font-extrabold text-[var(--color-text-title)] mt-1 tabular-nums">
              {activeCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={20} aria-hidden="true" />
          </div>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Clases en Cuadrante
            </p>
            <p className="text-2xl font-extrabold text-[var(--color-text-title)] mt-1 tabular-nums">
              {clases.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 flex items-center justify-center text-[var(--color-primary)]">
            <Calendar size={20} aria-hidden="true" />
          </div>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Nóminas y Documentos
            </p>
            <p className="text-2xl font-extrabold text-[var(--color-text-title)] mt-1 tabular-nums">
              {totalDocsCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <FolderOpen size={20} aria-hidden="true" />
          </div>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Accesos Desactivados
            </p>
            <p className="text-2xl font-extrabold text-[var(--color-text-title)] mt-1 tabular-nums">
              {inactiveCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert size={20} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-[var(--color-bg)] border border-[var(--color-border)] p-1 rounded-xl">
            <button
              type="button"
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
              type="button"
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
              type="button"
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

          <search className="relative flex-1 md:w-80">
            <label htmlFor="teacher-search-input" className="sr-only">
              Buscar profesor por nombre, PIN o especialidad
            </label>
            <input
              id="teacher-search-input"
              name="q"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Buscar nombre, PIN o estilo..."
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-xs text-[var(--color-text-title)] rounded-xl pl-8 pr-3 py-2 outline-none focus:border-[var(--color-primary)]"
            />
            <Search
              className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--color-text-secondary)]"
              aria-hidden="true"
            />
          </search>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAllPins((v) => !v)}
            className="px-3 py-2 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] flex items-center gap-1.5 cursor-pointer"
          >
            {showAllPins ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
            <span>{showAllPins ? "Ocultar PINs" : "Mostrar PINs"}</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            aria-label="Sincronizar profesores con base de datos"
            className="p-2 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] cursor-pointer"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Teachers Table */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg-hover)] border-b border-[var(--color-border)]">
                <th
                  scope="col"
                  className="py-3 px-4 text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider"
                >
                  Profesor/a
                </th>
                <th
                  scope="col"
                  className="py-3 px-3 text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider"
                >
                  Sede Base
                </th>
                <th
                  scope="col"
                  className="py-3 px-3 text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider"
                >
                  Clases Asignadas
                </th>
                <th
                  scope="col"
                  className="py-3 px-3 text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider text-center"
                >
                  Documentación
                </th>
                <th
                  scope="col"
                  className="py-3 px-3 text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider text-center"
                >
                  PIN Docente
                </th>
                <th
                  scope="col"
                  className="py-3 px-3 text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider text-center"
                >
                  Estado
                </th>
                <th
                  scope="col"
                  className="py-3 px-4 text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider text-right"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-xs text-[var(--color-text-secondary)]">
                    No hay profesores que coincidan con el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((teacher) => {
                  const assignedClasses = getAssignedClassesForTeacher(teacher.name);
                  const docSummary = getDocSummaryForTeacher(teacher);
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
                        <button
                          type="button"
                          onClick={() => handleOpenTeacherProfile(teacher, "documentos")}
                          className="flex items-center gap-2.5 text-left group cursor-pointer"
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              teacher.active
                                ? "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-[var(--color-text-title)] group-hover:text-[var(--color-secondary)] transition-colors">
                              {teacher.displayName}
                            </div>
                            <div className="text-[11px] text-[var(--color-text-secondary)]">
                              {teacher.especialidad}
                            </div>
                            {teacher.email && (
                              <div className="text-[10px] text-slate-500 whitespace-nowrap">{teacher.email}</div>
                            )}
                          </div>
                        </button>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg)] px-2 py-1 rounded-lg border border-[var(--color-border)]">
                          <Building2 size={11} className="text-[var(--color-primary)] shrink-0" aria-hidden="true" />
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
                          <div className="space-y-0.5 max-w-[230px]">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-md border border-cyan-500/20">
                              {assignedClasses.length}{" "}
                              {assignedClasses.length === 1 ? "clase" : "clases"}
                            </span>
                            <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                              {assignedClasses
                                .slice(0, 2)
                                .map((c) => `${c.dia_semana.slice(0, 3)} ${c.hora_inicio} (${c.nombre_clase})`)
                                .join(" · ")}
                              {assignedClasses.length > 2 ? ` +${assignedClasses.length - 2} más` : ""}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenTeacherProfile(teacher, "documentos")}
                          aria-label={`Documentación y nóminas de ${teacher.displayName}`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                            docSummary.total > 0
                              ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
                          }`}
                        >
                          <FileText size={12} aria-hidden="true" />
                          <span>
                            {docSummary.total > 0
                              ? `${docSummary.total} ${docSummary.total === 1 ? "doc" : "docs"}`
                              : "0 docs"}
                          </span>
                        </button>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] px-2.5 py-1 rounded-xl">
                          <KeyRound size={12} className="text-[var(--color-primary)]" aria-hidden="true" />
                          <span className="font-mono font-bold text-xs tracking-widest text-[var(--color-text-title)]">
                            {showAllPins ? teacher.pin : "••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPin(teacher)}
                            aria-label={`Copiar PIN de ${teacher.displayName}`}
                            className="ml-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                          >
                            {copiedId === teacher.uuid ? (
                              <Check size={12} className="text-emerald-400" aria-hidden="true" />
                            ) : (
                              <Copy size={12} aria-hidden="true" />
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
                            type="button"
                            onClick={() => handleOpenTeacherProfile(teacher, "documentos")}
                            aria-label={`Documentos de ${teacher.displayName}`}
                            className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-[11px] font-bold text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <FolderOpen size={12} aria-hidden="true" />
                            <span>Documentos</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenTeacherProfile(teacher, "ficha")}
                            aria-label={`Editar ficha de ${teacher.displayName}`}
                            className="px-2 py-1.5 rounded-lg bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-text-title)] flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit3 size={12} aria-hidden="true" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleAccess(teacher)}
                            aria-label={
                              teacher.active
                                ? `Dar de baja acceso de ${teacher.displayName}`
                                : `Reactivar acceso de ${teacher.displayName}`
                            }
                            className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                              teacher.active
                                ? "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400"
                                : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                            }`}
                          >
                            <Power size={12} aria-hidden="true" />
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

      {/* Native <dialog> Modal: Perfil Individual del Profesor (Ficha PIN + Gestión Documental) */}
      <dialog
        ref={profileDialogRef}
        aria-labelledby="teacher-profile-dialog-title"
        className="m-auto w-[calc(100%-1.5rem)] max-w-2xl max-h-[92vh] rounded-2xl bg-[var(--color-bg-card)] text-[var(--color-text-body)] border border-[var(--color-border)] shadow-2xl p-0 backdrop:bg-black/75 backdrop:backdrop-blur-sm overflow-hidden"
      >
        {isFormOpen && (
          <div className="flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 flex items-center justify-center text-[var(--color-primary)] shrink-0">
                  <GraduationCap size={18} aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="teacher-profile-dialog-title"
                    className="text-base font-bold text-[var(--color-text-title)]"
                  >
                    {editingTeacher
                      ? `Perfil Docente: ${editingTeacher.displayName}`
                      : "Alta de Nuevo Profesor/a"}
                  </h2>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    {editingTeacher
                      ? `PIN ${editingTeacher.pin} · Sincronizado en tiempo real con el Portal del Profesor`
                      : "Sincronización instantánea con Portal Docente y App de Alumnos"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseDialog}
                aria-label="Cerrar ventana"
                className="w-8 h-8 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] flex items-center justify-center cursor-pointer shrink-0"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Profile Tabs (Only when viewing an existing teacher) */}
            {editingTeacher && (
              <div
                role="tablist"
                aria-label="Secciones del perfil del profesor"
                className="px-5 pt-3.5 pb-1 bg-[var(--color-bg-card)] flex items-center gap-2 shrink-0"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={profileTab === "ficha"}
                  onClick={() => {
                    setProfileTab("ficha");
                    setDialogFeedback(null);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-colors cursor-pointer ${
                    profileTab === "ficha"
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md shadow-[var(--color-primary)]/20"
                      : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] border-[var(--color-border)]"
                  }`}
                >
                  <KeyRound size={14} aria-hidden="true" />
                  <span>Ficha y Acceso PIN</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={profileTab === "documentos"}
                  onClick={() => {
                    setProfileTab("documentos");
                    setDialogFeedback(null);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-colors cursor-pointer ${
                    profileTab === "documentos"
                      ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20"
                      : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] border-[var(--color-border)]"
                  }`}
                >
                  <FolderOpen size={14} aria-hidden="true" />
                  <span>Gestión Documental ({teacherDocs.length})</span>
                </button>
              </div>
            )}

            {/* Scrollable Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {dialogFeedback && (
                <div
                  role={dialogFeedback.type === "error" ? "alert" : "status"}
                  className={`p-3 rounded-xl border text-xs font-medium ${
                    dialogFeedback.type === "error"
                      ? "bg-rose-500/15 border-rose-500/30 text-rose-200"
                      : "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
                  }`}
                >
                  {dialogFeedback.text}
                </div>
              )}

              {(!editingTeacher || profileTab === "ficha") && (
                <form method="post" onSubmit={handleSaveForm} className="space-y-4">
                  <div>
                    <label
                      htmlFor="teacher-form-name"
                      className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1"
                    >
                      Nombre y Apellido del Profesor/a *
                    </label>
                    <input
                      id="teacher-form-name"
                      name="name"
                      type="text"
                      required
                      autoComplete="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej. Blanca Elías"
                      className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--color-text-title)] outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="teacher-form-pin"
                          className="text-xs font-bold text-[var(--color-text-secondary)]"
                        >
                          Código PIN (4 dígitos) *
                        </label>
                        <button
                          type="button"
                          onClick={handleSuggestFreePin}
                          className="text-[11px] font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles size={11} aria-hidden="true" />
                          <span>Sugerir libre</span>
                        </button>
                      </div>
                      <input
                        id="teacher-form-pin"
                        name="pin"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        required
                        maxLength={4}
                        pattern="\d{4}"
                        value={formData.pin}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pin: e.target.value.replace(/\D/g, "").slice(0, 4),
                          })
                        }
                        placeholder="1016"
                        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold tracking-widest text-[var(--color-text-title)] outline-none focus:border-[var(--color-primary)]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="teacher-form-sede"
                        className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1"
                      >
                        Sede Principal
                      </label>
                      <select
                        id="teacher-form-sede"
                        name="sede"
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
                      <label
                        htmlFor="teacher-form-especialidad"
                        className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1"
                      >
                        Especialidad / Estilo
                      </label>
                      <input
                        id="teacher-form-especialidad"
                        name="especialidad"
                        type="text"
                        value={formData.especialidad}
                        onChange={(e) => setFormData({ ...formData, especialidad: e.target.value })}
                        placeholder="Ej. Comercial, Urbano..."
                        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--color-text-title)] outline-none focus:border-[var(--color-primary)]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="teacher-form-email"
                        className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1"
                      >
                        Correo Electrónico (opcional)
                      </label>
                      <div className="relative">
                        <input
                          id="teacher-form-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="nombre@dancefactory.es"
                          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-[var(--color-text-title)] outline-none focus:border-[var(--color-primary)]"
                        />
                        <Mail
                          size={14}
                          className="absolute left-3 top-3 text-[var(--color-text-secondary)]"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                    <div>
                      <label
                        htmlFor="teacher-form-active"
                        className="text-xs font-bold text-[var(--color-text-title)] cursor-pointer block"
                      >
                        Acceso al Portal Docente
                      </label>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        Permite iniciar sesión con su PIN y consultar clases y nóminas
                      </p>
                    </div>
                    <input
                      id="teacher-form-active"
                      name="active"
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                    />
                  </div>

                  <div className="flex justify-end items-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={handleCloseDialog}
                      className="px-4 py-2.5 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-secondary)] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold shadow-lg shadow-[var(--color-primary)]/20 cursor-pointer disabled:opacity-50"
                    >
                      {isSaving
                        ? "Guardando..."
                        : editingTeacher
                        ? "Guardar Cambios"
                        : "Crear Profesor y Activar PIN"}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: GESTIÓN DOCUMENTAL (NÓMINAS Y DOCUMENTOS DEL PROFESOR) */}
              {editingTeacher && profileTab === "documentos" && (
                <div className="space-y-5">
                  {/* Formulario de Subida de Nómina / Documento */}
                  <form
                    method="post"
                    onSubmit={handleUploadDoc}
                    aria-labelledby="upload-doc-form-heading"
                    className="p-4 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        id="upload-doc-form-heading"
                        className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5"
                      >
                        <Upload size={14} aria-hidden="true" />
                        <span>Subir Nómina o Documento a {editingTeacher.displayName}</span>
                      </h3>
                      <span className="text-[11px] text-[var(--color-text-secondary)]">
                        PDF o imagen (máx. 8 MB)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="doc-categoria"
                          className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1"
                        >
                          Tipo de Documento *
                        </label>
                        <select
                          id="doc-categoria"
                          name="categoria"
                          value={docCategoria}
                          onChange={(e) =>
                            handleCategoriaChange(e.target.value as TeacherDocCategory)
                          }
                          className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--color-text-title)] outline-none focus:border-emerald-500"
                        >
                          {TEACHER_DOC_CATEGORIES.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="doc-periodo"
                          className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1"
                        >
                          Mes / Periodo
                        </label>
                        <input
                          id="doc-periodo"
                          name="periodo_mes"
                          type="month"
                          value={docPeriodoMes}
                          onChange={(e) => handlePeriodoChange(e.target.value)}
                          className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--color-text-title)] outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="doc-titulo"
                          className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1"
                        >
                          Título visible para el profesor *
                        </label>
                        <input
                          id="doc-titulo"
                          name="titulo"
                          type="text"
                          required
                          value={docTitulo}
                          onChange={(e) => {
                            setDocTitulo(e.target.value);
                            setDocTitleManuallyEdited(true);
                          }}
                          placeholder="Ej. Nómina Noviembre 2026"
                          className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-title)] outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="doc-notas"
                          className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1"
                        >
                          Nota opcional
                        </label>
                        <input
                          id="doc-notas"
                          name="notas"
                          type="text"
                          value={docNotas}
                          onChange={(e) => setDocNotas(e.target.value)}
                          placeholder="Ej. Incluye plus sustitución"
                          className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-title)] outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="doc-archivo"
                        className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1"
                      >
                        Seleccionar archivo PDF / Imagen *
                      </label>
                      <input
                        ref={fileInputRef}
                        id="doc-archivo"
                        name="archivo"
                        type="file"
                        accept=".pdf,application/pdf,image/*,.doc,.docx"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="w-full bg-[var(--color-bg-card)] border border-dashed border-[var(--color-border)] hover:border-emerald-500/60 rounded-xl px-3 py-2 text-xs text-[var(--color-text-secondary)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                      />
                      {selectedFile && (
                        <p className="text-[11px] text-emerald-400 mt-1 font-medium">
                          Archivo listo: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={isUploadingDoc}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-colors disabled:opacity-50"
                      >
                        {isUploadingDoc ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Upload size={14} aria-hidden="true" />
                        )}
                        <span>
                          {isUploadingDoc ? "Subiendo documento..." : "Subir al Perfil del Profesor"}
                        </span>
                      </button>
                    </div>
                  </form>

                  {/* Filtros y Listado de Documentos del Profesor */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Archivo Documental de {editingTeacher.displayName}
                      </h3>

                      <div className="flex flex-wrap items-center gap-1 bg-[var(--color-bg)] border border-[var(--color-border)] p-1 rounded-xl">
                        {(
                          [
                            { id: "todos", label: `Todos (${teacherDocs.length})` },
                            {
                              id: "nomina",
                              label: `Nóminas (${
                                teacherDocs.filter((d) => d.categoria === "nomina").length
                              })`,
                            },
                            {
                              id: "contrato",
                              label: `Contratos (${
                                teacherDocs.filter((d) => d.categoria === "contrato").length
                              })`,
                            },
                            {
                              id: "otros",
                              label: `DNI / Otros (${
                                teacherDocs.filter(
                                  (d) => d.categoria !== "nomina" && d.categoria !== "contrato"
                                ).length
                              })`,
                            },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setDocFilterCat(tab.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                              docFilterCat === tab.id
                                ? "bg-[var(--color-primary)] text-white"
                                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)]"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {isDocsLoading ? (
                      <div className="py-10 text-center text-xs text-[var(--color-text-secondary)] flex flex-col items-center gap-2">
                        <Loader2
                          size={20}
                          className="animate-spin text-[var(--color-primary)]"
                          aria-hidden="true"
                        />
                        <span>Cargando documentos de {editingTeacher.displayName}...</span>
                      </div>
                    ) : visibleTeacherDocs.length === 0 ? (
                      <div className="p-8 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] text-center space-y-1.5">
                        <FileText
                          size={26}
                          className="mx-auto text-[var(--color-text-secondary)] opacity-60"
                          aria-hidden="true"
                        />
                        <p className="text-xs font-bold text-[var(--color-text-title)]">
                          Todavía no hay documentos en esta categoría
                        </p>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                          Sube arriba la nómina mensual en PDF, contrato, DNI o seguro de{" "}
                          {editingTeacher.displayName} para que pueda consultarlo desde su App.
                        </p>
                      </div>
                    ) : (
                      <ul role="list" className="space-y-2.5">
                        {visibleTeacherDocs.map((doc) => {
                          const mesLabel = formatPeriodoMesSpanish(doc.periodo_mes);
                          const fechaAltaDoc = doc.creado_en
                            ? new Date(doc.creado_en).toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                            : "";
                          const isConfirmingDelete = confirmDeleteDocId === doc.id;

                          return (
                            <li
                              key={doc.id}
                              className="p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getDocBadgeClasses(
                                      doc.categoria
                                    )}`}
                                  >
                                    {getCategoryLabel(doc.categoria)}
                                  </span>
                                  {mesLabel && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-text-body)] bg-[var(--color-bg-card)] px-2 py-0.5 rounded-md border border-[var(--color-border)]">
                                      <Calendar
                                        size={11}
                                        className="text-[var(--color-primary)]"
                                        aria-hidden="true"
                                      />
                                      {mesLabel}
                                    </span>
                                  )}
                                </div>

                                <p className="text-sm font-bold text-[var(--color-text-title)] break-words">
                                  {doc.titulo}
                                </p>
                                <p className="text-[11px] text-[var(--color-text-secondary)] break-words">
                                  {doc.nombre_archivo} · {formatFileSize(doc.tamano_bytes)}
                                  {fechaAltaDoc ? ` · Subido el ${fechaAltaDoc}` : ""}
                                </p>
                                {doc.notas && (
                                  <p className="text-[11px] text-slate-300 italic break-words">
                                    {doc.notas}
                                  </p>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                {isConfirmingDelete ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={Boolean(busyDocActionId)}
                                      onClick={() => handleConfirmDeleteDoc(doc)}
                                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                    >
                                      {busyDocActionId === `${doc.id}_delete`
                                        ? "Borrando..."
                                        : "Confirmar borrado"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteDocId(null)}
                                      className="px-2.5 py-1.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={Boolean(busyDocActionId)}
                                      onClick={() => handleOpenOrDownloadDoc(doc, "view")}
                                      aria-label={`Ver ${doc.titulo}`}
                                      className="px-2.5 py-1.5 rounded-lg bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[11px] font-bold text-[var(--color-text-title)] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    >
                                      <Eye
                                        size={12}
                                        className="text-[var(--color-secondary)]"
                                        aria-hidden="true"
                                      />
                                      <span>Ver</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={Boolean(busyDocActionId)}
                                      onClick={() => handleOpenOrDownloadDoc(doc, "download")}
                                      aria-label={`Descargar ${doc.titulo}`}
                                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    >
                                      <Download size={12} aria-hidden="true" />
                                      <span>Descargar</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={Boolean(busyDocActionId)}
                                      onClick={() => setConfirmDeleteDocId(doc.id)}
                                      aria-label={`Eliminar ${doc.titulo}`}
                                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 cursor-pointer disabled:opacity-50"
                                    >
                                      <Trash2 size={13} aria-hidden="true" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </dialog>

      <AppModal modal={modal} onClose={() => setModal({ ...modal, isOpen: false })} />
    </div>
  );
}
