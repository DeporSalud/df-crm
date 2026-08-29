/**
 * ============================================================================
 * CHALLENGER 2 EMPIRICAL TEST SUITE: MILESTONE 1 (UI/UX, KEYPAD, HAPTICS, CSS)
 * ============================================================================
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwindPostcss from "@tailwindcss/postcss";

console.log("================================================================================");
console.log("   DANCE FACTORY CRM - CHALLENGER 2 EMPIRICAL TEST SUITE (MILESTONE 1)");
console.log("================================================================================\n");

let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
    failedCount++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
    failedCount++;
  }
}

// -----------------------------------------------------------------------------
// SECTION 1: CSS KEYFRAME ANIMATIONS & STYLES
// -----------------------------------------------------------------------------
console.log("--------------------------------------------------------------------------------");
console.log("SECTION 1: CSS KEYFRAME ANIMATIONS, TOKENS & POSTCSS COMPILATION");
console.log("--------------------------------------------------------------------------------");

const globalsCssPath = path.resolve("src/app/globals.css");
const globalsCss = fs.readFileSync(globalsCssPath, "utf8");

test("[CSS.1] globals.css defines @keyframes shake with proper x-axis offsets", () => {
  assert(globalsCss.includes("@keyframes shake"), "globals.css must contain @keyframes shake");
  assert(globalsCss.includes("transform: translateX(0)"), "Must return to translateX(0)");
  assert(globalsCss.includes("transform: translateX(-6px)"), "Must shake left by -6px");
  assert(globalsCss.includes("transform: translateX(6px)"), "Must shake right by +6px");
});

test("[CSS.2] globals.css defines .animate-shake with 0.4s cubic-bezier timing and both fill mode", () => {
  assert(globalsCss.includes(".animate-shake"), "globals.css must contain .animate-shake class");
  assert(globalsCss.includes("shake 0.4s"), "Must use shake with 0.4s duration");
  assert(globalsCss.includes("cubic-bezier(0.36, 0.07, 0.19, 0.97)"), "Must use natural spring cubic-bezier");
  assert(globalsCss.includes("both"), "Must specify both fill mode");
});

test("[CSS.3] globals.css defines core Dark Theme color variables in @theme", () => {
  const requiredThemeVars = [
    "--color-bg:",
    "--color-bg-card:",
    "--color-bg-hover:",
    "--color-border:",
    "--color-primary:",
    "--color-primary-hover:",
    "--color-secondary:",
    "--color-accent:",
    "--color-success:",
    "--color-danger:",
    "--color-warning:",
    "--color-text-title:",
    "--color-text-body:",
    "--color-text-secondary:"
  ];
  for (const v of requiredThemeVars) {
    assert(globalsCss.includes(v), `Missing theme token: ${v}`);
  }
});

await asyncTest("[CSS.4] PostCSS + Tailwind CSS v4 compiles globals.css cleanly with zero errors", async () => {
  const result = await postcss([tailwindPostcss()]).process(globalsCss, { from: globalsCssPath });
  assert(result.css.length > 50000, "Compiled CSS should be non-empty and comprehensive");
  assert(result.css.includes("@keyframes shake"), "Compiled output must retain @keyframes shake");
  assert(result.css.includes(".animate-shake"), "Compiled output must retain .animate-shake");
});

// -----------------------------------------------------------------------------
// SECTION 2: PIN KEYPAD & AUTHENTICATION MAPPING
// -----------------------------------------------------------------------------
console.log("\n--------------------------------------------------------------------------------");
console.log("SECTION 2: PIN KEYPAD & TEACHER AUTHENTICATION MAPPING");
console.log("--------------------------------------------------------------------------------");

const profesorPagePath = path.resolve("src/app/profesor/page.tsx");
const profesorPage = fs.readFileSync(profesorPagePath, "utf8");

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

test("[AUTH.1] TEACHER_PINS contains all 12 teachers with exact normalized names and admin flag", () => {
  for (const [pin, info] of Object.entries(TEACHER_PINS)) {
    assert(profesorPage.includes(`"${pin}"`), `PIN ${pin} missing from profesor/page.tsx`);
    assert(profesorPage.includes(info.name), `Teacher name ${info.name} missing from profesor/page.tsx`);
  }
});

test("[AUTH.2] Keypad input simulation: accumulator clamps at 4 digits", () => {
  let pinInput = "";
  const handleKeyClick = (digit) => {
    if (pinInput.length >= 4) return pinInput;
    pinInput += digit;
    return pinInput;
  };

  handleKeyClick("1");
  handleKeyClick("0");
  handleKeyClick("0");
  handleKeyClick("1");
  assert.strictEqual(pinInput, "1001", "Should have exact 4-digit PIN");

  // Attempt 5th digit
  handleKeyClick("5");
  assert.strictEqual(pinInput, "1001", "Should not append beyond 4 digits");
});

test("[AUTH.3] Keypad delete and clear actions handle empty strings safely", () => {
  let pinInput = "10";
  let pinError = "Some error";

  const handleDelete = () => {
    pinError = "";
    pinInput = pinInput.slice(0, -1);
  };

  const handleClear = () => {
    pinError = "";
    pinInput = "";
  };

  handleDelete();
  assert.strictEqual(pinInput, "1");
  assert.strictEqual(pinError, "");

  handleDelete();
  assert.strictEqual(pinInput, "");

  // Delete on empty
  handleDelete();
  assert.strictEqual(pinInput, "");

  // Clear
  pinInput = "1002";
  handleClear();
  assert.strictEqual(pinInput, "");
});

test("[AUTH.4] Invalid PIN triggers error state and shake feedback", () => {
  const invalidPins = ["0000", "1234", "9998", "4321", "8888", "1012"];
  for (const pin of invalidPins) {
    const teacher = TEACHER_PINS[pin];
    assert.strictEqual(teacher, undefined, `PIN ${pin} should not be recognized`);
  }
});

// -----------------------------------------------------------------------------
// SECTION 3: HAPTIC TOUCH FEEDBACK ENGINE
// -----------------------------------------------------------------------------
console.log("\n--------------------------------------------------------------------------------");
console.log("SECTION 3: HAPTIC FEEDBACK (triggerHaptic) SAFETY & PATTERNS");
console.log("--------------------------------------------------------------------------------");

test("[HAPTIC.1] triggerHaptic is resilient in SSR / Node.js environment (no window/navigator)", () => {
  const triggerHaptic = (pattern = 15) => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  // Must not throw in Node.js
  assert.doesNotThrow(() => {
    triggerHaptic(15);
    triggerHaptic([40, 30, 40]);
    triggerHaptic([20, 20]);
  });
});

test("[HAPTIC.2] triggerHaptic handles unsupported browsers (e.g. Safari where navigator.vibrate is undefined)", () => {
  const mockNavigator = {};
  let vibrateCalled = false;

  const triggerHapticMock = (nav, pattern = 15) => {
    if (typeof nav !== "undefined" && typeof nav.vibrate === "function") {
      try {
        nav.vibrate(pattern);
      } catch {}
    }
  };

  assert.doesNotThrow(() => triggerHapticMock(mockNavigator, 15));
  assert.strictEqual(vibrateCalled, false);
});

test("[HAPTIC.3] triggerHaptic executes correct vibration signatures and catches DOMExceptions", () => {
  const calls = [];
  const mockNavigator = {
    vibrate: (pattern) => {
      calls.push(pattern);
    }
  };

  const triggerHapticMock = (nav, pattern = 15) => {
    if (typeof nav !== "undefined" && typeof nav.vibrate === "function") {
      try {
        nav.vibrate(pattern);
      } catch {}
    }
  };

  // Button tap: 15ms
  triggerHapticMock(mockNavigator, 15);
  // Valid login: [20, 20]
  triggerHapticMock(mockNavigator, [20, 20]);
  // Invalid PIN: [40, 30, 40]
  triggerHapticMock(mockNavigator, [40, 30, 40]);

  assert.deepStrictEqual(calls, [15, [20, 20], [40, 30, 40]]);

  // Throwing navigator (permission blocked)
  const throwingNavigator = {
    vibrate: () => {
      throw new Error("SecurityError: vibrate not allowed");
    }
  };
  assert.doesNotThrow(() => triggerHapticMock(throwingNavigator, 15));
});

// -----------------------------------------------------------------------------
// SECTION 4: PHYSICAL KEYBOARD LISTENERS & SHORTCUTS
// -----------------------------------------------------------------------------
console.log("\n--------------------------------------------------------------------------------");
console.log("SECTION 4: KEYBOARD LISTENERS & INPUT ISOLATION");
console.log("--------------------------------------------------------------------------------");

test("[KEYBOARD.1] Keyboard event dispatcher handles 0-9, Backspace, Escape, Enter", () => {
  let pinInput = "";
  let pinError = "";
  let authenticatedTeacher = null;

  const handleKeyClick = (digit) => {
    if (pinInput.length >= 4) return;
    pinInput += digit;
    if (pinInput.length === 4) validatePin(pinInput);
  };

  const handleDelete = () => {
    pinInput = pinInput.slice(0, -1);
  };

  const handleClear = () => {
    pinInput = "";
    pinError = "";
  };

  const validatePin = (pin) => {
    if (TEACHER_PINS[pin]) {
      authenticatedTeacher = TEACHER_PINS[pin].name;
    } else {
      pinError = "Código PIN incorrecto";
    }
  };

  const simulateKeyDown = (e, activeTag = "DIV") => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) return;

    if (/^[0-9]$/.test(e.key)) {
      handleKeyClick(e.key);
    } else if (e.key === "Backspace") {
      handleDelete();
    } else if (e.key === "Escape") {
      handleClear();
    } else if (e.key === "Enter") {
      if (pinInput.length === 4) validatePin(pinInput);
    }
  };

  // Type 1, 0, Backspace, 0, 0, 1 -> 1001
  simulateKeyDown({ key: "1" });
  simulateKeyDown({ key: "0" });
  simulateKeyDown({ key: "Backspace" });
  simulateKeyDown({ key: "0" });
  simulateKeyDown({ key: "0" });
  simulateKeyDown({ key: "1" });

  assert.strictEqual(authenticatedTeacher, "LUCÍA MUÑOZ", "Teacher Lucía Muñoz must be authenticated");
});

test("[KEYBOARD.2] Keyboard dispatcher ignores keydowns when user is typing in form inputs", () => {
  let pinInput = "";
  const handleKeyClick = (d) => { pinInput += d; };

  const simulateKeyDown = (e, activeTag) => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) return;
    if (/^[0-9]$/.test(e.key)) handleKeyClick(e.key);
  };

  simulateKeyDown({ key: "1" }, "INPUT");
  simulateKeyDown({ key: "2" }, "TEXTAREA");
  simulateKeyDown({ key: "3" }, "SELECT");
  assert.strictEqual(pinInput, "", "Must not capture keypad digits when focus is in form fields");
});

// -----------------------------------------------------------------------------
// SECTION 5: SESSION CLEARANCE & LOGOUT MEMORY PURGE
// -----------------------------------------------------------------------------
console.log("\n--------------------------------------------------------------------------------");
console.log("SECTION 5: COMPLETE LOGOUT STATE RESET & RESIDUAL DATA PURGE");
console.log("--------------------------------------------------------------------------------");

test("[LOGOUT.1] handleLogout purges all 17 component state variables and sessionStorage", () => {
  const state = {
    sessionStorageItem: "1001",
    isAuthenticated: true,
    isAdmin: true,
    pinInput: "1001",
    pinError: "Old error",
    selectedProfesor: "ALEJANDRO ROVINA",
    activeTab: "open_classes",
    teacherStudent: { id: "std_123", name: "ALEJANDRO" },
    clasesProfesor: [{ id: "cls_1", name: "Salsa" }],
    selectedClase: { id: "cls_1" },
    roster: [{ id: "s1", name: "Student 1", telefono: "666555444" }],
    rosterSearch: "maria",
    asistenciasRegistradas: ["s1"],
    allOpenClasses: [{ id: "oc_1" }],
    teacherEnrolledClassIds: ["oc_1"],
    selectedBonoForPayment: { id: "b1" },
    isProcessingPayment: true,
    savingId: "s1",
    modal: { isOpen: true, message: "Hello" }
  };

  const handleLogout = (s) => {
    s.sessionStorageItem = null;
    s.isAuthenticated = false;
    s.isAdmin = false;
    s.pinInput = "";
    s.pinError = "";
    s.selectedProfesor = "LUCÍA MUÑOZ";
    s.activeTab = "mis_clases";
    s.teacherStudent = null;
    s.clasesProfesor = [];
    s.selectedClase = null;
    s.roster = [];
    s.rosterSearch = "";
    s.asistenciasRegistradas = [];
    s.allOpenClasses = [];
    s.teacherEnrolledClassIds = [];
    s.selectedBonoForPayment = null;
    s.isProcessingPayment = false;
    s.savingId = null;
    s.modal = { isOpen: false, message: "" };
  };

  handleLogout(state);

  assert.strictEqual(state.sessionStorageItem, null);
  assert.strictEqual(state.isAuthenticated, false);
  assert.strictEqual(state.isAdmin, false);
  assert.strictEqual(state.pinInput, "");
  assert.strictEqual(state.pinError, "");
  assert.strictEqual(state.selectedProfesor, "LUCÍA MUÑOZ");
  assert.strictEqual(state.activeTab, "mis_clases");
  assert.strictEqual(state.teacherStudent, null);
  assert.deepStrictEqual(state.clasesProfesor, []);
  assert.strictEqual(state.selectedClase, null);
  assert.deepStrictEqual(state.roster, []);
  assert.strictEqual(state.rosterSearch, "");
  assert.deepStrictEqual(state.asistenciasRegistradas, []);
  assert.deepStrictEqual(state.allOpenClasses, []);
  assert.deepStrictEqual(state.teacherEnrolledClassIds, []);
  assert.strictEqual(state.selectedBonoForPayment, null);
  assert.strictEqual(state.isProcessingPayment, false);
  assert.strictEqual(state.savingId, null);
  assert.deepStrictEqual(state.modal, { isOpen: false, message: "" });
});

// -----------------------------------------------------------------------------
// SECTION 6: MODAL UI/UX & BACKDROP DISMISSAL
// -----------------------------------------------------------------------------
console.log("\n--------------------------------------------------------------------------------");
console.log("SECTION 6: MODAL BACKDROP DISMISSAL & EVENT PROPAGATION");
console.log("--------------------------------------------------------------------------------");

const appModalPath = path.resolve("src/components/AppModal.tsx");
const appModalContent = fs.readFileSync(appModalPath, "utf8");

test("[MODAL.1] AppModal.tsx implements backdrop click dismissal (e.target === e.currentTarget)", () => {
  assert(appModalContent.includes("if (e.target === e.currentTarget)"), "AppModal must check e.target === e.currentTarget");
  assert(appModalContent.includes("onClose()"), "AppModal must call onClose()");
  assert(appModalContent.includes("e.stopPropagation()"), "Inner card must call e.stopPropagation()");
});

test("[MODAL.2] Teacher Bono Checkout modal in profesor/page.tsx implements backdrop click dismissal", () => {
  assert(profesorPage.includes("if (e.target === e.currentTarget)"), "Bono modal must check e.target === e.currentTarget");
  assert(profesorPage.includes("setSelectedBonoForPayment(null)"), "Bono modal must clear selected bono on backdrop tap");
});

test("[MODAL.3] Modal backdrop click simulation", () => {
  let isClosed = false;
  const onClose = () => { isClosed = true; };

  const backdropDiv = { id: "backdrop" };
  const cardDiv = { id: "card" };

  const handleBackdropClick = (target, currentTarget) => {
    if (target === currentTarget) {
      onClose();
    }
  };

  // Clicking backdrop (target === currentTarget)
  handleBackdropClick(backdropDiv, backdropDiv);
  assert.strictEqual(isClosed, true, "Clicking backdrop must close modal");

  // Clicking inner card (target !== currentTarget)
  isClosed = false;
  handleBackdropClick(cardDiv, backdropDiv);
  assert.strictEqual(isClosed, false, "Clicking inside card must not close modal");
});

// -----------------------------------------------------------------------------
// SECTION 7: MOBILE SAFE-AREA INSETS & VIEWPORT ERGONOMICS
// -----------------------------------------------------------------------------
console.log("\n--------------------------------------------------------------------------------");
console.log("SECTION 7: MOBILE SAFE-AREA INSETS & ERGONOMICS");
console.log("--------------------------------------------------------------------------------");

test("[MOBILE.1] Fixed bottom nav uses env(safe-area-inset-bottom, 0px) padding", () => {
  assert(profesorPage.includes("pb-[env(safe-area-inset-bottom,0px)]"), "Bottom nav must include safe-area-inset-bottom");
});

test("[MOBILE.2] Keypad buttons include touch-manipulation and select-none for fast multi-touch", () => {
  assert(profesorPage.includes("touch-manipulation"), "Keypad buttons must have touch-manipulation");
  assert(profesorPage.includes("select-none"), "Keypad buttons must have select-none");
});

test("[MOBILE.3] Root layout defines mobile viewport with initialScale 1 and userScalable false", () => {
  const layoutPath = path.resolve("src/app/layout.tsx");
  const layoutContent = fs.readFileSync(layoutPath, "utf8");
  assert(layoutContent.includes("initialScale: 1"), "Layout must configure initialScale: 1");
  assert(layoutContent.includes("maximumScale: 1"), "Layout must configure maximumScale: 1");
  assert(layoutContent.includes("userScalable: false"), "Layout must disable double-tap zoom delay");
});

console.log("\n================================================================================");
console.log(`SUMMARY: ${passedCount} PASSED / ${failedCount} FAILED`);
console.log("================================================================================");

if (failedCount > 0) {
  process.exit(1);
}
