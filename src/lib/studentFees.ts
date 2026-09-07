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

/**
 * Returns the exact monthly fee, prepaid advance (20€), and net September remittance for a student.
 */
export function getStudentFee(student: {
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

  // 1. Try lookup by NFC card token
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

  // 2. Try lookup by Name
  if (student.nombre_completo) {
    const key = student.nombre_completo.toLowerCase().trim();
    const byName = feeMap[key];
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

  // 3. Try lookup by Email
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

  // 4. Try parsing fee from plan_activo if present (e.g. "Clases Regulares (30€/mes)" or "37€")
  if (student.plan_activo) {
    const match = student.plan_activo.match(/(\d+)\s*€/);
    if (match) {
      const parsedFee = parseInt(match[1], 10);
      if (parsedFee > 0) {
        return {
          cuotaBase: parsedFee,
          adelanto,
          netoSep: Math.max(0, parsedFee - adelanto),
          claseNombre: "Clases Regulares",
          tipoAlumno
        };
      }
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

