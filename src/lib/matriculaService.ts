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

// @ts-ignore
import { getEndOfDayMadrid, getMadridDateISO } from "./timezones.ts";
export { getEndOfDayMadrid, getMadridDateISO };

export const PRECIO_MATRICULA_ANUAL = 15;

export interface BonoItemDefinition {
  id: string;
  nombre: string;
  precio: number | string;
  clasesCount?: number;
  desc?: string;
}

export interface PromoBonoItem {
  id: string;
  nombre: string;
  clasesCount: number;
  precioAlumno: number;
  precioNoAlumno: number;
  precioHabitual: number;
  caducidadTexto: string;
  caducidadISO: string;
}

export const PROMO_SEPTIEMBRE_BONOS: PromoBonoItem[] = [
  {
    id: "promo_sep_4",
    nombre: "Promo Septiembre • 4 Clases",
    clasesCount: 4,
    precioAlumno: 25.00,
    precioNoAlumno: 30.00,
    precioHabitual: 45.00,
    caducidadTexto: "Válido hasta el 30 de Septiembre de 2026",
    caducidadISO: "2026-09-30T23:59:59.000Z"
  },
  {
    id: "promo_sep_8",
    nombre: "Promo Septiembre • 8 Clases",
    clasesCount: 8,
    precioAlumno: 35.00,
    precioNoAlumno: 42.00,
    precioHabitual: 57.00,
    caducidadTexto: "Válido hasta el 30 de Septiembre de 2026",
    caducidadISO: "2026-09-30T23:59:59.000Z"
  },
  {
    id: "promo_sep_12",
    nombre: "Promo Septiembre • 12 Clases",
    clasesCount: 12,
    precioAlumno: 45.00,
    precioNoAlumno: 55.00,
    precioHabitual: 79.00,
    caducidadTexto: "Válido hasta el 30 de Septiembre de 2026",
    caducidadISO: "2026-09-30T23:59:59.000Z"
  }
];

/**
 * Comprueba si la promoción "PROMO OPEN CLASS - SOLO SEPTIEMBRE" está activa.
 * Vigencia oficial: Desde el 9 de septiembre de 2026 hasta el 30 de septiembre de 2026 a las 23:59:59.
 * A partir del 1 de octubre de 2026 (o tras el 30 de septiembre), se desactiva automáticamente.
 */
export function isPromoSeptiembreActive(customDate?: Date | string): boolean {
  const d = customDate ? new Date(customDate) : new Date();
  const start = new Date("2026-09-09T00:00:00");
  const end = new Date("2026-09-30T23:59:59.999");
  return d >= start && d <= end;
}

export function isPromoSeptiembreBono(bonoId?: string | null): boolean {
  if (!bonoId) return false;
  const id = bonoId.toLowerCase();
  return (
    id.includes("promo_sep") || 
    id.includes("promo sep") || 
    id.includes("promo septiembre") ||
    id.includes("promo open class")
  );
}

export interface BonoCalculationInput {
  bonoId: string;
  basePrice?: number;
  student?: any;
  assignedClassIds?: string[];
  userRole?: string;
  isTeacher?: boolean;
  isFirstBonoOfYearExplicit?: boolean;
  isPromoSeptiembre?: boolean;
  clasesCount?: number;
  currentDate?: Date;
}

export type ExemptionType = "regular" | "teacher" | "repeat_buyer" | "promo_septiembre" | "october_renewal_50" | "clase_suelta" | "none";

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
  temporada?: string;
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
  "mario.gadea@dancefactory.es",
  "daniela.merida@dancefactory.es",
  "marta.garci.013@gmail.com",
  "marta.garcia@dancefactory.es",
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
  if (email && (TEACHER_EMAILS.includes(email) || email === "marta.garci.013@gmail.com" || email.endsWith("@dancefactory.es"))) {
    return true;
  }

  const id = (student?.id || emailOrId || "").trim().toLowerCase();
  if (id === "e9cc4200-aba2-4e67-8191-808c40e75621" || id === "1014") {
    return true;
  }

  const planLower = (student?.plan_activo || "").toLowerCase();
  if (planLower.includes("docente") || planLower.includes("profesor")) {
    return true;
  }

  const nameLower = (student?.nombre_completo || "").toLowerCase();
  if (
    nameLower.includes("(docente)") || 
    nameLower.includes("(profesor)") || 
    nameLower.includes("marta garcía vázquez") ||
    nameLower.includes("marta garcia vazquez")
  ) {
    return true;
  }

  return false;
}

export const OPEN_CLASS_IDS = new Set([
  "71b12578-d254-4354-bb1c-e0ebfd0178aa", // Andrea Soto
  "1ee1eefb-7f1a-4423-ac6a-04030c5c0282", // Nil Barberá
  "85165dff-e126-4d32-90d4-2212c2fbb244", // Nerea Olivares
  "1d7df61b-a65e-4f35-82b2-3d34242abb87", // Alejandro Rovina
  "6a374f52-f6d8-447c-be48-e8fe3eca8faf", // Mario Gadea
  "39807014-ee30-4112-99cf-6b361c820834", // Formación Rotativa
  "oc_lunes_1",
  "oc_lunes_2",
  "oc_martes_1",
  "oc_miercoles_1",
  "oc_miercoles_2",
  "oc_jueves_1"
]);

export function isOpenClassId(id?: string | null): boolean {
  if (!id) return false;
  const clean = id.trim().toLowerCase();
  if (clean.startsWith("oc_") || clean.startsWith("open_") || clean.includes("openclass")) {
    return true;
  }
  return OPEN_CLASS_IDS.has(clean) || OPEN_CLASS_IDS.has(id);
}

/**
 * Identifica si un alumno está matriculado en clases regulares:
 * - Asignación en cuadrante / junction `alumnos_clases` (excluyendo Open Classes)
 * - `plan_activo` de clases regulares (infantil, adulto, regular, mensual)
 * - Cuota mensual regular activa
 */
export function isRegularClassStudent(
  student?: any,
  options?: { assignedClassIds?: string[]; enrollmentsCount?: number }
): boolean {
  if (!student) return false;

  const plan = (student.plan_activo || "").trim().toLowerCase();
  const isBonoOrOpen = (
    plan.includes("bono") || 
    plan.includes("open class") || 
    plan.includes("clase suelta") || 
    plan.includes("sesion suelta") || 
    plan.includes("sesión suelta") || 
    plan.includes("promo sep") || 
    plan.includes("septiembre")
  );

  // Helper para descartar IDs de Open Classes (las reservas de Open Class no son matrículas en clases regulares)
  const isRegularClassId = (id: any) => {
    if (!id || typeof id !== "string") return false;
    const clean = id.trim();
    if (clean === "") return false;
    return !isOpenClassId(clean);
  };

  // 1. Asignaciones explícitas en alumnos_clases (filtrando vacíos, nulos y descartando Open Classes)
  const regularAssignedIds = (options?.assignedClassIds || []).filter(isRegularClassId);
  if (regularAssignedIds.length > 0) {
    return true;
  }

  if (Array.isArray(student.alumnos_clases)) {
    const hasRegular = student.alumnos_clases.some((item: any) => {
      const cId = typeof item === "string" ? item : (item?.clase_id || "");
      return isRegularClassId(cId);
    });
    if (hasRegular) return true;
  }

  if (Array.isArray(student.alumnos_clases_ids)) {
    if (student.alumnos_clases_ids.some(isRegularClassId)) return true;
  }

  if (Array.isArray(student.assigned_classes)) {
    if (student.assigned_classes.some(isRegularClassId)) return true;
  }

  // 2. Flags booleanos directos (solo si NO tiene un plan explícito de bono u open class)
  if (!isBonoOrOpen) {
    if (student.es_regular === true || student.es_alumno_regular === true || student.tiene_clases_regulares === true) {
      return true;
    }
  }

  // 3. Inspección de plan_activo: debe ser un plan de clases regulares
  if (plan && plan !== "sin plan activo" && !plan.startsWith("pendiente:")) {
    // Si contiene "regular" o "regulares"
    if (plan.includes("regular") || plan.includes("regulares")) return true;
    if ((plan.includes("infantil") || plan.includes("adulto")) && !isBonoOrOpen) return true;
    if (plan.includes("cuota mensual") || plan.includes("mensualidad regular")) return true;

    // Si es un curso regular conocido (no bono y no open class)
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
  if (!isNaN(cuotaNum) && cuotaNum > 0 && !isBonoOrOpen) {
    return true;
  }

  // 5. Asignación directa a cursos o clases regulares en perfil
  const clasesAsignadas = (student.clase_o_clases || student.clases || student.curso || "").toString().trim().toLowerCase();
  const emptyPlaceholders = ["-", "ninguna", "ninguno", "sin asignar", "sin clase", "sin clases", "no", "n/a", "na", "none", "vacio", "vacío"];
  if (
    clasesAsignadas && 
    !emptyPlaceholders.includes(clasesAsignadas) && 
    !clasesAsignadas.includes("open class") && 
    !clasesAsignadas.includes("bono") &&
    !isBonoOrOpen
  ) {
    return true;
  }

  return false;
}

/**
 * Determines the official Dance Factory academic season for any given date.
 * Sept 1 to June 30:
 * - Months 7..11 (Aug..Dec): Year Y / Year Y+1 (e.g. Aug 2026 -> "2026-2027", Oct 2026 -> "2026-2027")
 * - Months 0..6 (Jan..July): Year Y-1 / Year Y (e.g. Feb 2027 -> "2026-2027")
 */
export function getCurrentSeason(date: Date = new Date()): string {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date(date || Date.now());
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 = Jan, 7 = Aug, 8 = Sept

  if (month >= 7) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

/**
 * Returns UTC Date boundaries for a season string (e.g. "2026-2027").
 */
export function getSeasonDateRange(seasonStr: string): { start: Date; end: Date } {
  const parts = (seasonStr || "").split("-");
  const startYear = parseInt(parts[0], 10) || 2026;
  const endYear = parseInt(parts[1], 10) || (startYear + 1);

  // Pre-season opens August 1st, official season ends June 30th (summer buffer July 31st)
  const start = new Date(Date.UTC(startYear, 7, 1, 0, 0, 0, 0)); // Aug 1
  const end = new Date(Date.UTC(endYear, 6, 31, 23, 59, 59, 999)); // July 31

  return { start, end };
}

/**
 * Evaluates whether student has paid the registration fee for the active season.
 * ZERO localStorage! Reads directly from student entity fetched from Supabase.
 */
export function isMatriculaValidForCurrentSeason(
  student?: any,
  date: Date = new Date()
): boolean {
  if (!student) return false;

  const currentSeason = getCurrentSeason(date);

  // 1. Explicit database season string match
  if (student.temporada_matricula && typeof student.temporada_matricula === "string") {
    const cleanSeason = student.temporada_matricula.trim();
    if (cleanSeason === currentSeason) {
      return student.matricula_pagada === true;
    }
    // If season is explicitly recorded and does NOT match, it is EXPIRED for the new season!
    return false;
  }

  // 2. Date-based verification if matricula_fecha is present
  if (student.matricula_fecha && typeof student.matricula_fecha === "string") {
    const paymentDate = new Date(student.matricula_fecha);
    if (!isNaN(paymentDate.getTime())) {
      const { start, end } = getSeasonDateRange(currentSeason);
      if (paymentDate >= start && paymentDate <= end) {
        return student.matricula_pagada !== false;
      } else {
        // Outside current season range -> expired!
        return false;
      }
    }
  }

  // 3. Boolean flag fallback (if season/date columns not yet backfilled or present)
  if (student.matricula_pagada === true) {
    return true;
  }

  return false;
}

/**
 * Comprueba si el alumno adquirió un bono de Open Class en el mes de septiembre de 2026.
 * Estos alumnos disfrutan de un 50% de descuento en la matrícula al renovar en octubre (7,50 € en vez de 15,00 €).
 * ZERO localStorage!
 */
export function hasPurchasedSeptemberBono(student?: any): boolean {
  if (!student) return false;

  // 1. Flags explícitos
  if (student.bono_septiembre === true || student.compro_bono_septiembre === true || student.promo_septiembre === true) {
    return true;
  }

  // 2. Inspección de plan_activo: debe contener específicamente la promoción o bono de septiembre
  const plan = (student.plan_activo || "").trim().toLowerCase();
  if (
    plan.includes("septiembre") || 
    plan.includes("promo sep") || 
    plan.includes("promo_sep") ||
    plan.includes("promo 4") ||
    plan.includes("promo 8") ||
    plan.includes("promo 12") ||
    plan.includes("bono septiembre")
  ) {
    return true;
  }

  // Si tiene un bono, clase suelta o pase adquirido durante septiembre 2026
  const isSpecificBono = (
    plan.includes("bono") || 
    plan.includes("clase suelta") || 
    plan.includes("sesion suelta") || 
    plan.includes("sesión suelta") || 
    plan.includes("open class") || 
    plan.includes("ilimitad") || 
    plan.includes("pase")
  );
  if (isSpecificBono && student.creado_en) {
    const createdDate = new Date(student.creado_en);
    if (!isNaN(createdDate.getTime()) && 
        createdDate >= new Date("2026-09-01T00:00:00Z") && 
        createdDate < new Date("2026-10-01T00:00:00Z")) {
      return true;
    }
  }

  return false;
}

/**
 * Comprueba si el alumno que compró bono en septiembre ya ha abonado la matrícula reducida de octubre (7,50 €)
 * o la matrícula anual de la temporada.
 * ZERO localStorage!
 */
export function hasPaidOctoberRenewal(student?: any): boolean {
  if (!student) return false;

  if (student.matricula_octubre_pagada === true || student.matricula_renovacion_pagada === true) {
    return true;
  }

  const plan = (student.plan_activo || "").toLowerCase();
  if (plan.includes("renovación octubre") || plan.includes("renovacion octubre") || plan.includes("matrícula octubre")) {
    return true;
  }

  return false;
}

/**
 * Comprueba si el alumno ya ha abonado la matrícula de temporada activa.
 * ZERO localStorage!
 */
export function hasPaidSeasonMatricula(student?: any, date: Date = new Date()): boolean {
  if (!student) return false;

  // 1. Direct season validity
  if (isMatriculaValidForCurrentSeason(student, date)) {
    return true;
  }

  // If student has explicit season or payment date that did NOT match current season, it is expired!
  const currentSeason = getCurrentSeason(date);
  if (student.temporada_matricula && typeof student.temporada_matricula === "string") {
    if (student.temporada_matricula.trim() !== currentSeason) {
      return false;
    }
  }
  if (student.matricula_fecha && typeof student.matricula_fecha === "string") {
    const paymentDate = new Date(student.matricula_fecha);
    if (!isNaN(paymentDate.getTime())) {
      const { start, end } = getSeasonDateRange(currentSeason);
      if (paymentDate < start || paymentDate > end) {
        return false;
      }
    }
  }

  // 2. Flag explícito alternativo
  if (student.matricula_bonos_pagada === true) {
    return true;
  }

  // 3. Comprador de bono de septiembre: solo se considera abonada si ya pagó la renovación de octubre
  if (hasPurchasedSeptemberBono(student)) {
    return hasPaidOctoberRenewal(student);
  }

  // 4. Saldo de clases activo (indica que ya ha adquirido y abonado un bono previo con matrícula pagada)
  const clasesCount = typeof student.clases_restantes === "number"
    ? student.clases_restantes
    : typeof student.clases_restantes === "string"
    ? parseInt(student.clases_restantes, 10)
    : 0;
  if (!isNaN(clasesCount) && clasesCount > 0) {
    return true;
  }

  // 5. Plan activo consolidado previo de bono específico adquirido
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
      plan.includes("suelta")
    );
    if (isSpecificBono && !plan.includes("matrícula") && !plan.includes("matricula")) {
      return true;
    }
  }

  return false;
}

/**
 * Comprueba si el bono seleccionado corresponde a una clase suelta / sesión puntual.
 * Las clases sueltas nunca conllevan cobro de matrícula anual.
 */
export function isClaseSueltaBono(bonoId?: string | null): boolean {
  if (!bonoId) return false;
  const clean = bonoId.trim().toLowerCase();
  return (
    clean.includes("suelta") || 
    clean.includes("1 clase") || 
    clean === "clase_suelta" || 
    clean === "clase suelta" ||
    clean === "sesion puntual" ||
    clean === "sesión puntual"
  );
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
    isFirstBonoOfYearExplicit,
    currentDate
  } = params;

  const calcDate = currentDate ? new Date(currentDate) : new Date();
  const currentSeason = getCurrentSeason(calcDate);
  const teacher = explicitIsTeacher ?? isTeacherProfile(student, undefined, userRole);
  const regular = isRegularClassStudent(student, { assignedClassIds });
  const alreadyPaid = hasPaidSeasonMatricula(student, calcDate);
  const isPromo = isPromoSeptiembreBono(bonoId) || Boolean(params.isPromoSeptiembre);
  const isSeptemberBuyer = hasPurchasedSeptemberBono(student);
  const alreadyPaidRenewal = hasPaidOctoberRenewal(student);

  const fallbackPrices: Record<string, number> = {
    bono_4: 45,
    bono_8: 57,
    bono_10: 79,
    ilimitado: 100,
    clase_suelta: 15,
  };
  const effectiveBasePrice = typeof basePrice === "number" && !isNaN(basePrice) && basePrice > 0
    ? basePrice
    : (fallbackPrices[bonoId] || 45);

  const isClaseSuelta = isClaseSueltaBono(bonoId) || params.clasesCount === 1;

  // 0. CLASE SUELTA (Sesión individual puntual): ¡NUNCA COBRA MATRÍCULA! (0,00 €)
  if (isClaseSuelta) {
    if (teacher) {
      const discountPercentage = 10;
      const discountAmount = Math.round(effectiveBasePrice * 0.10 * 100) / 100;
      const bonoPrice = Math.round(effectiveBasePrice * 0.90 * 100) / 100;
      return {
        bonoId,
        basePrice: effectiveBasePrice,
        discountPercentage,
        discountAmount,
        bonoPrice,
        matriculaCost: 0.00,
        isExempt: true,
        exemptionType: "clase_suelta",
        exemptionLabel: "0,00€ (Sin Matrícula en Clase Suelta)",
        totalToPay: bonoPrice,
        isFirstBonoOfYear: false,
        temporada: currentSeason,
      };
    }

    return {
      bonoId,
      basePrice: effectiveBasePrice,
      discountPercentage: 0,
      discountAmount: 0,
      bonoPrice: effectiveBasePrice,
      matriculaCost: 0.00,
      isExempt: true,
      exemptionType: "clase_suelta",
      exemptionLabel: "0,00€ (Sin Matrícula en Clase Suelta)",
      totalToPay: effectiveBasePrice,
      isFirstBonoOfYear: false,
      temporada: currentSeason,
    };
  }

  // 0. Bono Promoción Septiembre 2026: ¡MATRÍCULA TOTALMENTE GRATUITA (0,00 €)!
  if (isPromo) {
    if (teacher) {
      const discountPercentage = 10;
      const discountAmount = Math.round(effectiveBasePrice * 0.10 * 100) / 100;
      const bonoPrice = Math.round(effectiveBasePrice * 0.90 * 100) / 100;
      return {
        bonoId,
        basePrice: effectiveBasePrice,
        discountPercentage,
        discountAmount,
        bonoPrice,
        matriculaCost: 0.00,
        isExempt: true,
        exemptionType: "promo_septiembre",
        exemptionLabel: "0,00€ (Matrícula Gratuita Promo Septiembre)",
        totalToPay: bonoPrice,
        isFirstBonoOfYear: false,
        temporada: currentSeason,
      };
    }

    return {
      bonoId,
      basePrice: effectiveBasePrice,
      discountPercentage: 0,
      discountAmount: 0,
      bonoPrice: effectiveBasePrice,
      matriculaCost: 0.00,
      isExempt: true,
      exemptionType: "promo_septiembre",
      exemptionLabel: "0,00€ (Matrícula Gratuita Promo Septiembre)",
      totalToPay: effectiveBasePrice,
      isFirstBonoOfYear: false,
      temporada: currentSeason,
    };
  }

  // 1. Docente: 10% dto + 0€ matrícula
  if (teacher) {
    const discountPercentage = 10;
    const discountAmount = Math.round(effectiveBasePrice * 0.10 * 100) / 100;
    const bonoPrice = Math.round(effectiveBasePrice * 0.90 * 100) / 100;
    return {
      bonoId,
      basePrice: effectiveBasePrice,
      discountPercentage,
      discountAmount,
      bonoPrice,
      matriculaCost: 0.00,
      isExempt: true,
      exemptionType: "teacher",
      exemptionLabel: "0,00€ (Exenta por perfil Docente)",
      totalToPay: bonoPrice,
      isFirstBonoOfYear: false,
      temporada: currentSeason,
    };
  }

  // 2. Alumno de Clases Regulares: 0% dto bono + 0€ matrícula (Exenta por ser alumno de Clases Regulares)
  if (regular) {
    return {
      bonoId,
      basePrice: effectiveBasePrice,
      discountPercentage: 0,
      discountAmount: 0,
      bonoPrice: effectiveBasePrice,
      matriculaCost: 0.00,
      isExempt: true,
      exemptionType: "regular",
      exemptionLabel: "0,00€ (Exenta por ser alumno de Clases Regulares)",
      totalToPay: effectiveBasePrice,
      isFirstBonoOfYear: false,
      temporada: currentSeason,
    };
  }

  // 3. Alumno que ya abonó la matrícula previamente esta temporada
  if ((alreadyPaid || alreadyPaidRenewal) && isFirstBonoOfYearExplicit !== true) {
    return {
      bonoId,
      basePrice: effectiveBasePrice,
      discountPercentage: 0,
      discountAmount: 0,
      bonoPrice: effectiveBasePrice,
      matriculaCost: 0.00,
      isExempt: true,
      exemptionType: "repeat_buyer",
      exemptionLabel: "0,00€ (Abonada previamente)",
      totalToPay: effectiveBasePrice,
      isFirstBonoOfYear: false,
      temporada: currentSeason,
    };
  }

  // 4. Alumno que cogió un bono en Septiembre -> 50% de matrícula en Octubre (7,50 €)
  if (isSeptemberBuyer && !alreadyPaidRenewal) {
    return {
      bonoId,
      basePrice: effectiveBasePrice,
      discountPercentage: 0,
      discountAmount: 0,
      bonoPrice: effectiveBasePrice,
      matriculaCost: 7.50,
      isExempt: false,
      exemptionType: "october_renewal_50",
      exemptionLabel: "7,50 € (50% Dto. Renovación Octubre)",
      totalToPay: Math.round((effectiveBasePrice + 7.50) * 100) / 100,
      isFirstBonoOfYear: true,
      temporada: currentSeason,
    };
  }

  // 5. Alumno Exclusivo de Open Class Nuevo (1er bono de la temporada sin bono en septiembre): cobra 15,00 €
  return {
    bonoId,
    basePrice: effectiveBasePrice,
    discountPercentage: 0,
    discountAmount: 0,
    bonoPrice: effectiveBasePrice,
    matriculaCost: 15.00,
    isExempt: false,
    exemptionType: "none",
    exemptionLabel: "+15,00 € (Matrícula Anual)",
    totalToPay: Math.round((effectiveBasePrice + 15.00) * 100) / 100,
    isFirstBonoOfYear: true,
    temporada: currentSeason,
  };
}

/**
 * Mapa de respaldo con las fechas reales verificadas de compra del bono activo
 * (por si algún cliente aún tiene en memoria el creado_en original de agosto/septiembre).
 */
export const VERIFIED_BONO_PURCHASE_DATES: Record<string, string> = {
  "42be437b-6300-42aa-b5f8-dc5141f7628d": "2026-09-16", // Valeria Hernández Bedoya -> 16/10/2026
  "9fafcbbc-24db-40fa-8a9b-6c7198ab7c94": "2026-09-30", // Natalia de los Ríos Sánchez -> 30/10/2026
  "9d83129a-8dd8-4cef-bf2f-903433e9e7a5": "2026-09-30", // Paula Ruiz Talavante -> 30/10/2026
  "ed7cc9f5-a40a-435a-969e-7103911192ea": "2026-10-03", // Sara Romero Rodríguez -> 03/11/2026
  "aeb5112e-15a6-4daf-b839-da6183923f96": "2026-10-05", // Emma Egido -> 05/11/2026
  "2a5df9a7-720f-4f28-b4ac-ebfbf57a0256": "2026-10-05", // Natalia Moreno Sancho -> 05/11/2026
  "aeb9697b-c871-48e0-b521-b659cc3209bd": "2026-10-05", // Lucía San Miguel Mascaraque -> 05/11/2026
  "e43b3444-b1ce-4354-8867-a0132b0cc2fa": "2026-10-05", // Sara Gutiérrez Villanueva -> 05/11/2026
  "4740d7ba-9689-45c7-ac4f-ecbd407901ae": "2026-10-05", // Jimena Sánchez Saiz -> 05/11/2026
  "32d7139b-b2a2-4084-9322-d86cda358df7": "2026-10-05", // Paula Jiménez -> 05/11/2026
  "a075dbaf-3675-438e-8567-b0c35b2c10d0": "2026-10-05", // Daniela Acevedo Sampedro -> 05/11/2026
  "a6d11d42-ea44-4f53-9158-8cd682ed6ff0": "2026-10-06", // Nagore González Rodríguez -> 06/11/2026
  "37eee42c-3cb3-4286-8420-27f10110c0c0": "2026-10-07", // Paula Carril Cano -> 07/11/2026
  "e9cc4200-aba2-4e67-8191-808c40e75621": "2026-10-07", // Marta García Vázquez -> 07/11/2026
  "c57fb3d0-525f-474a-8de7-d6d504b540be": "2026-10-15", // Lucía Muñoz -> 15/11/2026
  "f9bac82e-467c-4f75-a118-671ed15bef66": "2026-10-14", // Mariana Nataly Nunes Nunes -> 14/11/2026
};

/**
 * Suma exactamente 1 mes de calendario en la zona horaria Europe/Madrid
 * (ej. compra el 05/10/2026 -> caduca el 05/11/2026 a las 23:59:59.999 Madrid;
 * compra el 16/09/2026 -> caduca el 16/10/2026 a las 23:59:59.999 Madrid).
 */
export function addOneCalendarMonthMadrid(dateInput: Date | string): Date {
  const madridISO = getMadridDateISO(dateInput);
  if (!madridISO) {
    return getEndOfDayMadrid(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  }
  const [year, month, day] = madridISO.split("-").map(Number);
  const targetMonth = month === 12 ? 1 : month + 1;
  const targetYear = month === 12 ? year + 1 : year;
  const maxDayInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const targetDay = Math.min(day, maxDayInTargetMonth);
  const expISO = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
  return getEndOfDayMadrid(expISO);
}

/**
 * Resta 1 mes de calendario a una fecha de caducidad YYYY-MM-DD para obtener
 * la fecha equivalente de compra/activación (para persistir ediciones manuales en creado_en).
 */
export function subtractOneCalendarMonthMadrid(expirationISO: string): string {
  const madridISO = getMadridDateISO(expirationISO);
  if (!madridISO) return new Date().toISOString();
  const [year, month, day] = madridISO.split("-").map(Number);
  const targetMonth = month === 1 ? 12 : month - 1;
  const targetYear = month === 1 ? year - 1 : year;
  const maxDayInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const targetDay = Math.min(day, maxDayInTargetMonth);
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}T12:00:00.000Z`;
}

/**
 * Calcula con precisión la fecha de caducidad oficial del bono activo del alumno.
 * 
 * Reglas de negocio:
 * 1. Bonos Promo Septiembre (promo_sep_...): caducan el 30 de septiembre de 2026 (23:59:59.999 Europe/Madrid).
 * 2. Bonos Regulares (Bono 4, Bono 8, Bono 10, Pase Ilimitado, Clase Suelta):
 *    Tienen una validez oficial de 1 mes exacto desde su fecha real de compra/activación
 *    (ej. compra el 5 de octubre -> caduca el 5 de noviembre; compra el 16 de septiembre -> caduca el 16 de octubre).
 *    Corte exacto a las 23:59:59.999 hora peninsular España (Europe/Madrid).
 */
export function calculateBonoExpirationDate(
  studentOrPlan?: any,
  storedCaducidadOrCreadoEn?: string | null,
  explicitCaducidad?: string | null,
  explicitStudentId?: string | null
): Date | null {
  if (!studentOrPlan) return null;

  const isPositional = typeof studentOrPlan === "string";
  const student = isPositional
    ? {
        id: explicitStudentId || undefined,
        plan_activo: studentOrPlan,
        creado_en: storedCaducidadOrCreadoEn || undefined,
        bono_caducidad: explicitCaducidad || undefined,
        clases_restantes: 1,
      }
    : studentOrPlan;
  const storedCaducidad = isPositional ? explicitCaducidad : storedCaducidadOrCreadoEn;

  const plan = (student.plan_activo || "").toLowerCase().trim();
  const classesRemaining = typeof student.clases_restantes === "number" ? student.clases_restantes : 0;
  
  const isBono = (
    plan.includes("bono") || 
    plan.includes("pase") || 
    plan.includes("ilimitad") || 
    plan.includes("suelta") || 
    classesRemaining > 0
  );
  if (!isBono || (!isPositional && classesRemaining <= 0)) {
    return null;
  }

  // 1. ¿Es un bono exclusivo de la Promoción de Septiembre?
  const isExplicitPromo = isPromoSeptiembreBono(student.plan_activo) || 
                          plan.includes("promo sep") || 
                          plan.includes("septiembre") || 
                          plan.includes("promoción septiembre") || 
                          plan.includes("promocion septiembre");

  if (isExplicitPromo) {
    return getEndOfDayMadrid("2026-09-30");
  }

  // 2. Determinar la fecha real de compra del bono
  const verifiedPurchaseISO = student.id ? VERIFIED_BONO_PURCHASE_DATES[student.id] : undefined;
  const rawPurchaseStr = student.bono_compra_fecha || student.fecha_compra || student.creado_en;
  const rawPurchaseMadridISO = rawPurchaseStr ? getMadridDateISO(rawPurchaseStr) : "";

  let effectivePurchaseISO = rawPurchaseMadridISO;
  if (verifiedPurchaseISO) {
    // Si creado_en aún tiene la fecha antigua de alta (< 16/09/2026), usar la fecha verificada de compra del bono
    if (!effectivePurchaseISO || effectivePurchaseISO < "2026-09-16") {
      effectivePurchaseISO = verifiedPurchaseISO;
    }
  }

  // 3. Si hay una caducidad explícita en BD (bono_caducidad) o un override manual (storedCaducidad)
  // Ignorar el valor "2026-11-01" heredado en caché si la compra real no fue el "2026-10-01"
  if (student.bono_caducidad) {
    const expMadrid = getMadridDateISO(student.bono_caducidad);
    if (expMadrid && !(expMadrid === "2026-11-01" && effectivePurchaseISO && effectivePurchaseISO !== "2026-10-01")) {
      return getEndOfDayMadrid(expMadrid);
    }
  }

  if (storedCaducidad) {
    const storedMadrid = getMadridDateISO(storedCaducidad);
    if (storedMadrid && !(storedMadrid === "2026-11-01" && effectivePurchaseISO && effectivePurchaseISO !== "2026-10-01")) {
      return getEndOfDayMadrid(storedMadrid);
    }
  }

  // 4. Calcular +1 mes de calendario exacto desde la fecha de compra
  if (effectivePurchaseISO) {
    return addOneCalendarMonthMadrid(effectivePurchaseISO);
  }

  return addOneCalendarMonthMadrid(new Date());
}
