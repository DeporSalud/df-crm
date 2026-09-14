// LocalStorage IBAN Helpers
const IBAN_STORAGE_KEY = "df_student_ibans";

export function getStoredIBAN(studentId: string): string {
  if (typeof window === "undefined" || !studentId) return "";
  try {
    const raw = localStorage.getItem(IBAN_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[studentId] || "";
  } catch {
    return "";
  }
}

export function saveStoredIBAN(studentId: string, iban: string): void {
  if (typeof window === "undefined" || !studentId) return;
  try {
    const raw = localStorage.getItem(IBAN_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    if (iban && iban.trim()) {
      map[studentId] = iban.replace(/[\s\-]/g, "").toUpperCase();
    } else {
      delete map[studentId];
    }
    localStorage.setItem(IBAN_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error("Error saving IBAN to localStorage:", e);
  }
}

export function deleteStoredIBAN(studentId: string): void {
  if (typeof window === "undefined" || !studentId) return;
  try {
    const raw = localStorage.getItem(IBAN_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    delete map[studentId];
    localStorage.setItem(IBAN_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error("Error deleting IBAN from localStorage:", e);
  }
}
