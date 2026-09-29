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
}

export type ExemptionType = "regular" | "teacher" | "repeat_buyer" | "promo_septiembre" | "october_renewal_50" | "none";

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
 * Comprueba si el alumno adquirió un bono de Open Class en el mes de septiembre de 2026.
 * Estos alumnos disfrutan de un 50% de descuento en la matrícula al renovar en octubre (7,50 € en vez de 15,00 €).
 */
export function hasPurchasedSeptemberBono(student?: any): boolean {
  if (!student) return false;

  // 1. Flags explícitos
  if (student.bono_septiembre === true || student.compro_bono_septiembre === true || student.promo_septiembre === true) {
    return true;
  }

  // 2. localStorage si está disponible
  if (typeof window !== "undefined" && student.id) {
    if (localStorage.getItem(`df_has_september_bono_${student.id}`) === "true") {
      return true;
    }
  }

  // 3. Inspección de plan_activo: debe contener específicamente la promoción o bono de septiembre
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

  if (typeof window !== "undefined" && student.id) {
    if (localStorage.getItem(`df_matricula_octubre_paid_${student.id}`) === "true") {
      return true;
    }
    if (localStorage.getItem(`df_matricula_paid_${student.id}`) === "true") {
      return true;
    }
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
    };
  }

  // 4. NUEVA REGLA: Alumno que cogió un bono en Septiembre -> 50% de matrícula en Octubre (7,50 €)
  // No requiere selector 'Soy alumno / No soy alumno', se aplica directamente.
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
  };
}
