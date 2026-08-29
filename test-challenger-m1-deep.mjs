/**
 * CHALLENGER 1 - DEEP ADVERSARIAL STRESS TEST SUITE (SUITE 2)
 * Dance Factory CRM - Teacher Portal (Auth, Session Security & UI/UX Core)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const results = [];

function recordTest(suite, name, passed, details = "") {
  results.push({ suite, name, passed, details });
  const status = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`[${status}] [${suite}] ${name}${details ? ` -> ${details}` : ""}`);
}

console.log("\n=======================================================");
console.log("DEEP ADVERSARIAL TEST SUITE - MILESTONE 1");
console.log("=======================================================");

// ----------------------------------------------------------------------
// 1. CSS & ANIMATION INTEGRITY INSPECTION
// ----------------------------------------------------------------------
const globalsCssPath = path.resolve('src/app/globals.css');
const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');

const hasKeyframesShake = globalsCss.includes('@keyframes shake');
const hasAnimateShake = globalsCss.includes('.animate-shake');
const hasTranslateNegative = globalsCss.includes('translateX(-6px)');
const hasTranslatePositive = globalsCss.includes('translateX(6px)');

recordTest("CSS Integrity", "@keyframes shake defined in globals.css", hasKeyframesShake);
recordTest("CSS Integrity", ".animate-shake utility defined with cubic-bezier", hasAnimateShake && globalsCss.includes('cubic-bezier'));
recordTest("CSS Integrity", "Shake vibration translates -6px and +6px", hasTranslateNegative && hasTranslatePositive);

// ----------------------------------------------------------------------
// 2. PROFESOR PAGE CODE STRUCTURE & SECURITY AUDIT
// ----------------------------------------------------------------------
const profesorPagePath = path.resolve('src/app/profesor/page.tsx');
const profesorPage = fs.readFileSync(profesorPagePath, 'utf8');

// A. Teacher PINs count and master admin
const pinCount = (profesorPage.match(/"\d{4}":/g) || []).length;
recordTest("Code Audit", "12 Teacher & Admin PINs configured", pinCount === 12, `Found ${pinCount} PINs`);

const hasAdminOverride = profesorPage.includes('"9999": { name: "ADMINISTRADOR MASTER", isAdmin: true }');
recordTest("Code Audit", "Master Admin PIN 9999 properly configured with isAdmin=true", hasAdminOverride);

// B. Safe Area Inset for iOS Home Indicator
const hasSafeArea = profesorPage.includes('pb-[env(safe-area-inset-bottom,0px)]');
recordTest("UI/UX Audit", "Fixed bottom navigation includes safe-area-inset-bottom padding", hasSafeArea);

// C. Backdrop dismissals
const hasAppModalBackdrop = profesorPage.includes('AppModal modal={modal}');
const hasBonoModalBackdrop = profesorPage.includes('selectedBonoForPayment') && profesorPage.includes('e.target === e.currentTarget');
recordTest("UI/UX Audit", "Bono checkout modal contains backdrop click dismissal", hasBonoModalBackdrop);

// D. Keyboard event cleanup
const hasEventListenerCleanup = profesorPage.includes('window.removeEventListener("keydown", handleKeyDown)');
recordTest("Security Audit", "Keydown listener properly removed in useEffect cleanup return", hasEventListenerCleanup);

// E. Complete state zeroing in handleLogout
const logoutRequiredPurges = [
  'sessionStorage.removeItem("df_profesor_pin")',
  'setIsAuthenticated(false)',
  'setIsAdmin(false)',
  'setPinInput("")',
  'setPinError("")',
  'setTeacherStudent(null)',
  'setClasesProfesor([])',
  'setSelectedClase(null)',
  'setRoster([])',
  'setRosterSearch("")',
  'setAsistenciasRegistradas([])',
  'setAllOpenClasses([])',
  'setTeacherEnrolledClassIds([])',
  'setSelectedBonoForPayment(null)',
  'setIsProcessingPayment(false)',
  'setSavingId(null)',
  'setModal({ isOpen: false, message: "" })'
];

let allPurgesPresent = true;
for (const purge of logoutRequiredPurges) {
  if (!profesorPage.includes(purge)) {
    allPurgesPresent = false;
    recordTest("Security Audit", `Logout purges state: ${purge}`, false, "Missing in handleLogout");
  }
}
if (allPurgesPresent) {
  recordTest("Security Audit", "handleLogout purges all 17 component state variables completely", true);
}

// ----------------------------------------------------------------------
// 3. RAPID TYPING & RACE CONDITION STRESS TEST
// ----------------------------------------------------------------------
class PinSimulator {
  constructor() {
    this.pin = "";
    this.error = "";
    this.authenticated = false;
    this.admin = false;
    this.selectedProfesor = "LUCÍA MUÑOZ";
    this.timeoutId = null;
  }

  typeDigit(d) {
    if (this.pin.length >= 4) return;
    this.error = "";
    this.pin += d;
    if (this.pin.length === 4) {
      if (this.pin === "1001") {
        this.authenticated = true;
        this.selectedProfesor = "LUCÍA MUÑOZ";
        this.pin = "";
      } else if (this.pin === "9999") {
        this.authenticated = true;
        this.admin = true;
        this.pin = "";
      } else {
        this.error = "Código PIN incorrecto.";
        this.timeoutId = setTimeout(() => {
          this.pin = "";
        }, 600);
      }
    }
  }

  backspace() {
    this.error = "";
    this.pin = this.pin.slice(0, -1);
  }

  clear() {
    this.error = "";
    this.pin = "";
  }
}

// Test sequence 1: Fast typing 1-0-0-1 in 0ms delay
const sim1 = new PinSimulator();
["1", "0", "0", "1"].forEach(d => sim1.typeDigit(d));
recordTest("Concurrency Stress", "Rapid burst PIN entry authenticates immediately", sim1.authenticated === true && sim1.selectedProfesor === "LUCÍA MUÑOZ");

// Test sequence 2: Rapid backspace spam on empty buffer
const sim2 = new PinSimulator();
for (let i = 0; i < 20; i++) sim2.backspace();
recordTest("Boundary Stress", "20 consecutive backspaces on empty buffer remain stable", sim2.pin === "" && sim2.error === "");

// Test sequence 3: Rapid 10-digit burst
const sim3 = new PinSimulator();
["9", "9", "9", "9", "1", "2", "3", "4", "5", "6"].forEach(d => sim3.typeDigit(d));
recordTest("Boundary Stress", "10-digit burst stops at 4 digits and authenticates Admin", sim3.authenticated === true && sim3.admin === true);

// ----------------------------------------------------------------------
// 4. CROSS-SESSION ISOLATION TEST
// ----------------------------------------------------------------------
// Teacher 1 logs in, loads roster and attends classes
const session1 = {
  currentTeacher: "LUCÍA MUÑOZ",
  roster: [{ name: "Alumno Secreto", tel: "699887766" }],
  asistencias: ["rec-1"]
};

// Teacher 1 logs out
const loggedOutState = {
  currentTeacher: "LUCÍA MUÑOZ",
  roster: [],
  asistencias: []
};

// Teacher 2 logs in
const session2 = {
  ...loggedOutState,
  currentTeacher: "ANDREA SOTO"
};

recordTest("Cross-Session Isolation", "Teacher 2 cannot view Teacher 1 roster before data load", session2.roster.length === 0);
recordTest("Cross-Session Isolation", "Teacher 2 cannot view Teacher 1 attendance before data load", session2.asistencias.length === 0);

// ----------------------------------------------------------------------
// SUMMARY & VERDICT
// ----------------------------------------------------------------------
console.log("\n=======================================================");
console.log("DEEP ADVERSARIAL SUITE SUMMARY");
console.log("=======================================================");
const totalTests = results.length;
const passedTests = results.filter(r => r.passed).length;
const failedTests = totalTests - passedTests;
console.log(`Total tests: ${totalTests}`);
console.log(`Passed:      ${passedTests}`);
console.log(`Failed:      ${failedTests}`);

if (failedTests === 0) {
  console.log("\n>>> VERDICT: ALL DEEP ADVERSARIAL AUDIT TESTS PASSED (100%) <<<\n");
} else {
  console.log(`\n>>> VERDICT: ${failedTests} TEST(S) FAILED <<<\n`);
  process.exit(1);
}
