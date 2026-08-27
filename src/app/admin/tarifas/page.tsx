"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Tag, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Check, 
  Edit3, 
  Sparkles, 
  Users, 
  Clock, 
  Coins, 
  Save,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  FileCheck2
} from "lucide-react";
import { 
  TarifaItem, 
  TipoTarifa, 
  PeriodicidadTarifa,
  getTarifas, 
  saveTarifas, 
  resetTarifasDefault,
  TARIFAS_DEFAULT 
} from "@/lib/tarifasService";
import { logActivity } from "@/lib/activityLogger";
import AppModal, { ModalState } from "@/components/AppModal";

export default function TarifasPage() {
  const [tarifas, setTarifas] = useState<TarifaItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<"all" | "bonos" | "regular_infantil" | "regular_adulto" | "matricula">("all");
  
  // Modal Edit / Create State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTarifa, setEditingTarifa] = useState<TarifaItem | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formTipo, setFormTipo] = useState<TipoTarifa>("regular_adulto");
  const [formPeriodicidad, setFormPeriodicidad] = useState<PeriodicidadTarifa>("mensual");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formPrecio, setFormPrecio] = useState<number | string>(30);
  const [formHoras, setFormHoras] = useState<number>(1);
  const [formClases, setFormClases] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // AppModal State for confirmations & alerts
  const [modal, setModal] = useState<ModalState>({ isOpen: false, message: "" });

  // Quick price local input state to prevent live wiping on backspace
  const [quickPriceInputs, setQuickPriceInputs] = useState<Record<string, string>>({});
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    const loaded = getTarifas();
    setTarifas(loaded);
    const initialInputs: Record<string, string> = {};
    loaded.forEach(t => {
      initialInputs[t.id] = t.precio.toString();
    });
    setQuickPriceInputs(initialInputs);

    const handleUpdate = () => {
      const updated = getTarifas();
      setTarifas(updated);
    };
    window.addEventListener("df_tarifas_updated", handleUpdate);
    return () => {
      window.removeEventListener("df_tarifas_updated", handleUpdate);
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenCreate = () => {
    setEditingTarifa(null);
    setFormNombre("");
    setFormTipo("regular_adulto");
    setFormPeriodicidad("mensual");
    setFormDescripcion("");
    setFormPrecio(30);
    setFormHoras(1);
    setFormClases(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: TarifaItem) => {
    setEditingTarifa(t);
    setFormNombre(t.nombre);
    setFormTipo(t.tipo);
    setFormPeriodicidad(t.periodicidad || (t.tipo === "matricula" ? "anual" : t.tipo === "bono" ? "puntual" : "mensual"));
    setFormDescripcion(t.descripcion);
    setFormPrecio(t.precio);
    setFormHoras(t.horas_semana || 1);
    setFormClases(t.clases_incluidas || 0);
    setIsModalOpen(true);
  };

  const handleSaveTarifa = (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = typeof formPrecio === "string" ? parseFloat(formPrecio) : formPrecio;
    if (!formNombre.trim() || isNaN(numericPrice) || numericPrice < 0) {
      setModal({
        isOpen: true,
        title: "Datos Incompletos",
        message: "Por favor, introduce un nombre y un precio válido (mayor o igual a 0).",
        type: "warning"
      });
      return;
    }

    let updated: TarifaItem[];
    if (editingTarifa) {
      updated = tarifas.map(item => item.id === editingTarifa.id ? {
        ...item,
        nombre: formNombre.trim(),
        tipo: formTipo,
        periodicidad: formPeriodicidad,
        descripcion: formDescripcion.trim(),
        precio: numericPrice,
        horas_semana: formTipo.startsWith("regular") ? Number(formHoras) : undefined,
        clases_incluidas: formTipo === "bono" ? Number(formClases) : undefined
      } : item);
      showToast("✓ Tarifa actualizada correctamente");
    } else {
      const nuevo: TarifaItem = {
        id: "tarifa_" + Date.now(),
        tipo: formTipo,
        periodicidad: formPeriodicidad,
        nombre: formNombre.trim(),
        descripcion: formDescripcion.trim(),
        precio: numericPrice,
        horas_semana: formTipo.startsWith("regular") ? Number(formHoras) : undefined,
        clases_incluidas: formTipo === "bono" ? Number(formClases) : undefined,
        activo: true
      };
      updated = [...tarifas, nuevo];
      showToast("✓ Nueva tarifa creada con éxito");
    }

    saveTarifas(updated);
    setTarifas(updated);
    setQuickPriceInputs(prev => ({ ...prev, ...(editingTarifa ? { [editingTarifa.id]: numericPrice.toString() } : {}) }));
    setIsModalOpen(false);

    logActivity({
      origen: "recepcion",
      tipo_evento: "edicion_alumno",
      descripcion: `Actualización en el catálogo de tarifas: ${formNombre} (${numericPrice.toFixed(2)}€)`,
      usuario_afectado: "Recepción / Admin",
      sede: "Ambas Sedes"
    });
  };

  const handleDeleteTarifa = (id: string, nombreTarifa: string) => {
    setModal({
      isOpen: true,
      title: "Eliminar Tarifa",
      message: `¿Estás seguro de que deseas eliminar la tarifa "${nombreTarifa}" del catálogo?`,
      type: "warning",
      showCancel: true,
      confirmText: "Sí, Eliminar",
      onConfirm: () => {
        const updated = tarifas.filter(t => t.id !== id);
        saveTarifas(updated);
        setTarifas(updated);
        showToast("Tarifa eliminada");
        logActivity({
          origen: "recepcion",
          tipo_evento: "edicion_alumno",
          descripcion: `Tarifa eliminada: ${nombreTarifa}`,
          usuario_afectado: "Recepción / Admin",
          sede: "Ambas Sedes"
        });
      }
    });
  };

  // Debounced Quick Price Change Handler
  const handleQuickPriceChange = (id: string, rawVal: string) => {
    setQuickPriceInputs(prev => ({ ...prev, [id]: rawVal }));

    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id]);
    }

    debounceTimers.current[id] = setTimeout(() => {
      const parsed = parseFloat(rawVal);
      if (!isNaN(parsed) && parsed >= 0) {
        const updated = tarifas.map(t => t.id === id ? { ...t, precio: parsed } : t);
        saveTarifas(updated);
        setTarifas(updated);
        showToast(`✓ Precio actualizado a ${parsed.toFixed(2)}€`);
      }
    }, 600);
  };

  const handleQuickPriceBlur = (id: string) => {
    const rawVal = quickPriceInputs[id];
    const parsed = parseFloat(rawVal || "0");
    const validPrice = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    
    setQuickPriceInputs(prev => ({ ...prev, [id]: validPrice.toString() }));
    const updated = tarifas.map(t => t.id === id ? { ...t, precio: validPrice } : t);
    saveTarifas(updated);
    setTarifas(updated);
  };

  const handleResetDefaults = () => {
    setModal({
      isOpen: true,
      title: "Restaurar Tarifas Oficiales",
      message: "¿Deseas restaurar todas las tarifas, precios de matrículas y bonos oficiales por defecto de Dance Factory?",
      type: "warning",
      showCancel: true,
      confirmText: "Restaurar Oficiales",
      onConfirm: () => {
        const defaults = resetTarifasDefault();
        setTarifas(defaults);
        const inputs: Record<string, string> = {};
        defaults.forEach(t => { inputs[t.id] = t.precio.toString(); });
        setQuickPriceInputs(inputs);
        showToast("✓ Tarifas oficiales restauradas");
      }
    });
  };

  const filteredTarifas = tarifas.filter(t => {
    if (activeCategory === "bonos") return t.tipo === "bono";
    if (activeCategory === "regular_infantil") return t.tipo === "regular_infantil";
    if (activeCategory === "regular_adulto") return t.tipo === "regular_adulto";
    if (activeCategory === "matricula") return t.tipo === "matricula";
    return true;
  });

  const bonosList = tarifas.filter(t => t.tipo === "bono");
  const infantilList = tarifas.filter(t => t.tipo === "regular_infantil");
  const adultosList = tarifas.filter(t => t.tipo === "regular_adulto");
  const matriculasList = tarifas.filter(t => t.tipo === "matricula");

  const getPeriodicidadLabel = (p?: PeriodicidadTarifa) => {
    switch (p) {
      case "anual": return "Anual";
      case "trimestral": return "Trimestral";
      case "puntual": return "Pago Único";
      default: return "Mensual";
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border)]">
        
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm flex-wrap">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === "all"
                ? "bg-[var(--color-primary)] text-white shadow-md"
                : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            Todas ({tarifas.length})
          </button>
          <button
            onClick={() => setActiveCategory("regular_adulto")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === "regular_adulto"
                ? "bg-[var(--color-primary)] text-white shadow-md"
                : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            👤 Clases Adultos ({adultosList.length})
          </button>
          <button
            onClick={() => setActiveCategory("regular_infantil")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === "regular_infantil"
                ? "bg-[var(--color-primary)] text-white shadow-md"
                : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            🧒 Clases Infantil ({infantilList.length})
          </button>
          <button
            onClick={() => setActiveCategory("bonos")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === "bonos"
                ? "bg-[var(--color-primary)] text-white shadow-md"
                : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            🎟️ Bonos & Pases ({bonosList.length})
          </button>
          <button
            onClick={() => setActiveCategory("matricula")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === "matricula"
                ? "bg-[var(--color-primary)] text-white shadow-md"
                : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            📝 Matrículas ({matriculasList.length})
          </button>
        </div>

        <div className="flex items-center gap-2.5 justify-end">
          <button
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] text-slate-300 hover:text-white text-xs font-bold border border-[var(--color-border)] transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Restablecer tarifas oficiales originales"
          >
            <RotateCcw size={14} />
            <span>Restaurar Oficiales</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:brightness-110 text-white text-xs font-extrabold transition-all shadow-md shadow-[var(--color-primary)]/30 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>Nueva Tarifa</span>
          </button>
        </div>

      </div>

      {/* TARIFF CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTarifas.map((t) => {
          const inputValue = quickPriceInputs[t.id] ?? t.precio.toString();

          return (
            <div 
              key={t.id}
              className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-5 shadow-lg relative group flex flex-col justify-between hover:border-[var(--color-primary)] transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${
                      t.tipo === "regular_adulto"
                        ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                        : t.tipo === "regular_infantil"
                        ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                        : t.tipo === "matricula"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    }`}>
                      {t.tipo === "regular_adulto" ? "Adulto (+14 años)" : t.tipo === "regular_infantil" ? "Infantil (hasta 14 años)" : t.tipo === "matricula" ? "Matrícula / Apertura" : "Bono / Pase"}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-slate-400">
                      {getPeriodicidadLabel(t.periodicidad)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEdit(t)}
                      className="p-1.5 rounded-lg bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] text-slate-300 hover:text-white border border-[var(--color-border)] transition-colors cursor-pointer"
                      title="Editar tarifa"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteTarifa(t.id, t.nombre)}
                      className="p-1.5 rounded-lg bg-[var(--color-bg)] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-[var(--color-border)] transition-colors cursor-pointer"
                      title="Eliminar tarifa"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <h4 className="text-base font-bold text-white leading-tight">{t.nombre}</h4>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">{t.descripcion}</p>
              </div>

              <div className="pt-4 mt-4 border-t border-[var(--color-border)] flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
                  {t.tipo === "matricula" ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-medium">
                      <FileCheck2 size={13} />
                      Inscripción Oficial
                    </span>
                  ) : t.horas_semana ? (
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-slate-400" />
                      {t.horas_semana} {t.horas_semana === 1 ? "hora/sem" : "horas/sem"}
                    </span>
                  ) : t.clases_incluidas ? (
                    <span className="flex items-center gap-1">
                      <Sparkles size={13} className="text-amber-400" />
                      {t.clases_incluidas} clases
                    </span>
                  ) : (
                    <span>Ilimitado</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Precio:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={inputValue}
                      onChange={(e) => handleQuickPriceChange(t.id, e.target.value)}
                      onBlur={() => handleQuickPriceBlur(t.id)}
                      className="w-20 px-2 py-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-white font-mono font-black text-sm text-right focus:outline-none focus:border-[var(--color-primary)]"
                    />
                    <span className="font-mono font-bold text-sm text-emerald-400">€</span>
                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-lg font-bold text-white">
                {editingTarifa ? "Editar Tarifa" : "Crear Nueva Tarifa"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTarifa} className="space-y-3.5 text-xs">
              
              <div>
                <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                  Nombre de la Tarifa / Matrícula *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. 1 hora / semana (Adultos), Matrícula Oficial, Bono 4 Clases..."
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                    Tipo de Tarifa
                  </label>
                  <select
                    value={formTipo}
                    onChange={(e) => {
                      const val = e.target.value as TipoTarifa;
                      setFormTipo(val);
                      if (val === "matricula") setFormPeriodicidad("anual");
                      else if (val === "bono") setFormPeriodicidad("puntual");
                      else setFormPeriodicidad("mensual");
                    }}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white font-semibold outline-none cursor-pointer"
                  >
                    <option value="regular_adulto">👤 Regular Adultos (+14 años)</option>
                    <option value="regular_infantil">🧒 Regular Infantil (hasta 14 años)</option>
                    <option value="bono">🎟️ Bono de Clases / Pase</option>
                    <option value="matricula">📝 Matrícula / Inscripción</option>
                    <option value="otro">📦 Otro Concepto</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                    Periodicidad de Cobro
                  </label>
                  <select
                    value={formPeriodicidad}
                    onChange={(e) => setFormPeriodicidad(e.target.value as PeriodicidadTarifa)}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white font-semibold outline-none cursor-pointer"
                  >
                    <option value="mensual">📅 Mensual</option>
                    <option value="trimestral">🗓️ Trimestral</option>
                    <option value="anual">🏆 Anual</option>
                    <option value="puntual">⚡ Pago Único / Puntual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                    Precio Final (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formPrecio}
                    onChange={(e) => setFormPrecio(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    placeholder="0.00"
                  />
                </div>

                {formTipo.startsWith("regular") && (
                  <div>
                    <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                      Horas Semanales
                    </label>
                    <select
                      value={formHoras}
                      onChange={(e) => setFormHoras(parseFloat(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white font-semibold outline-none cursor-pointer"
                    >
                      <option value="1">1 hora / semana</option>
                      <option value="1.5">1 hora y media (1.5h) / semana</option>
                      <option value="2">2 horas / semana</option>
                      <option value="3">3 horas / semana</option>
                      <option value="4">4 o más horas / semana</option>
                    </select>
                  </div>
                )}

                {formTipo === "bono" && (
                  <div>
                    <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                      Clases Incluidas
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formClases}
                      onChange={(e) => setFormClases(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white font-mono font-bold focus:outline-none"
                      placeholder="0 si ilimitado"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  placeholder="Información sobre la tarifa, condiciones o reserva de plaza..."
                  className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] text-slate-300 text-xs font-bold border border-[var(--color-border)] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold transition-all shadow-md shadow-[var(--color-primary)]/20 cursor-pointer"
                >
                  Guardar Tarifa
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
