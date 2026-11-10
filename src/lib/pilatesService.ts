/**
 * Módulo Independiente y Blindado: SOLO PILATES (Deporsalud S.L.)
 *
 * Reglas arquitectónicas:
 * 1. Aislamiento estricto respecto a Escuela de Baile (Alumnos, Pagos, Remesas SEPA, Analítica).
 * 2. Persistencia híbrida limpia:
 *    - Pre-activación / Sandbox (por defecto): localStorage + SyncEventBus (Supabase Realtime Broadcast en memoria <150ms, 0 filas en tablas).
 *    - Nube Activa (NEXT_PUBLIC_PILATES_CLOUD_DB === "true"): sincroniza además con tablas Supabase (`alumnos` con `sede = "pilates"` y `asistencias`).
 * 3. Horario Flexible 24h sin restricciones de cuadrante ni pantallas rojas de bloqueo.
 */

import { supabase } from "@/lib/supabase/client";
import { publishSyncEvent, subscribeSyncEvent, getClientInstanceId } from "@/lib/syncEventBus";
import { HardwareScannerDebouncer } from "@/lib/scannerDebounce";

export const IS_PILATES_CLOUD_DB_ENABLED =
  process.env.NEXT_PUBLIC_PILATES_CLOUD_DB === "true";

export function isPilatesCloudDbEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_PILATES_CLOUD_DB === "true") return true;
  if (process.env.NEXT_PUBLIC_PILATES_CLOUD_DB === "false") return false;
  if (typeof window !== "undefined") {
    const h = window.location.hostname.toLowerCase();
    if (h.includes("dancefactoryalcorcon.es")) return true;
  }
  return false;
}

export const PILATES_META_PREFIX = "DF_PILATES_META:";

const STORAGE_KEYS = {
  STUDENTS: "df_pilates_students_v1",
  ATTENDANCES: "df_pilates_attendances_v1",
  PAYMENTS: "df_pilates_payments_v1",
  SECURITY: "df_pilates_security_v1",
  SESSION_UNLOCKED: "df_pilates_unlocked_v1",
} as const;

export type PilatesPlanType =
  | "Suelo · 4 Clases (Mañana)"
  | "Suelo · 4 Clases (Tarde)"
  | "Suelo · 8 Clases (Mañana)"
  | "Suelo · 8 Clases (Tarde)"
  | "Suelo · 12 Clases (Mañana)"
  | "Suelo · 12 Clases (Tarde)"
  | "Máquina · 4 Clases (Mañana)"
  | "Máquina · 4 Clases (Tarde)"
  | "Máquina · 8 Clases (Mañana)"
  | "Máquina · 8 Clases (Tarde)"
  | "Máquina · 12 Clases (Mañana)"
  | "Máquina · 12 Clases (Tarde)"
  | "1 Suelo + 1 Máquina · 8 Clases (Mañana)"
  | "1 Suelo + 1 Máquina · 8 Clases (Tarde)"
  | "2 Suelo + 1 Máquina · 12 Clases (Mañana)"
  | "2 Suelo + 1 Máquina · 12 Clases (Tarde)"
  | "1 Suelo + 2 Máquina · 12 Clases (Mañana)"
  | "1 Suelo + 2 Máquina · 12 Clases (Tarde)"
  | "3 Suelo + 1 Máquina · 16 Clases (Mañana)"
  | "3 Suelo + 1 Máquina · 16 Clases (Tarde)"
  | "Clase Suelta Pilates Suelo"
  | "Clase Suelta Pilates Máquina"
  | "Reserva del Mes (1 por curso)"
  | "Suplemento Cuota Alumno Variable (+3€)"
  | "Matrícula EZG Pilates"
  | "Tarjeta de Acceso"
  | "Parking 1 Hora"
  | "Bono Mensual Parking 4 Horas"
  | "Bono Mensual Parking 8 Horas"
  | "Mensualidad Flexible 24h"
  | "Pilates Máquinas Mensual"
  | "Bono 4 Sesiones"
  | "Bono 8 Sesiones"
  | "Bono 10 Sesiones"
  | (string & {});

export type PilatesMetodoPago = "Efectivo" | "TPV" | "Transferencia" | "SEPA";

export type PilatesEstadoCuota = "Al día" | "Renovación Pendiente" | "Baja";

export interface PilatesPlanPreset {
  id: PilatesPlanType;
  label: string;
  categoria?: "Clases de Suelo" | "Clases Máquina" | "Suelo + Máquina" | "Clases Sueltas y Extras";
  turno?: "Mañana" | "Tarde" | "General";
  esBono: boolean;
  sesionesIncluidas: number | null;
  importeSugerido: number;
}

export const PILATES_PLAN_PRESETS: PilatesPlanPreset[] = [
  // --- CLASES DE SUELO (Cartel Oficial EZG Pilates Septiembre 2026) ---
  {
    id: "Suelo · 4 Clases (Mañana)",
    label: "Clases de Suelo · 4 Clases — Mañana (32,00 €)",
    categoria: "Clases de Suelo",
    turno: "Mañana",
    esBono: true,
    sesionesIncluidas: 4,
    importeSugerido: 32,
  },
  {
    id: "Suelo · 4 Clases (Tarde)",
    label: "Clases de Suelo · 4 Clases — Tarde (35,00 €)",
    categoria: "Clases de Suelo",
    turno: "Tarde",
    esBono: true,
    sesionesIncluidas: 4,
    importeSugerido: 35,
  },
  {
    id: "Suelo · 8 Clases (Mañana)",
    label: "Clases de Suelo · 8 Clases — Mañana (48,00 €)",
    categoria: "Clases de Suelo",
    turno: "Mañana",
    esBono: true,
    sesionesIncluidas: 8,
    importeSugerido: 48,
  },
  {
    id: "Suelo · 8 Clases (Tarde)",
    label: "Clases de Suelo · 8 Clases — Tarde (53,00 €)",
    categoria: "Clases de Suelo",
    turno: "Tarde",
    esBono: true,
    sesionesIncluidas: 8,
    importeSugerido: 53,
  },
  {
    id: "Suelo · 12 Clases (Mañana)",
    label: "Clases de Suelo · 12 Clases — Mañana (76,00 €)",
    categoria: "Clases de Suelo",
    turno: "Mañana",
    esBono: true,
    sesionesIncluidas: 12,
    importeSugerido: 76,
  },
  {
    id: "Suelo · 12 Clases (Tarde)",
    label: "Clases de Suelo · 12 Clases — Tarde (82,00 €)",
    categoria: "Clases de Suelo",
    turno: "Tarde",
    esBono: true,
    sesionesIncluidas: 12,
    importeSugerido: 82,
  },

  // --- CLASES MÁQUINA (Cartel Oficial EZG Pilates Septiembre 2026) ---
  {
    id: "Máquina · 4 Clases (Mañana)",
    label: "Clases Máquina · 4 Clases — Mañana (55,00 €)",
    categoria: "Clases Máquina",
    turno: "Mañana",
    esBono: true,
    sesionesIncluidas: 4,
    importeSugerido: 55,
  },
  {
    id: "Máquina · 4 Clases (Tarde)",
    label: "Clases Máquina · 4 Clases — Tarde (58,00 €)",
    categoria: "Clases Máquina",
    turno: "Tarde",
    esBono: true,
    sesionesIncluidas: 4,
    importeSugerido: 58,
  },
  {
    id: "Máquina · 8 Clases (Mañana)",
    label: "Clases Máquina · 8 Clases — Mañana (83,00 €)",
    categoria: "Clases Máquina",
    turno: "Mañana",
    esBono: true,
    sesionesIncluidas: 8,
    importeSugerido: 83,
  },
  {
    id: "Máquina · 8 Clases (Tarde)",
    label: "Clases Máquina · 8 Clases — Tarde (93,00 €)",
    categoria: "Clases Máquina",
    turno: "Tarde",
    esBono: true,
    sesionesIncluidas: 8,
    importeSugerido: 93,
  },
  {
    id: "Máquina · 12 Clases (Mañana)",
    label: "Clases Máquina · 12 Clases — Mañana (113,00 €)",
    categoria: "Clases Máquina",
    turno: "Mañana",
    esBono: true,
    sesionesIncluidas: 12,
    importeSugerido: 113,
  },
  {
    id: "Máquina · 12 Clases (Tarde)",
    label: "Clases Máquina · 12 Clases — Tarde (123,00 €)",
    categoria: "Clases Máquina",
    turno: "Tarde",
    esBono: true,
    sesionesIncluidas: 12,
    importeSugerido: 123,
  },

  // --- COMBINADOS SUELO + MÁQUINA (Cartel Oficial EZG Pilates Septiembre 2026) ---
  {
    id: "1 Suelo + 1 Máquina · 8 Clases (Mañana)",
    label: "1 Suelo + 1 Máquina (8 cl.) — Mañana (65,00 €)",
    categoria: "Suelo + Máquina",
    turno: "Mañana",
    esBono: true,
    sesionesIncluidas: 8,
    importeSugerido: 65,
  },
  {
    id: "1 Suelo + 1 Máquina · 8 Clases (Tarde)",
    label: "1 Suelo + 1 Máquina (8 cl.) — Tarde (68,00 €)",
    categoria: "Suelo + Máquina",
    turno: "Tarde",
    esBono: true,
    sesionesIncluidas: 8,
    importeSugerido: 68,
  },
  {
    id: "2 Suelo + 1 Máquina · 12 Clases (Mañana)",
    label: "2 Suelo + 1 Máquina (12 cl.) — Mañana (90,00 €)",
    categoria: "Suelo + Máquina",
    turno: "Mañana",
    esBono: true,
    sesionesIncluidas: 12,
    importeSugerido: 90,
  },
  {
    id: "2 Suelo + 1 Máquina · 12 Clases (Tarde)",
    label: "2 Suelo + 1 Máquina (12 cl.) — Tarde (97,00 €)",
    categoria: "Suelo + Máquina",
    turno: "Tarde",
    esBono: true,
    sesionesIncluidas: 12,
    importeSugerido: 97,
  },
  {
    id: "1 Suelo + 2 Máquina · 12 Clases (Mañana)",
    label: "1 Suelo + 2 Máquina (12 cl.) — Mañana (102,00 €)",
    categoria: "Suelo + Máquina",
    turno: "Mañana",
    esBono: true,
    sesionesIncluidas: 12,
    importeSugerido: 102,
  },
  {
    id: "1 Suelo + 2 Máquina · 12 Clases (Tarde)",
    label: "1 Suelo + 2 Máquina (12 cl.) — Tarde (114,00 €)",
    categoria: "Suelo + Máquina",
    turno: "Tarde",
    esBono: true,
    sesionesIncluidas: 12,
    importeSugerido: 114,
  },
  {
    id: "3 Suelo + 1 Máquina · 16 Clases (Mañana)",
    label: "3 Suelo + 1 Máquina (16 cl.) — Mañana (105,00 €)",
    categoria: "Suelo + Máquina",
    turno: "Mañana",
    esBono: true,
    sesionesIncluidas: 16,
    importeSugerido: 105,
  },
  {
    id: "3 Suelo + 1 Máquina · 16 Clases (Tarde)",
    label: "3 Suelo + 1 Máquina (16 cl.) — Tarde (116,00 €)",
    categoria: "Suelo + Máquina",
    turno: "Tarde",
    esBono: true,
    sesionesIncluidas: 16,
    importeSugerido: 116,
  },

  // --- CLASES SUELTAS, RESERVA, MATRÍCULA, TARJETA Y PARKING ---
  {
    id: "Clase Suelta Pilates Suelo",
    label: "Clase Suelta Pilates Suelo (12,00 €)",
    categoria: "Clases Sueltas y Extras",
    turno: "General",
    esBono: true,
    sesionesIncluidas: 1,
    importeSugerido: 12,
  },
  {
    id: "Clase Suelta Pilates Máquina",
    label: "Clase Suelta Pilates Máquina (17,00 €)",
    categoria: "Clases Sueltas y Extras",
    turno: "General",
    esBono: true,
    sesionesIncluidas: 1,
    importeSugerido: 17,
  },
  {
    id: "Reserva del Mes (1 por curso)",
    label: "Reserva del Mes · 1 por curso (15,00 €)",
    categoria: "Clases Sueltas y Extras",
    turno: "General",
    esBono: false,
    sesionesIncluidas: null,
    importeSugerido: 15,
  },
  {
    id: "Suplemento Cuota Alumno Variable (+3€)",
    label: "Suplemento Cuota Alumno Variable (+3,00 €)",
    categoria: "Clases Sueltas y Extras",
    turno: "General",
    esBono: false,
    sesionesIncluidas: null,
    importeSugerido: 3,
  },
  {
    id: "Matrícula EZG Pilates",
    label: "Matrícula EZG Pilates (30,00 €)",
    categoria: "Clases Sueltas y Extras",
    turno: "General",
    esBono: false,
    sesionesIncluidas: null,
    importeSugerido: 30,
  },
  {
    id: "Tarjeta de Acceso",
    label: "Tarjeta de Acceso QR / NFC (5,00 €)",
    categoria: "Clases Sueltas y Extras",
    turno: "General",
    esBono: false,
    sesionesIncluidas: null,
    importeSugerido: 5,
  },
  {
    id: "Parking 1 Hora",
    label: "Parking 1 Hora (1,30 €)",
    categoria: "Clases Sueltas y Extras",
    turno: "General",
    esBono: false,
    sesionesIncluidas: null,
    importeSugerido: 1.3,
  },
  {
    id: "Bono Mensual Parking 4 Horas",
    label: "Bono Mensual Parking · 4 Horas (4,00 €)",
    categoria: "Clases Sueltas y Extras",
    turno: "General",
    esBono: false,
    sesionesIncluidas: null,
    importeSugerido: 4,
  },
  {
    id: "Bono Mensual Parking 8 Horas",
    label: "Bono Mensual Parking · 8 Horas (8,00 €)",
    categoria: "Clases Sueltas y Extras",
    turno: "General",
    esBono: false,
    sesionesIncluidas: null,
    importeSugerido: 8,
  },
];

export interface PilatesStudent {
  id: string;
  codigo_qr: string; // Ej: PIL-1319
  num_socio?: string; // Ej: "1319"
  nombre: string;
  apellidos: string;
  nombre_completo: string;
  dni: string;
  telefono: string;
  email: string;
  foto_url: string; // DataURL JPEG comprimido <= 25KB o URL HTTPS
  tipo_plan: PilatesPlanType;
  es_bono: boolean;
  importe_cuota: number;
  sesiones_restantes: number | null;
  sesiones_totales_bono: number | null;
  metodo_pago: PilatesMetodoPago;
  iban: string;
  estado: "Activo" | "Baja";
  estado_cuota: PilatesEstadoCuota;
  ultimo_mes_pagado: string; // YYYY-MM
  notas_salud: string; // Tipo Alumno / observación médica (Recomendación médica, Reeducación postural, etc.)
  fecha_alta?: string; // DD/MM/YYYY
  fecha_baja?: string; // DD/MM/YYYY
  matriculado?: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface PilatesAttendance {
  id: string;
  alumno_id: string;
  alumno_nombre: string;
  codigo_qr: string;
  fecha_hora: string;
  fecha_iso: string; // YYYY-MM-DD
  hora_corta: string; // HH:MM:SS
  periodo_mes: string; // YYYY-MM
  tipo_plan: string;
  sesiones_restantes_tras_entrada: number | null;
  aviso_renovacion: boolean;
  origen_pc: string;
}

export interface PilatesPayment {
  id: string;
  numero_recibo: string;
  fecha_hora: string;
  fecha_corta: string;
  hora_corta: string;
  periodo_mes: string; // YYYY-MM
  alumno_id: string;
  alumno_nombre: string;
  alumno_dni: string;
  concepto: string;
  tipo_plan: PilatesPlanType;
  importe: number;
  metodo_pago: PilatesMetodoPago;
  sesiones_recargadas: number | null;
  notas?: string;
}

export interface PilatesSecurityConfig {
  masterPin: string;
  allowReceptionWelcomeCard: boolean;
  pcAlias: string;
  updatedAt: string;
}

export interface PilatesCheckInEvent {
  eventUid: string;
  studentId: string;
  codigoQr: string;
  nombreCompleto: string;
  fotoUrl: string;
  tipoPlan: string;
  esBono: boolean;
  sesionesRestantes: number | null;
  sesionesTotalesBono: number | null;
  estadoCuota: PilatesEstadoCuota;
  requiereAvisoAmable: boolean;
  mensajeEstado: string;
  asistenciasMes: number;
  horaEntrada: string;
  fechaCorta: string;
  origenPc: string;
  timestamp: number;
}

export interface PilatesImportCandidate {
  rowNumber: number;
  nombre: string;
  apellidos: string;
  nombre_completo: string;
  dni: string;
  telefono: string;
  email: string;
  tipo_plan: PilatesPlanType;
  es_bono: boolean;
  importe_cuota: number;
  sesiones_restantes: number | null;
  sesiones_totales_bono: number | null;
  metodo_pago: PilatesMetodoPago;
  iban: string;
  estado_cuota: PilatesEstadoCuota;
  foto_url: string;
  notas_salud: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  existingStudentId?: string;
}

export interface PilatesImportPreview {
  fileName: string;
  totalRows: number;
  validCandidates: PilatesImportCandidate[];
  duplicateCount: number;
  skippedEmptyRows: number;
}

const DEFAULT_MASTER_PIN =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PILATES_MASTER_PIN) || "2892";

// Debouncer compartido (>= 2.5s) para evitar dobles lecturas físicas del lector QR USB
const pilatesScanDebouncer = new HardwareScannerDebouncer(2500);

let crossPcSyncInitialized = false;

// ============================================================================
// 1. PREDICADOS CANÓNICOS DE AISLAMIENTO (ESCUELA DE BAILE vs SOLO PILATES)
// ============================================================================

export function isPilatesProfile(student: any): boolean {
  if (!student || typeof student !== "object") return false;
  const sede = String(student.sede || "").trim().toLowerCase();
  if (sede === "pilates" || sede === "solo_pilates" || sede === "deporsalud") return true;

  const direccion = String(student.direccion || "");
  if (direccion.includes(PILATES_META_PREFIX)) return true;

  const token = String(student.codigo_qr || student.nfc_token || "").trim().toUpperCase();
  if (token.startsWith("PIL-")) return true;

  const plan = String(student.plan_activo || "").trim().toLowerCase();
  if (plan.startsWith("solo pilates")) return true;

  return false;
}

export function isPilatesPayment(pago: any): boolean {
  if (!pago || typeof pago !== "object") return false;
  const id = String(pago.id || "").toLowerCase();
  const recibo = String(pago.numero_recibo || "").toUpperCase();
  const sede = String(pago.sede || "").toLowerCase();
  const categoria = String(pago.categoria || "").toLowerCase();

  return (
    id.startsWith("pil_") ||
    recibo.startsWith("PIL-") ||
    sede === "pilates" ||
    categoria === "pilates"
  );
}

// ============================================================================
// 2. UTILIDADES DE FECHA Y NORMALIZACIÓN
// ============================================================================

export function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getTodayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function normalizeStr(val?: string | null): string {
  return String(val || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeDni(val?: string | null): string {
  return String(val || "")
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, "");
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateNextPilatesQrCode(existingStudents: PilatesStudent[]): string {
  let maxNum = 1000;
  for (const s of existingStudents) {
    const match = String(s.codigo_qr || "").toUpperCase().match(/^PIL-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return `PIL-${maxNum + 1}`;
}

export function getPilatesInitials(fullName: string): string {
  const parts = String(fullName || "Pilates")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "SP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ============================================================================
// 3. SEGURIDAD Y CLAVE PRIVADA DE ENRIQUE
// ============================================================================

export function getPilatesSecurityConfig(): PilatesSecurityConfig {
  if (typeof window === "undefined") {
    return {
      masterPin: DEFAULT_MASTER_PIN,
      allowReceptionWelcomeCard: true,
      pcAlias: "PC Recepción Principal",
      updatedAt: new Date().toISOString(),
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SECURITY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        masterPin: String(parsed.masterPin || DEFAULT_MASTER_PIN),
        allowReceptionWelcomeCard:
          typeof parsed.allowReceptionWelcomeCard === "boolean"
            ? parsed.allowReceptionWelcomeCard
            : true,
        pcAlias: String(parsed.pcAlias || "PC Recepción 1"),
        updatedAt: String(parsed.updatedAt || new Date().toISOString()),
      };
    }
  } catch {}
  return {
    masterPin: DEFAULT_MASTER_PIN,
    allowReceptionWelcomeCard: true,
    pcAlias: "PC Recepción 1",
    updatedAt: new Date().toISOString(),
  };
}

export function savePilatesSecurityConfig(
  patch: Partial<PilatesSecurityConfig>
): PilatesSecurityConfig {
  const current = getPilatesSecurityConfig();
  const next: PilatesSecurityConfig = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEYS.SECURITY, JSON.stringify(next));
    } catch {}
    publishSyncEvent("df_pilates_roster_sync", {
      securityConfig: {
        masterPin: next.masterPin,
        allowReceptionWelcomeCard: next.allowReceptionWelcomeCard,
        updatedAt: next.updatedAt,
      },
      senderInstance: getClientInstanceId(),
      ts: Date.now(),
    });
    publishSyncEvent("df_pilates_updated", { reason: "security_config" });
  }
  return next;
}

export function isPilatesSessionUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(STORAGE_KEYS.SESSION_UNLOCKED) === "true";
  } catch {
    return false;
  }
}

export function verifyPilatesPin(inputPin: string): boolean {
  const clean = String(inputPin || "").trim();
  if (!clean) return false;
  const config = getPilatesSecurityConfig();
  const isValid = clean === config.masterPin;
  if (isValid && typeof window !== "undefined") {
    try {
      sessionStorage.setItem(STORAGE_KEYS.SESSION_UNLOCKED, "true");
      window.dispatchEvent(new CustomEvent("df_pilates_lock_changed", { detail: { unlocked: true } }));
    } catch {}
  }
  return isValid;
}

export function lockPilatesSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_UNLOCKED);
    window.dispatchEvent(new CustomEvent("df_pilates_lock_changed", { detail: { unlocked: false } }));
  } catch {}
}

export function updatePilatesMasterPin(
  currentPin: string,
  newPin: string
): { ok: boolean; error?: string } {
  const cfg = getPilatesSecurityConfig();
  if (String(currentPin || "").trim() !== cfg.masterPin) {
    return { ok: false, error: "La clave actual introducida no es correcta." };
  }
  const cleanNew = String(newPin || "").trim();
  if (cleanNew.length < 4 || cleanNew.length > 16) {
    return {
      ok: false,
      error: "La nueva clave privada debe tener entre 4 y 16 caracteres.",
    };
  }
  savePilatesSecurityConfig({ masterPin: cleanNew });
  return { ok: true };
}

// ============================================================================
// 4. ALMACENAMIENTO HÍBRIDO Y SINCRONIZACIÓN ENTRE LOS 2 PCS DE RECEPCIÓN
// ============================================================================

export function getPilatesStudents(): PilatesStudent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sortPilatesStudentsBySocioDesc(list: PilatesStudent[]): PilatesStudent[] {
  return [...list].sort((a, b) => {
    const extractNum = (s: PilatesStudent): number => {
      if (s.num_socio && /^\d+$/.test(s.num_socio)) {
        const n = parseInt(s.num_socio, 10);
        if (n > 0) return n;
      }
      const m = String(s.codigo_qr || "").match(/^PIL-(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > 0) return n;
      }
      return -1;
    };
    const na = extractNum(a);
    const nb = extractNum(b);
    if (na !== nb) return nb - na;
    return (b.creado_en || "").localeCompare(a.creado_en || "");
  });
}

function writePilatesStudentsLocal(
  students: PilatesStudent[],
  broadcastSync = true,
  singleUpdatedStudent?: PilatesStudent
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  } catch (e) {
    console.warn("[PilatesService] Error escribiendo alumnos en localStorage:", e);
  }
  if (broadcastSync) {
    publishSyncEvent("df_pilates_roster_sync", {
      students: singleUpdatedStudent
        ? [singleUpdatedStudent]
        : students.length <= 150
        ? students
        : undefined,
      reloadFromCloud: !singleUpdatedStudent && students.length > 150,
      senderInstance: getClientInstanceId(),
      ts: Date.now(),
    });
    publishSyncEvent("df_pilates_updated", { reason: "students" });
  }
}

export function getPilatesAttendances(): PilatesAttendance[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ATTENDANCES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePilatesAttendancesLocal(attendances: PilatesAttendance[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(attendances.slice(0, 1500)));
  } catch {}
}

export function getPilatesPayments(): PilatesPayment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePilatesPaymentsLocal(payments: PilatesPayment[], broadcastSync = true): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  } catch {}
  if (broadcastSync) {
    publishSyncEvent("df_pilates_roster_sync", {
      payments,
      senderInstance: getClientInstanceId(),
      ts: Date.now(),
    });
    publishSyncEvent("df_pilates_updated", { reason: "payments" });
  }
}

/**
 * Inicializa la escucha en tiempo real entre PC 1 y PC 2 sobre Supabase Realtime Broadcast.
 * Permite que los 2 ordenadores de recepción compartan censo y lecturas al instante (<150ms)
 * sin escribir ni una sola fila de prueba en las tablas de producción de Supabase.
 */
export function initPilatesCrossPcSync(): void {
  if (typeof window === "undefined" || crossPcSyncInitialized) return;
  crossPcSyncInitialized = true;

  subscribeSyncEvent("df_pilates_roster_sync", (detail) => {
    if (!detail) return;
    let changed = false;

    if (detail.reloadFromCloud) {
      syncPilatesFromCloudIfEnabled().then(() => {
        window.dispatchEvent(new CustomEvent("df_pilates_updated", { detail: { remote: true } }));
      });
    }

    if (Array.isArray(detail.students) || detail.deletedStudentId) {
      const local = getPilatesStudents();
      const mergedMap = new Map<string, PilatesStudent>();
      for (const s of local) mergedMap.set(s.id, s);
      if (Array.isArray(detail.students)) {
        for (const incoming of detail.students as PilatesStudent[]) {
          const prev = mergedMap.get(incoming.id);
          if (!prev || (incoming.actualizado_en || "") >= (prev.actualizado_en || "")) {
            mergedMap.set(incoming.id, incoming);
            changed = true;
          }
        }
      }
      if (detail.deletedStudentId && mergedMap.has(detail.deletedStudentId)) {
        mergedMap.delete(detail.deletedStudentId);
        changed = true;
      }
      if (changed) {
        const merged = sortPilatesStudentsBySocioDesc(Array.from(mergedMap.values()));
        writePilatesStudentsLocal(merged, false);
      }
    }

    if (Array.isArray(detail.payments)) {
      const localPay = getPilatesPayments();
      const payMap = new Map<string, PilatesPayment>();
      for (const p of localPay) payMap.set(p.id, p);
      for (const incomingPay of detail.payments as PilatesPayment[]) {
        if (!payMap.has(incomingPay.id)) {
          payMap.set(incomingPay.id, incomingPay);
          changed = true;
        }
      }
      if (changed) {
        const mergedPay = Array.from(payMap.values()).sort((a, b) =>
          (b.fecha_hora || "").localeCompare(a.fecha_hora || "")
        );
        writePilatesPaymentsLocal(mergedPay, false);
      }
    }

    if (detail.securityConfig && typeof detail.securityConfig === "object") {
      const localCfg = getPilatesSecurityConfig();
      const incomingUpdated = String(detail.securityConfig.updatedAt || "");
      if (!localCfg.updatedAt || incomingUpdated >= localCfg.updatedAt) {
        const mergedCfg: PilatesSecurityConfig = {
          ...localCfg,
          masterPin: String(detail.securityConfig.masterPin || localCfg.masterPin),
          allowReceptionWelcomeCard:
            typeof detail.securityConfig.allowReceptionWelcomeCard === "boolean"
              ? detail.securityConfig.allowReceptionWelcomeCard
              : localCfg.allowReceptionWelcomeCard,
          updatedAt: incomingUpdated || new Date().toISOString(),
        };
        try {
          localStorage.setItem(STORAGE_KEYS.SECURITY, JSON.stringify(mergedCfg));
          changed = true;
        } catch {}
      }
    }

    if (changed) {
      window.dispatchEvent(new CustomEvent("df_pilates_updated", { detail: { remote: true } }));
    }
  });

  subscribeSyncEvent("df_pilates_request_sync", () => {
    const students = getPilatesStudents();
    const payments = getPilatesPayments();
    const cfg = getPilatesSecurityConfig();
    if (students.length > 0 || payments.length > 0) {
      publishSyncEvent("df_pilates_roster_sync", {
        students: students.length <= 150 ? students : undefined,
        reloadFromCloud: students.length > 150,
        payments,
        securityConfig: {
          masterPin: cfg.masterPin,
          allowReceptionWelcomeCard: cfg.allowReceptionWelcomeCard,
          updatedAt: cfg.updatedAt,
        },
        senderInstance: getClientInstanceId(),
        ts: Date.now(),
      });
    }
  });

  // Solicitar sincronización inicial por si otro PC de recepción ya tiene fichas abiertas
  setTimeout(() => {
    publishSyncEvent("df_pilates_request_sync", { requester: getClientInstanceId() });
  }, 500);
}

/**
 * Sincronización opcional con tabla Supabase `alumnos` (SOLO cuando NEXT_PUBLIC_PILATES_CLOUD_DB === "true" o en producción)
 */
async function syncPilatesStudentToCloudIfEnabled(student: PilatesStudent): Promise<void> {
  if (!isPilatesCloudDbEnabled()) return;
  try {
    const metaPayload = {
      codigo_qr: student.codigo_qr,
      num_socio: student.num_socio || student.codigo_qr.replace(/^PIL-/i, ""),
      foto_url: student.foto_url,
      tipo_plan: student.tipo_plan,
      es_bono: student.es_bono,
      importe_cuota: student.importe_cuota,
      metodo_pago: student.metodo_pago,
      iban: student.iban,
      estado_cuota: student.estado_cuota,
      ultimo_mes_pagado: student.ultimo_mes_pagado,
      notas_salud: student.notas_salud,
      fecha_alta: student.fecha_alta || "",
      fecha_baja: student.fecha_baja || "",
      matriculado: Boolean(student.matriculado),
      sesiones_totales_bono: student.sesiones_totales_bono,
    };

    await supabase.from("alumnos").upsert([
      {
        id: student.id,
        sede: "pilates",
        nombre_completo: student.nombre_completo,
        dni: student.dni || "",
        telefono: student.telefono || "",
        email: student.email || "",
        plan_activo: `Solo Pilates · ${student.tipo_plan}`,
        clases_restantes: student.sesiones_restantes,
        nfc_token: student.codigo_qr,
        estado: student.estado,
        direccion: `${PILATES_META_PREFIX}${JSON.stringify(metaPayload)}`,
      },
    ]);
  } catch (err) {
    console.warn("[PilatesService] Sincronización Cloud DB diferida:", err);
  }
}

export async function syncPilatesFromCloudIfEnabled(): Promise<PilatesStudent[]> {
  const local = getPilatesStudents();
  if (!isPilatesCloudDbEnabled()) return local;

  try {
    const allRows: any[] = [];
    const pageSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("alumnos")
        .select("*")
        .eq("sede", "pilates")
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error || !data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    if (allRows.length === 0) return local;

    const mapped: PilatesStudent[] = allRows.map((row: any) => {
      let meta: any = {};
      const dir = String(row.direccion || "");
      if (dir.startsWith(PILATES_META_PREFIX)) {
        try {
          meta = JSON.parse(dir.slice(PILATES_META_PREFIX.length));
        } catch {}
      }
      const fullName = String(row.nombre_completo || "").trim();
      const parts = fullName.split(/\s+/);
      const nombre = parts[0] || "";
      const apellidos = parts.slice(1).join(" ");
      const rawPlan = String(meta.tipo_plan || row.plan_activo || "").replace(/^Solo Pilates\s*·\s*/i, "");
      const preset =
        PILATES_PLAN_PRESETS.find((p) => p.id === rawPlan) ||
        PILATES_PLAN_PRESETS.find((p) => p.id === "Suelo · 8 Clases (Mañana)") ||
        PILATES_PLAN_PRESETS[0];

      const isBaja = row.estado === "Baja";
      const codigoQr = String(meta.codigo_qr || row.nfc_token || "PIL-1001").trim();

      return {
        id: row.id,
        codigo_qr: codigoQr,
        num_socio: meta.num_socio || codigoQr.replace(/^PIL-/i, ""),
        nombre,
        apellidos,
        nombre_completo: fullName,
        dni: row.dni || "",
        telefono: row.telefono || "",
        email: row.email || "",
        foto_url: meta.foto_url || "",
        tipo_plan: meta.tipo_plan || preset.id,
        es_bono: typeof meta.es_bono === "boolean" ? meta.es_bono : preset.esBono,
        importe_cuota: Number(meta.importe_cuota ?? preset.importeSugerido),
        sesiones_restantes:
          typeof row.clases_restantes === "number"
            ? row.clases_restantes
            : isBaja
            ? 0
            : preset.sesionesIncluidas,
        sesiones_totales_bono: meta.sesiones_totales_bono ?? preset.sesionesIncluidas,
        metodo_pago: meta.metodo_pago || "TPV",
        iban: meta.iban || "",
        estado: isBaja ? "Baja" : "Activo",
        estado_cuota: isBaja ? "Baja" : meta.estado_cuota || "Al día",
        ultimo_mes_pagado: meta.ultimo_mes_pagado || getCurrentYearMonth(),
        notas_salud: meta.notas_salud || "",
        fecha_alta: meta.fecha_alta || "",
        fecha_baja: meta.fecha_baja || "",
        matriculado: Boolean(meta.matriculado),
        creado_en: row.creado_en || new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
      };
    });

    const sorted = sortPilatesStudentsBySocioDesc(mapped);
    if (sorted.length > 0) {
      writePilatesStudentsLocal(sorted, false);
      return sorted;
    }
  } catch (err) {
    console.warn("[PilatesService] Error sincronizando desde Cloud DB:", err);
  }
  return local;
}

// ============================================================================
// 5. CRUD DE FICHAS DE ALUMNOS PILATES + COMPRESIÓN DE FOTOGRAFÍA EN CLIENTE
// ============================================================================

export async function compressPilatesPhoto(
  file: File,
  maxDimension = 260,
  quality = 0.82
): Promise<string> {
  if (typeof window === "undefined") return "";

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo de imagen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagen no válido."));
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = maxDimension;
          canvas.height = maxDimension;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(String(reader.result || ""));
            return;
          }

          // Recorte centrado cuadrado tipo retrato (object-cover limpio)
          const minSide = Math.min(img.width, img.height);
          const sx = Math.max(0, (img.width - minSide) / 2);
          const sy = Math.max(0, (img.height - minSide) / 2);

          ctx.fillStyle = "#0f172a";
          ctx.fillRect(0, 0, maxDimension, maxDimension);
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxDimension, maxDimension);

          const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(compressedDataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export interface SavePilatesStudentInput {
  id?: string;
  codigo_qr?: string;
  nombre: string;
  apellidos?: string;
  dni?: string;
  telefono?: string;
  email?: string;
  foto_url?: string;
  tipo_plan: PilatesPlanType;
  importe_cuota: number;
  sesiones_restantes?: number | null;
  metodo_pago: PilatesMetodoPago;
  iban?: string;
  estado?: "Activo" | "Baja";
  estado_cuota?: PilatesEstadoCuota;
  notas_salud?: string;
}

export async function savePilatesStudent(
  input: SavePilatesStudentInput
): Promise<PilatesStudent> {
  const existing = getPilatesStudents();
  const nowIso = new Date().toISOString();
  const preset =
    PILATES_PLAN_PRESETS.find((p) => p.id === input.tipo_plan) || PILATES_PLAN_PRESETS[0];

  const cleanNombre = String(input.nombre || "").trim();
  const cleanApellidos = String(input.apellidos || "").trim();
  const nombreCompleto = [cleanNombre, cleanApellidos].filter(Boolean).join(" ").trim();

  const existingIdx = input.id ? existing.findIndex((s) => s.id === input.id) : -1;
  const previous = existingIdx >= 0 ? existing[existingIdx] : null;

  const sesionesRestantes = preset.esBono
    ? typeof input.sesiones_restantes === "number"
      ? Math.max(0, input.sesiones_restantes)
      : preset.sesionesIncluidas ?? 4
    : null;

  const estadoFinal = input.estado || previous?.estado || "Activo";
  let estadoCuotaFinal: PilatesEstadoCuota =
    input.estado_cuota || previous?.estado_cuota || "Al día";

  if (estadoFinal === "Baja") {
    estadoCuotaFinal = "Baja";
  } else if (preset.esBono && sesionesRestantes === 0) {
    estadoCuotaFinal = "Renovación Pendiente";
  }

  const student: PilatesStudent = {
    id: previous?.id || input.id || generateUuid(),
    codigo_qr:
      (input.codigo_qr && input.codigo_qr.trim().toUpperCase()) ||
      previous?.codigo_qr ||
      generateNextPilatesQrCode(existing),
    num_socio: previous?.num_socio,
    nombre: cleanNombre,
    apellidos: cleanApellidos,
    nombre_completo: nombreCompleto,
    dni: String(input.dni || "").trim().toUpperCase(),
    telefono: String(input.telefono || "").trim(),
    email: String(input.email || "").trim().toLowerCase(),
    foto_url: input.foto_url !== undefined ? input.foto_url : previous?.foto_url || "",
    tipo_plan: preset.id,
    es_bono: preset.esBono,
    importe_cuota: Number(input.importe_cuota || preset.importeSugerido),
    sesiones_restantes: sesionesRestantes,
    sesiones_totales_bono: preset.esBono ? preset.sesionesIncluidas : null,
    metodo_pago: input.metodo_pago || "TPV",
    iban: String(input.iban || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ""),
    estado: estadoFinal,
    estado_cuota: estadoCuotaFinal,
    ultimo_mes_pagado: previous?.ultimo_mes_pagado || getCurrentYearMonth(),
    notas_salud: String(input.notas_salud || "").trim(),
    fecha_alta: previous?.fecha_alta,
    fecha_baja: previous?.fecha_baja,
    matriculado: previous?.matriculado,
    creado_en: previous?.creado_en || nowIso,
    actualizado_en: nowIso,
  };

  let updatedList: PilatesStudent[];
  if (existingIdx >= 0) {
    updatedList = [...existing];
    updatedList[existingIdx] = student;
  } else {
    updatedList = [student, ...existing];
  }

  writePilatesStudentsLocal(updatedList, true, student);
  await syncPilatesStudentToCloudIfEnabled(student);

  return student;
}

export async function deletePilatesStudent(studentId: string): Promise<void> {
  const existing = getPilatesStudents();
  const next = existing.filter((s) => s.id !== studentId);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(next));
    publishSyncEvent("df_pilates_roster_sync", {
      students: next.length <= 150 ? next : undefined,
      deletedStudentId: studentId,
      senderInstance: getClientInstanceId(),
      ts: Date.now(),
    });
    publishSyncEvent("df_pilates_updated", { reason: "delete_student" });
  }
  if (isPilatesCloudDbEnabled()) {
    try {
      await supabase.from("asistencias").delete().eq("alumno_id", studentId);
      await supabase.from("alumnos").delete().eq("id", studentId).eq("sede", "pilates");
    } catch {}
  }
}

// ============================================================================
// 6. BÚSQUEDA Y CHECK-IN QR HORARIO LIBRE 24H (SIN PANTALLAS ROJAS NI SIRENAS)
// ============================================================================

export function extractPilatesCodeCandidate(rawInput: string): string {
  const trimmed = String(rawInput || "").trim();
  if (!trimmed) return "";

  // Soportar URLs con código embebido (ej: ?qr=PIL-1319 o /PIL-1)
  const pilMatch = trimmed.toUpperCase().match(/\b(PIL-\d{1,8}(?:-\d+)?)\b/);
  if (pilMatch) return pilMatch[1];

  return trimmed;
}

export function findPilatesStudentByCode(rawCode: string): PilatesStudent | null {
  const clean = extractPilatesCodeCandidate(rawCode);
  if (!clean) return null;

  const upper = clean.toUpperCase();
  const normPilNum = upper.replace(/^PIL-0*(\d+)$/, "PIL-$1");
  const normDniCandidate = normalizeDni(clean);
  const lower = clean.toLowerCase();

  const students = getPilatesStudents();
  for (const s of students) {
    const sQr = String(s.codigo_qr || "").toUpperCase();
    if (sQr === upper || sQr.replace(/^PIL-0*(\d+)$/, "PIL-$1") === normPilNum) return s;
    if (s.id === clean) return s;
    if (normDniCandidate.length >= 6 && normalizeDni(s.dni) === normDniCandidate) return s;
    if (s.email && s.email.toLowerCase() === lower) return s;
  }
  return null;
}

export function isExplicitPilatesCode(rawCode: string): boolean {
  const clean = extractPilatesCodeCandidate(rawCode).toUpperCase();
  return clean.startsWith("PIL-");
}

export interface ProcessPilatesScanResult {
  matched: boolean;
  debounced?: boolean;
  notFoundPilatesCode?: boolean;
  event?: PilatesCheckInEvent;
}

export async function processPilatesScan(
  rawCode: string,
  options?: { bypassDebounce?: boolean; originLabel?: string }
): Promise<ProcessPilatesScanResult> {
  const candidate = extractPilatesCodeCandidate(rawCode);
  if (!candidate) return { matched: false };

  const student = findPilatesStudentByCode(candidate);
  if (!student) {
    if (isExplicitPilatesCode(candidate)) {
      return { matched: true, notFoundPilatesCode: true };
    }
    return { matched: false };
  }

  if (!options?.bypassDebounce) {
    const deb = pilatesScanDebouncer.processScan(`PILATES_${student.id}`);
    if (!deb.accepted) {
      return { matched: true, debounced: true };
    }
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const todayIso = getTodayISO();
  const currentMonth = getCurrentYearMonth();
  const horaEntrada = now.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const fechaCorta = now.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const cfg = getPilatesSecurityConfig();
  const origenPc = options?.originLabel || cfg.pcAlias || "PC Recepción";

  // Lógica Horario Libre 24h: NUNCA deniega con sirena roja; descuenta 1 sesión si es bono > 0
  let nuevoSaldoSesiones = student.sesiones_restantes;
  let nuevoEstadoCuota: PilatesEstadoCuota = student.estado_cuota;
  let requiereAvisoAmable = false;
  let mensajeEstado = "";

  if (student.estado === "Baja") {
    requiereAvisoAmable = true;
    nuevoEstadoCuota = "Baja";
    mensajeEstado = "Ficha marcada como Baja · Revisar reactivación con amabilidad en mostrador";
  } else if (student.es_bono) {
    const saldoPrevio = typeof student.sesiones_restantes === "number" ? student.sesiones_restantes : 0;
    if (saldoPrevio > 0) {
      nuevoSaldoSesiones = saldoPrevio - 1;
      if (nuevoSaldoSesiones === 0) {
        nuevoEstadoCuota = "Renovación Pendiente";
        requiereAvisoAmable = true;
        mensajeEstado = `Última sesión consumida (0 restantes) · Recordar renovación del ${student.tipo_plan}`;
      } else {
        nuevoEstadoCuota = "Al día";
        requiereAvisoAmable = false;
        mensajeEstado = `${student.tipo_plan} Activo · Quedan ${nuevoSaldoSesiones} ${
          nuevoSaldoSesiones === 1 ? "sesión disponible" : "sesiones disponibles"
        }`;
      }
    } else {
      nuevoSaldoSesiones = 0;
      nuevoEstadoCuota = "Renovación Pendiente";
      requiereAvisoAmable = true;
      mensajeEstado = `Bono sin sesiones restantes (0/${student.sesiones_totales_bono || 4}) · Recordar renovación con amabilidad`;
    }
  } else {
    if (student.estado_cuota === "Renovación Pendiente") {
      requiereAvisoAmable = true;
      mensajeEstado = "Mensualidad pendiente de renovación · Recordar pago del mes con amabilidad";
    } else {
      requiereAvisoAmable = false;
      mensajeEstado = `${student.tipo_plan} al día · Acceso Libre 24h`;
    }
  }

  // Actualizar alumno en listado local + sincronizar censo entre los 2 PCs
  const allStudents = getPilatesStudents();
  const updatedStudent: PilatesStudent = {
    ...student,
    sesiones_restantes: nuevoSaldoSesiones,
    estado_cuota: nuevoEstadoCuota,
    actualizado_en: nowIso,
  };
  const nextStudents = allStudents.map((s) => (s.id === student.id ? updatedStudent : s));
  writePilatesStudentsLocal(nextStudents, true, updatedStudent);
  await syncPilatesStudentToCloudIfEnabled(updatedStudent);

  // Registrar asistencia 24h
  const allAttendances = getPilatesAttendances();
  const newAttendance: PilatesAttendance = {
    id: `pil_att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    alumno_id: updatedStudent.id,
    alumno_nombre: updatedStudent.nombre_completo,
    codigo_qr: updatedStudent.codigo_qr,
    fecha_hora: nowIso,
    fecha_iso: todayIso,
    hora_corta: horaEntrada,
    periodo_mes: currentMonth,
    tipo_plan: updatedStudent.tipo_plan,
    sesiones_restantes_tras_entrada: nuevoSaldoSesiones,
    aviso_renovacion: requiereAvisoAmable,
    origen_pc: origenPc,
  };
  const nextAttendances = [newAttendance, ...allAttendances];
  writePilatesAttendancesLocal(nextAttendances);

  if (isPilatesCloudDbEnabled()) {
    try {
      await supabase.from("asistencias").insert([
        {
          alumno_id: updatedStudent.id,
          fecha_hora: nowIso,
        },
      ]);
    } catch {}
  }

  const asistenciasMes = nextAttendances.filter(
    (a) => a.alumno_id === updatedStudent.id && a.periodo_mes === currentMonth
  ).length;

  const checkInEvent: PilatesCheckInEvent = {
    eventUid: `pil_evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    studentId: updatedStudent.id,
    codigoQr: updatedStudent.codigo_qr,
    nombreCompleto: updatedStudent.nombre_completo,
    fotoUrl: updatedStudent.foto_url || "",
    tipoPlan: updatedStudent.tipo_plan,
    esBono: updatedStudent.es_bono,
    sesionesRestantes: nuevoSaldoSesiones,
    sesionesTotalesBono: updatedStudent.sesiones_totales_bono,
    estadoCuota: nuevoEstadoCuota,
    requiereAvisoAmable,
    mensajeEstado,
    asistenciasMes,
    horaEntrada,
    fechaCorta,
    origenPc,
    timestamp: Date.now(),
  };

  // Emitir en vivo (<150ms) al propio PC y al segundo PC de recepción vía Supabase Realtime Broadcast
  await publishSyncEvent("df_pilates_checkin", checkInEvent);
  publishSyncEvent("df_pilates_updated", { reason: "checkin", studentId: updatedStudent.id });

  return {
    matched: true,
    event: checkInEvent,
  };
}

// ============================================================================
// 7. COBROS, RENOVACIONES EN 1 CLIC Y EXPORTACIÓN CONTABLE EXCLUSIVA PILATES
// ============================================================================

export interface RegistrarCobroPilatesInput {
  studentId: string;
  tipoPlan?: PilatesPlanType;
  importe: number;
  metodoPago: PilatesMetodoPago;
  periodoMes?: string; // YYYY-MM
  sesionesExtra?: number | null;
  conceptoPersonalizado?: string;
  notas?: string;
}

export async function registrarCobroPilates(
  input: RegistrarCobroPilatesInput
): Promise<{ payment: PilatesPayment; updatedStudent: PilatesStudent } | null> {
  const students = getPilatesStudents();
  const idx = students.findIndex((s) => s.id === input.studentId);
  if (idx < 0) return null;

  const student = students[idx];
  const targetPlan = input.tipoPlan || student.tipo_plan;
  const preset =
    PILATES_PLAN_PRESETS.find((p) => p.id === targetPlan) || PILATES_PLAN_PRESETS[0];

  const now = new Date();
  const nowIso = now.toISOString();
  const periodoMes = input.periodoMes || getCurrentYearMonth();

  let sesionesRecargadas: number | null = null;
  let nuevoSaldoSesiones: number | null = null;

  if (preset.esBono) {
    const addCount =
      typeof input.sesionesExtra === "number" && input.sesionesExtra > 0
        ? input.sesionesExtra
        : preset.sesionesIncluidas || 4;
    sesionesRecargadas = addCount;
    const currentSaldo =
      student.es_bono && typeof student.sesiones_restantes === "number"
        ? Math.max(0, student.sesiones_restantes)
        : 0;
    nuevoSaldoSesiones = currentSaldo + addCount;
  }

  const updatedStudent: PilatesStudent = {
    ...student,
    tipo_plan: preset.id,
    es_bono: preset.esBono,
    importe_cuota: Number(input.importe || preset.importeSugerido),
    metodo_pago: input.metodoPago,
    sesiones_restantes: nuevoSaldoSesiones,
    sesiones_totales_bono: preset.esBono
      ? Math.max(preset.sesionesIncluidas ?? 4, nuevoSaldoSesiones ?? 0)
      : null,
    estado: "Activo",
    estado_cuota: "Al día",
    ultimo_mes_pagado: periodoMes,
    actualizado_en: nowIso,
  };

  const nextStudents = [...students];
  nextStudents[idx] = updatedStudent;
  writePilatesStudentsLocal(nextStudents, true, updatedStudent);
  await syncPilatesStudentToCloudIfEnabled(updatedStudent);

  const existingPayments = getPilatesPayments();
  const seq = String(existingPayments.length + 1).padStart(4, "0");
  const recibo = `PIL-${periodoMes.replace("-", "")}-${seq}`;

  const concepto =
    input.conceptoPersonalizado?.trim() ||
    (preset.esBono
      ? `Renovación ${preset.id} (+${sesionesRecargadas} sesiones)`
      : `Cuota ${preset.id} · ${periodoMes}`);

  const payment: PilatesPayment = {
    id: `pil_pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    numero_recibo: recibo,
    fecha_hora: nowIso,
    fecha_corta: now.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    hora_corta: now.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    periodo_mes: periodoMes,
    alumno_id: updatedStudent.id,
    alumno_nombre: updatedStudent.nombre_completo,
    alumno_dni: updatedStudent.dni,
    concepto,
    tipo_plan: preset.id,
    importe: Number(input.importe),
    metodo_pago: input.metodoPago,
    sesiones_recargadas: sesionesRecargadas,
    notas: input.notas?.trim() || undefined,
  };

  writePilatesPaymentsLocal([payment, ...existingPayments], true);

  return { payment, updatedStudent };
}

export function deletePilatesPayment(paymentId: string): void {
  const existing = getPilatesPayments();
  const next = existing.filter((p) => p.id !== paymentId);
  writePilatesPaymentsLocal(next, true);
}

export function exportPilatesPaymentsCsv(payments: PilatesPayment[], periodoLabel: string): void {
  if (typeof window === "undefined") return;
  const headers = [
    "Nº Recibo",
    "Fecha",
    "Hora",
    "Periodo",
    "Alumno Pilates",
    "DNI",
    "Concepto",
    "Plan / Bono",
    "Método de Pago",
    "Importe (EUR)",
  ];

  const escapeCsv = (val: string | number) => {
    const str = String(val ?? "");
    if (str.includes(";") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = payments.map((p) =>
    [
      p.numero_recibo,
      p.fecha_corta,
      p.hora_corta,
      p.periodo_mes,
      p.alumno_nombre,
      p.alumno_dni,
      p.concepto,
      p.tipo_plan,
      p.metodo_pago,
      p.importe.toFixed(2).replace(".", ","),
    ]
      .map(escapeCsv)
      .join(";")
  );

  // UTF-8 BOM para apertura directa en Microsoft Excel España con tildes y columnas perfectas
  const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `facturacion_solo_pilates_${periodoLabel.replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getPilatesDashboardKpis(periodoMes: string = getCurrentYearMonth()) {
  const students = getPilatesStudents();
  const attendances = getPilatesAttendances();
  const payments = getPilatesPayments();
  const todayIso = getTodayISO();

  const activos = students.filter((s) => s.estado === "Activo");
  const alDia = activos.filter(
    (s) => s.estado_cuota === "Al día" && (!s.es_bono || (s.sesiones_restantes ?? 0) > 0)
  );
  const pendientes = activos.filter(
    (s) => s.estado_cuota === "Renovación Pendiente" || (s.es_bono && (s.sesiones_restantes ?? 0) <= 0)
  );
  const asistenciasHoy = attendances.filter((a) => a.fecha_iso === todayIso).length;
  const ingresosMes = payments
    .filter((p) => p.periodo_mes === periodoMes)
    .reduce((acc, p) => acc + (Number(p.importe) || 0), 0);

  return {
    alumnosActivos: activos.length,
    totalRegistrados: students.length,
    cuotasAlDia: alDia.length,
    renovacionesPendientes: pendientes.length,
    asistenciasHoy,
    ingresosMes,
  };
}

// ============================================================================
// 8. IMPORTADOR INTELIGENTE 1-CLIC (CSV / TSV / EXCEL ESPAÑA `;` / XLSX NATIVO)
// ============================================================================

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseDelimitedTextToMatrix(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headerSample = lines[0];
  const semicolons = (headerSample.match(/;/g) || []).length;
  const tabs = (headerSample.match(/\t/g) || []).length;
  const commas = (headerSample.match(/,/g) || []).length;

  let delimiter = ",";
  if (tabs >= semicolons && tabs >= commas && tabs > 0) delimiter = "\t";
  else if (semicolons >= commas && semicolons > 0) delimiter = ";";

  return lines.map((line) => parseCsvLine(line, delimiter));
}

/**
 * Lector ligero nativo de archivos Excel `.xlsx` (OOXML ZIP) sin dependencias externas,
 * usando DecompressionStream('deflate-raw') del navegador moderno.
 */
async function parseXlsxBufferToMatrix(buffer: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const entries = new Map<string, Uint8Array>();

  // Buscar End of Central Directory (EOCD)
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error("Archivo XLSX no reconocido. Puedes guardarlo como CSV UTF-8 desde Excel.");
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder("utf-8");

  for (let idx = 0; idx < totalEntries; idx++) {
    if (view.getUint32(cdOffset, true) !== 0x02014b50) break;
    const compressionMethod = view.getUint16(cdOffset + 10, true);
    const compressedSize = view.getUint32(cdOffset + 20, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localHeaderOffset = view.getUint32(cdOffset + 42, true);

    const fileName = decoder.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen));
    cdOffset += 46 + nameLen + extraLen + commentLen;

    if (
      fileName === "xl/sharedStrings.xml" ||
      fileName === "xl/worksheets/sheet1.xml"
    ) {
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compData = bytes.subarray(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) {
        entries.set(fileName, compData);
      } else if (compressionMethod === 8 && typeof DecompressionStream !== "undefined") {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        writer.write(compData);
        writer.close();
        const decompressedBuf = await new Response(ds.readable).arrayBuffer();
        entries.set(fileName, new Uint8Array(decompressedBuf));
      }
    }
  }

  const sheetBytes = entries.get("xl/worksheets/sheet1.xml");
  if (!sheetBytes) return [];

  const domParser = new DOMParser();
  const sharedStrings: string[] = [];
  const sharedBytes = entries.get("xl/sharedStrings.xml");
  if (sharedBytes) {
    const sharedDoc = domParser.parseFromString(decoder.decode(sharedBytes), "application/xml");
    const siNodes = Array.from(sharedDoc.getElementsByTagName("si"));
    for (const si of siNodes) {
      const tNodes = Array.from(si.getElementsByTagName("t"));
      sharedStrings.push(tNodes.map((t) => t.textContent || "").join(""));
    }
  }

  const sheetDoc = domParser.parseFromString(decoder.decode(sheetBytes), "application/xml");
  const rowNodes = Array.from(sheetDoc.getElementsByTagName("row"));
  const matrix: string[][] = [];

  const colLettersToIndex = (cellRef: string): number => {
    const letters = (cellRef.match(/^[A-Z]+/i)?.[0] || "A").toUpperCase();
    let col = 0;
    for (let i = 0; i < letters.length; i++) {
      col = col * 26 + (letters.charCodeAt(i) - 64);
    }
    return Math.max(0, col - 1);
  };

  for (const rowNode of rowNodes) {
    const cNodes = Array.from(rowNode.getElementsByTagName("c"));
    const rowArr: string[] = [];
    for (const c of cNodes) {
      const ref = c.getAttribute("r") || "";
      const colIdx = ref ? colLettersToIndex(ref) : rowArr.length;
      const cellType = c.getAttribute("t") || "";
      const vText = c.getElementsByTagName("v")[0]?.textContent || "";
      let val = vText;
      if (cellType === "s") {
        const sIdx = parseInt(vText, 10);
        val = !isNaN(sIdx) ? sharedStrings[sIdx] || "" : "";
      } else if (cellType === "inlineStr") {
        val = c.getElementsByTagName("t")[0]?.textContent || "";
      }
      while (rowArr.length < colIdx) rowArr.push("");
      rowArr[colIdx] = val.trim();
    }
    if (rowArr.some((cell) => cell.length > 0)) {
      matrix.push(rowArr);
    }
  }

  return matrix;
}

function inferPilatesPlanFromRaw(rawPlan: string, rawSessions: string): PilatesPlanPreset {
  const norm = normalizeStr(rawPlan);
  const sesNum = parseInt(rawSessions, 10);

  if (norm.includes("maquina")) return PILATES_PLAN_PRESETS[1];
  if (norm.includes("mensual") || norm.includes("flexible") || norm.includes("ilimitad")) {
    return PILATES_PLAN_PRESETS[0];
  }
  if (/\b10\b/.test(norm) || sesNum === 10) return PILATES_PLAN_PRESETS[4];
  if (/\b8\b/.test(norm) || sesNum === 8) return PILATES_PLAN_PRESETS[3];
  if (/\b4\b/.test(norm) || norm.includes("bono") || (!isNaN(sesNum) && sesNum > 0)) {
    return PILATES_PLAN_PRESETS[2];
  }
  return PILATES_PLAN_PRESETS[0];
}

function inferMetodoPagoFromRaw(raw: string): PilatesMetodoPago {
  const norm = normalizeStr(raw);
  if (norm.includes("efectivo") || norm.includes("metalico") || norm.includes("caja")) {
    return "Efectivo";
  }
  if (norm.includes("sepa") || norm.includes("domicili") || norm.includes("recibo")) {
    return "SEPA";
  }
  if (norm.includes("transfer")) {
    return "Transferencia";
  }
  return "TPV";
}

export async function parsePilatesImportFile(file: File): Promise<PilatesImportPreview> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  let matrix: string[][] = [];

  if (ext === "xlsx") {
    const buf = await file.arrayBuffer();
    matrix = await parseXlsxBufferToMatrix(buf);
  } else if (ext === "xml") {
    const buf = await file.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buf);
    const items = [...text.matchAll(/<Elemento>([\s\S]*?)<\/Elemento>/g)].map((m) => {
      const getTag = (tag: string) => {
        const r = m[1].match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
        return r ? r[1].trim() : "";
      };
      return [
        getTag("Numero"),
        getTag("Nombre"),
        getTag("NIF_CIF"),
        getTag("Movil") || getTag("Telefono"),
        getTag("CorreoElectronico"),
        getTag("TipoAlumno"),
        getTag("Estado"),
        getTag("FechaAlta"),
        getTag("FechaBaja"),
      ];
    });
    if (items.length > 0) {
      matrix = [
        ["numero", "nombre_completo", "dni", "telefono", "email", "notas_salud", "estado", "fecha_alta", "fecha_baja"],
        ...items,
      ];
    }
  } else {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("\uFFFD")) {
      text = new TextDecoder("windows-1252").decode(buf);
    }
    matrix = parseDelimitedTextToMatrix(text);
  }

  if (matrix.length < 2) {
    return {
      fileName: file.name,
      totalRows: 0,
      validCandidates: [],
      duplicateCount: 0,
      skippedEmptyRows: 0,
    };
  }

  const rawHeaders = matrix[0].map((h) => normalizeStr(h));
  const findCol = (aliases: string[]): number =>
    rawHeaders.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));

  const idxNombreCompleto = findCol(["nombre_completo", "nombre completo", "alumno", "alumna", "cliente"]);
  const idxNombre = rawHeaders.findIndex(
    (h) => h === "nombre" || h === "nombres" || (h.startsWith("nombre") && !h.includes("completo"))
  );
  const idxApellidos = findCol(["apellido", "apellidos", "primer apellido"]);
  const idxDni = findCol(["dni", "nif", "nie", "documento", "identificacion"]);
  const idxTelefono = findCol(["telefono", "movil", "celular", "tel", "whatsapp"]);
  const idxEmail = findCol(["email", "correo", "e-mail", "mail"]);
  const idxPlan = findCol(["plan", "tarifa", "modalidad", "bono", "tipo_plan", "suscripcion"]);
  const idxImporte = findCol(["cuota", "importe", "precio", "mensualidad", "total"]);
  const idxSesiones = findCol(["sesiones", "clases_restantes", "clases", "saldo", "restantes"]);
  const idxMetodo = findCol(["metodo", "pago", "forma_pago"]);
  const idxIban = findCol(["iban", "cuenta", "banco"]);
  const idxEstadoCuota = findCol(["estado_cuota", "estado pago", "situacion"]);
  const idxFoto = findCol(["foto", "foto_url", "imagen", "avatar"]);
  const idxNotas = findCol(["notas", "salud", "lesion", "observaciones", "comentarios"]);

  const existingStudents = getPilatesStudents();
  const candidates: PilatesImportCandidate[] = [];
  let skippedEmptyRows = 0;
  let duplicateCount = 0;

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    const getCell = (colIdx: number) => (colIdx >= 0 && colIdx < row.length ? String(row[colIdx] || "").trim() : "");

    let nombre = getCell(idxNombre);
    let apellidos = getCell(idxApellidos);
    let nombreCompleto = getCell(idxNombreCompleto);

    if (!nombre && !nombreCompleto && idxNombre < 0 && idxNombreCompleto < 0 && row[0]) {
      nombreCompleto = String(row[0] || "").trim();
    }

    if (nombreCompleto && !nombre) {
      const parts = nombreCompleto.split(/\s+/);
      nombre = parts[0] || "";
      apellidos = parts.slice(1).join(" ");
    } else if (nombre) {
      nombreCompleto = [nombre, apellidos].filter(Boolean).join(" ").trim();
    }

    if (!nombreCompleto) {
      skippedEmptyRows++;
      continue;
    }

    const dni = getCell(idxDni).toUpperCase();
    const telefono = getCell(idxTelefono);
    const email = getCell(idxEmail).toLowerCase();
    const rawPlan = getCell(idxPlan);
    const rawSesiones = getCell(idxSesiones);
    const preset = inferPilatesPlanFromRaw(rawPlan, rawSesiones);

    const rawImporte = getCell(idxImporte).replace("€", "").replace(",", ".").trim();
    const parsedImporte = parseFloat(rawImporte);
    const importeCuota = !isNaN(parsedImporte) && parsedImporte > 0 ? parsedImporte : preset.importeSugerido;

    let sesionesRestantes: number | null = null;
    if (preset.esBono) {
      const parsedSes = parseInt(rawSesiones, 10);
      sesionesRestantes = !isNaN(parsedSes) && parsedSes >= 0 ? parsedSes : preset.sesionesIncluidas;
    }

    const rawEstadoCuota = normalizeStr(getCell(idxEstadoCuota));
    const estadoCuota: PilatesEstadoCuota =
      rawEstadoCuota.includes("pendiente") || rawEstadoCuota.includes("impag")
        ? "Renovación Pendiente"
        : "Al día";

    const normDniRow = normalizeDni(dni);
    const normNameRow = normalizeStr(nombreCompleto);

    const matchedExisting = existingStudents.find((ex) => {
      if (normDniRow.length >= 6 && normalizeDni(ex.dni) === normDniRow) return true;
      if (email && ex.email && ex.email.toLowerCase() === email) return true;
      if (!normDniRow && !email && normalizeStr(ex.nombre_completo) === normNameRow) return true;
      return false;
    });

    const isDuplicate = Boolean(matchedExisting);
    if (isDuplicate) duplicateCount++;

    candidates.push({
      rowNumber: r + 1,
      nombre,
      apellidos,
      nombre_completo: nombreCompleto,
      dni,
      telefono,
      email,
      tipo_plan: preset.id,
      es_bono: preset.esBono,
      importe_cuota: importeCuota,
      sesiones_restantes: sesionesRestantes,
      sesiones_totales_bono: preset.esBono ? preset.sesionesIncluidas : null,
      metodo_pago: inferMetodoPagoFromRaw(getCell(idxMetodo)),
      iban: getCell(idxIban).toUpperCase().replace(/\s+/g, ""),
      estado_cuota: estadoCuota,
      foto_url: getCell(idxFoto),
      notas_salud: getCell(idxNotas),
      isDuplicate,
      duplicateReason: matchedExisting
        ? `Coincide con ${matchedExisting.nombre_completo} (${matchedExisting.codigo_qr})`
        : undefined,
      existingStudentId: matchedExisting?.id,
    });
  }

  return {
    fileName: file.name,
    totalRows: matrix.length - 1,
    validCandidates: candidates,
    duplicateCount,
    skippedEmptyRows,
  };
}

export async function importPilatesStudentsBatch(
  candidates: PilatesImportCandidate[],
  mode: "skip_duplicates" | "upsert" = "skip_duplicates"
): Promise<{ created: number; updated: number; skipped: number }> {
  const current = [...getPilatesStudents()];
  const nowIso = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const cand of candidates) {
    if (cand.isDuplicate && cand.existingStudentId) {
      if (mode === "skip_duplicates") {
        skipped++;
        continue;
      }
      const idx = current.findIndex((s) => s.id === cand.existingStudentId);
      if (idx >= 0) {
        current[idx] = {
          ...current[idx],
          nombre: cand.nombre,
          apellidos: cand.apellidos,
          nombre_completo: cand.nombre_completo,
          dni: cand.dni || current[idx].dni,
          telefono: cand.telefono || current[idx].telefono,
          email: cand.email || current[idx].email,
          tipo_plan: cand.tipo_plan,
          es_bono: cand.es_bono,
          importe_cuota: cand.importe_cuota,
          sesiones_restantes: cand.sesiones_restantes,
          sesiones_totales_bono: cand.sesiones_totales_bono,
          metodo_pago: cand.metodo_pago,
          iban: cand.iban || current[idx].iban,
          estado_cuota: cand.estado_cuota,
          foto_url: cand.foto_url || current[idx].foto_url,
          notas_salud: cand.notas_salud || current[idx].notas_salud,
          actualizado_en: nowIso,
        };
        await syncPilatesStudentToCloudIfEnabled(current[idx]);
        updated++;
        continue;
      }
    }

    const nextQr = generateNextPilatesQrCode(current);
    const newStudent: PilatesStudent = {
      id: generateUuid(),
      codigo_qr: nextQr,
      nombre: cand.nombre,
      apellidos: cand.apellidos,
      nombre_completo: cand.nombre_completo,
      dni: cand.dni,
      telefono: cand.telefono,
      email: cand.email,
      foto_url: cand.foto_url,
      tipo_plan: cand.tipo_plan,
      es_bono: cand.es_bono,
      importe_cuota: cand.importe_cuota,
      sesiones_restantes: cand.sesiones_restantes,
      sesiones_totales_bono: cand.sesiones_totales_bono,
      metodo_pago: cand.metodo_pago,
      iban: cand.iban,
      estado: "Activo",
      estado_cuota: cand.estado_cuota,
      ultimo_mes_pagado: getCurrentYearMonth(),
      notas_salud: cand.notas_salud,
      creado_en: nowIso,
      actualizado_en: nowIso,
    };
    current.unshift(newStudent);
    await syncPilatesStudentToCloudIfEnabled(newStudent);
    created++;
  }

  writePilatesStudentsLocal(current, true);
  return { created, updated, skipped };
}

export function downloadPilatesCsvTemplate(): void {
  if (typeof window === "undefined") return;
  const sampleRows = [
    "nombre;apellidos;dni;telefono;email;plan;cuota;sesiones_restantes;metodo_pago;notas_salud",
    "Elena;Martínez Gómez;50881234Z;611223344;elena.pilates@ejemplo.es;Mensualidad Flexible 24h;55;;TPV;Horario mañana libre",
    "Carmen;Ruiz Navarro;51992345X;622334455;carmen.pilates@ejemplo.es;Bono 8 Sesiones;85;8;Efectivo;Pilates suelo y máquinas",
    "Laura;Sánchez Pérez;52773456M;633445566;laura.pilates@ejemplo.es;Pilates Máquinas Mensual;75;;SEPA;Cuidado zona lumbar",
  ];
  const blob = new Blob(["\uFEFF" + sampleRows.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_importacion_solo_pilates.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// 9. AVISOS NATIVOS DE ESCRITORIO EN SEGUNDO PLANO (WEB NOTIFICATION API)
// ============================================================================

export function getDesktopNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestPilatesDesktopNotifications(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function triggerPilatesDesktopNotification(event: PilatesCheckInEvent): void {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  const isWindowInBackground = document.hidden || !document.hasFocus();
  if (!isWindowInBackground) return;

  try {
    const title = event.requiereAvisoAmable
      ? `Pilates 24h · ${event.nombreCompleto} (Revisar Renovación)`
      : `✓ Acceso Pilates 24h · ${event.nombreCompleto}`;
    const notif = new Notification(title, {
      body: `${event.mensajeEstado} • Entrada ${event.horaEntrada} (${event.codigoQr})`,
      tag: `pilates_checkin_${event.studentId}`,
      silent: true,
    });
    notif.onclick = () => {
      try {
        window.focus();
      } catch {}
      notif.close();
    };
  } catch {}
}
