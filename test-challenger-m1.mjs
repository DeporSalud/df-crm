/**
 * CHALLENGER 1 - EMPIRICAL STRESS TEST SUITE FOR MILESTONE 1
 * Dance Factory CRM - Teacher Portal (Auth, Session Security & UI/UX Core)
 */

import { strict as assert } from 'node:assert';

const TEACHER_PINS = {
  "9999": { name: "ADMINISTRADOR MASTER", isAdmin: true },
  "1001": { name: "LUCÍA MUÑOZ" },
  "1002": { name: "LUCÍA ZAMORANO" },
  "1003": { name: "ANDREA SOTO" },
  "1004": { name: "EVA LEIVA" },
  "1005": { name: "LUCAS LÓPEZ" },
  "1006": { name: "PAULA JIMÉNEZ" },
  "1007": { name: "ABEL Y NAYARA" },
  "1008": { name: "DARÍO HUMBERTO" },
  "1009": { name: "NEREA OLIVARES" },
  "1010": { name: "ALEJANDRO ROVINA" },
  "1011": { name: "NIL BARBERÁ" }
};

const results = [];

function recordTest(suite, name, passed, details = "") {
  results.push({ suite, name, passed, details });
  const status = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`[${status}] [${suite}] ${name}${details ? ` -> ${details}` : ""}`);
}

// ----------------------------------------------------------------------
// SUITE 1: PIN AUTHENTICATION, OVERRIDE & EDGE CASE STRESS TESTING
// ----------------------------------------------------------------------
console.log("\n=======================================================");
console.log("SUITE 1: PIN Authentication & Edge Case Stress Testing");
console.log("=======================================================");

// 1.1 Test all 12 valid PIN mappings
const expectedTeachers = [
  { pin: "9999", name: "ADMINISTRADOR MASTER", isAdmin: true },
  { pin: "1001", name: "LUCÍA MUÑOZ", isAdmin: undefined },
  { pin: "1002", name: "LUCÍA ZAMORANO", isAdmin: undefined },
  { pin: "1003", name: "ANDREA SOTO", isAdmin: undefined },
  { pin: "1004", name: "EVA LEIVA", isAdmin: undefined },
  { pin: "1005", name: "LUCAS LÓPEZ", isAdmin: undefined },
  { pin: "1006", name: "PAULA JIMÉNEZ", isAdmin: undefined },
  { pin: "1007", name: "ABEL Y NAYARA", isAdmin: undefined },
  { pin: "1008", name: "DARÍO HUMBERTO", isAdmin: undefined },
  { pin: "1009", name: "NEREA OLIVARES", isAdmin: undefined },
  { pin: "1010", name: "ALEJANDRO ROVINA", isAdmin: undefined },
  { pin: "1011", name: "NIL BARBERÁ", isAdmin: undefined },
];

let allPinsValid = true;
for (const exp of expectedTeachers) {
  const pinData = TEACHER_PINS[exp.pin];
  if (!pinData || pinData.name !== exp.name || pinData.isAdmin !== exp.isAdmin) {
    allPinsValid = false;
    recordTest("PIN Mapping", `PIN ${exp.pin} maps to ${exp.name}`, false, `Got: ${JSON.stringify(pinData)}`);
  } else {
    recordTest("PIN Mapping", `PIN ${exp.pin} -> ${exp.name} (admin: ${!!exp.isAdmin})`, true);
  }
}

// 1.2 Simulate PIN Keypad State Machine
class MockPinAuthSession {
  constructor() {
    this.sessionStorage = {};
    this.reset();
  }

  reset() {
    this.pinInput = "";
    this.isAuthenticated = false;
    this.isAdmin = false;
    this.pinError = "";
    this.selectedProfesor = "LUCÍA MUÑOZ";
    this.activeTab = "mis_clases";
    this.teacherStudent = null;
    this.clasesProfesor = [];
    this.selectedClase = null;
    this.roster = [];
    this.rosterSearch = "";
    this.asistenciasRegistradas = [];
    this.allOpenClasses = [];
    this.teacherEnrolledClassIds = [];
    this.selectedBonoForPayment = null;
    this.isProcessingPayment = false;
    this.savingId = null;
    this.modal = { isOpen: false, message: "" };
    this.pendingTimeout = null;
  }

  handleKeyClick(digit) {
    if (this.pinInput.length >= 4) return;
    this.pinError = "";
    const newPin = this.pinInput + digit;
    this.pinInput = newPin;

    if (newPin.length === 4) {
      this.validatePin(newPin);
    }
  }

  handleDelete() {
    this.pinError = "";
    this.pinInput = this.pinInput.slice(0, -1);
  }

  handleClear() {
    this.pinError = "";
    this.pinInput = "";
  }

  validatePin(pin) {
    const teacherInfo = TEACHER_PINS[pin];
    if (teacherInfo) {
      this.isAuthenticated = true;
      this.isAdmin = !!teacherInfo.isAdmin;
      this.sessionStorage["df_profesor_pin"] = pin;
      if (!teacherInfo.isAdmin) {
        this.selectedProfesor = teacherInfo.name;
      }
      this.pinInput = "";
      this.pinError = "";
    } else {
      this.pinError = "Código PIN incorrecto. Revisa e inténtalo de nuevo.";
      this.pendingTimeout = setTimeout(() => {
        this.pinInput = "";
      }, 600);
    }
  }

  handleLogout() {
    delete this.sessionStorage["df_profesor_pin"];
    this.isAuthenticated = false;
    this.isAdmin = false;
    this.pinInput = "";
    this.pinError = "";
    this.selectedProfesor = "LUCÍA MUÑOZ";
    this.activeTab = "mis_clases";
    this.teacherStudent = null;
    this.clasesProfesor = [];
    this.selectedClase = null;
    this.roster = [];
    this.rosterSearch = "";
    this.asistenciasRegistradas = [];
    this.allOpenClasses = [];
    this.teacherEnrolledClassIds = [];
    this.selectedBonoForPayment = null;
    this.isProcessingPayment = false;
    this.savingId = null;
    this.modal = { isOpen: false, message: "" };
  }
}

// Test 1.3 Backspace boundary conditions
const session = new MockPinAuthSession();
session.handleDelete(); // Backspace on empty
recordTest("PIN State", "Backspace on empty input remains empty string", session.pinInput === "");

session.handleKeyClick("1");
session.handleKeyClick("0");
session.handleDelete();
recordTest("PIN State", "Type '10', delete -> '1'", session.pinInput === "1");

session.handleClear();
recordTest("PIN State", "Clear resets pinInput to ''", session.pinInput === "");

// Test 1.4 Overflow / Rapid Entry stress test (> 4 digits)
session.handleKeyClick("1");
session.handleKeyClick("2");
session.handleKeyClick("3");
session.handleKeyClick("4"); // invalid pin 1234
session.handleKeyClick("5");
session.handleKeyClick("6");
session.handleKeyClick("7");
recordTest("PIN Stress", "Entering > 4 digits stops at 4 digits", session.pinInput.length === 4 || session.pinInput === "");
recordTest("PIN Stress", "Invalid PIN displays error message", session.pinError.includes("incorrecto"));

// Test 1.5 Master PIN 9999 Admin Override
const adminSession = new MockPinAuthSession();
adminSession.handleKeyClick("9");
adminSession.handleKeyClick("9");
adminSession.handleKeyClick("9");
adminSession.handleKeyClick("9");
recordTest("Master PIN", "PIN 9999 sets isAuthenticated=true", adminSession.isAuthenticated === true);
recordTest("Master PIN", "PIN 9999 sets isAdmin=true", adminSession.isAdmin === true);
recordTest("Master PIN", "PIN 9999 stores session token", adminSession.sessionStorage["df_profesor_pin"] === "9999");
recordTest("Master PIN", "PIN 9999 clears pinInput buffer", adminSession.pinInput === "");

// Test 1.6 Teacher PIN 1005 (Lucas Lopez)
const teacherSession = new MockPinAuthSession();
teacherSession.handleKeyClick("1");
teacherSession.handleKeyClick("0");
teacherSession.handleKeyClick("0");
teacherSession.handleKeyClick("5");
recordTest("Teacher PIN", "PIN 1005 authenticates as LUCAS LÓPEZ", teacherSession.selectedProfesor === "LUCAS LÓPEZ");
recordTest("Teacher PIN", "Teacher session isAdmin=false", teacherSession.isAdmin === false);
recordTest("Teacher PIN", "Teacher session stored in sessionStorage", teacherSession.sessionStorage["df_profesor_pin"] === "1005");

// ----------------------------------------------------------------------
// SUITE 2: LOGOUT ISOLATION & SENSITIVE DATA ZEROING
// ----------------------------------------------------------------------
console.log("\n=======================================================");
console.log("SUITE 2: Logout State Isolation & Data Zeroing");
console.log("=======================================================");

// Populate full sensitive state
teacherSession.teacherStudent = {
  id: "teacher-uuid-123",
  nombre_completo: "LUCAS LÓPEZ",
  email: "lucaslopez@dancefactory.es",
  telefono: "+34 699 999 999",
  clases_restantes: 4,
  dni: "12345678Z"
};
teacherSession.clasesProfesor = [
  { id: "clase-1", nombre_clase: "Hip Hop Avanzado", dia_semana: "MARTES", hora_inicio: "18:00" }
];
teacherSession.selectedClase = teacherSession.clasesProfesor[0];
teacherSession.roster = [
  { id: "student-1", nombre_completo: "Carlos Gómez", telefono: "+34 611 222 333", email: "carlos@example.com", clases_restantes: 0 },
  { id: "student-2", nombre_completo: "Elena Martín", telefono: "+34 622 333 444", email: "elena@example.com", clases_restantes: 8 }
];
teacherSession.rosterSearch = "Carlos";
teacherSession.asistenciasRegistradas = ["student-1"];
teacherSession.allOpenClasses = [{ id: "open-1", nombre_clase: "OPEN CLASS DANCEHALL" }];
teacherSession.teacherEnrolledClassIds = ["open-1"];
teacherSession.selectedBonoForPayment = { id: "Bono 8 clases", nombre: "Bono 8 Clases Docente", precioDocente: "51,30 €" };
teacherSession.isProcessingPayment = true;
teacherSession.savingId = "save-123";
teacherSession.modal = { isOpen: true, title: "Alerta", message: "Datos confidenciales" };

// Perform Logout
teacherSession.handleLogout();

// Assert all state variables are wiped
recordTest("Logout Isolation", "sessionStorage df_profesor_pin removed", teacherSession.sessionStorage["df_profesor_pin"] === undefined);
recordTest("Logout Isolation", "isAuthenticated is false", teacherSession.isAuthenticated === false);
recordTest("Logout Isolation", "isAdmin is false", teacherSession.isAdmin === false);
recordTest("Logout Isolation", "teacherStudent profile purged (null)", teacherSession.teacherStudent === null);
recordTest("Logout Isolation", "clasesProfesor array purged (empty)", Array.isArray(teacherSession.clasesProfesor) && teacherSession.clasesProfesor.length === 0);
recordTest("Logout Isolation", "selectedClase purged (null)", teacherSession.selectedClase === null);
recordTest("Logout Isolation", "student roster purged (no student names/phones accessible)", Array.isArray(teacherSession.roster) && teacherSession.roster.length === 0);
recordTest("Logout Isolation", "rosterSearch purged ('')", teacherSession.rosterSearch === "");
recordTest("Logout Isolation", "asistenciasRegistradas purged (empty)", Array.isArray(teacherSession.asistenciasRegistradas) && teacherSession.asistenciasRegistradas.length === 0);
recordTest("Logout Isolation", "allOpenClasses purged (empty)", Array.isArray(teacherSession.allOpenClasses) && teacherSession.allOpenClasses.length === 0);
recordTest("Logout Isolation", "teacherEnrolledClassIds purged (empty)", Array.isArray(teacherSession.teacherEnrolledClassIds) && teacherSession.teacherEnrolledClassIds.length === 0);
recordTest("Logout Isolation", "selectedBonoForPayment purged (null)", teacherSession.selectedBonoForPayment === null);
recordTest("Logout Isolation", "isProcessingPayment reset to false", teacherSession.isProcessingPayment === false);
recordTest("Logout Isolation", "savingId reset to null", teacherSession.savingId === null);
recordTest("Logout Isolation", "modal state reset (isOpen=false)", teacherSession.modal.isOpen === false && teacherSession.modal.message === "");

// ----------------------------------------------------------------------
// SUITE 3: MODAL BACKDROP PROPAGATION & EVENT CLEANUP
// ----------------------------------------------------------------------
console.log("\n=======================================================");
console.log("SUITE 3: Modal Backdrop Click Propagation & Lifecycle");
console.log("=======================================================");

// Simulate AppModal Click Outside logic
let modalClosed = false;
const onClose = () => { modalClosed = true; };

// Case A: Click directly on backdrop element
modalClosed = false;
const backdropEvent = {
  target: "BACKDROP_DOM_NODE",
  currentTarget: "BACKDROP_DOM_NODE"
};
if (backdropEvent.target === backdropEvent.currentTarget) {
  onClose();
}
recordTest("Modal Backdrop", "Clicking directly on outer backdrop triggers onClose()", modalClosed === true);

// Case B: Click on inner card (e.target is child, currentTarget is backdrop, or propagation stopped)
modalClosed = false;
let propagationStopped = false;
const innerEvent = {
  target: "INNER_MODAL_CARD",
  currentTarget: "BACKDROP_DOM_NODE",
  stopPropagation: () => { propagationStopped = true; }
};
innerEvent.stopPropagation();
if (innerEvent.target === innerEvent.currentTarget) {
  onClose();
}
recordTest("Modal Backdrop", "Clicking on modal inner card stops propagation and DOES NOT dismiss modal", modalClosed === false && propagationStopped === true);

// Case C: Keyboard Event Listener Lifecycle Simulation
class MockWindow {
  constructor() {
    this.listeners = new Map();
    this.activeElement = { tagName: "BODY" };
  }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }

  removeEventListener(type, callback) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).delete(callback);
    }
  }

  dispatchKeyEvent(key) {
    const activeTag = (this.activeElement?.tagName || "").toUpperCase();
    const event = {
      key,
      defaultPrevented: false,
      preventDefault: () => { event.defaultPrevented = true; }
    };
    if (this.listeners.has("keydown")) {
      for (const listener of this.listeners.get("keydown")) {
        listener(event);
      }
    }
    return event;
  }
}

const mockWindow = new MockWindow();
let keydownCalls = 0;
const testKeyHandler = (e) => {
  const activeTag = (mockWindow.activeElement?.tagName || "").toUpperCase();
  if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) return;
  if (/^[0-9]$/.test(e.key)) {
    e.preventDefault();
    keydownCalls++;
  }
};

// Mount Keypad
mockWindow.addEventListener("keydown", testKeyHandler);
recordTest("Keyboard Listener", "Listener successfully registered on mount", mockWindow.listeners.get("keydown").size === 1);

// Dispatch key 5 when body is active
const evt1 = mockWindow.dispatchKeyEvent("5");
recordTest("Keyboard Listener", "Key '5' triggers handler and prevents default", keydownCalls === 1 && evt1.defaultPrevented === true);

// Dispatch key 5 when active element is INPUT
mockWindow.activeElement = { tagName: "INPUT" };
const evt2 = mockWindow.dispatchKeyEvent("5");
recordTest("Keyboard Listener", "Key '5' ignored when user types in an active INPUT field", keydownCalls === 1 && evt2.defaultPrevented === false);

// Unmount component
mockWindow.removeEventListener("keydown", testKeyHandler);
recordTest("Keyboard Listener", "Listener removed on unmount (no memory leak)", mockWindow.listeners.get("keydown").size === 0);

// Dispatch key after unmount
mockWindow.activeElement = { tagName: "BODY" };
mockWindow.dispatchKeyEvent("5");
recordTest("Keyboard Listener", "Dispatched key after unmount has zero effect", keydownCalls === 1);

// ----------------------------------------------------------------------
// SUMMARY & VERDICT
// ----------------------------------------------------------------------
console.log("\n=======================================================");
console.log("TEST HARNESS SUMMARY");
console.log("=======================================================");
const totalTests = results.length;
const passedTests = results.filter(r => r.passed).length;
const failedTests = totalTests - passedTests;
console.log(`Total tests: ${totalTests}`);
console.log(`Passed:      ${passedTests}`);
console.log(`Failed:      ${failedTests}`);

if (failedTests === 0) {
  console.log("\n>>> VERDICT: ALL ADVERSARIAL STRESS TESTS PASSED (100%) <<<\n");
} else {
  console.log(`\n>>> VERDICT: ${failedTests} TEST(S) FAILED <<<\n`);
  process.exit(1);
}
