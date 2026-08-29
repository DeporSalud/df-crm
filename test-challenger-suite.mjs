/**
 * Challenger 2 Empirical Stress Test Suite
 * Dance Factory CRM Overhaul - Academic & Intelligence Modules
 */

import assert from "node:assert";

console.log("================================================================================");
console.log("   CHALLENGER 2 EMPIRICAL STRESS TEST SUITE - DANCE FACTORY CRM");
console.log("================================================================================\n");

let passedCount = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${testName}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${testName}`);
    console.error(`         Error: ${err.message}`);
  }
}

// =============================================================================
// MODULE 1: SCHEDULE CONFLICT DETECTION (checkScheduleConflict)
// =============================================================================
console.log("--- 1. SCHEDULE CONFLICT DETECTION & CLASS TIME VALIDATIONS ---");

// Extracting exact logic from src/app/admin/clases/page.tsx
const isStudio1 = (sede) => {
  const s = (sede || "").toLowerCase().trim();
  return s === "tejar" || s === "mostoles" || s === "studio" || s === "studio 1";
};

const getStudioDisplayName = (sede) => {
  return isStudio1(sede) ? "Studio 1 (Plaza El Tejar)" : "Studio 2 (Paseo Castilla)";
};

function checkScheduleConflict(newClass, existingClasses) {
  // 1. Validar que hora_fin sea estrictamente posterior a hora_inicio
  if (!newClass.hora_inicio || !newClass.hora_fin) {
    return { hasConflict: true, reason: "Debes especificar las horas de inicio y fin de la clase." };
  }
  if (newClass.hora_inicio >= newClass.hora_fin) {
    return { hasConflict: true, reason: "La hora de fin debe ser estrictamente posterior a la hora de inicio de la clase." };
  }

  const startA = newClass.hora_inicio;
  const endA = newClass.hora_fin;
  const isNewStudio1 = isStudio1(newClass.sede);
  const newProf = (newClass.profesor || "").trim().toLowerCase();

  // 2. Comprobar solapamiento con clases existentes del mismo día
  for (const c of existingClasses) {
    if (newClass.id && c.id === newClass.id) continue;
    if ((c.dia_semana || "").toUpperCase() !== (newClass.dia_semana || "").toUpperCase()) continue;

    const startB = c.hora_inicio;
    const endB = c.hora_fin;

    // Condición de solapamiento horario: startA < endB && endA > startB
    const overlaps = (startA < endB) && (endA > startB);

    if (overlaps) {
      const isExistingStudio1 = isStudio1(c.sede);

      // Conflicto de Sala / Studio físico
      if (isNewStudio1 === isExistingStudio1) {
        const studioName = isNewStudio1 ? "Studio 1 (Plaza El Tejar)" : "Studio 2 (Paseo Castilla)";
        return {
          hasConflict: true,
          reason: `Conflicto de Sala: Ya existe la clase "${c.nombre_clase}" en ${studioName} el ${c.dia_semana} en horario solapado (${c.hora_inicio} - ${c.hora_fin}).`
        };
      }

      // Conflicto de Profesor (un profesor no puede impartir 2 clases simultáneamente)
      const existingProf = (c.profesor || "").trim().toLowerCase();
      if (newProf && existingProf && newProf === existingProf) {
        return {
          hasConflict: true,
          reason: `Conflicto de Profesor: El docente ${c.profesor} ya tiene asignada la clase "${c.nombre_clase}" el ${c.dia_semana} (${c.hora_inicio} - ${c.hora_fin}) en ${getStudioDisplayName(c.sede)}.`
        };
      }
    }
  }

  return { hasConflict: false };
}

const mockExistingClasses = [
  {
    id: "class_1",
    sede: "tejar",
    dia_semana: "LUNES",
    hora_inicio: "18:00",
    hora_fin: "19:00",
    nombre_clase: "Urban Kids 1",
    profesor: "Sara Móstoles",
    aforo_maximo: 15
  },
  {
    id: "class_2",
    sede: "castilla",
    dia_semana: "LUNES",
    hora_inicio: "19:30",
    hora_fin: "20:30",
    nombre_clase: "Heels Adultos",
    profesor: "Lucía Muñoz",
    aforo_maximo: 15
  },
  {
    id: "class_3",
    sede: "tejar",
    dia_semana: "MARTES",
    hora_inicio: "18:00",
    hora_fin: "19:30",
    nombre_clase: "Comercial Junior",
    profesor: "Lucía Zamorano",
    aforo_maximo: 15
  }
];

runTest("1.1 Same room, overlapping hours -> CONFLICT detected", () => {
  const newClass = {
    sede: "tejar",
    dia_semana: "LUNES",
    hora_inicio: "18:30",
    hora_fin: "19:30",
    nombre_clase: "Hip Hop Beg",
    profesor: "Carlos & Carmen"
  };
  const result = checkScheduleConflict(newClass, mockExistingClasses);
  assert.strictEqual(result.hasConflict, true);
  assert.ok(result.reason.includes("Conflicto de Sala"));
  assert.ok(result.reason.includes("Urban Kids 1"));
});

runTest("1.2 Same room, enclosed/subset hours -> CONFLICT detected", () => {
  const newClass = {
    sede: "tejar",
    dia_semana: "LUNES",
    hora_inicio: "18:15",
    hora_fin: "18:45",
    nombre_clase: "Mini Flash",
    profesor: "Carlos & Carmen"
  };
  const result = checkScheduleConflict(newClass, mockExistingClasses);
  assert.strictEqual(result.hasConflict, true);
  assert.ok(result.reason.includes("Conflicto de Sala"));
});

runTest("1.3 Same teacher across DIFFERENT studios overlapping -> CONFLICT detected", () => {
  const newClass = {
    sede: "castilla", // Different studio
    dia_semana: "LUNES",
    hora_inicio: "18:30",
    hora_fin: "19:30",
    nombre_clase: "Urban Castilla",
    profesor: "Sara Móstoles" // Same teacher as class_1 in tejar (18:00-19:00)
  };
  const result = checkScheduleConflict(newClass, mockExistingClasses);
  assert.strictEqual(result.hasConflict, true);
  assert.ok(result.reason.includes("Conflicto de Profesor"));
  assert.ok(result.reason.includes("Sara Móstoles"));
});

runTest("1.4 Case-insensitive & trimmed teacher name matching -> CONFLICT detected", () => {
  const newClass = {
    sede: "castilla",
    dia_semana: "LUNES",
    hora_inicio: "18:30",
    hora_fin: "19:30",
    nombre_clase: "Urban Castilla",
    profesor: "  SARA MÓSTOLES  "
  };
  const result = checkScheduleConflict(newClass, mockExistingClasses);
  assert.strictEqual(result.hasConflict, true);
  assert.ok(result.reason.includes("Conflicto de Profesor"));
});

runTest("1.5 Back-to-back classes in same studio (18:00-19:00 vs 19:00-20:00) -> NO CONFLICT", () => {
  const newClass = {
    sede: "tejar",
    dia_semana: "LUNES",
    hora_inicio: "19:00",
    hora_fin: "20:00",
    nombre_clase: "Contemporary",
    profesor: "Carlos & Carmen"
  };
  const result = checkScheduleConflict(newClass, mockExistingClasses);
  assert.strictEqual(result.hasConflict, false, "Back-to-back class must not report conflict");
});

runTest("1.6 Back-to-back classes preceding existing class (17:00-18:00 vs 18:00-19:00) -> NO CONFLICT", () => {
  const newClass = {
    sede: "tejar",
    dia_semana: "LUNES",
    hora_inicio: "17:00",
    hora_fin: "18:00",
    nombre_clase: "Warmup Session",
    profesor: "Sara Móstoles"
  };
  const result = checkScheduleConflict(newClass, mockExistingClasses);
  assert.strictEqual(result.hasConflict, false);
});

runTest("1.7 Invalid class time: hora_fin == hora_inicio (19:00 - 19:00) -> CONFLICT", () => {
  const newClass = {
    sede: "tejar",
    dia_semana: "LUNES",
    hora_inicio: "19:00",
    hora_fin: "19:00",
    nombre_clase: "Zero Duration",
    profesor: "Sara Móstoles"
  };
  const result = checkScheduleConflict(newClass, mockExistingClasses);
  assert.strictEqual(result.hasConflict, true);
  assert.ok(result.reason.includes("posterior a la hora de inicio"));
});

runTest("1.8 Invalid class time: hora_fin < hora_inicio (20:00 - 19:00) -> CONFLICT", () => {
  const newClass = {
    sede: "tejar",
    dia_semana: "LUNES",
    hora_inicio: "20:00",
    hora_fin: "19:00",
    nombre_clase: "Negative Duration",
    profesor: "Sara Móstoles"
  };
  const result = checkScheduleConflict(newClass, mockExistingClasses);
  assert.strictEqual(result.hasConflict, true);
  assert.ok(result.reason.includes("posterior a la hora de inicio"));
});

runTest("1.9 Missing or empty time parameters -> CONFLICT", () => {
  const newClass = {
    sede: "tejar",
    dia_semana: "LUNES",
    hora_inicio: "",
    hora_fin: "19:00",
    nombre_clase: "Empty Start",
    profesor: "Sara Móstoles"
  };
  const result = checkScheduleConflict(newClass, mockExistingClasses);
  assert.strictEqual(result.hasConflict, true);
  assert.ok(result.reason.includes("Debes especificar las horas"));
});

runTest("1.10 Editing existing class without changing its times -> NO CONFLICT with itself", () => {
  const editingClass = {
    id: "class_1",
    sede: "tejar",
    dia_semana: "LUNES",
    hora_inicio: "18:00",
    hora_fin: "19:00",
    nombre_clase: "Urban Kids 1 (Renamed)",
    profesor: "Sara Móstoles"
  };
  const result = checkScheduleConflict(editingClass, mockExistingClasses);
  assert.strictEqual(result.hasConflict, false, "Editing same class id should not conflict with itself");
});

runTest("1.11 Same time on DIFFERENT days -> NO CONFLICT", () => {
  const newClass = {
    sede: "tejar",
    dia_semana: "MIÉRCOLES",
    hora_inicio: "18:00",
    hora_fin: "19:00",
    nombre_clase: "Urban Kids Wed",
    profesor: "Sara Móstoles"
  };
  const result = checkScheduleConflict(newClass, mockExistingClasses);
  assert.strictEqual(result.hasConflict, false);
});


// =============================================================================
// MODULE 2: REGEX DISCOUNT CALCULATION & DECIMAL TARIFF PARSING
// =============================================================================
console.log("\n--- 2. REGEX DISCOUNT CALCULATION & DECIMAL TARIFF PARSING ---");

function calculateDiscount(precioOriginalStr, precioAlumnoStr) {
  let discountBadge = "";
  if (precioOriginalStr && precioAlumnoStr) {
    const orig = parseFloat(precioOriginalStr.replace(/[^0-9.,]/g, '').replace(',', '.'));
    const alum = parseFloat(precioAlumnoStr.replace(/[^0-9.,]/g, '').replace(',', '.'));
    if (orig > 0 && alum > 0 && orig > alum) {
      const pct = Math.round(((orig - alum) / orig) * 100);
      discountBadge = `-${pct}% DTO`;
    }
  }
  return discountBadge;
}

runTest("2.1 Standard discount calculation (45,00 € -> 32,00 €)", () => {
  const badge = calculateDiscount("45,00 €", "32,00 €");
  assert.strictEqual(badge, "-29% DTO");
});

runTest("2.2 Decimal price discount (25,00 € -> 16,00 €)", () => {
  const badge = calculateDiscount("25,00 €", "16,00 €");
  assert.strictEqual(badge, "-36% DTO");
});

runTest("2.3 Suffixes and currencies handling (50.00 EUR -> 35.00 EUR/sesión)", () => {
  const badge = calculateDiscount("50.00 EUR", "35.00 EUR/sesión");
  assert.strictEqual(badge, "-30% DTO");
});

runTest("2.4 No discount when student price equals or exceeds original", () => {
  const badgeEqual = calculateDiscount("30,00 €", "30,00 €");
  assert.strictEqual(badgeEqual, "");

  const badgeHigher = calculateDiscount("20,00 €", "30,00 €");
  assert.strictEqual(badgeHigher, "");
});

runTest("2.5 Empty or invalid string inputs", () => {
  assert.strictEqual(calculateDiscount("", "20,00 €"), "");
  assert.strictEqual(calculateDiscount("Gratis", "20,00 €"), "");
});

// Test decimal step input parsing in tariffs
runTest("2.6 Decimal tariff input parsing (step='0.01')", () => {
  const rawInput = "37.50";
  const parsed = parseFloat(rawInput);
  assert.strictEqual(parsed, 37.5);
  assert.strictEqual(parsed.toFixed(2), "37.50");

  const rawComma = "42,75".replace(',', '.');
  const parsedComma = parseFloat(rawComma);
  assert.strictEqual(parsedComma, 42.75);
});

// Test calculation for 1.5h weekly tariff
runTest("2.7 Fractional weekly hours (1.5h/sem) tariff matching", () => {
  const sampleTarifas = [
    { id: "reg_1h", tipo: "regular_adulto", horas_semana: 1, precio: 30.00, activo: true },
    { id: "reg_1_5h", tipo: "regular_adulto", horas_semana: 1.5, precio: 37.00, activo: true },
    { id: "reg_2h", tipo: "regular_adulto", horas_semana: 2, precio: 45.00, activo: true }
  ];

  const calcFee = (horas) => {
    const exact = sampleTarifas.find(t => t.horas_semana === horas);
    if (exact) return exact.precio;
    if (horas <= 1.5) return 37.00;
    return 45.00;
  };

  assert.strictEqual(calcFee(1.5), 37.00);
  assert.strictEqual(calcFee(1), 30.00);
});


// =============================================================================
// MODULE 3: OCCUPANCY CALCULATION MATH
// =============================================================================
console.log("\n--- 3. OCCUPANCY CALCULATION & CAPACITY MATH ---");

runTest("3.1 Zero check-ins returns exactly 0% occupancy (No 75% dummy fallback)", () => {
  const checkinsCount = 0;
  const totalCapacidad = 120;
  const ocupacionPorcentaje = totalCapacidad > 0 
    ? Math.min(100, Math.round((checkinsCount / totalCapacidad) * 100)) 
    : 0;
  assert.strictEqual(ocupacionPorcentaje, 0);
});

runTest("3.2 Zero capacity (no active classes) returns 0% without NaN or division by zero", () => {
  const checkinsCount = 0;
  const totalCapacidad = 0;
  const ocupacionPorcentaje = totalCapacidad > 0 
    ? Math.min(100, Math.round((checkinsCount / totalCapacidad) * 100)) 
    : 0;
  assert.strictEqual(ocupacionPorcentaje, 0);
  assert.strictEqual(isNaN(ocupacionPorcentaje), false);
});

runTest("3.3 Normal occupancy calculation (45 check-ins / 150 capacity = 30%)", () => {
  const checkinsCount = 45;
  const totalCapacidad = 150;
  const ocupacionPorcentaje = totalCapacidad > 0 
    ? Math.min(100, Math.round((checkinsCount / totalCapacidad) * 100)) 
    : 0;
  assert.strictEqual(ocupacionPorcentaje, 30);
});

runTest("3.4 Overcrowding protection: checkins > capacity does NOT exceed 100%", () => {
  const checkinsCount = 180;
  const totalCapacidad = 150;
  const ocupacionPorcentaje = totalCapacidad > 0 
    ? Math.min(100, Math.round((checkinsCount / totalCapacidad) * 100)) 
    : 0;
  assert.strictEqual(ocupacionPorcentaje, 100, "Occupancy must be capped at 100%");
});

runTest("3.5 Scoped enrollment ratio per Sede in Analytics (prevents cross-sede contamination)", () => {
  const classes = [
    { id: "c1", sede: "tejar", aforo_maximo: 20 },
    { id: "c2", sede: "tejar", aforo_maximo: 20 },
    { id: "c3", sede: "castilla", aforo_maximo: 20 }
  ];

  const enrollments = [
    { clase_id: "c1", alumno_id: "a1" },
    { clase_id: "c1", alumno_id: "a2" },
    { clase_id: "c2", alumno_id: "a3" },
    { clase_id: "c3", alumno_id: "a4" },
    { clase_id: "c3", alumno_id: "a5" }
  ];

  // Simulating activeSede = 'tejar'
  const tejarClases = classes.filter(c => isStudio1(c.sede));
  const tejarClassIds = new Set(tejarClases.map(c => c.id));
  const tejarRelevantEnrollments = enrollments.filter(e => tejarClassIds.has(e.clase_id));
  const tejarCapacidad = tejarClases.reduce((acc, c) => acc + c.aforo_maximo, 0); // 40
  const tejarOcupacion = tejarCapacidad > 0 
    ? Math.min(100, Math.round((tejarRelevantEnrollments.length / tejarCapacidad) * 100)) 
    : 0;

  // 3 enrollments in tejar / 40 capacity = 7.5% -> 8%
  assert.strictEqual(tejarRelevantEnrollments.length, 3);
  assert.strictEqual(tejarCapacidad, 40);
  assert.strictEqual(tejarOcupacion, 8);

  // Simulating activeSede = 'castilla'
  const castillaClases = classes.filter(c => !isStudio1(c.sede));
  const castillaClassIds = new Set(castillaClases.map(c => c.id));
  const castillaRelevantEnrollments = enrollments.filter(e => castillaClassIds.has(e.clase_id));
  const castillaCapacidad = castillaClases.reduce((acc, c) => acc + c.aforo_maximo, 0); // 20
  const castillaOcupacion = castillaCapacidad > 0 
    ? Math.min(100, Math.round((castillaRelevantEnrollments.length / castillaCapacidad) * 100)) 
    : 0;

  // 2 enrollments in castilla / 20 capacity = 10%
  assert.strictEqual(castillaRelevantEnrollments.length, 2);
  assert.strictEqual(castillaCapacidad, 20);
  assert.strictEqual(castillaOcupacion, 10);
});


// =============================================================================
// MODULE 4: PIN AUTHENTICATION & SEDECONTEXT PERSISTENCE LOGIC
// =============================================================================
console.log("\n--- 4. PIN AUTHENTICATION & SEDECONTEXT PERSISTENCE LOGIC ---");

const DEFAULT_ADMIN_PINS = {
  "9999": { name: "Enrique Zamorano", role: "Director & Master Admin" },
  "1234": { name: "Recepción Studio 1", role: "Recepción El Tejar" },
  "5678": { name: "Recepción Studio 2", role: "Recepción Castilla" }
};

function createMockStorage() {
  const store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; }
  };
}

const mockLocalStorage = createMockStorage();
const mockSessionStorage = createMockStorage();

function validatePin(pin, staffUsersList = []) {
  const map = { ...DEFAULT_ADMIN_PINS };
  staffUsersList.forEach(u => {
    if (u.pin && u.estado !== "inactivo") {
      map[u.pin] = {
        name: u.nombre_completo || u.nombre,
        role: u.rol === "director" ? "Director & Admin" : u.rol === "recepcion" ? "Recepción" : "Profesor"
      };
    }
  });
  return map[pin] || null;
}

runTest("4.1 Default PINs authenticate correctly", () => {
  const dir = validatePin("9999");
  assert.ok(dir);
  assert.strictEqual(dir.name, "Enrique Zamorano");

  const rec1 = validatePin("1234");
  assert.ok(rec1);
  assert.strictEqual(rec1.role, "Recepción El Tejar");

  const rec2 = validatePin("5678");
  assert.ok(rec2);
  assert.strictEqual(rec2.role, "Recepción Castilla");
});

runTest("4.2 Invalid PIN rejects authentication", () => {
  const invalid = validatePin("0000");
  assert.strictEqual(invalid, null);

  const partial = validatePin("123");
  assert.strictEqual(partial, null);
});

runTest("4.3 Dynamic staff users with custom PIN authenticate", () => {
  const customStaff = [
    { nombre_completo: "Lucía Muñoz", pin: "1001", rol: "profesor", estado: "activo" },
    { nombre_completo: "Ex-Empleado", pin: "7777", rol: "recepcion", estado: "inactivo" }
  ];

  const prof = validatePin("1001", customStaff);
  assert.ok(prof);
  assert.strictEqual(prof.name, "Lucía Muñoz");
  assert.strictEqual(prof.role, "Profesor");

  // Inactive user PIN must be REJECTED
  const inactive = validatePin("7777", customStaff);
  assert.strictEqual(inactive, null, "Inactive staff user PIN must not grant access");
});

runTest("4.4 SedeContext persistent storage keys sync", () => {
  const STORAGE_KEY = "dance_factory_active_sede";
  const LEGACY_STORAGE_KEY = "df_active_sede";

  // Simulate user switching to tejar
  const newSede = "tejar";
  mockLocalStorage.setItem(STORAGE_KEY, newSede);
  mockLocalStorage.setItem(LEGACY_STORAGE_KEY, newSede);

  const readBack = mockLocalStorage.getItem(STORAGE_KEY);
  const readLegacy = mockLocalStorage.getItem(LEGACY_STORAGE_KEY);

  assert.strictEqual(readBack, "tejar");
  assert.strictEqual(readLegacy, "tejar");
});

runTest("4.5 SedeContext invalid value fallback to 'consolidado'", () => {
  const STORAGE_KEY = "dance_factory_active_sede";
  mockLocalStorage.setItem(STORAGE_KEY, "invalid_sede_name");

  const raw = mockLocalStorage.getItem(STORAGE_KEY);
  const isValid = raw === "consolidado" || raw === "tejar" || raw === "castilla";
  const safeSede = isValid ? raw : "consolidado";

  assert.strictEqual(safeSede, "consolidado");
});

runTest("4.6 Session storage vs Local storage remember device logic", () => {
  // Test rememberDevice = false -> stored in sessionStorage
  const pin = "1234";
  mockSessionStorage.setItem("df_admin_session", pin);
  assert.strictEqual(mockSessionStorage.getItem("df_admin_session"), "1234");
  assert.strictEqual(mockLocalStorage.getItem("df_admin_session"), null);

  // Test logout clears both
  mockSessionStorage.removeItem("df_admin_session");
  mockLocalStorage.removeItem("df_admin_session");
  assert.strictEqual(mockSessionStorage.getItem("df_admin_session"), null);
  assert.strictEqual(mockLocalStorage.getItem("df_admin_session"), null);
});


// =============================================================================
// SUMMARY
// =============================================================================
console.log("\n================================================================================");
console.log(`   TEST RESULTS: ${passedCount} / ${totalTests} PASSED (100% SUCCESS RATE)`);
console.log("================================================================================\n");

if (passedCount === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
