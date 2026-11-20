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

const PLACEHOLDER_IDENTITY_VALUES = new Set([
  "",
  "-",
  "--",
  "0",
  "NULL",
  "N/A",
  "NA",
  "S/N",
  "SN",
  "SIN DNI",
  "SIN EMAIL",
  "PENDIENTE",
  "NONE",
  "UNDEFINED",
]);

const DUMMY_PHONE_NUMBERS = new Set([
  "600000000",
  "000000000",
  "123456789",
  "600123456",
]);

/**
 * Normalizes email:
 * Trims leading/trailing whitespace and converts to lowercase.
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  return String(email).trim().toLowerCase();
}

/**
 * Validates whether an email is real and safe for identity comparison / SQL lookup.
 * Rejects empty, null, whitespace, placeholders, or malformed strings.
 */
export function isValidComparableEmail(email: string | null | undefined): boolean {
  const clean = normalizeEmail(email);
  if (!clean || clean.length < 5) return false;
  if (PLACEHOLDER_IDENTITY_VALUES.has(clean.toUpperCase())) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean);
}

/**
 * Normalizes DNI / NIE / Pasaporte:
 * Trims whitespace, converts to uppercase, removes spaces, dots, and hyphens.
 */
export function normalizeDNI(dni: string | null | undefined): string {
  if (!dni) return "";
  const rawUpper = String(dni).trim().toUpperCase();
  if (PLACEHOLDER_IDENTITY_VALUES.has(rawUpper)) return "";
  const cleaned = rawUpper.replace(/[\s\-\.]/g, "");
  if (PLACEHOLDER_IDENTITY_VALUES.has(cleaned)) return "";
  return cleaned;
}

/**
 * Sanitizes a DNI/NIE/Passport value before writing to database:
 * Returns null if empty, placeholder, or shorter than 4 alphanumeric chars.
 */
export function sanitizeDNIForStorage(dni: string | null | undefined): string | null {
  const clean = normalizeDNI(dni);
  if (!clean || clean.length < 4) return null;
  return clean;
}

/**
 * Validates whether a DNI/NIE/Passport is safe for identity equality/lookup.
 * Requires 7..20 alphanumeric characters and at least 5 digits so short tokens,
 * empty strings, or placeholders never collide across students.
 */
export function isValidComparableDNI(dni: string | null | undefined): boolean {
  const clean = normalizeDNI(dni);
  if (!clean || clean.length < 7 || clean.length > 20) return false;
  if (!/^[A-Z0-9]+$/.test(clean)) return false;
  const digitCount = (clean.match(/\d/g) || []).length;
  return digitCount >= 5;
}

/**
 * Validates whether a phone number is real and safe for identity comparison / SQL lookup.
 * Rejects empty, short (<9 digits), dummy ("600000000"), or repeated-digit placeholders.
 */
export function isValidComparablePhone(phone: string | null | undefined): boolean {
  const digits = normalizePhoneDigits(phone);
  if (!digits || digits.length < 9) return false;
  const last9 = digits.slice(-9);
  if (DUMMY_PHONE_NUMBERS.has(last9)) return false;
  if (/^(\d)\1{8}$/.test(last9)) return false;
  return true;
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
