import studentFeesData from "@/data/student_fees.json";

export type MetodoCobro = "Efectivo" | "TPV" | "Bizum" | "Transferencia" | "Stripe" | "SEPA" | "Pendiente Recepción";
export type SedePago = "tejar" | "castilla";
export type CategoriaConcepto = "mensualidad" | "matricula" | "bono" | "clase_suelta" | "merchandising" | "taller" | "otro";

export interface PagoTransaccion {
  id: string;
  numero_recibo: string;
  fecha_hora: string; // ISO string
  fecha_corta: string; // DD/MM/YYYY
  hora_corta: string; // HH:MM
  alumno_id?: string;
  alumno_nombre: string;
  alumno_dni?: string;
  alumno_telefono?: string;
  concepto: string;
  categoria: CategoriaConcepto;
  importe: number;
  metodo_pago: MetodoCobro;
  sede: SedePago;
  atendido_por: string;
  notas?: string;
  periodo_mes?: string; // e.g. "2026-09"
  estado: "Cobrado" | "Anulado" | "Devuelto" | "Pendiente";
}

export interface ArqueoSede {
  sede: SedePago;
  nombreSede: string;
  totalRecaudado: number;
  totalEfectivo: number;
  totalTPV: number;
  totalBizum: number;
  totalTransferencia: number;
  totalStripe: number;
  totalSEPA: number;
  numeroOperaciones: number;
}

export interface ConceptoRapidoConfig {
  id: string;
  titulo: string;
  categoria: CategoriaConcepto;
  importeSugerido?: number;
  esVariable?: boolean;
}

export const CONCEPTOS_RAPIDOS: ConceptoRapidoConfig[] = [
  { id: "mensualidad_regular", titulo: "Mensualidad Regular (Cuota Alumno)", categoria: "mensualidad", esVariable: true },
  { id: "matricula_anual", titulo: "Matrícula / Reserva de Plaza (Anticipo)", categoria: "matricula", importeSugerido: 20 },
  { id: "bono_10_open", titulo: "Bono 10 Clases Open Class", categoria: "bono", importeSugerido: 90 },
  { id: "bono_4_open", titulo: "Bono 4 Clases Open Class", categoria: "bono", importeSugerido: 45 },
  { id: "clase_suelta", titulo: "Clase Suelta / Prueba", categoria: "clase_suelta", importeSugerido: 12 },
  { id: "sudadera_oficial", titulo: "Sudadera Oficial DF (Black Edition)", categoria: "merchandising", importeSugerido: 32 },
  { id: "camiseta_oficial", titulo: "Camiseta DF 'Step & Flow'", categoria: "merchandising", importeSugerido: 16 },
  { id: "mochila_oficial", titulo: "Bolsa Deportiva DF Pro Duffel", categoria: "merchandising", importeSugerido: 24 },
  { id: "botella_oficial", titulo: "Botella Térmica Inox DF", categoria: "merchandising", importeSugerido: 12 },
  { id: "taller_masterclass", titulo: "Taller Intensivo / Masterclass", categoria: "taller", importeSugerido: 25 },
  { id: "concepto_libre", titulo: "Otro Concepto (Importe Libre)", categoria: "otro", esVariable: true }
];

const STORAGE_KEY = "df_pagos_transacciones_v1";

// Generate initial seed transactions (Recent counter payments + September SEPA simulated batch)
export function generateSeedTransactions(): PagoTransaccion[] {
  const transactions: PagoTransaccion[] = [];
  const today = new Date();
  const todayStr = today.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  const todayISO = today.toISOString();

  // 1. Some recent desk counter payments for TODAY
  transactions.push({
    id: "pago_today_1",
    numero_recibo: "REC-2026-0142",
    fecha_hora: todayISO,
    fecha_corta: todayStr,
    hora_corta: "17:15",
    alumno_id: "demo_1",
    alumno_nombre: "Laura Gómez Martín",
    alumno_dni: "50894721K",
    alumno_telefono: "654 987 123",
    concepto: "Sudadera Oficial DF (Black Edition) - Talla M",
    categoria: "merchandising",
    importe: 32.00,
    metodo_pago: "Efectivo",
    sede: "tejar",
    atendido_por: "Recepción Studio 1",
    notas: "Cobro en mostrador recepción",
    estado: "Cobrado"
  });

  transactions.push({
    id: "pago_today_2",
    numero_recibo: "REC-2026-0143",
    fecha_hora: todayISO,
    fecha_corta: todayStr,
    hora_corta: "17:45",
    alumno_id: "demo_2",
    alumno_nombre: "Carlos Menéndez Ruiz",
    alumno_dni: "09483726L",
    alumno_telefono: "611 223 344",
    concepto: "Bono 10 Clases Open Class",
    categoria: "bono",
    importe: 90.00,
    metodo_pago: "TPV",
    sede: "tejar",
    atendido_por: "Recepción Studio 1",
    notas: "Pago con tarjeta TPV mostrador",
    estado: "Cobrado"
  });

  transactions.push({
    id: "pago_today_3",
    numero_recibo: "REC-2026-0144",
    fecha_hora: todayISO,
    fecha_corta: todayStr,
    hora_corta: "18:10",
    alumno_id: "demo_3",
    alumno_nombre: "Lucía Fernández Santos",
    alumno_dni: "47382910M",
    alumno_telefono: "622 334 455",
    concepto: "Clase Suelta / Prueba Urban Dance",
    categoria: "clase_suelta",
    importe: 12.00,
    metodo_pago: "Bizum",
    sede: "castilla",
    atendido_por: "Recepción Studio 2",
    notas: "Bizum al 600 000 000",
    estado: "Cobrado"
  });

  transactions.push({
    id: "pago_today_4",
    numero_recibo: "REC-2026-0145",
    fecha_hora: todayISO,
    fecha_corta: todayStr,
    hora_corta: "18:30",
    alumno_id: "demo_4",
    alumno_nombre: "Adrián Morales Blanco",
    alumno_dni: "51829304N",
    alumno_telefono: "633 445 566",
    concepto: "Mensualidad Regular Septiembre (Ajuste -20€)",
    categoria: "mensualidad",
    importe: 21.00,
    metodo_pago: "Efectivo",
    sede: "castilla",
    atendido_por: "Recepción Studio 2",
    notas: "Abono en efectivo cuota mensual",
    estado: "Cobrado"
  });

  // 2. Simulated Monthly SEPA Remittance for September 1st, 2026
  let counter = 1;
  const feesMap = studentFeesData as Record<string, any>;
  
  Object.entries(feesMap).forEach(([key, entry]) => {
    if (key.startsWith("card_") || key.startsWith("email_")) return;
    const baseCuota = entry.cuota_base || 41;
    const netoSep = entry.neto_septiembre ?? Math.max(0, baseCuota - 20);
    const nombre = entry.nombre || key;
    const sede: SedePago = counter % 2 === 0 ? "tejar" : "castilla";
    const reciboNum = "REC-2026-" + String(counter).padStart(4, "0");

    transactions.push({
      id: "sepa_sep_" + counter,
      numero_recibo: reciboNum,
      fecha_hora: "2026-09-01T08:00:00.000Z",
      fecha_corta: "01/09/2026",
      hora_corta: "08:00",
      alumno_nombre: nombre,
      concepto: `Liquidación Cuota Septiembre 2026 (Base ${baseCuota}€ - 20€ Anticipo)`,
      categoria: "mensualidad",
      importe: netoSep,
      metodo_pago: "SEPA",
      sede,
      atendido_por: "Remesa Bancaria SEPA Automatizada",
      periodo_mes: "2026-09",
      notas: "Remesa bancaria periódica domiciliada Norma 19",
      estado: "Cobrado"
    });
    counter++;
  });

  return transactions;
}

export function getHistorialPagos(): PagoTransaccion[] {
  if (typeof window === "undefined") return generateSeedTransactions();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = generateSeedTransactions();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed: PagoTransaccion[] = JSON.parse(raw);
    // Purge test transactions for Fran Sarciat
    const clean = parsed.filter(p => 
      !p.alumno_nombre.toLowerCase().includes("fran sarciat") &&
      !p.concepto.toLowerCase().includes("fran sarciat")
    );
    if (clean.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    }
    return clean;
  } catch (e) {
    return generateSeedTransactions();
  }
}

export function eliminarPagosDeAlumno(nombreOrEmail: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const all: PagoTransaccion[] = JSON.parse(raw);
    const search = nombreOrEmail.toLowerCase().trim();
    const filtered = all.filter(p => 
      !p.alumno_nombre.toLowerCase().includes(search) &&
      !p.concepto.toLowerCase().includes(search)
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("df_pagos_updated"));
  } catch (e) {
    console.error("Error eliminando pagos de alumno:", e);
  }
}

export function saveHistorialPagos(pagos: PagoTransaccion[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pagos));
    window.dispatchEvent(new Event("df_pagos_updated"));
  } catch (e) {
    console.error("Error saving historial pagos:", e);
  }
}

export function registrarNuevoPago(data: {
  alumno_id?: string;
  alumno_nombre: string;
  alumno_dni?: string;
  alumno_telefono?: string;
  concepto: string;
  categoria: CategoriaConcepto;
  importe: number;
  metodo_pago: MetodoCobro;
  sede: SedePago;
  atendido_por?: string;
  notas?: string;
  periodo_mes?: string;
}): PagoTransaccion {
  const all = getHistorialPagos();
  const today = new Date();
  const nextNum = all.length + 1;
  const numero_recibo = "REC-2026-" + String(nextNum).padStart(4, "0");

  const nuevoPago: PagoTransaccion = {
    id: "pago_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    numero_recibo,
    fecha_hora: today.toISOString(),
    fecha_corta: today.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }),
    hora_corta: today.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    alumno_id: data.alumno_id,
    alumno_nombre: data.alumno_nombre.trim(),
    alumno_dni: data.alumno_dni?.trim() || undefined,
    alumno_telefono: data.alumno_telefono?.trim() || undefined,
    concepto: data.concepto.trim(),
    categoria: data.categoria,
    importe: data.importe,
    metodo_pago: data.metodo_pago,
    sede: data.sede,
    atendido_por: data.atendido_por || (data.sede === "tejar" ? "Recepción Studio 1" : "Recepción Studio 2"),
    notas: data.notas?.trim() || undefined,
    periodo_mes: data.periodo_mes,
    estado: "Cobrado"
  };

  const updated = [nuevoPago, ...all];
  saveHistorialPagos(updated);
  return nuevoPago;
}

export function anularPago(id: string): void {
  const all = getHistorialPagos();
  const updated = all.map(p => p.id === id ? { ...p, estado: "Anulado" as const } : p);
  saveHistorialPagos(updated);
}

export function cobrarPagoPendiente(alumnoId: string, details?: {
  metodo_pago?: MetodoCobro;
  sede?: SedePago;
  atendido_por?: string;
  importe?: number;
  notas?: string;
}): PagoTransaccion | null {
  const all = getHistorialPagos();
  const pendingIndex = all.findIndex(p => p.alumno_id === alumnoId && p.estado === "Pendiente");
  if (pendingIndex === -1) return null;

  const pending = all[pendingIndex];
  const nextNum = all.filter(p => p.estado === "Cobrado").length + 1;
  const numero_recibo = "REC-2026-" + String(nextNum).padStart(4, "0");

  const updated: PagoTransaccion = {
    ...pending,
    numero_recibo,
    metodo_pago: details?.metodo_pago || (pending.metodo_pago === "Pendiente Recepción" ? "Efectivo" : pending.metodo_pago),
    sede: details?.sede || pending.sede,
    atendido_por: details?.atendido_por || pending.atendido_por,
    importe: details?.importe !== undefined ? details.importe : pending.importe,
    notas: details?.notas || "Cobrado en mostrador de recepción",
    estado: "Cobrado"
  };

  all[pendingIndex] = updated;
  saveHistorialPagos(all);
  return updated;
}

export function getPagosByAlumno(alumnoId?: string, alumnoNombre?: string): PagoTransaccion[] {
  const all = getHistorialPagos();
  return all.filter(p => {
    if (alumnoId && p.alumno_id === alumnoId) return true;
    if (alumnoNombre && p.alumno_nombre && alumnoNombre.trim() && p.alumno_nombre.toLowerCase().includes(alumnoNombre.trim().toLowerCase())) return true;
    return false;
  });
}

export function calcularArqueoPorSede(pagos: PagoTransaccion[], fechaFiltro?: string): { tejar: ArqueoSede; castilla: ArqueoSede; consolidado: ArqueoSede } {
  const filterList = pagos.filter(p => {
    if (p.estado !== "Cobrado") return false;
    if (fechaFiltro && p.fecha_corta !== fechaFiltro) return false;
    return true;
  });

  const createEmpty = (sede: SedePago, nombreSede: string): ArqueoSede => ({
    sede,
    nombreSede,
    totalRecaudado: 0,
    totalEfectivo: 0,
    totalTPV: 0,
    totalBizum: 0,
    totalTransferencia: 0,
    totalStripe: 0,
    totalSEPA: 0,
    numeroOperaciones: 0
  });

  const tejar = createEmpty("tejar", "Studio 1 (Plaza El Tejar)");
  const castilla = createEmpty("castilla", "Studio 2 (Paseo Castilla)");

  filterList.forEach(p => {
    const target = p.sede === "tejar" ? tejar : castilla;
    target.totalRecaudado += p.importe;
    target.numeroOperaciones += 1;

    switch (p.metodo_pago) {
      case "Efectivo":
        target.totalEfectivo += p.importe;
        break;
      case "TPV":
        target.totalTPV += p.importe;
        break;
      case "Bizum":
        target.totalBizum += p.importe;
        break;
      case "Transferencia":
        target.totalTransferencia += p.importe;
        break;
      case "Stripe":
        target.totalStripe += p.importe;
        break;
      case "SEPA":
        target.totalSEPA += p.importe;
        break;
    }
  });

  const consolidado: ArqueoSede = {
    sede: "tejar",
    nombreSede: "Consolidado Total Dance Factory",
    totalRecaudado: tejar.totalRecaudado + castilla.totalRecaudado,
    totalEfectivo: tejar.totalEfectivo + castilla.totalEfectivo,
    totalTPV: tejar.totalTPV + castilla.totalTPV,
    totalBizum: tejar.totalBizum + castilla.totalBizum,
    totalTransferencia: tejar.totalTransferencia + castilla.totalTransferencia,
    totalStripe: tejar.totalStripe + castilla.totalStripe,
    totalSEPA: tejar.totalSEPA + castilla.totalSEPA,
    numeroOperaciones: tejar.numeroOperaciones + castilla.numeroOperaciones
  };

  return { tejar, castilla, consolidado };
}

export function exportarPagosCSV(pagos: PagoTransaccion[]): void {
  const headers = [
    "Numero Recibo",
    "Fecha",
    "Hora",
    "Alumno",
    "DNI",
    "Telefono",
    "Concepto",
    "Categoria",
    "Importe EUR",
    "Metodo Pago",
    "Sede",
    "Atendido Por",
    "Notas",
    "Estado"
  ];

  const rows = pagos.map(p => [
    p.numero_recibo,
    p.fecha_corta,
    p.hora_corta,
    `"${p.alumno_nombre.replace(/"/g, '""')}"`,
    p.alumno_dni || "",
    p.alumno_telefono || "",
    `"${p.concepto.replace(/"/g, '""')}"`,
    p.categoria,
    p.importe.toFixed(2),
    p.metodo_pago,
    p.sede === "tejar" ? "Studio 1 El Tejar" : "Studio 2 Paseo Castilla",
    `"${p.atendido_por.replace(/"/g, '""')}"`,
    `"${(p.notas || "").replace(/"/g, '""')}"`,
    p.estado
  ]);

  const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `dance_factory_historial_pagos_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
