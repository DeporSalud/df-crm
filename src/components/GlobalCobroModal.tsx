"use client";

import { useState, useEffect } from "react";
import { 
  DollarSign, 
  CreditCard, 
  Coins, 
  Smartphone, 
  Landmark, 
  Building2, 
  CheckCircle2, 
  X, 
  Printer, 
  Receipt, 
  Sparkles,
  Search,
  Plus,
  Zap,
  Calculator
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useSede } from "@/context/SedeContext";
import { getStudentFee } from "@/lib/studentFees";
import { 
  PagoTransaccion, 
  MetodoCobro, 
  SedePago, 
  CategoriaConcepto, 
  CONCEPTOS_RAPIDOS, 
  registrarNuevoPago 
} from "@/lib/pagosService";
import { isPromoSeptiembreActive } from "@/lib/matriculaService";
import { logActivity } from "@/lib/activityLogger";

export function openGlobalCobro(student?: any) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("df_open_cobro_terminal", { detail: student }));
  }
}

export default function GlobalCobroModal() {
  const { activeSede } = useSede();
  const [isOpen, setIsOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);

  // Form State
  const [searchStudentInput, setSearchStudentInput] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [formSede, setFormSede] = useState<SedePago>("tejar");
  const [formConcepto, setFormConcepto] = useState("Mensualidad Regular (Cuota Alumno)");
  const [formCategoria, setFormCategoria] = useState<CategoriaConcepto>("mensualidad");
  const [formImporte, setFormImporte] = useState<number>(21);
  const [formMetodo, setFormMetodo] = useState<MetodoCobro>("Efectivo");
  const [formNotas, setFormNotas] = useState("");
  const [efectivoEntregado, setEfectivoEntregado] = useState<string>("");

  // Receipt Modal State
  const [receiptData, setReceiptData] = useState<PagoTransaccion | null>(null);

  useEffect(() => {
    // Fetch students list for autocomplete
    const fetchStudents = async () => {
      const { data } = await supabase.from("alumnos").select("*").eq("estado", "Activo").order("nombre_completo", { ascending: true });
      if (data) setStudents(data);
    };
    fetchStudents();

    // Listen to global open event
    const handleOpenEvent = (e: any) => {
      const student = e.detail;
      if (student) {
        setSelectedStudent(student);
        setSearchStudentInput(student.nombre_completo || "");
        const feeInfo = getStudentFee(student);
        setFormImporte(feeInfo.netoSep);
        setFormConcepto(`Mensualidad Regular Septiembre 2026 (Base ${feeInfo.cuotaBase}€ - 20€ Anticipo)`);
        setFormCategoria("mensualidad");
        if (student.sede === "castilla" || student.sede === "tejar") {
          setFormSede(student.sede);
        }
      } else {
        setSelectedStudent(null);
        setSearchStudentInput("");
        setFormConcepto("Mensualidad Regular (Cuota Alumno)");
        setFormCategoria("mensualidad");
        setFormImporte(21);
      }
      setFormMetodo("Efectivo");
      setFormNotas("");
      setEfectivoEntregado("");
      setIsOpen(true);
    };

    window.addEventListener("df_open_cobro_terminal", handleOpenEvent);
    return () => {
      window.removeEventListener("df_open_cobro_terminal", handleOpenEvent);
    };
  }, []);

  // Update default sede from context if not chosen
  useEffect(() => {
    if (activeSede === "castilla" || activeSede === "tejar") {
      setFormSede(activeSede);
    }
  }, [activeSede]);

  // Select Quick Concept
  const handleSelectQuickConcept = (conceptoId: string) => {
    const config = CONCEPTOS_RAPIDOS.find(c => c.id === conceptoId);
    if (!config) return;

    setFormCategoria(config.categoria);

    if (conceptoId === "mensualidad_regular") {
      if (selectedStudent) {
        const feeInfo = getStudentFee(selectedStudent);
        setFormImporte(feeInfo.netoSep);
        setFormConcepto(`Mensualidad Regular Septiembre 2026 (Base ${feeInfo.cuotaBase}€ - 20€ Anticipo)`);
      } else {
        setFormImporte(21);
        setFormConcepto("Mensualidad Regular (Cuota Alumno)");
      }
    } else if (config.importeSugerido) {
      setFormImporte(config.importeSugerido);
      setFormConcepto(config.titulo);
    } else {
      setFormConcepto(config.titulo);
    }
  };

  // Select Student from Autocomplete
  const handleSelectStudent = (st: any) => {
    setSelectedStudent(st);
    setSearchStudentInput(st.nombre_completo);
    if (st.sede === "castilla" || st.sede === "tejar") {
      setFormSede(st.sede);
    }
    if (formCategoria === "mensualidad") {
      const feeInfo = getStudentFee(st);
      setFormImporte(feeInfo.netoSep);
      setFormConcepto(`Mensualidad Regular Septiembre 2026 (Base ${feeInfo.cuotaBase}€ - 20€ Anticipo)`);
    }
  };

  // Submit Cobro
  const handleSubmitCobro = (e: React.FormEvent) => {
    e.preventDefault();
    if (formImporte <= 0 && formConcepto.trim() === "") return;

    const nombrePagador = selectedStudent ? selectedStudent.nombre_completo : (searchStudentInput.trim() || "Cliente Mostrador");

    const nuevo = registrarNuevoPago({
      alumno_id: selectedStudent?.id,
      alumno_nombre: nombrePagador,
      alumno_dni: selectedStudent?.dni,
      alumno_telefono: selectedStudent?.telefono,
      concepto: formConcepto.trim() || "Cobro Mostrador",
      categoria: formCategoria,
      importe: Number(formImporte),
      metodo_pago: formMetodo,
      sede: formSede,
      atendido_por: formSede === "tejar" ? "Recepción Studio 1" : "Recepción Studio 2",
      notas: formNotas.trim() || undefined
    });

    logActivity({
      origen: "recepcion",
      tipo_evento: "cobro_bono",
      descripcion: `Cobro en mostrador: ${formConcepto} (${formImporte}€ por ${formMetodo})`,
      usuario_afectado: nombrePagador,
      sede: formSede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
    });

    setIsOpen(false);
    setReceiptData(nuevo);
  };

  const matchingStudents = searchStudentInput.trim().length > 1
    ? students.filter(s => 
        (s.nombre_completo || "").toLowerCase().includes(searchStudentInput.toLowerCase()) ||
        (s.dni || "").toLowerCase().includes(searchStudentInput.toLowerCase()) ||
        (s.telefono || "").includes(searchStudentInput)
      ).slice(0, 5)
    : [];

  const cambioEfectivo = efectivoEntregado && parseFloat(efectivoEntregado) > formImporte
    ? (parseFloat(efectivoEntregado) - formImporte).toFixed(2)
    : null;

  return (
    <>
      {/* FLOATING ACTION BUTTON - ICON ONLY CALCULATOR */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => {
            setSelectedStudent(null);
            setSearchStudentInput("");
            setFormConcepto("Mensualidad Regular (Cuota Alumno)");
            setFormCategoria("mensualidad");
            setFormImporte(21);
            setFormMetodo("Efectivo");
            setFormNotas("");
            setEfectivoEntregado("");
            setIsOpen(true);
          }}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] via-indigo-600 to-[var(--color-accent)] hover:brightness-110 text-white flex items-center justify-center shadow-2xl shadow-[var(--color-primary)]/40 border border-white/25 transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer group"
          title="Terminal de Cobro Rápido en Recepción"
        >
          <Calculator size={26} className="text-white group-hover:scale-110 transition-transform drop-shadow-md" />
        </button>
      </div>

      {/* COBRO MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-[var(--color-bg)] text-slate-400 hover:text-white border border-[var(--color-border)] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="pr-8">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-secondary)]">
                TERMINAL DE RECEPCIÓN
              </span>
              <h2 className="text-xl font-bold text-white mt-0.5">
                Registrar Cobro en Mostrador
              </h2>
            </div>

            <form onSubmit={handleSubmitCobro} className="space-y-4">
              
              {/* 1. Seleccionar Alumno */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-white uppercase tracking-wider block">
                  1. Alumno / Pagador <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Escribe para buscar alumno (nombre, DNI, teléfono)..."
                    value={searchStudentInput}
                    onChange={(e) => {
                      setSearchStudentInput(e.target.value);
                      setSelectedStudent(null);
                    }}
                    className="w-full pl-3.5 pr-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs focus:outline-none focus:border-[var(--color-primary)] placeholder:text-slate-500"
                  />
                  {selectedStudent && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      ✓ Seleccionado
                    </span>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {matchingStudents.length > 0 && !selectedStudent && (
                  <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-1.5 space-y-1 shadow-xl max-h-40 overflow-y-auto">
                    {matchingStudents.map(st => {
                      const feeInfo = getStudentFee(st);
                      return (
                        <div
                          key={st.id}
                          onClick={() => handleSelectStudent(st)}
                          className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] cursor-pointer flex items-center justify-between transition-colors text-xs"
                        >
                          <div>
                            <span className="font-bold text-white block">{st.nombre_completo}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{st.dni || "Sin DNI"} • {st.telefono}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-[var(--color-secondary)] block">{feeInfo.netoSep} €</span>
                            <span className="text-[9px] text-slate-400">{st.sede === "castilla" ? "Studio 2" : "Studio 1"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Sede del Cobro */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-white uppercase tracking-wider block">
                  2. Sede donde se realiza el cobro
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormSede("tejar")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      formSede === "tejar"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md"
                        : "bg-[var(--color-bg)] text-slate-400 border-[var(--color-border)] hover:border-slate-600"
                    }`}
                  >
                    <Building2 size={14} />
                    <span>Studio 1 (El Tejar)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormSede("castilla")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      formSede === "castilla"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md"
                        : "bg-[var(--color-bg)] text-slate-400 border-[var(--color-border)] hover:border-slate-600"
                    }`}
                  >
                    <Building2 size={14} />
                    <span>Studio 2 (Paseo Castilla)</span>
                  </button>
                </div>
              </div>

              {/* 3. Conceptos Rápidos */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-white uppercase tracking-wider block">
                  3. Conceptos Rápidos
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {CONCEPTOS_RAPIDOS.filter(c => !c.id.startsWith("promo_sep_") || isPromoSeptiembreActive()).slice(0, 12).map(c => {
                    const isPromo = c.id.startsWith("promo_sep_");
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectQuickConcept(c.id)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                          isPromo
                            ? "bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
                            : "bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] border-[var(--color-border)] hover:border-[var(--color-secondary)] text-slate-300"
                        }`}
                      >
                        {c.titulo.split("(")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Concepto & Importe */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-white uppercase tracking-wider block">
                    Concepto Detallado
                  </label>
                  <input
                    type="text"
                    required
                    value={formConcepto}
                    onChange={(e) => setFormConcepto(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-white uppercase tracking-wider block">
                    Importe (€) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formImporte}
                    onChange={(e) => setFormImporte(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-base font-bold font-mono text-[var(--color-secondary)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              {/* 4. Método de Pago */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-white uppercase tracking-wider block">
                  4. Método de Cobro en Mostrador
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormMetodo("Efectivo")}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      formMetodo === "Efectivo"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md"
                        : "bg-[var(--color-bg)] text-slate-400 border-[var(--color-border)] hover:border-slate-600"
                    }`}
                  >
                    <Coins size={18} />
                    <span>💵 Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormMetodo("TPV")}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      formMetodo === "TPV"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md"
                        : "bg-[var(--color-bg)] text-slate-400 border-[var(--color-border)] hover:border-slate-600"
                    }`}
                  >
                    <CreditCard size={18} />
                    <span>💳 Tarjeta TPV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormMetodo("Bizum")}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      formMetodo === "Bizum"
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-md"
                        : "bg-[var(--color-bg)] text-slate-400 border-[var(--color-border)] hover:border-slate-600"
                    }`}
                  >
                    <Smartphone size={18} />
                    <span>📱 Bizum</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormMetodo("Transferencia")}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      formMetodo === "Transferencia"
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-md"
                        : "bg-[var(--color-bg)] text-slate-400 border-[var(--color-border)] hover:border-slate-600"
                    }`}
                  >
                    <Landmark size={18} />
                    <span>🏦 Transferencia</span>
                  </button>
                </div>
              </div>

              {/* Calculadora de Cambio si es Efectivo */}
              {formMetodo === "Efectivo" && (
                <div className="p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-semibold">Importe entregado:</span>
                    <input
                      type="number"
                      step="1"
                      placeholder="ej. 50"
                      value={efectivoEntregado}
                      onChange={(e) => setEfectivoEntregado(e.target.value)}
                      className="w-20 px-2 py-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-white font-mono text-xs focus:outline-none"
                    />
                  </div>
                  {cambioEfectivo && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Cambio a devolver:</span>
                      <span className="font-mono font-extrabold text-sm text-emerald-400">{cambioEfectivo} €</span>
                    </div>
                  )}
                </div>
              )}

              {/* Notas opcionales */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white uppercase tracking-wider block">
                  Notas / Nº de Operación (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="ej. Nº autorización datáfono o justificante Bizum..."
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-white text-xs focus:outline-none focus:border-[var(--color-primary)] placeholder:text-slate-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] text-xs font-bold text-slate-400 hover:text-white border border-[var(--color-border)] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-xs font-bold text-white transition-all shadow-lg shadow-[var(--color-primary)]/25 flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  <span>Confirmar y Emitir Recibo</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {receiptData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-[#0e1628] border border-[var(--color-border)] rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl relative text-white">
            
            <button
              onClick={() => setReceiptData(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-[var(--color-bg)] text-slate-400 hover:text-white border border-[var(--color-border)] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Recibo Header */}
            <div className="text-center space-y-1 border-b border-white/10 pb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white flex items-center justify-center font-[family-name:var(--font-heading)] text-lg mx-auto mb-1">
                DF
              </div>
              <h2 className="text-lg font-extrabold tracking-wide font-[family-name:var(--font-heading)]">DANCE FACTORY</h2>
              <p className="text-[10px] text-slate-400 font-mono">
                {receiptData.sede === "tejar" ? "Studio 1: Plaza El Tejar, Alcorcón" : "Studio 2: Paseo Castilla, Alcorcón"}
              </p>
              <div className="pt-2">
                <span className="text-xs font-mono font-bold text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-3 py-0.5 rounded-full border border-[var(--color-secondary)]/30">
                  RECIBO OFICIAL: {receiptData.numero_recibo}
                </span>
              </div>
            </div>

            {/* Recibo Body */}
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Fecha y Hora:</span>
                <span className="font-mono font-semibold">{receiptData.fecha_corta} • {receiptData.hora_corta}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Alumno / Titular:</span>
                <span className="font-bold text-white">{receiptData.alumno_nombre}</span>
              </div>

              {receiptData.alumno_dni && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">DNI / NIE:</span>
                  <span className="font-mono">{receiptData.alumno_dni}</span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Concepto:</span>
                <span className="font-semibold text-right max-w-[220px]">{receiptData.concepto}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Método de Cobro:</span>
                <span className="font-bold text-cyan-400">{receiptData.metodo_pago}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Atendido por:</span>
                <span className="text-slate-300">{receiptData.atendido_por}</span>
              </div>

              {/* Total Box */}
              <div className="p-4 rounded-2xl bg-black/40 border border-emerald-500/30 flex items-center justify-between mt-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Total Abonado</span>
                <span className="text-2xl font-mono font-extrabold text-emerald-400">
                  {receiptData.importe.toFixed(2)} €
                </span>
              </div>

              <div className="text-center pt-2 text-[10px] text-slate-500">
                ✓ Justificante de pago válido emitido por el sistema de gestión Dance Factory.
              </div>
            </div>

            {/* Print Action */}
            <div className="pt-2 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Printer size={15} />
                <span>Imprimir Recibo</span>
              </button>
              <button
                onClick={() => setReceiptData(null)}
                className="px-4 py-2.5 rounded-xl bg-[var(--color-bg)] hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
