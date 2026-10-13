/**
 * identityUtils.ts
 *
 * Canonical identity normalization and matching utilities for Dance Factory.
 * Handles:
 * - Phone digits normalization (removes +34, 0034, spaces, dots, hyphens, parentheses)
 * - Phone display formatting (+34 658 80 25 42)
 * - Email normalization (trim, toLowerCase)
 * - DNI/NIE normalization (trim, toUpperCase, strip spaces, dots, hyphens)
 * - Diacritic/accent removal via Unicode NFD
 * - Composite name matching ("Romina Weng" matches "Romina Cabrera Weng")
 * - Omnichannel student search matching across name, phone, email, DNI, NFC
 */

/**
 * Normalizes phone numbers:
 * - Strips leading +34, 0034, or Spanish international country code 34
 * - Removes non-digits (spaces, dots, hyphens, parentheses)
 * - Returns 9 digits for Spanish phone numbers or cleaned digits for international
 */
export function normalizePhoneDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  let cleaned = String(phone).trim().replace(/[\s\(\)\.\-]/g, "");
  if (cleaned.startsWith("0034")) {
    cleaned = cleaned.slice(4);
  } else if (cleaned.startsWith("+34")) {
    cleaned = cleaned.slice(3);
  }
  let digits = cleaned.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("34")) {
    digits = digits.slice(2);
  } else if (digits.length > 9 && digits.startsWith("34")) {
    digits = digits.slice(2);
  }
  return digits;
}

/**
 * Formats a phone number for display:
 * Formats standard 9-digit Spanish phone as: +34 658 80 25 42
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  const digits = normalizePhoneDigits(phone);
  if (digits.length === 9) {
    return `+34 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  }
  return phone ? String(phone).trim() : "";
}

/**
 * Normalizes email:
 * Trims leading/trailing whitespace and converts to lowercase.
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  return String(email).trim().toLowerCase();
}

/**
 * Normalizes DNI / NIE / Pasaporte:
 * Trims whitespace, converts to uppercase, removes spaces, dots, and hyphens.
 */
export function normalizeDNI(dni: string | null | undefined): string {
  if (!dni) return "";
  return String(dni).trim().toUpperCase().replace(/[\s\-\.]/g, "");
}

/**
 * Strips accents, tildes and diacritics using Unicode NFD decomposition:
 * e.g. "María" -> "maria", "Álvaro" -> "alvaro", "Peña" -> "pena"
 */
export function removeDiacritics(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Matches a student full name against a search query:
 * - Insensitive to accents, tildes, and casing
 * - Handles composite names and out-of-order words:
 *   e.g. "Romina Weng" matches "Romina Cabrera Weng"
 *   e.g. "Maria Jose" matches "María José López"
 *   e.g. "Weng Romina" matches "Romina Cabrera Weng"
 */
export function matchesStudentName(
  fullName: string | null | undefined,
  query: string | null | undefined
): boolean {
  if (!fullName || !query) return false;
  const cleanTarget = removeDiacritics(fullName);
  const cleanQuery = removeDiacritics(query);

  if (!cleanQuery) return false;
  const targetNormalized = cleanTarget.replace(/[\-\,\.]/g, " ");
  if (cleanTarget.includes(cleanQuery) || targetNormalized.includes(cleanQuery)) return true;

  // Split query into individual tokens
  const tokens = cleanQuery.replace(/[\-\,\.]/g, " ").split(/\s+/).filter(t => t.length > 0);
  if (tokens.length <= 1) {
    return cleanTarget.includes(cleanQuery) || targetNormalized.includes(cleanQuery);
  }

  // All tokens in the query must be present in the target name
  return tokens.every(token => cleanTarget.includes(token) || targetNormalized.includes(token));
}

/**
 * Omnichannel student search matching:
 * Matches query against:
 * 1. Full name (composite name & accent-insensitive)
 * 2. Phone number (prefix and format-insensitive)
 * 3. Email (case-insensitive & trimmed)
 * 4. DNI/NIE (punctuation and case-insensitive)
 * 5. NFC Token
 * 6. Internal ID
 */
export function studentMatchesSearchQuery(
  student: any,
  query: string | null | undefined
): boolean {
  if (!student) return false;
  if (!query || !query.trim()) return true;

  const rawQ = query.trim();

  // 1. Name matching (composite names & diacritic-tolerant)
  const fullName = student.nombre_completo || student.name || student.nombre || "";
  if (matchesStudentName(fullName, rawQ)) return true;

  // 2. Phone matching (normalized digits)
  const qPhone = normalizePhoneDigits(rawQ);
  if (qPhone.length >= 3 && student.telefono) {
    const sPhone = normalizePhoneDigits(student.telefono);
    if (sPhone.includes(qPhone)) return true;
  }
  if (student.telefono && String(student.telefono).includes(rawQ)) return true;

  // 3. Email matching (lowercase trimmed)
  const cleanQ = rawQ.toLowerCase();
  if (student.email) {
    const sEmail = normalizeEmail(student.email);
    if (sEmail.includes(cleanQ)) return true;
  }

  // 4. DNI matching (normalized uppercase alphanumeric)
  const cleanDniQ = normalizeDNI(rawQ);
  if (cleanDniQ.length >= 2 && student.dni) {
    const sDni = normalizeDNI(student.dni);
    if (sDni.includes(cleanDniQ)) return true;
  }
  if (student.dni && String(student.dni).toLowerCase().includes(cleanQ)) return true;

  // 5. NFC token matching
  if (student.nfc_token && String(student.nfc_token).toLowerCase().includes(cleanQ)) return true;

  // 6. Direct ID match
  if (student.id && String(student.id).toLowerCase() === cleanQ) return true;

  return false;
}
