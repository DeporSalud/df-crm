"use client";

import { useState, useEffect } from "react";
import { useSede } from "@/context/SedeContext";
import { supabase } from "@/lib/supabase/client";
import { getLocalLogs, logActivity, ActivityLogItem } from "@/lib/activityLogger";
import { 
  Users, 
  ShieldCheck, 
  KeyRound, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  Building2, 
  Clock, 
  Filter, 
  RefreshCw, 
  UserCheck, 
  AlertTriangle,
  Lock,
  Sparkles,
  Phone,
  Mail,
  Shield,
  FileText
} from "lucide-react";
import AppModal, { ModalState } from "@/components/AppModal";

export interface StaffUser {
  id: string;
  nombre_completo: string;
  email: string;
  telefono: string;
  rol: "director" | "recepcion" | "profesor";
  permiso_sede: "consolidado" | "tejar" | "castilla";
  pin: string;
  estado: "activo" | "inactivo";
  creado_en: string;
  ultimo_acceso?: string;
  notas?: string;
}

const DEFAULT_STAFF: StaffUser[] = [
  {
    id: "staff_1",
    nombre_completo: "Enrique Zamorano",
    email: "direccion@dancefactory.es",
    telefono: "600 112 233",
    rol: "director",
    permiso_sede: "consolidado",
    pin: "9999",
    estado: "activo",
    creado_en: "2026-08-01T10:00:00.000Z",
    ultimo_acceso: "2026-08-26T17:15:00.000Z",
    notas: "Director General y Propietario Dance Factory"
  },
  {
    id: "staff_2",
    nombre_completo: "Sara Móstoles",
    email: "recepcion.tejar@dancefactory.es",
    telefono: "611 223 344",
    rol: "recepcion",
    permiso_sede: "tejar",
    pin: "1234",
    estado: "activo",
    creado_en: "2026-08-05T09:00:00.000Z",
    ultimo_acceso: "2026-08-26T16:45:00.000Z",
    notas: "Encargada Recepción y Cobros Studio 1 Plaza El Tejar"
  },
  {
    id: "staff_3",
    nombre_completo: "Marta Alcorcón",
    email: "recepcion.castilla@dancefactory.es",
    telefono: "622 334 455",
    rol: "recepcion",
    permiso_sede: "castilla",
    pin: "5678",
    estado: "activo",
    creado_en: "2026-08-05T09:00:00.000Z",
    ultimo_acceso: "2026-08-26T15:20:00.000Z",
    notas: "Encargada Recepción y Atención Studio 2 Paseo Castilla"
  },
  {
    id: "staff_4",
    nombre_completo: "Lucía Muñoz",
    email: "lucia.munoz@dancefactory.es",
    telefono: "633 445 566",
    rol: "profesor",
    permiso_sede: "castilla",
    pin: "1001",
    estado: "activo",
    creado_en: "2026-08-10T12:00:00.000Z",
    ultimo_acceso: "2026-08-26T18:00:00.000Z",
    notas: "Docente Urban Dance & Open Classes"
  },
  {
    id: "staff_5",
    nombre_completo: "Lucía Zamorano",
    email: "lucia.zamorano@dancefactory.es",
    telefono: "644 556 677",
    rol: "profesor",
    permiso_sede: "tejar",
    pin: "1002",
    estado: "activo",
    creado_en: "2026-08-10T12:00:00.000Z",
    ultimo_acceso: "2026-08-26T17:30:00.000Z",
    notas: "Docente Comercial & Baby Dance"
  },
  {
    id: "staff_6",
    nombre_completo: "Andrea Soto",
    email: "andrea.soto@dancefactory.es",
    telefono: "655 667 788",
    rol: "profesor",
    permiso_sede: "consolidado",
    pin: "1003",
    estado: "activo",
    creado_en: "2026-08-10T12:00:00.000Z",
    notas: "Docente Junior Pro & Danza Urbana"
  },
  {
    id: "staff_7",
    nombre_completo: "Carlos & Carmen",
    email: "carlos.carmen@dancefactory.es",
    telefono: "666 778 899",
    rol: "profesor",
    permiso_sede: "castilla",
    pin: "1007",
    estado: "activo",
    creado_en: "2026-08-10T12:00:00.000Z",
    notas: "Docentes Bachata Sensual & Ritmos Latinos"
  }
];

const STAFF_STORAGE_KEY = "df_staff_users";

export default function RegistroPage() {
  const { activeSede } = useSede();

  // Tab State
  const [activeTab, setActiveTab] = useState<"usuarios" | "logs">("usuarios");

  // Staff State
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>("todos");
  const [visiblePins, setVisiblePins] = useState<Record<string, boolean>>({});

  // Staff Modal Form State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffFormData, setStaffFormData] = useState({
    nombre_completo: "",
    email: "",
    telefono: "",
    rol: "recepcion" as "director" | "recepcion" | "profesor",
    permiso_sede: "consolidado" as "consolidado" | "tejar" | "castilla",
    pin: "",
    estado: "activo" as "activo" | "inactivo",
    notas: ""
  });

  // Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [filterOrigen, setFilterOrigen] = useState<string>("todos");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [logSearchTerm, setLogSearchTerm] = useState<string>("");
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(true);

  // General App Modal for Dialogs/Alerts
  const [modal, setModal] = useState<ModalState>({ isOpen: false, message: "" });

  // ----------------------------------------------------
  // STAFF MANAGEMENT LOGIC
  // ----------------------------------------------------
  const loadStaffUsers = () => {
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem(STAFF_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setStaffList(parsed);
            return;
          }
        }
        // Initialize default staff
        localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(DEFAULT_STAFF));
        setStaffList(DEFAULT_STAFF);
      }
    } catch (e) {
      console.warn("Failed to load staff users:", e);
      setStaffList(DEFAULT_STAFF);
    }
  };

  const saveStaffUsers = (newList: StaffUser[]) => {
    setStaffList(newList);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(newList));
        window.dispatchEvent(new Event("df_staff_updated"));
      }
    } catch (e) {
      console.error("Failed to save staff users:", e);
    }
  };

  useEffect(() => {
    loadStaffUsers();
  }, []);

  const togglePinVisibility = (id: string) => {
    setVisiblePins(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const generateRandomPin = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    setStaffFormData(prev => ({ ...prev, pin: randomPin }));
  };

  const handleOpenCreateStaff = () => {
    setEditingStaffId(null);
    setStaffFormData({
      nombre_completo: "",
      email: "",
      telefono: "",
      rol: "recepcion",
      permiso_sede: activeSede === "tejar" ? "tejar" : activeSede === "castilla" ? "castilla" : "consolidado",
      pin: Math.floor(1000 + Math.random() * 9000).toString(),
      estado: "activo",
      notas: ""
    });
    setIsStaffModalOpen(true);
  };

  const handleOpenEditStaff = (user: StaffUser) => {
    setEditingStaffId(user.id);
    setStaffFormData({
      nombre_completo: user.nombre_completo,
      email: user.email,
      telefono: user.telefono,
      rol: user.rol,
      permiso_sede: user.permiso_sede,
      pin: user.pin,
      estado: user.estado,
      notas: user.notas || ""
    });
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();

    if (!staffFormData.nombre_completo.trim()) {
      setModal({
        isOpen: true,
        title: "Campo Requerido",
        message: "Por favor, introduce el nombre completo del miembro del personal.",
        type: "warning"
      });
      return;
    }

    if (!/^\d{4}$/.test(staffFormData.pin)) {
      setModal({
        isOpen: true,
        title: "PIN Inválido",
        message: "El código PIN debe tener exactamente 4 dígitos numéricos (ej. 1234).",
        type: "warning"
      });
      return;
    }

    // Check PIN collisions with other active staff
    const pinCollision = staffList.find(u => u.pin === staffFormData.pin && u.id !== editingStaffId);
    if (pinCollision) {
      setModal({
        isOpen: true,
        title: "PIN en Uso",
        message: `El PIN ${staffFormData.pin} ya está asignado a ${pinCollision.nombre_completo}. Por favor elige otro PIN.`,
        type: "warning"
      });
      return;
    }

    let updatedList: StaffUser[];
    if (editingStaffId) {
      updatedList = staffList.map(u => {
        if (u.id === editingStaffId) {
          return {
            ...u,
            ...staffFormData
          };
        }
        return u;
      });

      logActivity({
        origen: "recepcion",
        tipo_evento: "modificacion_usuario",
        descripcion: `Actualizadas credenciales y rol de ${staffFormData.nombre_completo} (${staffFormData.rol})`,
        usuario_afectado: staffFormData.nombre_completo,
        sede: staffFormData.permiso_sede === "tejar" ? "Studio 1 Plaza El Tejar" : staffFormData.permiso_sede === "castilla" ? "Studio 2 Paseo Castilla" : "Consolidado"
      });
    } else {
      const newUser: StaffUser = {
        id: "staff_" + Date.now(),
        ...staffFormData,
        creado_en: new Date().toISOString()
      };
      updatedList = [newUser, ...staffList];

      logActivity({
        origen: "recepcion",
        tipo_evento: "creacion_usuario",
        descripcion: `Alta de nuevo usuario en el sistema: ${newUser.nombre_completo} (Rol: ${newUser.rol}, PIN: ****)`,
        usuario_afectado: newUser.nombre_completo,
        sede: newUser.permiso_sede === "tejar" ? "Studio 1 Plaza El Tejar" : newUser.permiso_sede === "castilla" ? "Studio 2 Paseo Castilla" : "Consolidado"
      });
    }

    saveStaffUsers(updatedList);
    setIsStaffModalOpen(false);
    setModal({
      isOpen: true,
      title: editingStaffId ? "Usuario Actualizado" : "Usuario Creado",
      message: `Los datos y permisos de ${staffFormData.nombre_completo} se han guardado con éxito.`,
      type: "success"
    });
  };

  const handleDeleteStaff = (user: StaffUser) => {
    if (user.rol === "director" && staffList.filter(u => u.rol === "director").length <= 1) {
      setModal({
        isOpen: true,
        title: "Operación Denegada",
        message: "No es posible eliminar al único Director / Administrador Master del sistema.",
        type: "warning"
      });
      return;
    }

    setModal({
      isOpen: true,
      title: "Eliminar Usuario",
      message: `¿Estás seguro de que deseas revocar el acceso y eliminar a ${user.nombre_completo} (${user.rol.toUpperCase()})?`,
      type: "warning",
      showCancel: true,
      confirmText: "Sí, Eliminar",
      onConfirm: () => {
        const updated = staffList.filter(u => u.id !== user.id);
        saveStaffUsers(updated);

        logActivity({
          origen: "recepcion",
          tipo_evento: "eliminacion_usuario",
          descripcion: `Usuario revocado y eliminado del personal: ${user.nombre_completo}`,
          usuario_afectado: user.nombre_completo,
          sede: "Consolidado"
        });

        setModal({
          isOpen: true,
          title: "Usuario Eliminado",
          message: `${user.nombre_completo} ha sido eliminado del registro de personal.`,
          type: "success"
        });
      }
    });
  };

  const handleToggleStaffStatus = (user: StaffUser) => {
    const nextStatus = user.estado === "activo" ? "inactivo" : "activo";
    const updated = staffList.map(u => u.id === user.id ? { ...u, estado: nextStatus as "activo" | "inactivo" } : u);
    saveStaffUsers(updated);

    logActivity({
      origen: "recepcion",
      tipo_evento: "modificacion_usuario",
      descripcion: `Estado de acceso de ${user.nombre_completo} cambiado a ${nextStatus.toUpperCase()}`,
      usuario_afectado: user.nombre_completo,
      sede: "Consolidado"
    });
  };

  // Filtered Staff
  const filteredStaff = staffList.filter(user => {
    // Sede filter
    if (activeSede !== "consolidado") {
      if (user.permiso_sede !== "consolidado" && user.permiso_sede !== activeSede) {
        return false;
      }
    }

    // Role filter
    if (staffRoleFilter !== "todos" && user.rol !== staffRoleFilter) {
      return false;
    }

    // Search filter
    if (staffSearch.trim()) {
      const term = staffSearch.toLowerCase();
      const matchName = user.nombre_completo.toLowerCase().includes(term);
      const matchEmail = user.email.toLowerCase().includes(term);
      const matchPhone = user.telefono.includes(term);
      if (!matchName && !matchEmail && !matchPhone) return false;
    }

    return true;
  });

  // ----------------------------------------------------
  // ACTIVITY LOGS LOGIC
  // ----------------------------------------------------
  const sampleLogs = [
    {
      id: "log-seed-1",
      created_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
      origen: "alumno",
      tipo_evento: "reserva_bono",
      descripcion: "Solicitud de reserva de Bono 8 Clases (57 €) para abonar en Recepción",
      usuario_afectado: "Fran Sarciat",
      sede: "Studio 1 Plaza El Tejar"
    },
    {
      id: "log-seed-2",
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      origen: "recepcion",
      tipo_evento: "cobro_bono",
      descripcion: "Cobro y activación de Bono 8 Clases a Fran Sarciat (57.00 € TPV)",
      usuario_afectado: "Fran Sarciat",
      sede: "Studio 1 Plaza El Tejar"
    },
    {
      id: "log-seed-3",
      created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      origen: "alumno",
      tipo_evento: "checkin",
      descripcion: "Acceso QR validado en la clase Salsa I",
      usuario_afectado: "Fran Sarciat",
      sede: "Studio 1 Plaza El Tejar"
    },
    {
      id: "log-seed-4",
      created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      origen: "profesor",
      tipo_evento: "asistencia_profesor",
      descripcion: "Pase de lista masivo registrado en Bachata Sensual II (14 alumnos)",
      usuario_afectado: "Carlos & Carmen",
      sede: "Studio 2 Paseo Castilla"
    },
    {
      id: "log-seed-5",
      created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      origen: "recepcion",
      tipo_evento: "email_credenciales",
      descripcion: "Envío de credenciales de acceso por correo a la alumna Laura Gómez",
      usuario_afectado: "Laura Gómez",
      sede: "Studio 2 Paseo Castilla"
    }
  ];

  const fetchLogs = async () => {
    setIsLoadingLogs(true);

    try {
      const local = getLocalLogs();
      const { data } = await supabase
        .from("registros_actividad")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150);

      let combined = [...local];
      if (data && data.length > 0) {
        data.forEach((item: any) => {
          if (!combined.some(c => c.id === item.id)) {
            combined.push(item);
          }
        });
      }

      if (combined.length === 0) {
        combined = sampleLogs;
      }

      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setLogs(combined);
    } catch (e) {
      console.warn("Error fetching logs:", e);
      setLogs(getLocalLogs().length > 0 ? getLocalLogs() : sampleLogs);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    const handleUpdate = () => fetchLogs();
    window.addEventListener("df_activity_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("df_activity_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Filter logs based on selection and activeSede
  const filteredLogs = logs.filter((log) => {
    // 1. Sede Filter
    if (activeSede !== "consolidado") {
      const logSede = (log.sede || "").toLowerCase();
      const isTejar = activeSede === "tejar";
      
      if (isTejar) {
        const matchTejar = logSede.includes("tejar") || logSede.includes("studio 1") || logSede.includes("mostoles") || logSede === "general" || logSede === "consolidado" || logSede === "ambas sedes";
        if (!matchTejar) return false;
      } else {
        const matchCastilla = logSede.includes("castilla") || logSede.includes("studio 2") || logSede.includes("alcorcon") || logSede === "general" || logSede === "consolidado" || logSede === "ambas sedes";
        if (!matchCastilla) return false;
      }
    }

    // 2. Origin Filter
    if (filterOrigen !== "todos" && log.origen !== filterOrigen) return false;
    
    // 3. Category / Event Type Filter
    if (filterTipo !== "todos") {
      if (filterTipo === "checkin" && log.tipo_evento !== "checkin") return false;
      if (filterTipo === "bonos" && !["reserva_bono", "cobro_bono", "compra_bono", "solicitud_bono", "compra_bono_stripe"].includes(log.tipo_evento)) return false;
      if (filterTipo === "alumnos" && !["alta_alumno", "baja_alumno", "edicion_alumno", "email_credenciales", "inscripcion_clase", "modificacion_perfil"].includes(log.tipo_evento)) return false;
      if (filterTipo === "profesor" && log.tipo_evento !== "asistencia_profesor") return false;
      if (filterTipo === "sistema" && !["acceso_admin", "creacion_usuario", "modificacion_usuario", "eliminacion_usuario"].includes(log.tipo_evento)) return false;
    }

    // 4. Search term
    if (logSearchTerm.trim()) {
      const term = logSearchTerm.toLowerCase();
      const matchName = (log.usuario_afectado || "").toLowerCase().includes(term);
      const matchDesc = (log.descripcion || "").toLowerCase().includes(term);
      const matchDet = (log.detalles || "").toLowerCase().includes(term);
      if (!matchName && !matchDesc && !matchDet) return false;
    }

    return true;
  });

  const getOriginBadge = (origen: string) => {
    switch (origen) {
      case "alumno":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/30 shadow-sm">
            <span>📱</span> Alumno
          </span>
        );
      case "profesor":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/30 shadow-sm">
            <span>👨‍🏫</span> Profesor
          </span>
        );
      case "sistema":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/30 shadow-sm">
            <Shield size={12} /> Sistema
          </span>
        );
      case "recepcion":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30 shadow-sm">
            <span>🏢</span> Recepción
          </span>
        );
    }
  };

  const getEventIcon = (tipo: string) => {
    if (tipo.includes("bono")) return "🎟️";
    if (tipo === "checkin") return "⚡";
    if (tipo.includes("alumno") || tipo === "inscripcion_clase" || tipo === "modificacion_perfil") return "👤";
    if (tipo.includes("profesor")) return "📋";
    if (tipo.includes("email")) return "✉️";
    if (tipo.includes("usuario") || tipo === "acceso_admin") return "🔐";
    return "📝";
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));

      if (diffMins < 1) return "Justo ahora";
      if (diffMins < 60) return `Hace ${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Hace ${diffHours}h`;
      return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header & Section Selector Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] text-[var(--color-text-title)] tracking-wide">
            Registro, Accesos y Auditoría
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Gestión de usuarios y personal docente, asignación de roles y timeline de eventos en tiempo real
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl shadow-inner">
          <button
            onClick={() => setActiveTab("usuarios")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "usuarios"
                ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            <Users size={15} />
            <span>Personal & Roles ({staffList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "logs"
                ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            <Clock size={15} />
            <span>Logs de Auditoría ({filteredLogs.length})</span>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: GESTIÓN DE USUARIOS Y ROLES DE PERSONAL       */}
      {/* ==================================================== */}
      {activeTab === "usuarios" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Header Controls Bar */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
              
              {/* Role filter */}
              <div className="flex items-center gap-1 bg-[var(--color-bg)] border border-[var(--color-border)] p-1 rounded-xl">
                <button
                  onClick={() => setStaffRoleFilter("todos")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    staffRoleFilter === "todos" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)]"
                  }`}
                >
                  Todos los Roles
                </button>
                <button
                  onClick={() => setStaffRoleFilter("director")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    staffRoleFilter === "director" ? "bg-purple-600 text-white" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)]"
                  }`}
                >
                  Dirección
                </button>
                <button
                  onClick={() => setStaffRoleFilter("recepcion")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    staffRoleFilter === "recepcion" ? "bg-amber-500 text-slate-950 font-bold" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)]"
                  }`}
                >
                  Recepción
                </button>
                <button
                  onClick={() => setStaffRoleFilter("profesor")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    staffRoleFilter === "profesor" ? "bg-cyan-500 text-slate-950 font-bold" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)]"
                  }`}
                >
                  Profesores
                </button>
              </div>

              {/* Search input */}
              <div className="relative w-full md:w-64">
                <input
                  type="text"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder="Buscar por nombre, email o tel..."
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-xs text-[var(--color-text-title)] rounded-xl pl-8 pr-3 py-2 outline-none focus:border-[var(--color-primary)] shadow-sm"
                />
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--color-text-secondary)]" />
              </div>
            </div>

            <button
              onClick={handleOpenCreateStaff}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 cursor-pointer w-full md:w-auto justify-center active:scale-95"
            >
              <Plus size={16} />
              <span>+ Nuevo Personal / Usuario</span>
            </button>
          </div>

          {/* Staff Table / Cards Grid */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--color-bg-hover)] border-b border-[var(--color-border)]">
                    <th className="py-3.5 px-5 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Miembro del Personal</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Rol Asignado</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Sede Autorizada</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider text-center">PIN de Acceso</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider text-center">Estado</th>
                    <th className="py-3.5 px-5 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-xs text-[var(--color-text-secondary)]">
                        No se encontraron usuarios del personal con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((user) => {
                      const isPinVisible = visiblePins[user.id] || false;
                      const isDirector = user.rol === "director";
                      const isRecepcion = user.rol === "recepcion";

                      return (
                        <tr key={user.id} className="hover:bg-[var(--color-bg-hover)]/70 transition-colors">
                          
                          {/* Columna: Nombre y Contacto */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-md shrink-0 ${
                                isDirector 
                                  ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white" 
                                  : isRecepcion 
                                  ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white" 
                                  : "bg-gradient-to-br from-cyan-500 to-blue-600 text-white"
                              }`}>
                                {user.nombre_completo.split(" ").slice(0, 2).map(n => n[0]).join("")}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-sm text-[var(--color-text-title)] block truncate">
                                  {user.nombre_completo}
                                </span>
                                <div className="flex items-center gap-2.5 text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                                  <span className="flex items-center gap-1 font-mono">
                                    <Phone size={11} /> {user.telefono}
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 truncate max-w-[160px]">
                                    <Mail size={11} /> {user.email}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Columna: Rol */}
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase inline-flex items-center gap-1.5 border ${
                              isDirector
                                ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                                : isRecepcion
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                : "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                            }`}>
                              <Shield size={12} />
                              {user.rol === "director" ? "Director & Master" : user.rol === "recepcion" ? "Recepción" : "Profesor / Docente"}
                            </span>
                          </td>

                          {/* Columna: Sede */}
                          <td className="py-4 px-4 text-xs font-semibold text-[var(--color-text-title)]">
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 size={13} className="text-[var(--color-primary)]" />
                              {user.permiso_sede === "consolidado" 
                                ? "🏢 Consolidado (Ambas Sedes)" 
                                : user.permiso_sede === "tejar" 
                                ? "Studio 1 (Plaza El Tejar)" 
                                : "Studio 2 (Paseo Castilla)"}
                            </span>
                          </td>

                          {/* Columna: PIN */}
                          <td className="py-4 px-4 text-center">
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] shadow-inner">
                              <KeyRound size={13} className="text-[var(--color-primary)]" />
                              <span className="font-mono font-bold text-xs text-[var(--color-text-title)] tracking-widest">
                                {isPinVisible ? user.pin : "••••"}
                              </span>
                              <button
                                onClick={() => togglePinVisibility(user.id)}
                                className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] transition-colors cursor-pointer"
                                title={isPinVisible ? "Ocultar PIN" : "Ver PIN"}
                              >
                                {isPinVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            </div>
                          </td>

                          {/* Columna: Estado */}
                          <td className="py-4 px-4 text-center">
                            <button
                              onClick={() => handleToggleStaffStatus(user)}
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer inline-flex items-center gap-1 ${
                                user.estado === "activo"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-400 border-rose-500/25 hover:bg-rose-500/20"
                              }`}
                              title="Clic para cambiar estado"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${user.estado === "activo" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`}></span>
                              {user.estado === "activo" ? "Activo" : "Inactivo"}
                            </button>
                          </td>

                          {/* Columna: Acciones */}
                          <td className="py-4 px-5 text-right">
                            <div className="flex justify-end items-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditStaff(user)}
                                className="p-2 rounded-lg bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 border border-[var(--color-border)] transition-colors cursor-pointer"
                                title="Editar datos y permisos"
                              >
                                <Edit3 size={14} />
                              </button>

                              <button
                                onClick={() => handleDeleteStaff(user)}
                                className="p-2 rounded-lg bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 border border-[var(--color-border)] transition-colors cursor-pointer"
                                title="Eliminar miembro"
                              >
                                <Trash2 size={14} />
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

        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: LOGS DE AUDITORÍA EN TIEMPO REAL              */}
      {/* ==================================================== */}
      {activeTab === "logs" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Tarjetas KPI Resumen de Logs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Total Registros</span>
                <h3 className="text-2xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)] mt-1">{filteredLogs.length}</h3>
                <span className="text-[10px] text-emerald-400 font-semibold mt-0.5 inline-block">Sincronización en vivo</span>
              </div>
              <div className="p-3 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-xl border border-[var(--color-primary)]/20">
                📜
              </div>
            </div>

            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Acciones Alumnos</span>
                <h3 className="text-2xl font-[family-name:var(--font-heading)] text-cyan-400 mt-1">
                  {logs.filter(l => l.origen === "alumno").length}
                </h3>
                <span className="text-[10px] text-[var(--color-text-secondary)]">Reservas & QR</span>
              </div>
              <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                📱
              </div>
            </div>

            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Acciones Recepción</span>
                <h3 className="text-2xl font-[family-name:var(--font-heading)] text-amber-400 mt-1">
                  {logs.filter(l => l.origen === "recepcion").length}
                </h3>
                <span className="text-[10px] text-[var(--color-text-secondary)]">Cobros & Altas</span>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                🏢
              </div>
            </div>

            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Acciones Profesores</span>
                <h3 className="text-2xl font-[family-name:var(--font-heading)] text-purple-400 mt-1">
                  {logs.filter(l => l.origen === "profesor").length}
                </h3>
                <span className="text-[10px] text-[var(--color-text-secondary)]">Asistencias en aula</span>
              </div>
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                👨‍🏫
              </div>
            </div>
          </div>

          {/* Barra de Filtros Rápidos */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              
              {/* Filtro por Origen */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[var(--color-text-secondary)] mr-1">Origen:</span>
                
                <button
                  onClick={() => setFilterOrigen("todos")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filterOrigen === "todos"
                      ? "bg-[var(--color-primary)] text-white shadow-md"
                      : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-title)]"
                  }`}
                >
                  Todos
                </button>

                <button
                  onClick={() => setFilterOrigen("alumno")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filterOrigen === "alumno"
                      ? "bg-cyan-500 text-slate-950 shadow-md font-bold"
                      : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-title)]"
                  }`}
                >
                  📱 Alumnos
                </button>

                <button
                  onClick={() => setFilterOrigen("recepcion")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filterOrigen === "recepcion"
                      ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                      : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-title)]"
                  }`}
                >
                  🏢 Recepción
                </button>

                <button
                  onClick={() => setFilterOrigen("profesor")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filterOrigen === "profesor"
                      ? "bg-purple-500 text-white shadow-md font-bold"
                      : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-title)]"
                  }`}
                >
                  👨‍🏫 Profesores
                </button>
              </div>

              {/* Filtro por Categoría / Evento */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                  className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-title)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--color-primary)] cursor-pointer"
                >
                  <option value="todos">Todas las categorías</option>
                  <option value="checkin">⚡ Check-ins QR</option>
                  <option value="bonos">🎟️ Solicitudes & Cobro de Bonos</option>
                  <option value="alumnos">👤 Altas, Bajas & Matrículas</option>
                  <option value="profesor">📋 Asistencias de Profesor</option>
                  <option value="sistema">🔐 Accesos & Seguridad Personal</option>
                </select>

                {/* Búsqueda */}
                <input 
                  type="text"
                  value={logSearchTerm}
                  onChange={(e) => setLogSearchTerm(e.target.value)}
                  placeholder="Buscar acción o usuario..."
                  className="bg-[var(--color-bg)] border border-[var(--color-border)] text-xs text-[var(--color-text-title)] rounded-xl px-3.5 py-2 outline-none focus:border-[var(--color-primary)] w-full md:w-60"
                />
              </div>

            </div>
          </div>

          {/* Lista de Registros Timeline */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-bold text-[var(--color-text-title)] tracking-wide flex items-center gap-2">
                <span>Historial de Eventos Relevantes</span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  En Tiempo Real
                </span>
              </h3>
              
              <button 
                onClick={fetchLogs}
                className="text-xs text-[var(--color-primary)] hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Actualizar Lista</span>
              </button>
            </div>

            {isLoadingLogs ? (
              <div className="p-8 text-center text-xs text-[var(--color-text-secondary)]">
                Cargando registros de actividad...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--color-text-secondary)]">
                No se han encontrado registros con los filtros seleccionados.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="p-4 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition-all flex items-start gap-4 shadow-sm"
                  >
                    {/* Icono de Evento */}
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center text-lg shrink-0 mt-0.5">
                      {getEventIcon(log.tipo_evento)}
                    </div>

                    {/* Contenido Principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getOriginBadge(log.origen)}
                          <strong className="text-sm font-bold text-[var(--color-text-title)] truncate">
                            {log.usuario_afectado || "Sistema"}
                          </strong>
                          {log.sede && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)] font-semibold">
                              {log.sede}
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] font-mono text-[var(--color-text-secondary)] shrink-0">
                          {formatTimeAgo(log.created_at)}
                        </span>
                      </div>

                      <p className="text-xs text-[var(--color-text-body)] leading-relaxed">
                        {log.descripcion}
                      </p>

                      {log.detalles && (
                        <span className="text-[10px] text-[var(--color-text-secondary)] font-mono block mt-1">
                          {log.detalles}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ALTA Y EDICIÓN DE PERSONAL / STAFF            */}
      {/* ==================================================== */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg-card)] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-bold">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-[family-name:var(--font-heading)] text-[var(--color-text-title)]">
                    {editingStaffId ? "Editar Personal / Credenciales" : "Nuevo Miembro del Personal"}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Configuración de permisos, rol y PIN de seguridad de acceso
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveStaff} className="p-6 space-y-4 overflow-y-auto flex-1">
              
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={staffFormData.nombre_completo}
                  onChange={(e) => setStaffFormData(prev => ({ ...prev, nombre_completo: e.target.value }))}
                  placeholder="Ej. Laura Gómez Martín"
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--color-text-title)] outline-none focus:border-[var(--color-primary)] font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={staffFormData.email}
                    onChange={(e) => setStaffFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="correo@dancefactory.es"
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--color-text-title)] outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={staffFormData.telefono}
                    onChange={(e) => setStaffFormData(prev => ({ ...prev, telefono: e.target.value }))}
                    placeholder="600 000 000"
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--color-text-title)] outline-none focus:border-[var(--color-primary)] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                    Rol / Cargo *
                  </label>
                  <select
                    value={staffFormData.rol}
                    onChange={(e) => setStaffFormData(prev => ({ ...prev, rol: e.target.value as any }))}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--color-text-title)] font-bold outline-none focus:border-[var(--color-primary)] cursor-pointer"
                  >
                    <option value="director">👑 Director / Admin Master</option>
                    <option value="recepcion">🏢 Recepción / Mostrador</option>
                    <option value="profesor">👨‍🏫 Profesor / Docente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                    Permisos de Sede *
                  </label>
                  <select
                    value={staffFormData.permiso_sede}
                    onChange={(e) => setStaffFormData(prev => ({ ...prev, permiso_sede: e.target.value as any }))}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--color-text-title)] font-bold outline-none focus:border-[var(--color-primary)] cursor-pointer"
                  >
                    <option value="consolidado">🏢 Consolidado (Ambas Sedes)</option>
                    <option value="tejar">Studio 1 Plaza El Tejar</option>
                    <option value="castilla">Studio 2 Paseo Castilla</option>
                  </select>
                </div>
              </div>

              {/* PIN Code Setup */}
              <div className="p-4 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[var(--color-text-title)] flex items-center gap-1.5">
                    <KeyRound size={14} className="text-[var(--color-primary)]" />
                    Código PIN de Acceso (4 dígitos) *
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPin}
                    className="text-[11px] font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
                  >
                    Generar PIN aleatorio
                  </button>
                </div>
                
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={staffFormData.pin}
                  onChange={(e) => setStaffFormData(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, "") }))}
                  placeholder="Ej. 1234"
                  className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-center text-lg font-mono font-bold tracking-widest text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                />
                <p className="text-[10px] text-[var(--color-text-secondary)]">
                  Este PIN se usará en el teclado táctil para iniciar sesión en la recepción o el portal docente.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                  Notas / Observaciones
                </label>
                <textarea
                  rows={2}
                  value={staffFormData.notas}
                  onChange={(e) => setStaffFormData(prev => ({ ...prev, notas: e.target.value }))}
                  placeholder="Horarios, responsabilidades específicas..."
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-3 text-xs text-[var(--color-text-title)] outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[var(--color-border)] flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] text-xs font-semibold text-[var(--color-text-secondary)] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold shadow-lg shadow-[var(--color-primary)]/20 transition-all cursor-pointer"
                >
                  {editingStaffId ? "Guardar Cambios" : "Crear Usuario"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Global App Modal for Alerts / Confirmations */}
      <AppModal modal={modal} onClose={() => setModal(prev => ({ ...prev, isOpen: false }))} />

    </div>
  );
}
