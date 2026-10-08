/**
 * Dance Factory - RFC 4180 Compliant CSV Utilities
 * Supports UTF-8 BOM, delimiter auto-detection (';' and ','),
 * proper quote escaping, student roster export & import.
 */

import { getTipoAlumnoFromBirthDate } from "./studentFees";

export const UTF8_BOM = "\uFEFF";

/**
 * Auto-detects whether the CSV uses semicolon (';') or comma (',') as delimiter.
 * Semicolon is the standard European/Spanish Excel default.
 */
export function detectCSVDelimiter(text: string): string {
  if (!text) return ";";
  // Look at the first non-empty line
  const lines = text.replace(UTF8_BOM, "").split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return ";";
  const firstLine = lines[0];

  let semicolonCount = 0;
  let commaCount = 0;
  let inQuotes = false;

  for (let i = 0; i < firstLine.length; i++) {
    const char = firstLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (char === ';') semicolonCount++;
      else if (char === ',') commaCount++;
    }
  }

  // If semicolons are present, prefer semicolon (common in Spanish Excel)
  if (semicolonCount > 0 && semicolonCount >= commaCount) {
    return ";";
  }
  if (commaCount > 0) {
    return ",";
  }
  return ";";
}

/**
 * Escapes a single cell value according to RFC 4180 rules.
 * Wraps in quotes if the string contains the delimiter, quotes, or newlines.
 * Double-quotes inside the value are escaped as '""'.
 */
export function escapeCSVCell(value: any, delimiter: string = ";"): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * RFC 4180 character-by-character CSV parser.
 * Handles quoted fields, embedded newlines, escaped quotes, and trims BOM.
 */
export function parseCSV(text: string, customDelimiter?: string): string[][] {
  if (!text) return [];
  const cleanText = text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text;
  const delimiter = customDelimiter || detectCSVDelimiter(cleanText);

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < cleanText.length) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = "";
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        currentField = "";
        if (currentRow.some(cell => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        currentField = "";
        if (currentRow.some(cell => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Push remainder
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Builds an RFC 4180 CSV string with UTF-8 BOM prefix.
 */
export function buildCSVString(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  delimiter: string = ";"
): string {
  const headerLine = headers.map(h => escapeCSVCell(h, delimiter)).join(delimiter);
  const rowLines = rows.map(row => 
    row.map(cell => escapeCSVCell(cell, delimiter)).join(delimiter)
  );
  return UTF8_BOM + [headerLine, ...rowLines].join("\r\n");
}

/**
 * Triggers a browser download of CSV content with proper UTF-8 BOM encoding.
 */
export function downloadCSV(filename: string, csvContent: string): void {
  if (typeof window === "undefined") return;
  const content = csvContent.startsWith(UTF8_BOM) ? csvContent : UTF8_BOM + csvContent;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports the student roster to an Excel-friendly CSV file with UTF-8 BOM.
 */
export function exportAlumnosCSV(
  alumnos: any[], 
  filename: string = `alumnos_dance_factory_${new Date().toISOString().slice(0, 10)}.csv`,
  delimiter: string = ";"
): void {
  const headers = [
    "Nombre Completo",
    "DNI",
    "Email",
    "Teléfono",
    "Sede",
    "Fecha Nacimiento",
    "Tipo Alumno",
    "Plan Activo",
    "Clases Restantes",
    "Estado",
    "IBAN",
    "Titular Cuenta",
    "Método Pago",
    "NFC Token",
    "Dirección",
    "Notas"
  ];

  const rows = alumnos.map(a => {
    const sedeLabel = a.sede === "castilla" ? "Studio 2 Paseo Castilla" : "Studio 1 Plaza El Tejar";
    return [
      a.nombre_completo || "",
      a.dni || "",
      a.email || "",
      a.telefono || "",
      sedeLabel,
      a.fecha_nacimiento || "",
      a.tipo_alumno || "adulto",
      a.plan_activo || "Clases Regulares",
      a.clases_restantes ?? "",
      a.estado || "Activo",
      a.iban || "",
      a.titular_cuenta || "",
      a.metodo_pago || "SEPA",
      a.nfc_token || "",
      a.direccion || "",
      a.notas || ""
    ];
  });

  const csv = buildCSVString(headers, rows, delimiter);
  downloadCSV(filename, csv);
}

/**
 * Parses and maps CSV student import data to Supabase student schema.
 * Handles flexible header names, auto-detects delimiter, and calculates
 * tipo_alumno via exact age if fecha_nacimiento is provided.
 */
export function parseAlumnosCSV(text: string): {
  valid: any[];
  errors: string[];
} {
  const parsedRows = parseCSV(text);
  const valid: any[] = [];
  const errors: string[] = [];

  if (parsedRows.length <= 1) {
    errors.push("El archivo CSV está vacío o solo contiene la fila de cabeceras.");
    return { valid, errors };
  }

  const rawHeaders = parsedRows[0];
  const normalizedHeaders = rawHeaders.map(h => 
    h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
  );

  const getColIndex = (...candidates: string[]): number => {
    for (const c of candidates) {
      const idx = normalizedHeaders.findIndex(h => h.includes(c));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxNombre = getColIndex("nombre completo", "nombre", "alumno");
  const idxDni = getColIndex("dni", "nif", "documento");
  const idxEmail = getColIndex("email", "correo");
  const idxTelefono = getColIndex("telefono", "movil", "celular", "tel");
  const idxSede = getColIndex("sede");
  const idxFechaNac = getColIndex("fecha nacimiento", "nacimiento", "cumpleanos");
  const idxTipo = getColIndex("tipo alumno", "tipo", "categoria");
  const idxPlan = getColIndex("plan activo", "plan", "tarifa");
  const idxClases = getColIndex("clases restantes", "clases");
  const idxEstado = getColIndex("estado");
  const idxIban = getColIndex("iban", "cuenta");
  const idxTitular = getColIndex("titular");
  const idxMetodo = getColIndex("metodo", "pago");
  const idxNfc = getColIndex("nfc", "tarjeta");
  const idxDireccion = getColIndex("direccion", "domicilio");
  const idxNotas = getColIndex("notas", "observaciones");

  const hasNamedHeaders = idxNombre !== -1;
  const dataRows = parsedRows.slice(1);

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rowNum = r + 2;

    if (row.length === 0 || row.every(cell => !cell || cell.trim() === "")) {
      continue;
    }

    if (hasNamedHeaders) {
      const nombre = row[idxNombre]?.trim();
      if (!nombre) {
        errors.push(`Fila ${rowNum}: El nombre del alumno es obligatorio.`);
        continue;
      }

      const emailRaw = idxEmail !== -1 ? row[idxEmail]?.trim() : null;
      const email = emailRaw && emailRaw.includes("@") ? emailRaw : null;
      const telefono = (idxTelefono !== -1 ? row[idxTelefono]?.trim() : "") || "600000000";
      const rawSede = (idxSede !== -1 ? row[idxSede]?.toLowerCase() : "") || "";
      const sede = (rawSede.includes("2") || rawSede.includes("castilla") || rawSede.includes("alcorcon")) ? "castilla" : "tejar";
      const plan_activo = (idxPlan !== -1 ? row[idxPlan]?.trim() : "") || "Clases Regulares";
      const dniRaw = idxDni !== -1 ? row[idxDni]?.trim() : null;
      const dni = dniRaw && dniRaw !== "-" ? dniRaw : null;
      const fecha_nacimiento = (idxFechaNac !== -1 ? row[idxFechaNac]?.trim() : null) || null;
      
      let tipo_alumno: "adulto" | "infantil" = "adulto";
      if (idxTipo !== -1 && row[idxTipo]) {
        const t = row[idxTipo].toLowerCase();
        if (t.includes("infantil") || t.includes("nino") || t.includes("junior")) tipo_alumno = "infantil";
        else tipo_alumno = "adulto";
      } else if (fecha_nacimiento) {
        tipo_alumno = getTipoAlumnoFromBirthDate(fecha_nacimiento);
      }

      let clases_restantes = 0;
      if (idxClases !== -1 && row[idxClases] && !isNaN(parseInt(row[idxClases], 10))) {
        clases_restantes = parseInt(row[idxClases], 10);
      } else {
        const planLower = plan_activo.toLowerCase();
        if (planLower.includes("bono 4")) clases_restantes = 4;
        else if (planLower.includes("bono 8")) clases_restantes = 8;
        else if (planLower.includes("bono 10")) clases_restantes = 10;
        else if (planLower.includes("ilimitad")) clases_restantes = 999;
        else if (planLower.includes("suelta")) clases_restantes = 1;
      }

      const rawNfc = idxNfc !== -1 ? row[idxNfc]?.trim() : null;
      const nfc_token = rawNfc && rawNfc !== "-" ? rawNfc : null;
      const direccion = (idxDireccion !== -1 ? row[idxDireccion]?.trim() : null) || null;
      const iban = (idxIban !== -1 ? row[idxIban]?.replace(/\s/g, "").toUpperCase() : null) || null;
      const titular_cuenta = (idxTitular !== -1 ? row[idxTitular]?.trim() : null) || null;
      const metodo_pago = (idxMetodo !== -1 ? row[idxMetodo]?.trim() : null) || (iban ? "SEPA" : "Efectivo");
      const notas = (idxNotas !== -1 ? row[idxNotas]?.trim() : null) || null;
      const estado = (idxEstado !== -1 ? row[idxEstado]?.trim() : "") || "Activo";

      valid.push({
        nombre_completo: nombre,
        dni,
        email,
        telefono,
        sede,
        fecha_nacimiento,
        tipo_alumno,
        plan_activo,
        clases_restantes,
        nfc_token,
        direccion,
        iban,
        titular_cuenta,
        metodo_pago,
        notas,
        estado
      });
    } else {
      // Positional legacy layout fallback
      if (row.length >= 7) {
        // Official 10-column layout: [0] Nombre, [1] NFC, [2] Teléfono, [3] Email, [4] Sede, [5] Plan, [6] Clase, [7] Pago, [8] DNI, [9] Dirección
        const nombre_completo = row[0]?.trim() || "Sin Nombre";
        const rawNfc = row[1]?.trim();
        const nfc_token = rawNfc && rawNfc !== "-" ? rawNfc : null;
        const telefono = row[2]?.trim() || "600000000";
        const rawEmail = row[3]?.trim();
        const email = rawEmail && rawEmail.includes("@") ? rawEmail : null;
        const rawSede = (row[4] || "").toLowerCase();
        const sede = (rawSede.includes("2") || rawSede.includes("castilla") || rawSede.includes("alcorcon")) ? "castilla" : "tejar";
        const plan_activo = row[5]?.trim() || "Clases Regulares";
        const rawDni = row[8]?.trim();
        const dni = rawDni && rawDni !== "-" ? rawDni : null;
        const rawDir = row[9]?.trim();
        const direccion = rawDir && rawDir !== "-" ? rawDir : null;

        let clases_restantes = 0;
        const planLower = plan_activo.toLowerCase();
        if (planLower.includes("bono 4")) clases_restantes = 4;
        else if (planLower.includes("bono 8")) clases_restantes = 8;
        else if (planLower.includes("bono 10")) clases_restantes = 10;
        else if (planLower.includes("ilimitad")) clases_restantes = 999;
        else if (planLower.includes("suelta")) clases_restantes = 1;

        valid.push({
          nombre_completo,
          nfc_token,
          telefono,
          email,
          sede,
          plan_activo,
          dni,
          direccion,
          clases_restantes,
          tipo_alumno: "adulto",
          estado: "Activo"
        });
      } else if (row.length >= 2) {
        // Simplified 5-column fallback: [Nombre, Telefono, Email, Sede, Plan]
        const nombre_completo = row[0]?.trim() || "Sin Nombre";
        const telefono = row[1]?.trim() || "600000000";
        const email = (row[2]?.trim() && row[2].includes("@")) ? row[2].trim() : null;
        const rawSede = (row[3] || "").toLowerCase();
        const sede = (rawSede.includes("2") || rawSede.includes("castilla") || rawSede.includes("alcorcon")) ? "castilla" : "tejar";
        const plan_activo = row[4]?.trim() || "Clases Regulares";

        let clases_restantes = 0;
        const planLower = plan_activo.toLowerCase();
        if (planLower.includes("bono 4")) clases_restantes = 4;
        else if (planLower.includes("bono 8")) clases_restantes = 8;
        else if (planLower.includes("bono 10")) clases_restantes = 10;
        else if (planLower.includes("ilimitad")) clases_restantes = 999;
        else if (planLower.includes("suelta")) clases_restantes = 1;

        valid.push({
          nombre_completo,
          telefono,
          email,
          sede,
          plan_activo,
          clases_restantes,
          tipo_alumno: "adulto",
          estado: "Activo"
        });
      }
    }
  }

  return { valid, errors };
}
