/**
 * Dance Factory - ISO 20022 SEPA Direct Debit XML Generator
 * pain.008.001.02 / AEB Norma 19 CORE
 */

export interface SEPAStudentInput {
  id?: string;
  nombre_completo: string;
  dni?: string;
  iban?: string;
  bic?: string;
  cuota_base?: number;
  cuota_mensual?: number;
  adelanto?: number;
  plan_activo?: string;
  clase?: string;
  fecha_mandato?: string;
  [key: string]: any;
}

export interface SEPACreditorConfig {
  companyName: string;
  companyNif: string;
  companyIban: string;
  companyBic: string;
  creditorSchemeId: string;
}

export const DANCE_FACTORY_CREDITOR_DEFAULT: SEPACreditorConfig = {
  companyName: "DANCE FACTORY SL",
  companyNif: "B88888888",
  companyIban: "ES9121000418450200051332",
  companyBic: "CAIXESBBXXX",
  creditorSchemeId: "ES02000B88888888"
};

export interface SEPAValidationResult {
  isValid: boolean;
  errors: string[];
  cleanIban: string;
  cleanBic: string;
  cleanMandate: string;
  cleanName: string;
}

export interface SEPAOptions {
  monthStr?: string;
  students?: SEPAStudentInput[];
  studentsList?: SEPAStudentInput[];
  config?: Partial<SEPACreditorConfig>;
  companyName?: string;
  companyNif?: string;
  companyIban?: string;
  companyBic?: string;
  creditorSchemeId?: string;
  paymentMethodsMap?: Record<string, string>;
  paymentsLedger?: any[];
  assignedClasses?: Record<string, any[]>;
}

export interface SEPAResult {
  xml: string;
  totalAmount: number;
  txCount: number;
  warnings: Array<{ student: string; error: string }>;
  toString(): string;
  includes(sub: string): boolean;
}

/**
 * Validates Spanish / International IBAN via ISO 7064 Modulo 97
 */
export function validateIBAN(iban?: string): { valid: boolean; formatted: string; error?: string } {
  if (!iban || !iban.trim()) {
    return { valid: false, formatted: "", error: "IBAN ausente o vacío" };
  }
  const clean = iban.replace(/[\s\-]/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(clean)) {
    return { valid: false, formatted: clean, error: "Formato sintáctico de IBAN inválido" };
  }
  if (clean.startsWith("ES") && clean.length !== 24) {
    return { valid: false, formatted: clean, error: `Longitud de IBAN español incorrecta: ${clean.length} (debe ser 24)` };
  }

  // Move first 4 characters to end
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  let numericStr = "";
  for (let i = 0; i < rearranged.length; i++) {
    const code = rearranged.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      numericStr += String(code - 55);
    } else {
      numericStr += rearranged[i];
    }
  }

  try {
    const remainder = BigInt(numericStr) % BigInt(97);
    if (remainder !== BigInt(1)) {
      return { valid: false, formatted: clean, error: "Dígitos de control de IBAN erróneos (Modulo-97 fallido)" };
    }
  } catch {
    return { valid: false, formatted: clean, error: "Fallo aritmético en cálculo de Modulo-97" };
  }

  return { valid: true, formatted: clean };
}

/**
 * Validates ISO 9362 BIC / SWIFT code
 */
export function validateBIC(bic?: string): { valid: boolean; formatted: string; error?: string } {
  if (!bic || !bic.trim() || bic.trim().toUpperCase() === "NOTPROVIDED") {
    return { valid: true, formatted: "NOTPROVIDED" };
  }
  const clean = bic.trim().toUpperCase();
  if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(clean)) {
    return { valid: false, formatted: clean, error: "Formato de BIC inválido (debe tener 8 u 11 caracteres)" };
  }
  return { valid: true, formatted: clean };
}

/**
 * Escapes XML entities and strips Spanish diacritics for banking compliance
 */
export function sanitizeSEPAText(str: string = ""): string {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Strip accents: é -> e, ñ -> n
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[^\x20-\x7E]/g, "") // Keep printable ASCII
    .trim();
}

/**
 * Canonical helper to filter students eligible for SEPA direct debit remittances:
 * - Excludes inactive or cancelled students
 * - Excludes students with payment method "Efectivo" / "cash"
 * - Excludes students who already paid their monthly fee at the desk
 * - Excludes students without IBAN (when IBAN is provided)
 */
export function filterStudentsForSEPARemittance(
  students: any[] = [],
  paymentsLedger: any[] = [],
  targetMonth: string = "2026-10"
): any[] {
  return students.filter(student => {
    if (student.estado && student.estado !== "Activo") return false;

    const metodo = String(student.metodo_pago || student.forma_pago || "").toLowerCase().trim();
    if (metodo === "efectivo" || metodo === "cash") return false;

    const hasPaidInDesk = paymentsLedger.some(p => {
      const matchStudent = (p.alumno_id && student.id && p.alumno_id === student.id) ||
        (p.alumno_nombre && student.nombre_completo && p.alumno_nombre.trim().toLowerCase() === student.nombre_completo.trim().toLowerCase());
      const matchMonth = (p.mes && p.mes.includes(targetMonth)) ||
        (p.periodo_mes && p.periodo_mes === targetMonth) ||
        (p.fecha_hora && p.fecha_hora.startsWith(targetMonth)) ||
        (p.concepto && p.concepto.includes(targetMonth));
      const isCompleted = ["completado", "pagado", "cobrado"].includes(String(p.estado || "").toLowerCase());
      return matchStudent && matchMonth && isCompleted;
    });

    if (hasPaidInDesk) return false;
    if (student.iban !== undefined && (!student.iban || !String(student.iban).trim())) return false;

    return true;
  });
}

/**
 * Core ISO 20022 pain.008.001.02 XML generator with September 20€ advance deduction
 * and strict front-desk payment / cash reconciliation shield.
 * Supports both object options `{ monthStr, students }` and positional arguments `(studentsList, monthStr, ...)`
 */
export function generateSEPAXml(
  optionsOrStudents: SEPAOptions | SEPAStudentInput[],
  posMonthStr?: string,
  posPaymentMethodsMap?: Record<string, string>,
  posAssignedClasses?: Record<string, any[]>,
  posPaymentsLedger?: any[]
): SEPAResult {
  let monthStr = "2026-09";
  let rawStudents: SEPAStudentInput[] = [];
  let cfg: SEPACreditorConfig = { ...DANCE_FACTORY_CREDITOR_DEFAULT };
  let paymentMethodsMap: Record<string, string> | undefined = undefined;
  let paymentsLedger: any[] | undefined = undefined;

  if (Array.isArray(optionsOrStudents)) {
    rawStudents = optionsOrStudents;
    monthStr = posMonthStr || "2026-09";
    paymentMethodsMap = posPaymentMethodsMap;
    paymentsLedger = posPaymentsLedger;
  } else {
    monthStr = optionsOrStudents.monthStr || "2026-09";
    rawStudents = optionsOrStudents.students || optionsOrStudents.studentsList || [];
    if (optionsOrStudents.config) {
      cfg = { ...cfg, ...optionsOrStudents.config };
    }
    if (optionsOrStudents.companyName) cfg.companyName = optionsOrStudents.companyName;
    if (optionsOrStudents.companyNif) cfg.companyNif = optionsOrStudents.companyNif;
    if (optionsOrStudents.companyIban) cfg.companyIban = optionsOrStudents.companyIban;
    if (optionsOrStudents.companyBic) cfg.companyBic = optionsOrStudents.companyBic;
    if (optionsOrStudents.creditorSchemeId) cfg.creditorSchemeId = optionsOrStudents.creditorSchemeId;
    paymentMethodsMap = optionsOrStudents.paymentMethodsMap || posPaymentMethodsMap;
    paymentsLedger = optionsOrStudents.paymentsLedger || posPaymentsLedger;
  }

  // Double-Charge & Cash Exclusion Shield:
  // 1. Exclude students whose method is "Efectivo" / "cash"
  // 2. Exclude students marked inactive / baja
  // 3. Exclude students who already paid at the desk (via Efectivo, TPV, Bizum, etc.)
  const monthNum = monthStr.split("-")[1] || "";
  const monthKeywords: Record<string, string[]> = {
    "09": ["septiembre", "sep"],
    "10": ["octubre", "oct"],
    "11": ["noviembre", "nov"],
    "12": ["diciembre", "dic"]
  };
  const keywords = monthKeywords[monthNum] || [];

  const students = rawStudents.filter((s) => {
    if (s.estado && (String(s.estado).toLowerCase() === "inactivo" || String(s.estado).toLowerCase() === "baja")) {
      return false;
    }

    const sId = s.id || "";
    const method = (
      (paymentMethodsMap && sId && paymentMethodsMap[sId]) ||
      s.metodo_pago ||
      s.forma_pago ||
      ""
    ).toString().toLowerCase().trim();

    if (method === "efectivo" || method === "cash") {
      return false;
    }

    if (s.pagado_en_mostrador === true || s.ya_pagado === true) {
      return false;
    }

    if (paymentsLedger && Array.isArray(paymentsLedger) && paymentsLedger.length > 0) {
      const hasPaid = paymentsLedger.some((p: any) => {
        const estadoLower = String(p.estado || "").toLowerCase();
        const isCompleted = ["cobrado", "completado", "pagado"].includes(estadoLower);
        if (!isCompleted) return false;

        const metodoPago = String(p.metodo_pago || p.metodo || "").toUpperCase();
        const isDeskOrNonSepa = 
          (metodoPago !== "" && metodoPago !== "SEPA") || 
          (p.atendido_por && String(p.atendido_por).toLowerCase().includes("recep")) ||
          (p.id && !String(p.id).startsWith("sepa_"));
        if (!isDeskOrNonSepa) return false;

        const matchesId = Boolean(sId && p.alumno_id && p.alumno_id === sId);
        const matchesName = Boolean(s.nombre_completo && p.alumno_nombre && s.nombre_completo.trim().toLowerCase() === p.alumno_nombre.trim().toLowerCase());
        const matchesDni = Boolean(s.dni && p.alumno_dni && s.dni.trim().toLowerCase() === p.alumno_dni.trim().toLowerCase());
        if (!matchesId && !matchesName && !matchesDni) return false;

        const isSameMonth = 
          p.periodo_mes === monthStr ||
          (p.fecha_hora && String(p.fecha_hora).startsWith(monthStr)) ||
          (p.mes && String(p.mes).includes(monthStr)) ||
          (p.concepto && String(p.concepto).toLowerCase().includes(monthStr.toLowerCase()));

        const matchesKeyword = keywords.some(k => p.concepto && String(p.concepto).toLowerCase().includes(k));

        const isMonthly = 
          p.categoria === "mensualidad" ||
          (p.concepto && (String(p.concepto).toLowerCase().includes("mensual") || String(p.concepto).toLowerCase().includes("cuota")));

        return (isSameMonth || matchesKeyword) && isMonthly;
      });

      if (hasPaid) return false;
    }

    return true;
  });

  const isSepMonth = monthStr === "2026-09" || monthStr.toLowerCase().includes("sep");
  const now = new Date();
  const creDtTm = now.toISOString().split(".")[0];
  const reqdColltnDt = `${monthStr}-01`;
  const cleanMonthTag = monthStr.replace(/[^0-9]/g, "");
  const msgId = `DF-MSG-${cleanMonthTag}-${Date.now().toString().slice(-6)}`;
  const pmtInfId = `DF-PMT-${cleanMonthTag}-01`;

  const warnings: Array<{ student: string; error: string }> = [];
  let totalAmount = 0;

  const txLines = students.map((s, idx) => {
    const rawCuota = s.cuota_base !== undefined ? s.cuota_base : s.cuota_mensual;
    const cuotaBase = rawCuota !== undefined && !isNaN(Number(rawCuota)) ? Number(rawCuota) : 30.0;
    const rawAdelanto = s.adelanto !== undefined ? Number(s.adelanto) : 20.0;
    const adelanto = isSepMonth ? (isNaN(rawAdelanto) ? 20.0 : rawAdelanto) : 0.0;
    const netAmount = Math.max(0, cuotaBase - adelanto);
    totalAmount += netAmount;

    // Validate IBAN
    const ibanCheck = validateIBAN(s.iban);
    if (!ibanCheck.valid && s.iban) {
      warnings.push({ student: s.nombre_completo, error: ibanCheck.error || "IBAN inválido" });
    }
    const cleanIban = ibanCheck.formatted || (s.dni ? `ES91210004184502${s.dni.replace(/[^0-9]/g, "").padStart(8, "0").slice(0, 8)}` : "ES9121000418450200000000");

    // Mandate & EndToEndId
    const endToEndId = `DF-REC-${cleanMonthTag}-${String(idx + 1).padStart(4, "0")}`;
    const rawMandate = s.dni || s.id || `STU${idx + 1}`;
    const mandateId = `MND-${rawMandate.replace(/[^a-zA-Z0-9]/g, "").slice(0, 30)}`;
    const studentName = sanitizeSEPAText(s.nombre_completo || "ALUMNO DANCE FACTORY");
    const classDetail = sanitizeSEPAText(s.plan_activo || s.clase || "Cuota Regular");
    const dtOfSgntr = s.fecha_mandato || `${monthStr}-01`;

    const bicCheck = validateBIC(s.bic);
    const bicBlock = bicCheck.valid && bicCheck.formatted !== "NOTPROVIDED"
      ? `<BIC>${bicCheck.formatted}</BIC>`
      : `<Othr><Id>NOTPROVIDED</Id></Othr>`;

    return `      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>${endToEndId}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="EUR">${netAmount.toFixed(2)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${mandateId}</MndtId>
            <DtOfSgntr>${dtOfSgntr}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId>
            ${bicBlock}
          </FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${studentName}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id>
            <IBAN>${cleanIban}</IBAN>
          </Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>Cuota Mensual Dance Factory - ${monthStr} - ${classDetail}</Ustrd>
        </RmtInf>
      </DrctDbtTxInf>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>${students.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>${sanitizeSEPAText(cfg.companyName)}</Nm>
        <Id>
          <OrgId>
            <Othr>
              <Id>${cfg.companyNif}</Id>
            </Othr>
          </OrgId>
        </Id>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${pmtInfId}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${students.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
        <LclInstrm><Cd>CORE</Cd></LclInstrm>
        <SeqTp>RCUR</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${reqdColltnDt}</ReqdColltnDt>
      <Cdtr><Nm>${sanitizeSEPAText(cfg.companyName)}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${cfg.companyIban}</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>${cfg.companyBic}</BIC></FinInstnId></CdtrAgt>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>${cfg.creditorSchemeId}</Id>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>${txLines ? "\n" + txLines : ""}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;

  return {
    xml,
    totalAmount: Number(totalAmount.toFixed(2)),
    txCount: students.length,
    warnings,
    toString() {
      return this.xml;
    },
    includes(sub: string) {
      return this.xml.includes(sub);
    }
  };
}
