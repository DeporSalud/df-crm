/**
 * Access Control Service for Dance Factory CRM.
 * Evaluates student access eligibility and blocks inactive, unpaid ("cuota impagada"),
 * unassigned plan, or exhausted balance students immediately.
 * Compliant with Milestone 2 Requirement R1.1.
 */

export type AccessDenialReason = 
  | "ALUMNO_NO_ENCONTRADO"
  | "ESTADO_INACTIVO"
  | "CUOTA_IMPAGADA"
  | "SIN_PLAN_ACTIVO"
  | "BONO_AGOTADO";

export interface AccessEvaluationResult {
  granted: boolean;
  reason: "ACCESO_AUTORIZADO" | AccessDenialReason;
  overlayColor: "red" | "green";
  sound: "sawtooth" | "sine";
  message: string;
  motivoDetallado?: string;
}

export interface StudentAccessCandidate {
  id: string;
  nombre_completo: string;
  estado?: string | null;
  plan_activo?: string | null;
  clases_restantes?: number | null;
  cuota_impagada?: boolean | string | number | null;
  estado_pago?: string | null;
  [key: string]: any;
}

/**
 * Detects whether a student has an unpaid monthly fee ("cuota impagada")
 * across DB properties, payment ledger, and reception overrides.
 */
export function isCuotaImpagada(student: any): boolean {
  if (!student) return false;

  // 1. Explicit boolean or truthy property on student object
  if (
    student.cuota_impagada === true || 
    student.cuota_impagada === "true" || 
    student.cuota_impagada === 1 ||
    student.cuota_impagada === "1"
  ) {
    return true;
  }

  // 2. Status flag
  const estadoStr = String(student.estado || "").trim().toLowerCase();
  const estadoPagoStr = String(student.estado_pago || "").trim().toLowerCase();

  if (
    estadoStr === "impagado" || 
    estadoStr === "cuota impagada" ||
    estadoPagoStr === "impagado" ||
    estadoPagoStr === "pendiente"
  ) {
    return true;
  }

  // 3. Persistent localStorage check for reception flags and pending ledger
  if (typeof window !== "undefined") {
    try {
      // Check reception override set
      const rawImpagados = localStorage.getItem("df_cuotas_impagadas");
      if (rawImpagados) {
        const impagados: string[] = JSON.parse(rawImpagados);
        const normName = (student.nombre_completo || "").toLowerCase().trim();
        if (
          impagados.includes(student.id) || 
          (normName && impagados.includes(normName))
        ) {
          return true;
        }
      }

      // Check pending mensualidad in payments ledger
      const rawPagos = localStorage.getItem("df_pagos_transacciones_v1");
      if (rawPagos) {
        const pagos: any[] = JSON.parse(rawPagos);
        const normName = (student.nombre_completo || "").toLowerCase().trim();
        const hasPendingMonthly = pagos.some(p => 
          (p.alumno_id === student.id || (p.alumno_nombre && p.alumno_nombre.toLowerCase().trim() === normName)) &&
          (p.estado === "Pendiente" || p.estado === "Impagado") &&
          (p.categoria === "mensualidad" || p.categoria === "cuota")
        );
        if (hasPendingMonthly) return true;
      }
    } catch (e) {
      console.warn("[AccessControl] Error evaluando cuota impagada:", e);
    }
  }

  return false;
}

/**
 * Evaluates student access eligibility.
 * Adheres strictly to Requirement R1.1, PROJECT.md contracts, and e2e-tests.
 */
export function evaluateReceptionAccess(student: any): AccessEvaluationResult {
  // 1. Check if student exists
  if (!student) {
    return {
      granted: false,
      reason: "ALUMNO_NO_ENCONTRADO",
      overlayColor: "red",
      sound: "sawtooth",
      message: "⛔ ACCESO DENEGADO: Código no reconocido o alumno inexistente. Pasar por mostrador de recepción",
      motivoDetallado: "Alumno no encontrado"
    };
  }

  // 2. Check student status (must be strictly 'Activo')
  const estadoTrim = (student.estado || "").trim();
  if (estadoTrim !== "Activo" && estadoTrim.toLowerCase() !== "activo") {
    return {
      granted: false,
      reason: "ESTADO_INACTIVO",
      overlayColor: "red",
      sound: "sawtooth",
      message: `⛔ ACCESO DENEGADO: El alumno ${student.nombre_completo} está ${student.estado || "Inactivo"}. Pasar por mostrador de recepción`,
      motivoDetallado: `Alumno ${student.estado || "Inactivo"}`
    };
  }

  // 3. Check for unpaid fees ("cuota impagada")
  if (isCuotaImpagada(student)) {
    return {
      granted: false,
      reason: "CUOTA_IMPAGADA",
      overlayColor: "red",
      sound: "sawtooth",
      message: `⛔ ACCESO DENEGADO: ${student.nombre_completo} tiene cuota impagada. Pasar por mostrador de recepción`,
      motivoDetallado: "CUOTA MENSUAL IMPAGADA"
    };
  }

  // 4. Normalize and check plan status
  const planLower = (student.plan_activo || "").toLowerCase().trim();
  const sinPlan = 
    !student.plan_activo || 
    planLower === "" || 
    planLower.includes("sin plan") || 
    planLower.includes("ningun") || 
    planLower.includes("pendiente");

  // 5. Determine if student is on a bono or regular membership
  const isRegularOrUnlimited = 
    planLower.includes("regular") || 
    planLower.includes("mensual") || 
    planLower.includes("ilimitad") || 
    planLower.includes("cuota") ||
    student.clases_restantes === null;

  const isBono = 
    planLower.includes("bono") || 
    planLower.includes("suelta") || 
    (!isRegularOrUnlimited && student.clases_restantes !== null && student.clases_restantes !== undefined);

  // 6. Check for exhausted bono (saldo <= 0)
  const bonoAgotado = isBono && (
    student.clases_restantes === null || 
    student.clases_restantes === undefined || 
    student.clases_restantes <= 0
  );

  if (sinPlan) {
    return {
      granted: false,
      reason: "SIN_PLAN_ACTIVO",
      overlayColor: "red",
      sound: "sawtooth",
      message: `⛔ ACCESO DENEGADO: ${student.nombre_completo} está SIN PLAN ACTIVO. Pasar por mostrador de recepción`,
      motivoDetallado: "SIN PLAN ACTIVO (No matriculado ni con bono)"
    };
  }

  if (bonoAgotado) {
    return {
      granted: false,
      reason: "BONO_AGOTADO",
      overlayColor: "red",
      sound: "sawtooth",
      message: `⛔ ACCESO DENEGADO: ${student.nombre_completo} está con BONO AGOTADO (0 clases restantes). Pasar por mostrador de recepción`,
      motivoDetallado: `BONO AGOTADO (0 clases restantes en ${student.plan_activo || "Bono"})`
    };
  }

  // 7. Access authorized
  return {
    granted: true,
    reason: "ACCESO_AUTORIZADO",
    overlayColor: "green",
    sound: "sine",
    message: `✓ ACCESO AUTORIZADO: Bienvenido/a ${student.nombre_completo}`
  };
}

/**
 * Dispatches access denial events across local CustomEvent and BroadcastChannel.
 */
export function dispatchAccessDenied(detail: {
  student?: any;
  reason: string;
  message: string;
  rawCode?: string;
}): void {
  if (typeof window === "undefined") return;

  try {
    window.dispatchEvent(new CustomEvent("df_checkin_denied", { detail }));
  } catch (e) {
    console.warn("[AccessControl] Error disparando df_checkin_denied:", e);
  }

  try {
    const channel = new BroadcastChannel("dance_factory_sync");
    channel.postMessage({
      type: "df_checkin_denied",
      ...detail,
      timestamp: Date.now()
    });
    channel.close();
  } catch (e) {
    // BroadcastChannel might not be supported in older test environments
  }
}
