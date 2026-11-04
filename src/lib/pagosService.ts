import studentFeesData from "@/data/student_fees.json";
import { publishSyncEvent } from "@/lib/syncEventBus";
import { supabase } from "@/lib/supabase/client";
import {
  upsertStudentPagoInDireccion,
  updateStudentPagosListInDireccion,
} from "@/lib/teacherRegistryService";

const FALLBACK_LEDGER_ROW_ID = "7a101100-0000-4000-a000-000000001011";

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
}

export function isFakeDemoTransaction(p?: Partial<PagoTransaccion> | null): boolean {
  if (!p) return false;
  const id = String(p.id || "");
  const alumnoId = String(p.alumno_id || "");
  if (id.startsWith("pago_today_")) return true;
  if (alumnoId.startsWith("demo_")) return true;
  return false;
}

export function sortPagosDesc(pagos: PagoTransaccion[]): PagoTransaccion[] {
  return [...pagos].sort((a, b) => {
    const tB = a && b && b.fecha_hora ? new Date(b.fecha_hora).getTime() : 0;
    const tA = a && a.fecha_hora ? new Date(a.fecha_hora).getTime() : 0;
    if (!isNaN(tB) && !isNaN(tA) && tB !== tA) return tB - tA;
    return String(b?.numero_recibo || "").localeCompare(String(a?.numero_recibo || ""));
  });
}

export async function persistPagoToSupabaseCloud(pago: PagoTransaccion): Promise<void> {
  try {
    const targetId = isValidUUID(pago.alumno_id) ? pago.alumno_id!.trim() : FALLBACK_LEDGER_ROW_ID;
    const { data: row } = await supabase
      .from("alumnos")
      .select("id, direccion")
      .eq("id", targetId)
      .maybeSingle();

    if (row) {
      const nextDir = upsertStudentPagoInDireccion(row.direccion, pago);
      await supabase.from("alumnos").update({ direccion: nextDir }).eq("id", row.id);
      return;
    }

    if (targetId !== FALLBACK_LEDGER_ROW_ID) {
      const { data: fallbackRow } = await supabase
        .from("alumnos")
        .select("id, direccion")
        .eq("id", FALLBACK_LEDGER_ROW_ID)
        .maybeSingle();
      if (fallbackRow) {
        const nextDir = upsertStudentPagoInDireccion(fallbackRow.direccion, pago);
        await supabase.from("alumnos").update({ direccion: nextDir }).eq("id", FALLBACK_LEDGER_ROW_ID);
      }
    }
  } catch (err) {
    console.warn("[PagosCloud] Warning syncing payment to Supabase:", err);
  }
}

export async function persistBatchPagosToSupabaseCloud(pagos: PagoTransaccion[]): Promise<void> {
  if (!pagos || pagos.length === 0) return;
  try {
    const byTarget = new Map<string, PagoTransaccion[]>();
    for (const p of pagos) {
      const targetId = isValidUUID(p.alumno_id) ? p.alumno_id!.trim() : FALLBACK_LEDGER_ROW_ID;
      const list = byTarget.get(targetId) || [];
      list.push(p);
      byTarget.set(targetId, list);
    }

    const entries = Array.from(byTarget.entries());
    const CHUNK = 20;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const slice = entries.slice(i, i + CHUNK);
      const ids = slice.map(([id]) => id);
      const { data: rows } = await supabase
        .from("alumnos")
        .select("id, direccion")
        .in("id", ids);

      const dirMap = new Map<string, string | null>();
      for (const r of rows || []) {
        dirMap.set(r.id, r.direccion || null);
      }

      await Promise.all(
        slice.map(async ([targetId, txList]) => {
          if (!dirMap.has(targetId)) return;
          let dir = dirMap.get(targetId) || "";
          for (const tx of txList) {
            dir = upsertStudentPagoInDireccion(dir, tx);
          }
          await supabase.from("alumnos").update({ direccion: dir }).eq("id", targetId);
        })
      );
    }
  } catch (err) {
    console.warn("[PagosCloud] Warning batch-syncing payments to Supabase:", err);
  }
}

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
  { id: "matricula_octubre_50", titulo: "Matrícula 50% Renovación Octubre (Bono Sep)", categoria: "matricula", importeSugerido: 7.5 },
  { id: "matricula_open_15", titulo: "Matrícula Anual Open Class (1er Bono)", categoria: "matricula", importeSugerido: 15 },
  { id: "exencion_matricula_0", titulo: "Exención Matrícula (0,00€ - Autorizado)", categoria: "matricula", importeSugerido: 0 },
  { id: "bono_4_sin_mat", titulo: "Bono 4 Clases (45€ - Sin Matrícula)", categoria: "bono", importeSugerido: 45 },
  { id: "bono_8_sin_mat", titulo: "Bono 8 Clases (57€ - Sin Matrícula)", categoria: "bono", importeSugerido: 57 },
  { id: "bono_10_sin_mat", titulo: "Bono 10 Clases (79€ - Sin Matrícula)", categoria: "bono", importeSugerido: 79 },
  { id: "promo_sep_4_alumno", titulo: "Promo Sep 4 Clases (Alumno DF)", categoria: "bono", importeSugerido: 25 },
  { id: "promo_sep_8_alumno", titulo: "Promo Sep 8 Clases (Alumno DF)", categoria: "bono", importeSugerido: 35 },
  { id: "promo_sep_12_alumno", titulo: "Promo Sep 12 Clases (Alumno DF)", categoria: "bono", importeSugerido: 45 },
  { id: "promo_sep_4_no_alumno", titulo: "Promo Sep 4 Clases (No Alumno)", categoria: "bono", importeSugerido: 30 },
  { id: "promo_sep_8_no_alumno", titulo: "Promo Sep 8 Clases (No Alumno)", categoria: "bono", importeSugerido: 42 },
  { id: "promo_sep_12_no_alumno", titulo: "Promo Sep 12 Clases (No Alumno)", categoria: "bono", importeSugerido: 55 },
  { id: "bono_4_open", titulo: "Bono 4 Clases Open Class", categoria: "bono", importeSugerido: 45 },
  { id: "bono_8_open", titulo: "Bono 8 Clases Open Class", categoria: "bono", importeSugerido: 57 },
  { id: "bono_10_open", titulo: "Bono 10 Clases Open Class", categoria: "bono", importeSugerido: 79 },
  { id: "clase_suelta", titulo: "Clase Suelta / Prueba", categoria: "clase_suelta", importeSugerido: 15 },
  { id: "sudadera_oficial", titulo: "Sudadera Oficial DF (Black Edition)", categoria: "merchandising", importeSugerido: 32 },
  { id: "camiseta_oficial", titulo: "Camiseta DF 'Step & Flow'", categoria: "merchandising", importeSugerido: 16 },
  { id: "mochila_oficial", titulo: "Bolsa Deportiva DF Pro Duffel", categoria: "merchandising", importeSugerido: 24 },
  { id: "botella_oficial", titulo: "Botella Térmica Inox DF", categoria: "merchandising", importeSugerido: 12 },
  { id: "taller_masterclass", titulo: "Taller Intensivo / Masterclass", categoria: "taller", importeSugerido: 25 },
  { id: "concepto_libre", titulo: "Otro Concepto (Importe Libre)", categoria: "otro", esVariable: true }
];

const STORAGE_KEY = "df_pagos_transacciones_v1";

export const VERIFIED_STRIPE_TRANSACTIONS: PagoTransaccion[] = [
  {
    id: "stripe_cs_live_a1h08PbOy9NgYJ407Z3bTIoqKy1rQFOv5crSGdLouOmLe3oF8wMqT2ez8W",
    numero_recibo: "STRIPE-2EZ8W",
    fecha_hora: "2026-09-11T11:57:52.000Z",
    fecha_corta: "11/09/2026",
    hora_corta: "13:57",
    alumno_id: "a6d11d42-ea44-4f53-9158-8cd682ed6ff0",
    alumno_nombre: "Nagore González Rodríguez",
    concepto: "Promo Septiembre • 8 Clases (No Alumno)",
    categoria: "bono",
    importe: 42.00,
    metodo_pago: "Stripe",
    sede: "castilla",
    atendido_por: "Pasarela Online Stripe",
    notas: "ID Sesión: cs_live_a1h08PbOy9NgYJ407Z3bTIoqKy1rQFOv5crSGdLouOmLe3oF8wMqT2ez8W | Titular: Isabel Rodriguez | Email: nagoreeettt@gmail.com",
    periodo_mes: "2026-09",
    estado: "Cobrado"
  },
  {
    id: "stripe_cs_live_a1oPkjZ1cmdo3hnLduMMantnmRGQG6Jf5DcRTlxHoPayCHZgb5utVTxIhC",
    numero_recibo: "STRIPE-VTIHC",
    fecha_hora: "2026-09-11T11:39:07.000Z",
    fecha_corta: "11/09/2026",
    hora_corta: "13:39",
    alumno_id: "e43b3444-b1ce-4354-8867-a0132b0cc2fa",
    alumno_nombre: "Sara Gutiérrez Villanueva",
    concepto: "Promo Septiembre • 8 Clases (No Alumno)",
    categoria: "bono",
    importe: 42.00,
    metodo_pago: "Stripe",
    sede: "castilla",
    atendido_por: "Pasarela Online Stripe",
    notas: "ID Sesión: cs_live_a1oPkjZ1cmdo3hnLduMMantnmRGQG6Jf5DcRTlxHoPayCHZgb5utVTxIhC | Email: gutierrezvillanuevasara03@gmail.com",
    periodo_mes: "2026-09",
    estado: "Cobrado"
  },
  {
    id: "stripe_cs_live_a1PrBXsfuDVKTuyZ5o1OC1dX5E1nzNg6MNQiotiy8nO7EXa8gtfkzENpRf",
    numero_recibo: "STRIPE-ENPRF",
    fecha_hora: "2026-09-10T15:39:00.000Z",
    fecha_corta: "10/09/2026",
    hora_corta: "17:39",
    alumno_id: "1c79011b-c0a7-4019-a43d-cdfd049a3c8e",
    alumno_nombre: "Zaira Cristina Rius Seco",
    concepto: "Promo Septiembre • 4 Clases (No Alumno)",
    categoria: "bono",
    importe: 30.00,
    metodo_pago: "Stripe",
    sede: "castilla",
    atendido_por: "Pasarela Online Stripe",
    notas: "ID Sesión: cs_live_a1PrBXsfuDVKTuyZ5o1OC1dX5E1nzNg6MNQiotiy8nO7EXa8gtfkzENpRf | Email: zahirar1820@gmail.com",
    periodo_mes: "2026-09",
    estado: "Cobrado"
  },
  {
    id: "stripe_cs_live_a1EgAt3CLXBrPYlZJ69PnndPtY2Agc1ppOcEDsTMucp1YlRm7OVoyZ3srB",
    numero_recibo: "STRIPE-Z3SRB",
    fecha_hora: "2026-09-10T15:15:00.000Z",
    fecha_corta: "10/09/2026",
    hora_corta: "17:15",
    alumno_id: "ed7cc9f5-a40a-435a-969e-7103911192ea",
    alumno_nombre: "Sara Romero Rodríguez",
    concepto: "Promo Septiembre • 4 Clases (No Alumno)",
    categoria: "bono",
    importe: 30.00,
    metodo_pago: "Stripe",
    sede: "castilla",
    atendido_por: "Pasarela Online Stripe",
    notas: "ID Sesión: cs_live_a1EgAt3CLXBrPYlZJ69PnndPtY2Agc1ppOcEDsTMucp1YlRm7OVoyZ3srB | Email: sromer0rodr1@gmail.com",
    periodo_mes: "2026-09",
    estado: "Cobrado"
  },
  {
    id: "stripe_cs_live_a19e5tFzalE45jcEeIQQyeLBLfhTlSkMI6XPUafFDjRUqM2rs7bar0dcdM",
    numero_recibo: "STRIPE-0DCDM",
    fecha_hora: "2026-09-09T17:22:00.000Z",
    fecha_corta: "09/09/2026",
    hora_corta: "19:22",
    alumno_id: "2d95e851-b927-494b-9558-d7ed6d447a20",
    alumno_nombre: "Lucía Zamorano",
    concepto: "Clase Suelta Open Class",
    categoria: "clase_suelta",
    importe: 15.00,
    metodo_pago: "Stripe",
    sede: "castilla",
    atendido_por: "Pasarela Online Stripe",
    notas: "ID Sesión: cs_live_a19e5tFzalE45jcEeIQQyeLBLfhTlSkMI6XPUafFDjRUqM2rs7bar0dcdM | Email: luciaza0509@gmail.com",
    periodo_mes: "2026-09",
    estado: "Cobrado"
  }
];

// Generate initial seed transactions (Verified Stripe fallback + September SEPA batch, ZERO fake demo rows)
export function generateSeedTransactions(): PagoTransaccion[] {
  const transactions: PagoTransaccion[] = [...VERIFIED_STRIPE_TRANSACTIONS];

  // Historical Monthly SEPA Remittance for September 1st, 2026
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

  return sortPagosDesc(transactions);
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
    const list = parsed.filter(p => !isFakeDemoTransaction(p));
    let updated = list.length !== parsed.length;
    for (const vStripe of VERIFIED_STRIPE_TRANSACTIONS) {
      const exists = list.some(p => p.id === vStripe.id || p.numero_recibo === vStripe.numero_recibo);
      if (!exists) {
        list.unshift(vStripe);
        updated = true;
      }
    }
    const sorted = sortPagosDesc(list);
    if (updated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    }
    return sorted;
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
    publishSyncEvent("df_pagos_updated", { count: filtered.length, timestamp: Date.now() });
  } catch (e) {
    console.error("Error eliminando pagos de alumno:", e);
  }
}

export interface SeasonMonthOption {
  value: string;
  monthTitle: string;
  historialLabel: string;
  remesaLabel: string;
}

export const SEASON_BILLING_MONTHS: SeasonMonthOption[] = [
  { value: "2026-09", monthTitle: "Septiembre 2026", historialLabel: "🍂 Septiembre 2026", remesaLabel: "Septiembre 2026 (Cuota Ajustada -20€)" },
  { value: "2026-10", monthTitle: "Octubre 2026", historialLabel: "🍁 Octubre 2026", remesaLabel: "Octubre 2026 (Cuota Completa)" },
  { value: "2026-11", monthTitle: "Noviembre 2026", historialLabel: "🗓️ Noviembre 2026", remesaLabel: "Noviembre 2026 (Cuota Completa)" },
  { value: "2026-12", monthTitle: "Diciembre 2026", historialLabel: "🎄 Diciembre 2026", remesaLabel: "Diciembre 2026 (Cuota Completa)" },
  { value: "2027-01", monthTitle: "Enero 2027", historialLabel: "❄️ Enero 2027", remesaLabel: "Enero 2027 (Cuota Completa)" },
  { value: "2027-02", monthTitle: "Febrero 2027", historialLabel: "🎭 Febrero 2027", remesaLabel: "Febrero 2027 (Cuota Completa)" },
  { value: "2027-03", monthTitle: "Marzo 2027", historialLabel: "🌸 Marzo 2027", remesaLabel: "Marzo 2027 (Cuota Completa)" },
  { value: "2027-04", monthTitle: "Abril 2027", historialLabel: "🌷 Abril 2027", remesaLabel: "Abril 2027 (Cuota Completa)" },
  { value: "2027-05", monthTitle: "Mayo 2027", historialLabel: "☀️ Mayo 2027", remesaLabel: "Mayo 2027 (Cuota Completa)" },
  { value: "2027-06", monthTitle: "Junio 2027", historialLabel: "🎓 Junio 2027", remesaLabel: "Junio 2027 (Cuota Completa)" }
];

export const MONTH_KEYWORDS_BY_NUM: Record<string, string[]> = {
  "01": ["enero", "ene"],
  "02": ["febrero", "feb"],
  "03": ["marzo", "mar"],
  "04": ["abril", "abr"],
  "05": ["mayo", "may"],
  "06": ["junio", "jun"],
  "07": ["julio", "jul"],
  "08": ["agosto", "ago"],
  "09": ["septiembre", "sep"],
  "10": ["octubre", "oct"],
  "11": ["noviembre", "nov"],
  "12": ["diciembre", "dic"]
};

export function getSeasonMonthTitle(periodoMes: string): string {
  const found = SEASON_BILLING_MONTHS.find(m => m.value === periodoMes);
  if (found) return found.monthTitle;
  const [y, m] = (periodoMes || "").split("-");
  const monthMap: Record<string, string> = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
    "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
  };
  return monthMap[m] && y ? `${monthMap[m]} ${y}` : periodoMes;
}

/**
 * Selects the active/upcoming billing month dynamically:
 * - Day >= 25 -> next month (e.g. Oct 27 -> "2026-11")
 * - Day < 25  -> current YYYY-MM
 * - Bounded within season 2026-09 .. 2027-06 (fallback "2026-11")
 */
export function getDefaultRemesaMonth(referenceDate?: Date): string {
  try {
    let year: number;
    let month: number;
    let day: number;

    const T = (globalThis as any).Temporal;
    if (!referenceDate && T && T.Now && typeof T.Now.plainDateISO === "function") {
      const todayPlain = T.Now.plainDateISO("Europe/Madrid");
      day = todayPlain.day;
      const targetYm = day >= 25
        ? todayPlain.toPlainYearMonth().add({ months: 1 })
        : todayPlain.toPlainYearMonth();
      const candidate = `${targetYm.year}-${String(targetYm.month).padStart(2, "0")}`;
      return candidate >= "2026-09" && candidate <= "2027-06" ? candidate : "2026-11";
    }

    const now = referenceDate || new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
    day = now.getDate();

    if (day >= 25) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    const candidate = `${year}-${String(month).padStart(2, "0")}`;
    if (candidate >= "2026-09" && candidate <= "2027-06") {
      return candidate;
    }
    return "2026-11";
  } catch {
    return "2026-11";
  }
}

export function normalizeSedePago(sede?: string | null): SedePago {
  return ["castilla", "alcorcon", "studio 2"].includes((sede || "").toLowerCase().trim())
    ? "castilla"
    : "tejar";
}

function normalizeIdentityText(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function saveHistorialPagos(pagos: PagoTransaccion[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pagos));
    publishSyncEvent("df_pagos_updated", { count: pagos.length, timestamp: Date.now() });
  } catch (e) {
    console.error("Error saving historial pagos:", e);
  }
}

export function generarNumeroRecibo(seq: number, year: number = 2026): string {
  return `REC-${year}-${String(seq).padStart(4, "0")}`;
}

export function getMaxReciboSequence(pagos: PagoTransaccion[]): number {
  let maxSeq = 0;
  for (const p of pagos) {
    if (!p.numero_recibo) continue;
    const match = p.numero_recibo.match(/^REC-2026-(\d+)$/i) || p.numero_recibo.match(/^REC-\d{4}-(\d+)$/i);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }
  return maxSeq;
}

export interface RemesaContableItem {
  alumno_id: string;
  alumno_nombre: string;
  alumno_dni?: string;
  alumno_telefono?: string;
  sede?: string;
  importe: number;
  cuota_base?: number;
  anticipo?: number;
  clase_nombre?: string;
  concepto?: string;
}

export interface ContabilizarRemesaResult {
  created: PagoTransaccion[];
  createdCount: number;
  skippedDuplicateCount: number;
  totalAmountCreated: number;
  tejarCount: number;
  tejarAmount: number;
  castillaCount: number;
  castillaAmount: number;
  periodoMes: string;
}

/**
 * Canonical student identity matcher (sibling-safe):
 * - If BOTH `student.id` and `p.alumno_id` exist and are non-empty, identity is decided
 *   EXCLUSIVELY by `p.alumno_id.trim() === student.id.trim()` (returns `false` immediately
 *   when UUIDs differ, even if two minor sisters share their mother/father's DNI).
 * - Fallback by normalized `nombre_completo` is used ONLY when either `p.alumno_id` or `student.id`
 *   is missing (e.g. legacy seed records or manual desk entries without student ID).
 */
export function doesPaymentMatchStudent(
  p: { alumno_id?: string | null; alumno_nombre?: string | null },
  student: { id?: string | null; nombre_completo?: string | null }
): boolean {
  const stuId = (student?.id || "").trim();
  const payId = (p?.alumno_id || "").trim();
  if (stuId && payId) {
    return payId === stuId;
  }
  const stuName = normalizeIdentityText(student?.nombre_completo);
  const payName = normalizeIdentityText(p?.alumno_nombre);
  return Boolean(stuName && payName && payName === stuName);
}

/**
 * Checks whether an existing payment is an active ("Cobrado") monthly fee for targetMonth
 * matching the student via canonical sibling-safe identity (`doesPaymentMatchStudent`).
 */
export function hasExistingMonthlyPaymentForPeriod(
  pagos: PagoTransaccion[],
  candidate: { id?: string; dni?: string; nombre_completo?: string },
  periodoMes: string
): boolean {
  const [targetYear, targetMonth] = (periodoMes || "").split("-");
  const keywords = MONTH_KEYWORDS_BY_NUM[targetMonth] || [];

  return pagos.some(p => {
    if (p.estado !== "Cobrado") return false;
    if (p.categoria !== "mensualidad") return false;

    if (!doesPaymentMatchStudent(p, candidate)) return false;

    // Strict accounting rule: if p.periodo_mes is defined, match strictly against periodoMes
    if (p.periodo_mes) {
      return p.periodo_mes === periodoMes;
    }

    // Fallback when p.periodo_mes is not defined
    const conceptoLower = (p.concepto || "").toLowerCase();
    const matchesIso = Boolean(p.fecha_hora && p.fecha_hora.startsWith(periodoMes));
    const matchesShort = Boolean(
      targetMonth && targetYear && p.fecha_corta && p.fecha_corta.endsWith(`/${targetMonth}/${targetYear}`)
    );
    const matchesConceptMonth =
      conceptoLower.includes(periodoMes.toLowerCase()) ||
      keywords.some(k => conceptoLower.includes(k));

    return matchesIso || matchesShort || matchesConceptMonth;
  });
}

/**
 * Batch-accounts monthly SEPA direct debit receipts in the app's income ledger:
 * - Single read & single write to localStorage + 1 single publishSyncEvent("df_pagos_updated")
 * - Uses id `sepa_${periodoMes}_${alumno_id}` so SEPA XML generator continues to recognize it as SEPA (not desk cash)
 * - Sequential collision-free `REC-2026-XXXX` receipt numbers
 * - Strict anti-duplicate shield by alumno_id, DNI, or normalized full name for `periodoMes`
 */
export function contabilizarRemesaMensualSEPA(
  items: RemesaContableItem[],
  periodoMes: string
): ContabilizarRemesaResult {
  const all = getHistorialPagos();
  const now = new Date();
  const nowISO = now.toISOString();
  const fechaCorta = now.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  const horaCorta = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const monthTitle = getSeasonMonthTitle(periodoMes);

  let maxSeq = Math.max(all.length, getMaxReciboSequence(all));
  const usedRecibos = new Set<string>(all.map(p => p.numero_recibo).filter(Boolean));
  const usedIds = new Set<string>(all.map(p => p.id).filter(Boolean));

  const created: PagoTransaccion[] = [];
  let skippedDuplicateCount = 0;
  let totalAmountCreated = 0;
  let tejarCount = 0;
  let tejarAmount = 0;
  let castillaCount = 0;
  let castillaAmount = 0;

  // Working view including newly created items in this batch to prevent intra-batch duplicates
  const workingLedger: PagoTransaccion[] = [...all];

  for (const item of items) {
    const cleanId = (item.alumno_id || "").trim();
    const cleanName = (item.alumno_nombre || "").trim();
    if (!cleanId && !cleanName) continue;

    const alreadyPaid = hasExistingMonthlyPaymentForPeriod(
      workingLedger,
      {
        id: cleanId,
        dni: item.alumno_dni,
        nombre_completo: cleanName
      },
      periodoMes
    );

    if (alreadyPaid) {
      skippedDuplicateCount += 1;
      continue;
    }

    let numeroRecibo = "";
    do {
      maxSeq += 1;
      numeroRecibo = generarNumeroRecibo(maxSeq, 2026);
    } while (usedRecibos.has(numeroRecibo));
    usedRecibos.add(numeroRecibo);

    const safeStudentKey = cleanId || normalizeIdentityText(cleanName).replace(/[^a-z0-9]/g, "_");
    let txId = `sepa_${periodoMes}_${safeStudentKey}`;
    if (usedIds.has(txId)) {
      // Only happens if a previous SEPA receipt for this student+month was Anulado
      txId = `sepa_${periodoMes}_${safeStudentKey}_${maxSeq}`;
    }
    usedIds.add(txId);

    const normalizedSede = normalizeSedePago(item.sede);
    const importeNeto = Number(Number(item.importe || 0).toFixed(2));
    const isSep = periodoMes === "2026-09";
    const baseStr = item.cuota_base !== undefined ? Number(item.cuota_base).toFixed(0) : importeNeto.toFixed(0);
    const anticipoNum = item.anticipo !== undefined ? Number(item.anticipo) : 0;

    const conceptoFinal = item.concepto
      ? item.concepto.trim()
      : isSep && anticipoNum > 0
        ? `Remesa Mensual SEPA ${monthTitle} (Base ${baseStr}€ - ${anticipoNum}€ Anticipo)`
        : `Remesa Mensual SEPA ${monthTitle}${item.clase_nombre ? ` • ${item.clase_nombre}` : ""}`;

    const nuevoPago: PagoTransaccion = {
      id: txId,
      numero_recibo: numeroRecibo,
      fecha_hora: nowISO,
      fecha_corta: fechaCorta,
      hora_corta: horaCorta,
      alumno_id: cleanId || undefined,
      alumno_nombre: cleanName || "Alumno Dance Factory",
      alumno_dni: item.alumno_dni?.trim() || undefined,
      alumno_telefono: item.alumno_telefono?.trim() || undefined,
      concepto: conceptoFinal,
      categoria: "mensualidad",
      importe: importeNeto,
      metodo_pago: "SEPA",
      sede: normalizedSede,
      atendido_por: "Remesa Bancaria SEPA",
      notas: `Remesa bancaria domiciliada contabilizada en ingresos (${periodoMes})`,
      periodo_mes: periodoMes,
      estado: "Cobrado"
    };

    created.push(nuevoPago);
    workingLedger.unshift(nuevoPago);
    totalAmountCreated += importeNeto;

    if (normalizedSede === "castilla") {
      castillaCount += 1;
      castillaAmount += importeNeto;
    } else {
      tejarCount += 1;
      tejarAmount += importeNeto;
    }
  }

  if (created.length > 0) {
    saveHistorialPagos(sortPagosDesc([...created, ...all]));
    void persistBatchPagosToSupabaseCloud(created);
  }

  return {
    created,
    createdCount: created.length,
    skippedDuplicateCount,
    totalAmountCreated: Number(totalAmountCreated.toFixed(2)),
    tejarCount,
    tejarAmount: Number(tejarAmount.toFixed(2)),
    castillaCount,
    castillaAmount: Number(castillaAmount.toFixed(2)),
    periodoMes
  };
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
  const nextNum = Math.max(all.length, getMaxReciboSequence(all)) + 1;
  const numero_recibo = generarNumeroRecibo(nextNum, 2026);
  const fechaCorta = today.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });
  const parts = fechaCorta.split("/");
  const autoPeriodoMes =
    data.periodo_mes || (parts.length === 3 ? `${parts[2]}-${parts[1]}` : today.toISOString().slice(0, 7));

  const nuevoPago: PagoTransaccion = {
    id: "pago_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    numero_recibo,
    fecha_hora: today.toISOString(),
    fecha_corta: fechaCorta,
    hora_corta: today.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Madrid",
    }),
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
    periodo_mes: autoPeriodoMes,
    estado: "Cobrado"
  };

  const updated = sortPagosDesc([nuevoPago, ...all]);
  saveHistorialPagos(updated);
  void persistPagoToSupabaseCloud(nuevoPago);
  return nuevoPago;
}

export function anularPago(id: string): void {
  const all = getHistorialPagos();
  let voidedItem: PagoTransaccion | null = null;
  const updated = all.map(p => {
    if (p.id === id) {
      voidedItem = { ...p, estado: "Anulado" as const };
      return voidedItem;
    }
    return p;
  });
  saveHistorialPagos(updated);
  if (voidedItem) {
    void persistPagoToSupabaseCloud(voidedItem);
  }
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
  const nextNum = Math.max(all.length, getMaxReciboSequence(all)) + 1;
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
  saveHistorialPagos(sortPagosDesc(all));
  void persistPagoToSupabaseCloud(updated);
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
