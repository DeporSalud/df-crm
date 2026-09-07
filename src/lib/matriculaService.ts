/**
 * Matricula Service - Dance Factory Alcorcón
 * 
 * Reglas de Exención y Cobro de Matrícula Anual (15,00 €):
 * 1. Alumnos de Clases Regulares: EXENCIÓN TOTAL (0,00 €).
 *    - Detectado por registros en `alumnos_clases`, `plan_activo` de clases regulares o cuota regular.
 * 2. Profesores / Claustro Docente: EXENCIÓN TOTAL (0,00 €) + 10% dto en el bono.
 *    - Detectado por rol profesor, email docente o `plan_activo` docente.
 * 3. Alumnos Exclusivos de Open Class:
 *    - 1ª compra de la temporada: 15,00 € (Matrícula Anual Oficial).
 *    - Compras posteriores: 0,00 € (ya abonada en compra anterior o saldo activo).
 */

export interface BonoItemDefinition {
  id: string;
  nombre: string;
  precio: number | string;
  clasesCount?: number;
  desc?: string;
}

export interface BonoCalculationInput {
  bonoId: string;
  basePrice: number;
  student?: any;
  assignedClassIds?: string[];
  userRole?: string;
  isTeacher?: boolean;
  isFirstBonoOfYearExplicit?: boolean;
}

export type ExemptionType = "regular" | "teacher" | "repeat_buyer" | "none";

export interface BonoCalculationResult {
  bonoId: string;
  basePrice: number;
  discountPercentage: number;
  discountAmount: number;
  bonoPrice: number;
  matriculaCost: number;
  isExempt: boolean;
  exemptionType: ExemptionType;
  exemptionLabel: string;
  totalToPay: number;
  isFirstBonoOfYear: boolean;
}

export const TEACHER_EMAILS = [
  "lucia.munoz@dancefactory.es",
  "lucia.zamorano@dancefactory.es",
  "andrea.soto@dancefactory.es",
  "eva.leiva@dancefactory.es",
  "lucas.lopez@dancefactory.es",
  "paula.jimenez@dancefactory.es",
  "abel.nayara@dancefactory.es",
  "dario.humberto@dancefactory.es",
  "nerea.olivares@dancefactory.es",
  "alejandro.rovina@dancefactory.es",
  "nil.barbera@dancefactory.es",
  "ruth.dominguez@dancefactory.es",
  "admin@dancefactory.es"
];

/**
 * Identifica si el perfil corresponde a un docente / profesor de Dance Factory.
 */
export function isTeacherProfile(student?: any, emailOrId?: string, userRole?: string): boolean {
  const role = (userRole || student?.rol || student?.role || "").toString().trim().toLowerCase();
  if (role === "profesor" || role === "docente" || role === "teacher") return true;
  if (student?.es_docente === true || student?.es_profesor === true) return true;

  const email = (student?.email || emailOrId || "").trim().toLowerCase();
  if (email && (TEACHER_EMAILS.includes(email) || email.endsWith("@dancefactory.es"))) {
    return true;
  }

  const planLower = (student?.plan_activo || "").toLowerCase();
  if (planLower.includes("docente") || planLower.includes("profesor")) {
    return true;
  }

  const nameLower = (student?.nombre_completo || "").toLowerCase();
  if (nameLower.includes("(docente)") || nameLower.includes("(profesor)")) {
    return true;
  }

  return false;
}

/**
 * Identifica si un alumno está matriculado en clases regulares:
 * - Asignación en cuadrante / junction `alumnos_clases`
 * - `plan_activo` de clases regulares (infantil, adulto, regular, mensual)
 * - Cuota mensual regular activa
 */
export function isRegularClassStudent(
  student?: any,
  options?: { assignedClassIds?: string[]; enrollmentsCount?: number }
): boolean {
  if (!student) return false;

  // 1. Asignaciones explícitas en alumnos_clases (filtrando vacíos o nulos)
  if (options?.assignedClassIds && options.assignedClassIds.filter(id => Boolean(id && typeof id === "string" && id.trim() !== "")).length > 0) {
    return true;
  }
  if (typeof options?.enrollmentsCount === "number" && options.enrollmentsCount > 0) {
    return true;
  }
  if (Array.isArray(student.alumnos_clases) && student.alumnos_clases.filter((item: any) => item && (item.clase_id || (typeof item === "string" && item.trim() !== ""))).length > 0) {
    return true;
  }
  if (Array.isArray(student.alumnos_clases_ids) && student.alumnos_clases_ids.filter((id: any) => Boolean(id && typeof id === "string" && id.trim() !== "")).length > 0) {
    return true;
  }
  if (Array.isArray(student.assigned_classes) && student.assigned_classes.filter((id: any) => Boolean(id && typeof id === "string" && id.trim() !== "")).length > 0) {
    return true;
  }

  // 2. Flags booleanos directos
  if (student.es_regular === true || student.es_alumno_regular === true || student.tiene_clases_regulares === true) {
    return true;
  }

  // 3. Inspección de plan_activo
  const plan = (student.plan_activo || "").trim().toLowerCase();
  if (plan && plan !== "sin plan activo" && !plan.startsWith("pendiente:")) {
    // Si contiene "regular", "infantil" o "adulto"
    if (plan.includes("regular") || plan.includes("regulares")) return true;
    if (plan.includes("infantil") || plan.includes("adulto")) return true;
    if (plan.includes("cuota mensual") || plan.includes("mensualidad regular")) return true;

    // Si es un curso regular conocido (no bono y no open class)
    const isBonoOrOpen = plan.includes("bono") || plan.includes("open class") || plan.includes("clase suelta");
    if (!isBonoOrOpen && (
      plan.includes("baile") || plan.includes("danza") || plan.includes("hip hop") || 
      plan.includes("ballet") || plan.includes("contemporaneo") || plan.includes("contemporáneo") ||
      plan.includes("urban") || plan.includes("urbano") || plan.includes("k-pop") || plan.includes("kpop") ||
      plan.includes("jazz") || plan.includes("flamenco") || plan.includes("salsa") || plan.includes("bachata") ||
      plan.includes("heels") || plan.includes("comercial") || plan.includes("dancehall")
    )) {
      return true;
    }
  }

  // 4. Cuota mensual configurada en perfil (numérica o parseable de texto)
  const cuotaNum = typeof student.cuota_mensual === "number"
    ? student.cuota_mensual
    : typeof student.cuota_mensual === "string"
    ? parseFloat(student.cuota_mensual.replace(",", ".").replace(/[^0-9.]/g, ""))
    : 0;
  if (!isNaN(cuotaNum) && cuotaNum > 0) {
    return true;
  }

  // 5. Asignación directa a cursos o clases regulares en perfil
  const clasesAsignadas = (student.clase_o_clases || student.clases || student.curso || "").toString().trim().toLowerCase();
  const emptyPlaceholders = ["-", "ninguna", "ninguno", "sin asignar", "sin clase", "sin clases", "no", "n/a", "na", "none", "vacio", "vacío"];
  if (
    clasesAsignadas && 
    !emptyPlaceholders.includes(clasesAsignadas) && 
    !clasesAsignadas.includes("open class") && 
    !clasesAsignadas.includes("bono")
  ) {
    return true;
  }

  return false;
}

/**
 * Comprueba si el alumno ya ha abonado la matrícula de temporada 2026/2027
 * (por ejemplo en una compra anterior de bono o registro previo).
 */
export function hasPaidSeasonMatricula(student?: any): boolean {
  if (!student) return false;

  // 1. Flag explícito
  if (student.matricula_pagada === true || student.matricula_bonos_pagada === true) {
    return true;
  }

  // 2. Fecha de matrícula de temporada registrada
  if (student.matricula_fecha && typeof student.matricula_fecha === "string" && student.matricula_fecha.trim() !== "") {
    return true;
  }

  // 3. Saldo de clases activo (indica que ya ha adquirido y abonado un bono previo)
  const clasesCount = typeof student.clases_restantes === "number"
    ? student.clases_restantes
    : typeof student.clases_restantes === "string"
    ? parseInt(student.clases_restantes, 10)
    : 0;
  if (!isNaN(clasesCount) && clasesCount > 0) {
    return true;
  }

  // 4. Plan activo consolidado previo de bono específico adquirido
  // NOTA: NO incluir 'open class' genérico aquí, porque los alumnos exclusivos de Open Class
  // tienen la etiqueta/categoría 'Open Class' pero deben abonar la matrícula en su 1ª compra.
  const plan = (student.plan_activo || "").trim().toLowerCase();
  if (
    plan && 
    plan !== "sin plan activo" && 
    plan !== "sin plan" && 
    !plan.startsWith("pendiente:") && 
    !plan.startsWith("solicitud:")
  ) {
    const isSpecificBono = (
      plan.includes("bono 4") || 
      plan.includes("bono 8") || 
      plan.includes("bono 10") || 
      plan.includes("ilimitad") || 
      plan.includes("pase") ||
      plan.includes("clase suelta") ||
      plan.includes("sesion suelta") ||
      plan.includes("sesión suelta")
    );
    if (isSpecificBono && !plan.includes("matrícula") && !plan.includes("matricula")) {
      return true;
    }
  }

  return false;
}

/**
 * Calcula el desglose oficial de precios y matrícula para la compra de bonos.
 */
export function calculateBonoPriceAndMatricula(params: BonoCalculationInput): BonoCalculationResult {
  const {
    bonoId,
    basePrice,
    student,
    assignedClassIds,
    userRole,
    isTeacher: explicitIsTeacher,
    isFirstBonoOfYearExplicit
  } = params;

  const teacher = explicitIsTeacher ?? isTeacherProfile(student, undefined, userRole);
  const regular = isRegularClassStudent(student, { assignedClassIds });
  const alreadyPaid = hasPaidSeasonMatricula(student);

  // 1. Docente: 10% dto + 0€ matrícula
  if (teacher) {
    const discountPercentage = 10;
    const discountAmount = Math.round(basePrice * 0.10 * 100) / 100;
    const bonoPrice = Math.round(basePrice * 0.90 * 100) / 100;
    return {
      bonoId,
      basePrice,
      discountPercentage,
      discountAmount,
      bonoPrice,
      matriculaCost: 0.00,
      isExempt: true,
      exemptionType: "teacher",
      exemptionLabel: "0,00€ (Exenta por perfil Docente)",
      totalToPay: bonoPrice,
      isFirstBonoOfYear: false,
    };
  }

  // 2. Alumno de Clases Regulares: 0% dto bono + 0€ matrícula (Exenta por ser alumno de Clases Regulares)
  if (regular) {
    return {
      bonoId,
      basePrice,
      discountPercentage: 0,
      discountAmount: 0,
      bonoPrice: basePrice,
      matriculaCost: 0.00,
      isExempt: true,
      exemptionType: "regular",
      exemptionLabel: "0,00€ (Exenta por ser alumno de Clases Regulares)",
      totalToPay: basePrice,
      isFirstBonoOfYear: false,
    };
  }

  // 3. Alumno Exclusivo de Open Class que ya abonó la matrícula previamente
  if (alreadyPaid && isFirstBonoOfYearExplicit !== true) {
    return {
      bonoId,
      basePrice,
      discountPercentage: 0,
      discountAmount: 0,
      bonoPrice: basePrice,
      matriculaCost: 0.00,
      isExempt: true,
      exemptionType: "repeat_buyer",
      exemptionLabel: "0,00€ (Abonada previamente)",
      totalToPay: basePrice,
      isFirstBonoOfYear: false,
    };
  }

  // 4. Alumno Exclusivo de Open Class (1er bono de la temporada): cobra 15,00 €
  return {
    bonoId,
    basePrice,
    discountPercentage: 0,
    discountAmount: 0,
    bonoPrice: basePrice,
    matriculaCost: 15.00,
    isExempt: false,
    exemptionType: "none",
    exemptionLabel: "+15,00 € (Matrícula Anual)",
    totalToPay: Math.round((basePrice + 15.00) * 100) / 100,
    isFirstBonoOfYear: true,
  };
}
