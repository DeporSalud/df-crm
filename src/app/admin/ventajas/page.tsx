"use client";

import { useState, useEffect } from "react";
import { 
  Gift, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  ShoppingBag, 
  Tag, 
  Sparkles, 
  ShieldCheck, 
  X, 
  Eye, 
  EyeOff, 
  ChevronRight,
  UserCheck,
  AlertCircle,
  Ticket,
  Calendar,
  AlertTriangle,
  RotateCcw
} from "lucide-react";
import { 
  VentajaItem, 
  SolicitudVentaja, 
  BonoAlumno,
  getVentajasCatalog, 
  saveVentajasCatalog, 
  getSolicitudesVentajas, 
  updateSolicitudStatus,
  getBonosAlumnos,
  saveBonosAlumnos,
  consumirSesionBono,
  recargarSesionesBono,
  crearBonoAlumno
} from "@/lib/ventajasService";
import { registrarNuevoPago } from "@/lib/pagosService";
import { logActivity } from "@/lib/activityLogger";
import AppModal, { ModalState } from "@/components/AppModal";

export default function AdminVentajasPage() {
  const [items, setItems] = useState<VentajaItem[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudVentaja[]>([]);
  const [bonos, setBonos] = useState<BonoAlumno[]>([]);
  const [activeTab, setActiveTab] = useState<"catalogo" | "reservas" | "bonos">("catalogo");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State for Catalog Edit / Create
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VentajaItem | null>(null);

  // Form State Catalog
  const [formTitulo, setFormTitulo] = useState("");
  const [formCategoria, setFormCategoria] = useState<"merch" | "bonos" | "salud" | "descuentos">("merch");
  const [formBadge, setFormBadge] = useState("OFERTA ALUMNOS");
  const [formPrecioAlumno, setFormPrecioAlumno] = useState("");
  const [formPrecioOriginal, setFormPrecioOriginal] = useState("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formCaracteristicas, setFormCaracteristicas] = useState<string[]>([""]);
  const [formTallas, setFormTallas] = useState<string[]>(["S", "M", "L", "XL"]);
  const [formHasTallas, setFormHasTallas] = useState(true);
  const [formIcono, setFormIcono] = useState<"sudadera" | "camiseta" | "mochila" | "botella" | "bono" | "fisio" | "tienda">("sudadera");
  const [formActivo, setFormActivo] = useState(true);

  // Modal State for New Bono Alumno
  const [isBonoModalOpen, setIsBonoModalOpen] = useState(false);
  const [bonoFormAlumno, setBonoFormAlumno] = useState("");
  const [bonoFormDni, setBonoFormDni] = useState("");
  const [bonoFormTelefono, setBonoFormTelefono] = useState("");
  const [bonoFormTipo, setBonoFormTipo] = useState("Bono 10 Clases Open Class");
  const [bonoFormClases, setBonoFormClases] = useState(10);
  const [bonoFormPrecio, setBonoFormPrecio] = useState(79.00);
  const [bonoFormSede, setBonoFormSede] = useState<"tejar" | "castilla">("tejar");
  const [bonoFormDias, setBonoFormDias] = useState(90);
  const [bonoRegistrarCobro, setBonoRegistrarCobro] = useState(true);

  // Modal State for Recharge Bono
  const [isRecargaModalOpen, setIsRecargaModalOpen] = useState(false);
  const [recargaBonoId, setRecargaBonoId] = useState<string | null>(null);
  const [recargaClases, setRecargaClases] = useState(4);
  const [recargaPrecio, setRecargaPrecio] = useState(45.00);

  // AppModal State for confirmations & alerts
  const [modal, setModal] = useState<ModalState>({ isOpen: false, message: "" });

  const loadData = () => {
    setItems(getVentajasCatalog());
    setSolicitudes(getSolicitudesVentajas());
    setBonos(getBonosAlumnos());
  };

  useEffect(() => {
    loadData();
    window.addEventListener("df_ventajas_updated", loadData);
    window.addEventListener("df_solicitudes_ventajas_updated", loadData);
    window.addEventListener("df_bonos_updated", loadData);
    return () => {
      window.removeEventListener("df_ventajas_updated", loadData);
      window.removeEventListener("df_solicitudes_ventajas_updated", loadData);
      window.removeEventListener("df_bonos_updated", loadData);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormTitulo("");
    setFormCategoria("merch");
    setFormBadge("OFERTA ALUMNOS");
    setFormPrecioAlumno("25,00 €");
    setFormPrecioOriginal("35,00 €");
    setFormDescripcion("");
    setFormCaracteristicas(["Algodón 100% premium", "Diseño exclusivo Dance Factory"]);
    setFormTallas(["S", "M", "L", "XL"]);
    setFormHasTallas(true);
    setFormIcono("sudadera");
    setFormActivo(true);
    setIsModalOpen(true);
  };

  const openEditModal = (item: VentajaItem) => {
    setEditingItem(item);
    setFormTitulo(item.titulo);
    setFormCategoria(item.categoria);
    setFormBadge(item.badge);
    setFormPrecioAlumno(item.precioAlumno);
    setFormPrecioOriginal(item.precioOriginal || "");
    setFormDescripcion(item.descripcion);
    setFormCaracteristicas(item.caracteristicas.length > 0 ? item.caracteristicas : [""]);
    setFormTallas(item.tallas || []);
    setFormHasTallas(!!item.tallas && item.tallas.length > 0);
    setFormIcono(item.iconoTipo);
    setFormActivo(item.activo);
    setIsModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim() || !formPrecioAlumno.trim()) return;

    // FIX REGEX: Change /[^d.,]/g to /[^0-9.,]/g so discount calculation does not produce NaN
    let discountBadge = "";
    if (formPrecioOriginal && formPrecioAlumno) {
      const orig = parseFloat(formPrecioOriginal.replace(/[^0-9.,]/g, '').replace(',', '.'));
      const alum = parseFloat(formPrecioAlumno.replace(/[^0-9.,]/g, '').replace(',', '.'));
      if (orig > 0 && alum > 0 && orig > alum) {
        const pct = Math.round(((orig - alum) / orig) * 100);
        discountBadge = `-${pct}% DTO`;
      }
    }

    let badgeColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
    if (formCategoria === "merch") badgeColor = "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
    else if (formCategoria === "salud") badgeColor = "text-purple-400 bg-purple-500/10 border-purple-500/20";
    else if (formCategoria === "bonos") badgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

    const newItem: VentajaItem = {
      id: editingItem ? editingItem.id : `ventaja_${Date.now()}`,
      categoria: formCategoria,
      titulo: formTitulo.trim(),
      badge: formBadge.trim() || "OFERTA ALUMNO",
      badgeColor,
      precioAlumno: formPrecioAlumno.trim(),
      precioOriginal: formPrecioOriginal.trim() || undefined,
      descuentoTexto: discountBadge || undefined,
      descripcion: formDescripcion.trim(),
      caracteristicas: formCaracteristicas.filter(c => c.trim().length > 0),
      tallas: formHasTallas ? formTallas : undefined,
      iconoTipo: formIcono,
      activo: formActivo,
      creadoEn: editingItem?.creadoEn || new Date().toISOString()
    };

    let updatedList: VentajaItem[];
    if (editingItem) {
      updatedList = items.map(i => i.id === editingItem.id ? newItem : i);
      showToast("✓ Artículo actualizado en catálogo");
    } else {
      updatedList = [newItem, ...items];
      showToast("✓ Nuevo artículo añadido al catálogo");
    }

    setItems(updatedList);
    saveVentajasCatalog(updatedList);
    setIsModalOpen(false);

    logActivity({
      origen: "recepcion",
      tipo_evento: "edicion_alumno",
      descripcion: `Catálogo de ventajas actualizado: ${formTitulo}`,
      usuario_afectado: "Recepción / Admin",
      sede: "Ambas Sedes"
    });
  };

  const handleDeleteItem = (id: string, titulo: string) => {
    setModal({
      isOpen: true,
      title: "Eliminar Artículo",
      message: `¿Estás seguro de que deseas eliminar "${titulo}" del catálogo de ventajas?`,
      type: "warning",
      showCancel: true,
      confirmText: "Sí, Eliminar",
      onConfirm: () => {
        const updated = items.filter(i => i.id !== id);
        setItems(updated);
        saveVentajasCatalog(updated);
        showToast("Artículo eliminado del catálogo");
      }
    });
  };

  const handleToggleActivo = (id: string) => {
    const updated = items.map(i => i.id === id ? { ...i, activo: !i.activo } : i);
    setItems(updated);
    saveVentajasCatalog(updated);
  };

  const handleFeatureChange = (index: number, val: string) => {
    const updated = [...formCaracteristicas];
    updated[index] = val;
    setFormCaracteristicas(updated);
  };

  const addFeatureRow = () => {
    setFormCaracteristicas([...formCaracteristicas, ""]);
  };

  const removeFeatureRow = (index: number) => {
    setFormCaracteristicas(formCaracteristicas.filter((_, i) => i !== index));
  };

  const toggleTalla = (talla: string) => {
    if (formTallas.includes(talla)) {
      setFormTallas(formTallas.filter(t => t !== talla));
    } else {
      setFormTallas([...formTallas, talla]);
    }
  };

  // -------------------------------------------------------------------
  // RETAIL ACCOUNTING: Cobro y Entrega de Merchandising / Reservas
  // -------------------------------------------------------------------
  const handleCobrarYEntregar = (sol: SolicitudVentaja) => {
    updateSolicitudStatus(sol.id, "Entregado");

    const cleanPrice = parseFloat(sol.precio.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
    const isBono = sol.ventaja_titulo.toLowerCase().includes("bono");
    const sedePago = (sol.sede === "castilla" || sol.sede === "alcorcon") ? "castilla" : "tejar";

    // 1. Asiento en el Libro Diario de Pagos
    registrarNuevoPago({
      alumno_id: sol.alumno_id,
      alumno_nombre: sol.alumno_nombre,
      alumno_telefono: sol.alumno_telefono,
      concepto: `Entrega ${isBono ? "Bono" : "Merchandising"}: ${sol.ventaja_titulo}${sol.talla_elegida ? ` (Talla: ${sol.talla_elegida})` : ''}`,
      categoria: isBono ? "bono" : "merchandising",
      importe: cleanPrice,
      metodo_pago: "Efectivo",
      sede: sedePago,
      atendido_por: sedePago === "tejar" ? "Recepción Studio 1" : "Recepción Studio 2",
      notas: `Entrega en mostrador de solicitud #${sol.id}`
    });

    // 2. Registro de Auditoría
    logActivity({
      origen: "recepcion",
      tipo_evento: "edicion_alumno",
      descripcion: `Cobro en mostrador y entrega de ${sol.ventaja_titulo} (${sol.precio}) a ${sol.alumno_nombre}`,
      usuario_afectado: sol.alumno_nombre,
      sede: sedePago === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
    });

    // 3. Si era un bono, crearlo en bonos alumnos automáticamente
    if (isBono) {
      let clasesCount = 10;
      if (sol.ventaja_titulo.includes("4")) clasesCount = 4;
      else if (sol.ventaja_titulo.includes("8")) clasesCount = 8;
      else if (sol.ventaja_titulo.includes("3")) clasesCount = 3;

      crearBonoAlumno({
        alumno_id: sol.alumno_id,
        alumno_nombre: sol.alumno_nombre,
        alumno_telefono: sol.alumno_telefono,
        tipo_bono: sol.ventaja_titulo,
        total_clases: clasesCount,
        precio_pagado: cleanPrice,
        sede: sedePago,
        notas: "Emitido tras entrega en recepción"
      });
    }

    loadData();
    showToast(`✓ Entregado y registrado cobro de ${cleanPrice.toFixed(2)}€ en caja`);
  };

  const handleCancelarSolicitud = (sol: SolicitudVentaja) => {
    updateSolicitudStatus(sol.id, "Cancelado");
    loadData();
    showToast("Solicitud cancelada");
  };

  // -------------------------------------------------------------------
  // BONO MANAGEMENT ACTIONS (Consumo de Sesiones y Recargas)
  // -------------------------------------------------------------------
  const handleConsumirSesion = (bono: BonoAlumno) => {
    setModal({
      isOpen: true,
      title: "Canjear Sesión de Bono",
      message: `¿Confirmar asistencia y descontar 1 clase del bono de ${bono.alumno_nombre}?\n(Saldo actual: ${bono.clases_restantes} clases restantes)`,
      type: "info",
      showCancel: true,
      confirmText: "Canjear 1 Clase",
      onConfirm: () => {
        const res = consumirSesionBono(bono.id);
        if (res.success) {
          logActivity({
            origen: "recepcion",
            tipo_evento: "registro_acceso",
            descripcion: `Canje de sesión de bono para ${bono.alumno_nombre} (${res.bono?.clases_restantes} restantes)`,
            usuario_afectado: bono.alumno_nombre,
            sede: bono.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
          });
          loadData();
          showToast(`✓ ${res.message}`);
        } else {
          setModal({
            isOpen: true,
            title: "No se pudo canjear",
            message: res.message,
            type: "warning"
          });
        }
      }
    });
  };

  const handleOpenRecarga = (bono: BonoAlumno) => {
    setRecargaBonoId(bono.id);
    setRecargaClases(4);
    setRecargaPrecio(45.00);
    setIsRecargaModalOpen(true);
  };

  const handleSaveRecarga = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recargaBonoId) return;

    const updated = recargarSesionesBono(recargaBonoId, recargaClases, recargaPrecio);
    if (updated) {
      // Registrar cobro de la recarga en el libro de pagos
      if (recargaPrecio > 0) {
        registrarNuevoPago({
          alumno_id: updated.alumno_id,
          alumno_nombre: updated.alumno_nombre,
          alumno_telefono: updated.alumno_telefono,
          concepto: `Recarga Bono: +${recargaClases} Clases (${updated.tipo_bono})`,
          categoria: "bono",
          importe: recargaPrecio,
          metodo_pago: "Efectivo",
          sede: updated.sede,
          atendido_por: updated.sede === "tejar" ? "Recepción Studio 1" : "Recepción Studio 2",
          notas: `Recarga de ${recargaClases} clases para bono #${updated.id}`
        });
      }

      logActivity({
        origen: "recepcion",
        tipo_evento: "edicion_alumno",
        descripcion: `Recarga de bono (+${recargaClases} clases) para ${updated.alumno_nombre}`,
        usuario_afectado: updated.alumno_nombre,
        sede: updated.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
      });

      setIsRecargaModalOpen(false);
      loadData();
      showToast(`✓ Bono recargado (+${recargaClases} clases) y cobro registrado`);
    }
  };

  const handleCreateNuevoBono = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonoFormAlumno.trim() || bonoFormClases <= 0) return;

    const nuevo = crearBonoAlumno({
      alumno_nombre: bonoFormAlumno.trim(),
      alumno_dni: bonoFormDni.trim() || undefined,
      alumno_telefono: bonoFormTelefono.trim() || undefined,
      tipo_bono: bonoFormTipo,
      total_clases: bonoFormClases,
      precio_pagado: bonoFormPrecio,
      dias_validez: bonoFormDias,
      sede: bonoFormSede,
      notas: "Bono emitido manualmente desde mostrador recepción"
    });

    if (bonoRegistrarCobro && bonoFormPrecio > 0) {
      registrarNuevoPago({
        alumno_nombre: bonoFormAlumno.trim(),
        alumno_dni: bonoFormDni.trim() || undefined,
        alumno_telefono: bonoFormTelefono.trim() || undefined,
        concepto: `Emisión ${bonoFormTipo} (${bonoFormClases} Clases)`,
        categoria: "bono",
        importe: bonoFormPrecio,
        metodo_pago: "Efectivo",
        sede: bonoFormSede,
        atendido_por: bonoFormSede === "tejar" ? "Recepción Studio 1" : "Recepción Studio 2",
        notas: `Venta de bono en mostrador de recepción`
      });
    }

    logActivity({
      origen: "recepcion",
      tipo_evento: "edicion_alumno",
      descripcion: `Nuevo bono emitido: ${bonoFormTipo} (${bonoFormPrecio}€) a ${bonoFormAlumno}`,
      usuario_afectado: bonoFormAlumno,
      sede: bonoFormSede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
    });

    setIsBonoModalOpen(false);
    loadData();
    showToast(`✓ Bono emitido para ${bonoFormAlumno} y registrado con éxito`);
  };

  // Filter items for Tab 1 (Catálogo)
  const filteredItems = items.filter(item => {
    const matchesCat = selectedCategory === "all" || item.categoria === selectedCategory;
    const titleStr = (item.titulo || "").toLowerCase();
    const descStr = (item.descripcion || "").toLowerCase();
    const search = (searchTerm || "").toLowerCase();
    const matchesSearch = titleStr.includes(search) || descStr.includes(search);
    return matchesCat && matchesSearch;
  });

  // Filter Bonos for Tab 3 (Seguimiento de Bonos)
  const filteredBonos = bonos.filter(b => {
    const search = searchTerm.toLowerCase();
    const nameMatch = b.alumno_nombre.toLowerCase().includes(search);
    const dniMatch = (b.alumno_dni || "").toLowerCase().includes(search);
    const tipoMatch = b.tipo_bono.toLowerCase().includes(search);
    return nameMatch || dniMatch || tipoMatch;
  });

  const totalActivos = items.filter(i => i.activo).length;
  const totalMerch = items.filter(i => i.categoria === "merch").length;
  const totalBonosActivos = bonos.filter(b => b.estado === "Activo").length;
  const totalSesionesDisponibles = bonos.reduce((acc, b) => acc + (b.estado === "Activo" ? b.clases_restantes : 0), 0);
  const totalReservasPendientes = solicitudes.filter(s => s.estado === "Pendiente").length;

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Actions Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">Ventajas, Merchandising & Bonos</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">Gestión del catálogo oficial, reservas de alumnos y seguimiento de bonos de clases.</p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === "bonos" ? (
            <button
              onClick={() => {
                setBonoFormAlumno("");
                setBonoFormDni("");
                setBonoFormTelefono("");
                setBonoFormTipo("Bono 10 Clases Open Class");
                setBonoFormClases(10);
                setBonoFormPrecio(79.00);
                setBonoFormSede("tejar");
                setBonoFormDias(90);
                setIsBonoModalOpen(true);
              }}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Ticket size={16} />
              <span>Emitir Nuevo Bono a Alumno</span>
            </button>
          ) : (
            <button
              onClick={openCreateModal}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-[var(--color-primary)]/20 flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Plus size={16} />
              <span>Nueva Ventaja / Producto</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4 rounded-2xl shadow-md">
          <span className="text-[11px] text-[var(--color-text-secondary)] font-medium block">Catálogo Activo</span>
          <span className="text-xl font-bold font-mono text-white mt-1 block">{totalActivos}</span>
          <span className="text-[10px] text-emerald-400 font-semibold mt-0.5 block">Prendas y Ofertas</span>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4 rounded-2xl shadow-md">
          <span className="text-[11px] text-[var(--color-text-secondary)] font-medium block">Bonos Alumnos Activos</span>
          <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">{totalBonosActivos}</span>
          <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">{totalSesionesDisponibles} clases por canjear</span>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4 rounded-2xl shadow-md">
          <span className="text-[11px] text-[var(--color-text-secondary)] font-medium block">Reservas en Mostrador</span>
          <span className="text-xl font-bold font-mono text-[var(--color-secondary)] mt-1 block">{totalReservasPendientes}</span>
          <span className="text-[10px] text-amber-400 font-semibold mt-0.5 block">Pendientes de Cobro/Entrega</span>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4 rounded-2xl shadow-md">
          <span className="text-[11px] text-[var(--color-text-secondary)] font-medium block">Merchandising DF</span>
          <span className="text-xl font-bold font-mono text-cyan-400 mt-1 block">{totalMerch}</span>
          <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">Sudaderas & Tops</span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActiveTab("catalogo"); setSearchTerm(""); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "catalogo"
                ? "bg-[var(--color-primary)] text-white shadow-md"
                : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            📦 Catálogo de Ventajas & Merch ({items.length})
          </button>

          <button
            onClick={() => { setActiveTab("bonos"); setSearchTerm(""); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "bonos"
                ? "bg-[var(--color-primary)] text-white shadow-md"
                : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            🎟️ Seguimiento de Bonos ({bonos.length})
          </button>

          <button
            onClick={() => { setActiveTab("reservas"); setSearchTerm(""); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
              activeTab === "reservas"
                ? "bg-[var(--color-primary)] text-white shadow-md"
                : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            📋 Reservas en Recepción ({solicitudes.length})
            {totalReservasPendientes > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                {totalReservasPendientes}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: CATALOGO */}
      {activeTab === "catalogo" && (
        <div className="space-y-4">
          
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--color-bg-card)] p-3 rounded-2xl border border-[var(--color-border)]">
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto scrollbar-none">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === "all" 
                    ? "bg-[var(--color-primary)] text-white" 
                    : "bg-[var(--color-bg)] text-slate-400 hover:text-white border border-[var(--color-border)]"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setSelectedCategory("merch")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === "merch" 
                    ? "bg-[var(--color-primary)] text-white" 
                    : "bg-[var(--color-bg)] text-slate-400 hover:text-white border border-[var(--color-border)]"
                }`}
              >
                👕 Merchandising
              </button>
              <button
                onClick={() => setSelectedCategory("bonos")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === "bonos" 
                    ? "bg-[var(--color-primary)] text-white" 
                    : "bg-[var(--color-bg)] text-slate-400 hover:text-white border border-[var(--color-border)]"
                }`}
              >
                🎟️ Bonos Especiales
              </button>
              <button
                onClick={() => setSelectedCategory("salud")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === "salud" 
                    ? "bg-[var(--color-primary)] text-white" 
                    : "bg-[var(--color-bg)] text-slate-400 hover:text-white border border-[var(--color-border)]"
                }`}
              >
                🩺 Fisioterapia & Salud
              </button>
              <button
                onClick={() => setSelectedCategory("descuentos")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === "descuentos" 
                    ? "bg-[var(--color-primary)] text-white" 
                    : "bg-[var(--color-bg)] text-slate-400 hover:text-white border border-[var(--color-border)]"
                }`}
              >
                🏷️ Cupones Tienda
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar artículo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Items Table / Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <div 
                key={item.id}
                className={`bg-[var(--color-bg-card)] border rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all ${
                  item.activo ? "border-[var(--color-border)]" : "border-[var(--color-border)] opacity-60 bg-black/40"
                }`}
              >
                <div>
                  {/* Top Row Badge & State */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${item.badgeColor || "text-slate-300 border-slate-700"}`}>
                      {item.badge}
                    </span>
                    <button
                      onClick={() => handleToggleActivo(item.id)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 cursor-pointer ${
                        item.activo 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                          : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                      }`}
                    >
                      {item.activo ? <Eye size={11} /> : <EyeOff size={11} />}
                      <span>{item.activo ? "Activo" : "Pausado"}</span>
                    </button>
                  </div>

                  {/* Title & Icon */}
                  <div className="flex items-start gap-3 mt-2">
                    <div className="w-12 h-12 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center text-xl shrink-0 shadow-inner">
                      {item.iconoTipo === "sudadera" && "🧥"}
                      {item.iconoTipo === "camiseta" && "👕"}
                      {item.iconoTipo === "mochila" && "🎒"}
                      {item.iconoTipo === "botella" && "🍶"}
                      {item.iconoTipo === "bono" && "🎟️"}
                      {item.iconoTipo === "fisio" && "💆‍♂️"}
                      {item.iconoTipo === "tienda" && "👟"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-bold text-white leading-tight truncate">
                        {item.titulo}
                      </h2>
                      <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2 mt-1">
                        {item.descripcion}
                      </p>
                    </div>
                  </div>

                  {/* Sizes */}
                  {item.tallas && item.tallas.length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Tallas:</span>
                      <div className="flex gap-1 flex-wrap">
                        {item.tallas.map(t => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-[var(--color-bg)] text-slate-300 text-[10px] font-mono border border-[var(--color-border)]">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pricing */}
                  <div className="mt-4 p-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Precio Alumno</span>
                      <span className="text-base font-extrabold font-mono text-[var(--color-secondary)]">
                        {item.precioAlumno}
                      </span>
                    </div>
                    {item.precioOriginal && (
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">PVP General</span>
                        <span className="text-xs font-mono text-slate-500 line-through">
                          {item.precioOriginal}
                        </span>
                      </div>
                    )}
                    {item.descuentoTexto && (
                      <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                        {item.descuentoTexto}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
                  <button
                    onClick={() => openEditModal(item)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 size={13} />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id, item.titulo)}
                    className="p-1.5 rounded-lg bg-[var(--color-bg)] hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 border border-[var(--color-border)] transition-colors cursor-pointer"
                    title="Eliminar artículo"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* TAB 2: SEGUIMIENTO DE BONOS DE ALUMNOS */}
      {activeTab === "bonos" && (
        <div className="space-y-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg">
            
            {/* Header / Search in Bonos */}
            <div className="p-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">Supervisión y Control de Bonos de Clases</h2>
                <p className="text-[11px] text-[var(--color-text-secondary)]">Consulta el saldo restante de clases, fechas límite de caducidad y canje de sesiones en mostrador.</p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar alumno, DNI o bono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>

            {/* Bonos Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-bg)] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[var(--color-border)]">
                  <tr>
                    <th className="py-3 px-4">Alumno</th>
                    <th className="py-3 px-4">Tipo de Bono</th>
                    <th className="py-3 px-4 text-center">Saldo de Clases</th>
                    <th className="py-3 px-4">Caducidad</th>
                    <th className="py-3 px-4">Sede</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones Recepción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-slate-300">
                  {filteredBonos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No se encontraron bonos que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredBonos.map((bono) => {
                      const pct = Math.round((bono.clases_consumidas / bono.total_clases) * 100);
                      const isExpired = bono.estado === "Caducado";
                      const isAgotado = bono.clases_restantes <= 0;

                      return (
                        <tr key={bono.id} className="hover:bg-[var(--color-bg-hover)] transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white">{bono.alumno_nombre}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {bono.alumno_dni ? `DNI: ${bono.alumno_dni}` : bono.alumno_telefono || "Sin DNI"}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-semibold text-white">
                            <div>{bono.tipo_bono}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Importe: {bono.precio_pagado.toFixed(2)}€</div>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex flex-col items-center gap-1">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                isAgotado
                                  ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                  : bono.clases_restantes <= 2
                                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                  : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              }`}>
                                {bono.clases_restantes} / {bono.total_clases} restantes
                              </span>
                              <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={`h-full ${isAgotado ? "bg-rose-500" : "bg-emerald-500"}`} 
                                  style={{ width: `${Math.min(100, pct)}%` }} 
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px]">
                            <div className="flex items-center gap-1">
                              <Calendar size={12} className="text-slate-400" />
                              <span className={isExpired ? "text-rose-400 font-bold" : "text-slate-300"}>
                                {bono.fecha_caducidad}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              bono.sede === "tejar"
                                ? "bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border-[var(--color-secondary)]/20"
                                : "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/20"
                            }`}>
                              {bono.sede === "tejar" ? "Studio 1 (Tejar)" : "Studio 2 (Castilla)"}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              bono.estado === "Activo"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : bono.estado === "Agotado"
                                ? "bg-slate-500/10 text-slate-400 border-slate-500/30"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            }`}>
                              {bono.estado}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-1.5">
                            {bono.estado === "Activo" && (
                              <button
                                onClick={() => handleConsumirSesion(bono)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                                title="Descontar 1 clase al alumno"
                              >
                                🎟️ Canjear 1 Clase
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenRecarga(bono)}
                              className="px-2.5 py-1 rounded-lg bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] text-slate-300 hover:text-white border border-[var(--color-border)] text-[11px] font-bold transition-colors cursor-pointer"
                              title="Recargar más sesiones a este bono"
                            >
                              ➕ Recargar
                            </button>
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

      {/* TAB 3: RESERVAS DE ALUMNOS */}
      {activeTab === "reservas" && (
        <div className="space-y-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Solicitudes y Reservas de Merch / Bonos</h2>
                <p className="text-[11px] text-[var(--color-text-secondary)]">Alumnos que han solicitado artículos desde la app móvil para recoger en recepción.</p>
              </div>
              <span className="text-xs font-bold text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-3 py-1 rounded-full border border-[var(--color-secondary)]/20">
                {solicitudes.length} Registros
              </span>
            </div>

            {solicitudes.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                <ShoppingBag size={28} className="mx-auto text-slate-600 mb-2" />
                <p className="font-semibold text-slate-300">No hay reservas de alumnos pendientes actualmente.</p>
                <p className="text-[11px]">Cuando un alumno reserve una prenda o bono desde su móvil, aparecerá en esta lista para su entrega en recepción.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--color-bg)] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[var(--color-border)]">
                    <tr>
                      <th className="py-3 px-4">Alumno</th>
                      <th className="py-3 px-4">Artículo / Ventaja</th>
                      <th className="py-3 px-4">Talla</th>
                      <th className="py-3 px-4">Importe</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acción Recepción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] text-slate-300">
                    {solicitudes.map((sol) => (
                      <tr key={sol.id} className="hover:bg-[var(--color-bg-hover)] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white">{sol.alumno_nombre}</div>
                          <div className="text-[10px] text-slate-400">{sol.alumno_email || "Registrado en App"}</div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {sol.ventaja_titulo}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[11px] font-mono font-bold text-slate-300">
                            {sol.talla_elegida || "Única"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-[var(--color-secondary)]">
                          {sol.precio}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            sol.estado === "Entregado"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : sol.estado === "Cancelado"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}>
                            {sol.estado}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          {sol.estado === "Pendiente" && (
                            <>
                              <button
                                onClick={() => handleCobrarYEntregar(sol)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                ✓ Cobrado y Entregado
                              </button>
                              <button
                                onClick={() => handleCancelarSolicitud(sol)}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                          {sol.estado === "Entregado" && (
                            <span className="text-[11px] text-emerald-400 font-semibold">Completado ✓</span>
                          )}
                          {sol.estado === "Cancelado" && (
                            <span className="text-[11px] text-slate-500">Cancelado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE / EDIT CATALOG ITEM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-[var(--color-bg)] text-slate-400 hover:text-white border border-[var(--color-border)] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="pr-8">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-secondary)]">
                {editingItem ? "EDITAR ARTÍCULO" : "NUEVO ARTÍCULO / VENTAJA"}
              </span>
              <h2 className="text-lg font-bold text-white mt-0.5">
                {editingItem ? "Editar Ventaja o Merchandising" : "Añadir al Catálogo Oficial DF"}
              </h2>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              
              {/* Título */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white uppercase tracking-wider block">
                  Nombre del Artículo / Bono <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Sudadera Oficial Dance Factory (Oversize Black)"
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              {/* Categoría & Icono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-white uppercase tracking-wider block">
                    Categoría
                  </label>
                  <select
                    value={formCategoria}
                    onChange={(e: any) => setFormCategoria(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                  >
                    <option value="merch">👕 Merchandising Oficial</option>
                    <option value="bonos">🎟️ Bonos & Cursos Especiales</option>
                    <option value="salud">🩺 Fisioterapia & Salud</option>
                    <option value="descuentos">🏷️ Descuentos Tiendas Asociadas</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-white uppercase tracking-wider block">
                    Icono Representativo
                  </label>
                  <select
                    value={formIcono}
                    onChange={(e: any) => setFormIcono(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                  >
                    <option value="sudadera">🧥 Sudadera / Chaqueta</option>
                    <option value="camiseta">👕 Camiseta / Top</option>
                    <option value="mochila">🎒 Mochila / Bolsa</option>
                    <option value="botella">🍶 Botella Térmica</option>
                    <option value="bono">🎟️ Bono de Clases</option>
                    <option value="fisio">💆‍♂️ Salud / Fisioterapia</option>
                    <option value="tienda">👟 Tienda / Calzado</option>
                  </select>
                </div>
              </div>

              {/* Precios & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-white uppercase tracking-wider block">
                    Precio Alumno <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="32,00 €"
                    value={formPrecioAlumno}
                    onChange={(e) => setFormPrecioAlumno(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-white uppercase tracking-wider block">
                    PVP General (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="45,00 €"
                    value={formPrecioOriginal}
                    onChange={(e) => setFormPrecioOriginal(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs font-mono focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-white uppercase tracking-wider block">
                    Etiqueta / Badge
                  </label>
                  <input
                    type="text"
                    placeholder="OFERTA ALUMNOS"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs uppercase focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              {/* Tallas */}
              <div className="space-y-2 p-3 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-white uppercase tracking-wider">
                    ¿Requiere selección de talla?
                  </label>
                  <input
                    type="checkbox"
                    checked={formHasTallas}
                    onChange={(e) => setFormHasTallas(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-800 text-[var(--color-primary)] cursor-pointer"
                  />
                </div>

                {formHasTallas && (
                  <div className="flex gap-2 pt-1 flex-wrap">
                    {["XS", "S", "M", "L", "XL", "XXL"].map((sz) => (
                      <button
                        type="button"
                        key={sz}
                        onClick={() => toggleTalla(sz)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                          formTallas.includes(sz)
                            ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                            : "bg-[var(--color-bg-card)] text-slate-400 border-[var(--color-border)] hover:border-slate-600"
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Descripción */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white uppercase tracking-wider block">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre el tejido, características o condiciones del bono..."
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              {/* Puntos Clave */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-white uppercase tracking-wider flex items-center justify-between">
                  <span>Puntos Clave / Características</span>
                  <button
                    type="button"
                    onClick={addFeatureRow}
                    className="text-[10px] font-bold text-[var(--color-secondary)] hover:underline cursor-pointer"
                  >
                    + Añadir punto
                  </button>
                </label>
                {formCaracteristicas.map((car, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Punto ${idx + 1} (ej. Tejido 100% transpirable)`}
                      value={car}
                      onChange={(e) => handleFeatureChange(idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs focus:outline-none focus:border-[var(--color-primary)]"
                    />
                    {formCaracteristicas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFeatureRow(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Estado Activo */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activoCheckbox"
                  checked={formActivo}
                  onChange={(e) => setFormActivo(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-[var(--color-primary)] cursor-pointer"
                />
                <label htmlFor="activoCheckbox" className="text-xs text-slate-300 font-semibold cursor-pointer">
                  Publicar y hacer visible inmediatamente para los alumnos en la app móvil
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] text-xs font-bold text-slate-400 hover:text-white border border-[var(--color-border)] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-xs font-bold text-white transition-all shadow-lg shadow-[var(--color-primary)]/25 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 size={15} />
                  <span>{editingItem ? "Guardar Cambios" : "Crear y Publicar"}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL 2: EMITIR NUEVO BONO A ALUMNO */}
      {isBonoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">EMISIÓN DE BONOS</span>
                <h3 className="text-lg font-bold text-white">Vender / Asignar Bono a Alumno</h3>
              </div>
              <button
                onClick={() => setIsBonoModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNuevoBono} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                  Nombre del Alumno *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nombre y apellidos del alumno"
                  value={bonoFormAlumno}
                  onChange={(e) => setBonoFormAlumno(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                    DNI / NIE
                  </label>
                  <input
                    type="text"
                    placeholder="50894721K"
                    value={bonoFormDni}
                    onChange={(e) => setBonoFormDni(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white uppercase font-mono focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    placeholder="654 987 123"
                    value={bonoFormTelefono}
                    onChange={(e) => setBonoFormTelefono(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white font-mono focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                    Tipo de Bono
                  </label>
                  <select
                    value={bonoFormTipo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBonoFormTipo(val);
                      if (val.includes("4")) { setBonoFormClases(4); setBonoFormPrecio(45.00); }
                      else if (val.includes("8")) { setBonoFormClases(8); setBonoFormPrecio(57.00); }
                      else if (val.includes("3")) { setBonoFormClases(3); setBonoFormPrecio(45.00); }
                      else { setBonoFormClases(10); setBonoFormPrecio(79.00); }
                    }}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white font-semibold outline-none cursor-pointer"
                  >
                    <option value="Bono 4 Clases">Bono 4 Clases (45.00 €)</option>
                    <option value="Bono 8 Clases">Bono 8 Clases (57.00 €)</option>
                    <option value="Bono 10 Clases Open Class">Bono 10 Clases (79.00 €)</option>
                    <option value="Bono Especial Masterclasses (3 Sesiones)">Bono 3 Masterclasses (45.00 €)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                    Sede Asignada
                  </label>
                  <select
                    value={bonoFormSede}
                    onChange={(e) => setBonoFormSede(e.target.value as "tejar" | "castilla")}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white font-semibold outline-none cursor-pointer"
                  >
                    <option value="tejar">Studio 1 (Plaza El Tejar)</option>
                    <option value="castilla">Studio 2 (Paseo Castilla)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                    Nº Clases
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={bonoFormClases}
                    onChange={(e) => setBonoFormClases(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white font-mono font-bold focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                    Precio Cobrado (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={bonoFormPrecio}
                    onChange={(e) => setBonoFormPrecio(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white font-mono font-bold text-emerald-400 focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                    Validez (Días)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={bonoFormDias}
                    onChange={(e) => setBonoFormDias(parseInt(e.target.value, 10) || 90)}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white font-mono focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="bonoCobroCheckbox"
                  checked={bonoRegistrarCobro}
                  onChange={(e) => setBonoRegistrarCobro(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-[var(--color-primary)] cursor-pointer"
                />
                <label htmlFor="bonoCobroCheckbox" className="text-xs text-slate-300 font-semibold cursor-pointer">
                  Registrar automáticamente el ingreso de {bonoFormPrecio.toFixed(2)}€ en el libro diario de caja
                </label>
              </div>

              <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsBonoModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] text-slate-300 text-xs font-bold border border-[var(--color-border)] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  Emitir Bono
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 3: RECARGA DE SESIONES DE BONO */}
      {isRecargaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-lg font-bold text-white">Recargar Sesiones de Bono</h3>
              <button
                onClick={() => setIsRecargaModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRecarga} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                  Nº de Clases a Añadir *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={recargaClases}
                  onChange={(e) => setRecargaClases(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white font-mono font-bold focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                  Importe de la Recarga (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={recargaPrecio}
                  onChange={(e) => setRecargaPrecio(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white font-mono font-bold text-emerald-400 focus:outline-none focus:border-[var(--color-primary)]"
                />
                <p className="text-[10px] text-slate-400 mt-1">Se prorrogará automáticamente la fecha de caducidad por 3 meses adicionales.</p>
              </div>

              <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsRecargaModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] text-slate-300 text-xs font-bold border border-[var(--color-border)] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold transition-all shadow-md shadow-[var(--color-primary)]/20 cursor-pointer"
                >
                  Confirmar Recarga
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* AppModal Component for confirmation alerts */}
      <AppModal modal={modal} onClose={() => setModal(prev => ({ ...prev, isOpen: false }))} />

    </div>
  );
}
