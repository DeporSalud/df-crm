import studentFeesData from "@/data/student_fees.json";
import { calcularCuotaPorHoras, TarifaItem } from "./tarifasService";

export interface StudentFeeInfo {
  cuotaBase: number;
  adelanto: number;
  netoSep: number;
  claseNombre?: string;
  tipoAlumno?: "adulto" | "infantil";
}

interface FeeEntry {
  nombre: string;
  nfc_token: string | null;
  telefono: string;
  email: string | null;
  clase: string;
  cuota_base: number;
  adelanto: number;
  neto_septiembre: number;
}

const feeMap = studentFeesData as Record<string, FeeEntry>;

/**
 * Calculates class duration in hours from class object or time string (e.g. "17:30 - 18:30" -> 1.0h, "18:30 - 20:00" -> 1.5h)
 */
export function getClassDurationHours(cls: any): number {
  if (!cls) return 1.0;
  if (cls.duracion_minutos) return cls.duracion_minutos / 60;
  
  const horario = cls.horario || "";
  const match = horario.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (match) {
    const startH = parseInt(match[1], 10);
    const startM = parseInt(match[2], 10);
    const endH = parseInt(match[3], 10);
    const endM = parseInt(match[4], 10);
    const diffMins = (endH * 60 + endM) - (startH * 60 + startM);
    if (diffMins > 0) return diffMins / 60;
  }

  const name = (cls.nombre_clase || "").toLowerCase();
  if (name.includes("1.5h") || name.includes("1,5h") || name.includes("avanzado")) {
    return 1.5;
  }
  if (name.includes("45m") || name.includes("baby")) {
    return 1.0; // Baby dance 45m-1h tier
  }

  return 1.0; // Default 1 hour
}

/**
 * Calculates the monthly fee automatically based on the enrolled classes and student type.
 * Official Dance Factory Tariff Table:
 * - 1 hora / semana: 27€ (niños hasta 14 años) y 30€ (adultos)
 * - 1 hora y media / semana: 35€ (niños) y 37€ (adultos)
 * - 2 horas / semana: 41€ (niños) y 45€ (adultos)
 */
export function calculateFeeFromClasses(
  classes: any[], 
  tipoAlumno: "adulto" | "infantil" = "adulto",
  tarifasCustom?: TarifaItem[]
): number {
  if (!classes || classes.length === 0) {
    return tipoAlumno === "infantil" ? 27 : 30;
  }

  // Comprobar si corresponde a la tarifa especial de 25€ para alumnos antiguos:
  // Martes 17:00 de Lucía Zamorano o Jueves 17:00 de Paula Jiménez
  const isSpecialAntiguosBaby = classes.some(c => {
    const prof = (c.profesor || "").toLowerCase();
    const dia = (c.dia_semana || "").toUpperCase();
    const hora = c.hora_inicio || "";
    return (
      (dia === "MARTES" && hora.startsWith("17") && (prof.includes("lucia") || prof.includes("zamorano"))) ||
      (dia === "JUEVES" && hora.startsWith("17") && prof.includes("paula"))
    );
  });

  // Calculate total weekly hours across all enrolled classes
  const totalHours = classes.reduce((sum, c) => sum + getClassDurationHours(c), 0);

  // Si solo asiste a esta clase (1 hora semanal), se aplica la tarifa especial de 25€
  if (isSpecialAntiguosBaby && totalHours <= 1.0) {
    return 25.00;
  }

  return calcularCuotaPorHoras(totalHours, tipoAlumno, tarifasCustom);
}

const OVERRIDES_STORAGE_KEY = "df_student_fees_overrides";

export function getStudentFeeOverrides(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveStudentFeeOverride(studentIdentifier: string, cuota: number): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStudentFeeOverrides();
    current[studentIdentifier] = cuota;
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event("df_student_fees_updated"));
    window.dispatchEvent(new Event("df_pagos_updated"));
  } catch (e) {
    console.error("Error saving student fee override:", e);
  }
}

/**
 * Returns the exact monthly fee, prepaid advance (20€), and net September remittance for a student.
 */
export function getStudentFee(student: {
  id?: string | null;
  nombre_completo?: string | null;
  nfc_token?: string | null;
  email?: string | null;
  telefono?: string | null;
  plan_activo?: string | null;
  fecha_nacimiento?: string | null;
  tipo_alumno?: "adulto" | "infantil" | null;
}): StudentFeeInfo {
  const adelanto = 20; // Todos los alumnos regulares tienen 20€ abonados de matrícula/reserva

  // Determine if student is child/infantil (<= 14 years)
  let tipoAlumno: "adulto" | "infantil" = student.tipo_alumno || "adulto";
  if (!student.tipo_alumno && student.fecha_nacimiento) {
    const birthYear = new Date(student.fecha_nacimiento).getFullYear();
    const currentYear = new Date().getFullYear();
    if (birthYear && (currentYear - birthYear) <= 14) {
      tipoAlumno = "infantil";
    }
  }

  // 1. PRIORITY: Check local manual overrides set by administrator
  const overrides = getStudentFeeOverrides();
  let manualFee: number | undefined = undefined;

  if (student.id && overrides[student.id] !== undefined) {
    manualFee = overrides[student.id];
  } else if (student.nombre_completo && overrides[student.nombre_completo.toLowerCase().trim()] !== undefined) {
    manualFee = overrides[student.nombre_completo.toLowerCase().trim()];
  } else if (student.nfc_token && overrides["card_" + student.nfc_token] !== undefined) {
    manualFee = overrides["card_" + student.nfc_token];
  } else if (student.email && overrides["email_" + student.email.toLowerCase().trim()] !== undefined) {
    manualFee = overrides["email_" + student.email.toLowerCase().trim()];
  }

  if (typeof manualFee === "number" && manualFee > 0) {
    return {
      cuotaBase: manualFee,
      adelanto,
      netoSep: Math.max(0, manualFee - adelanto),
      claseNombre: student.plan_activo || "Clases Regulares",
      tipoAlumno
    };
  }

  // 2. PRIORITY: Check if plan_activo has an explicit price set (e.g. "Clases Regulares (35€/mes)" or "30€")
  if (student.plan_activo) {
    const match = student.plan_activo.match(/(\d+(?:[.,]\d+)?)\s*€/);
    if (match) {
      const parsedFee = parseFloat(match[1].replace(',', '.'));
      if (parsedFee > 0) {
        return {
          cuotaBase: parsedFee,
          adelanto,
          netoSep: Math.max(0, parsedFee - adelanto),
          claseNombre: student.plan_activo,
          tipoAlumno
        };
      }
    }
  }

  // 3. Fallback: Lookup by NFC card token in static feeMap
  if (student.nfc_token) {
    const byCard = feeMap["card_" + student.nfc_token];
    if (byCard) {
      return {
        cuotaBase: byCard.cuota_base,
        adelanto: byCard.adelanto,
        netoSep: byCard.neto_septiembre,
        claseNombre: byCard.clase,
        tipoAlumno
      };
    }
  }

  // 4. Fallback: Lookup by Name in static feeMap
  if (student.nombre_completo) {
    const rawKey = student.nombre_completo.toLowerCase().trim();
    const cleanKey = rawKey.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const byName = feeMap[rawKey] || feeMap[cleanKey] || Object.values(feeMap).find(e => 
      e.nombre && (
        e.nombre.toLowerCase().trim() === rawKey ||
        e.nombre.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === cleanKey
      )
    );
    if (byName) {
      return {
        cuotaBase: byName.cuota_base,
        adelanto: byName.adelanto,
        netoSep: byName.neto_septiembre,
        claseNombre: byName.clase,
        tipoAlumno
      };
    }
  }

  // 5. Fallback: Lookup by Email in static feeMap
  if (student.email) {
    const byEmail = feeMap["email_" + student.email.toLowerCase().trim()];
    if (byEmail) {
      return {
        cuotaBase: byEmail.cuota_base,
        adelanto: byEmail.adelanto,
        netoSep: byEmail.neto_septiembre,
        claseNombre: byEmail.clase,
        tipoAlumno
      };
    }
  }

  // Default fallback for regular courses if not in database
  const defaultCuota = tipoAlumno === "infantil" ? 27 : 30;
  return {
    cuotaBase: defaultCuota,
    adelanto,
    netoSep: Math.max(0, defaultCuota - adelanto),
    claseNombre: student.plan_activo || "Clases Regulares",
    tipoAlumno
  };
}

/**
 * Returns fee information for any given month.
 * In September (or '2026-09'), the 20€ registration advance is applied.
 * In subsequent months (October, November, etc.), the full cuotaBase is charged with 0€ advance deduction.
 */
export function getStudentMonthlyRemittanceFee(
  student: Parameters<typeof getStudentFee>[0],
  monthStr: string = "2026-09"
): { cuotaBase: number; adelantoAbonado: number; importeNeto: number; claseNombre?: string; tipoAlumno?: "adulto" | "infantil" } {
  const feeInfo = getStudentFee(student);
  const isSepMonth = monthStr === "2026-09" || monthStr.toLowerCase().includes("sep");
  const adelantoAbonado = isSepMonth ? feeInfo.adelanto : 0;
  const importeNeto = isSepMonth ? feeInfo.netoSep : feeInfo.cuotaBase;

  return {
    cuotaBase: feeInfo.cuotaBase,
    adelantoAbonado,
    importeNeto,
    claseNombre: feeInfo.claseNombre,
    tipoAlumno: feeInfo.tipoAlumno
  };
}

