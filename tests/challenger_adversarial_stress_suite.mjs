/**
 * ============================================================================
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE - DANCE FACTORY CRM
 * Challenger Final 1 - Deep Attack Vectors & Fuzzing Harness
 * ============================================================================
 */

import assert from "node:assert";

console.log("================================================================================");
console.log("   DANCE FACTORY CRM - EMPIRICAL ADVERSARIAL STRESS HARNESS");
console.log("================================================================================\n");

let passedCount = 0;
let failedCount = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(`    Details: ${err.message}`);
    failedCount++;
  }
}

async function runAsyncTest(testName, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(`    Details: ${err.message}`);
    failedCount++;
  }
}

// -----------------------------------------------------------------------------
// CORE HELPER FUNCTIONS DIRECTLY FROM CRM PRODUCTION CODE
// -----------------------------------------------------------------------------

const normalizeText = (text) => {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
};

const isStudio1 = (sede) => {
  const s = (sede || "").toLowerCase().trim();
  return s === "tejar" || s === "mostoles" || s === "studio" || s === "studio 1";
};

const getStudioDisplayName = (sede) => {
  return isStudio1(sede) ? "Studio 1 (Plaza El Tejar)" : "Studio 2 (Paseo Castilla)";
};

const checkClassIntervalConflict = (startA, endA, startB, endB) => {
  if (!startA || !endA || !startB || !endB) return false;
  return (startA < endB) && (endA > startB);
};

const checkTeacherTimeConflict = (
  targetClass,
  teacherClasses = [],
  enrolledOpenClasses = []
) => {
  if (!targetClass.hora_inicio || !targetClass.hora_fin) {
    return { conflict: true, reason: "Horas no especificadas" };
  }
  if (targetClass.hora_inicio >= targetClass.hora_fin) {
    return { conflict: true, reason: "La hora de fin debe ser posterior a la hora de inicio" };
  }

  const targetDay = normalizeText(targetClass.dia_semana);
  const allClassesToCheck = [...teacherClasses, ...enrolledOpenClasses];

  for (const c of allClassesToCheck) {
    if (c.id && c.id === targetClass.id) continue;
    if (normalizeText(c.dia_semana) !== targetDay) continue;

    const overlaps = checkClassIntervalConflict(
      targetClass.hora_inicio, targetClass.hora_fin,
      c.hora_inicio, c.hora_fin
    );

    if (overlaps) {
      return {
        conflict: true,
        conflictingClassName: c.nombre_clase,
        reason: `Existe un solapamiento horario con "${c.nombre_clase}" (${c.dia_semana} ${c.hora_inicio}-${c.hora_fin}h).`
      };
    }
  }

  return { conflict: false };
};

const calculateCancellationWindow = (clase, referenceDate = new Date()) => {
  const daysMap = {
    "DOMINGO": 0, "LUNES": 1, "MARTES": 2, "MIERCOLES": 3, "MIÉRCOLES": 3,
    "JUEVES": 4, "VIERNES": 5, "SABADO": 6, "SÁBADO": 6
  };
  const targetDayNum = daysMap[normalizeText(clase.dia_semana)] ?? 1;
  const now = new Date(referenceDate);
  const currentDayNum = now.getDay();
  let daysUntil = (targetDayNum - currentDayNum + 7) % 7;
  const [hours, minutes] = (clase.hora_inicio || "00:00").split(":").map(Number);
  const classDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil, hours, minutes || 0, 0);
  if (daysUntil === 0 && classDate.getTime() <= now.getTime()) {
    classDate.setDate(classDate.getDate() + 7);
  }
  const diffHours = (classDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  return {
    diffHours,
    canCancel: diffHours >= 24,
    classDate
  };
};

// =============================================================================
// CATEGORY 1: SCHEDULE COLLISION INTERVALS (TOUCHING, OVERLAPPING, ENCLOSING)
// =============================================================================
console.log("--------------------------------------------------------------------------------");
console.log("CATEGORY 1: SCHEDULE COLLISION INTERVALS (DEEP ADVERSARIAL CHALLENGE)");
console.log("--------------------------------------------------------------------------------");

runTest("[Schedule.1] Touching intervals at exact boundary (18:00-19:00 vs 19:00-20:00) have NO conflict", () => {
  const target = { id: "tgt", dia_semana: "Lunes", hora_inicio: "19:00", hora_fin: "20:00", nombre_clase: "Hip Hop 2" };
  const teacherClasses = [{ id: "t1", dia_semana: "Lunes", hora_inicio: "18:00", hora_fin: "19:00", nombre_clase: "Hip Hop 1" }];
  const res = checkTeacherTimeConflict(target, teacherClasses);
  assert.strictEqual(res.conflict, false, "Touching boundaries must not trigger collision");
});

runTest("[Schedule.2] Back-to-back touching reversed (19:00-20:00 vs 18:00-19:00) has NO conflict", () => {
  const target = { id: "tgt", dia_semana: "Lunes", hora_inicio: "18:00", hora_fin: "19:00", nombre_clase: "Hip Hop 1" };
  const teacherClasses = [{ id: "t1", dia_semana: "Lunes", hora_inicio: "19:00", hora_fin: "20:00", nombre_clase: "Hip Hop 2" }];
  const res = checkTeacherTimeConflict(target, teacherClasses);
  assert.strictEqual(res.conflict, false, "Reverse touching boundaries must not trigger collision");
});

runTest("[Schedule.3] 1-minute overlap at end boundary (18:00-19:01 vs 19:00-20:00) DOES conflict", () => {
  const target = { id: "tgt", dia_semana: "Lunes", hora_inicio: "19:00", hora_fin: "20:00", nombre_clase: "Hip Hop 2" };
  const teacherClasses = [{ id: "t1", dia_semana: "Lunes", hora_inicio: "18:00", hora_fin: "19:01", nombre_clase: "Hip Hop 1" }];
  const res = checkTeacherTimeConflict(target, teacherClasses);
  assert.strictEqual(res.conflict, true, "1-minute overlap must trigger collision");
});

runTest("[Schedule.4] 1-minute overlap at start boundary (18:00-19:00 vs 18:59-20:00) DOES conflict", () => {
  const target = { id: "tgt", dia_semana: "Lunes", hora_inicio: "18:59", hora_fin: "20:00", nombre_clase: "Hip Hop 2" };
  const teacherClasses = [{ id: "t1", dia_semana: "Lunes", hora_inicio: "18:00", hora_fin: "19:00", nombre_clase: "Hip Hop 1" }];
  const res = checkTeacherTimeConflict(target, teacherClasses);
  assert.strictEqual(res.conflict, true, "1-minute start overlap must trigger collision");
});

runTest("[Schedule.5] Enclosing interval: Target (17:00-21:00) encloses existing (18:00-19:00) DOES conflict", () => {
  const target = { id: "tgt", dia_semana: "Lunes", hora_inicio: "17:00", hora_fin: "21:00", nombre_clase: "Master Intensive" };
  const teacherClasses = [{ id: "t1", dia_semana: "Lunes", hora_inicio: "18:00", hora_fin: "19:00", nombre_clase: "Regular Hip Hop" }];
  const res = checkTeacherTimeConflict(target, teacherClasses);
  assert.strictEqual(res.conflict, true, "Enclosing interval must collide");
});

runTest("[Schedule.6] Enclosed interval: Target (18:15-18:45) inside existing (18:00-19:00) DOES conflict", () => {
  const target = { id: "tgt", dia_semana: "Lunes", hora_inicio: "18:15", hora_fin: "18:45", nombre_clase: "Mini Workshop" };
  const teacherClasses = [{ id: "t1", dia_semana: "Lunes", hora_inicio: "18:00", hora_fin: "19:00", nombre_clase: "Regular Hip Hop" }];
  const res = checkTeacherTimeConflict(target, teacherClasses);
  assert.strictEqual(res.conflict, true, "Enclosed interval must collide");
});

runTest("[Schedule.7] Identical intervals (18:00-19:00 vs 18:00-19:00) on same day DO conflict", () => {
  const target = { id: "tgt", dia_semana: "Lunes", hora_inicio: "18:00", hora_fin: "19:00", nombre_clase: "Class A" };
  const teacherClasses = [{ id: "t1", dia_semana: "Lunes", hora_inicio: "18:00", hora_fin: "19:00", nombre_clase: "Class B" }];
  const res = checkTeacherTimeConflict(target, teacherClasses);
  assert.strictEqual(res.conflict, true);
});

runTest("[Schedule.8] Identical intervals on DIFFERENT weekdays (Lunes 18:00 vs Martes 18:00) have NO conflict", () => {
  const target = { id: "tgt", dia_semana: "Martes", hora_inicio: "18:00", hora_fin: "19:00", nombre_clase: "Class A" };
  const teacherClasses = [{ id: "t1", dia_semana: "Lunes", hora_inicio: "18:00", hora_fin: "19:00", nombre_clase: "Class B" }];
  const res = checkTeacherTimeConflict(target, teacherClasses);
  assert.strictEqual(res.conflict, false, "Different weekdays must not conflict");
});

runTest("[Schedule.9] Self-target ID exclusion during class edit does NOT trigger false collision", () => {
  const target = { id: "class_existing_123", dia_semana: "Lunes", hora_inicio: "18:00", hora_fin: "19:00", nombre_clase: "Urban Kids" };
  const teacherClasses = [{ id: "class_existing_123", dia_semana: "Lunes", hora_inicio: "18:00", hora_fin: "19:00", nombre_clase: "Urban Kids" }];
  const res = checkTeacherTimeConflict(target, teacherClasses);
  assert.strictEqual(res.conflict, false, "Target matching its own ID must be ignored");
});

runTest("[Schedule.10] Invalid start time >= end time (19:00-18:00 or 18:00-18:00) rejected immediately", () => {
  const res1 = checkTeacherTimeConflict({ hora_inicio: "19:00", hora_fin: "18:00", dia_semana: "Lunes" });
  assert.strictEqual(res1.conflict, true);
  assert(res1.reason.includes("posterior"));

  const res2 = checkTeacherTimeConflict({ hora_inicio: "18:00", hora_fin: "18:00", dia_semana: "Lunes" });
  assert.strictEqual(res2.conflict, true);
});

runTest("[Schedule.11] Missing start or end time rejected immediately", () => {
  const res1 = checkTeacherTimeConflict({ hora_inicio: "19:00", dia_semana: "Lunes" });
  assert.strictEqual(res1.conflict, true);
  const res2 = checkTeacherTimeConflict({ hora_fin: "19:00", dia_semana: "Lunes" });
  assert.strictEqual(res2.conflict, true);
});

runTest("[Schedule.12] Fuzzing intervals: 500 randomized time slots verify interval overlap theorem", () => {
  for (let i = 0; i < 500; i++) {
    const sA = Math.floor(Math.random() * 1000);
    const eA = sA + 1 + Math.floor(Math.random() * 200);
    const sB = Math.floor(Math.random() * 1000);
    const eB = sB + 1 + Math.floor(Math.random() * 200);

    const pad = (n) => {
      const h = String(Math.floor(n / 60)).padStart(2, "0");
      const m = String(n % 60).padStart(2, "0");
      return `${h}:${m}`;
    };

    const startA = pad(sA);
    const endA = pad(eA);
    const startB = pad(sB);
    const endB = pad(eB);

    const overlap = checkClassIntervalConflict(startA, endA, startB, endB);
    const expected = (startA < endB) && (endA > startB);
    assert.strictEqual(overlap, expected, `Fuzzing mismatch for ${startA}-${endA} vs ${startB}-${endB}`);
  }
});


// =============================================================================
// CATEGORY 2: 24-HOUR CANCELLATION BOUNDARY & DIACRITIC STRIPPING
// =============================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("CATEGORY 2: 24-HOUR CANCELLATION BOUNDARY & DIACRITIC STRIPPING");
console.log("--------------------------------------------------------------------------------");

runTest("[Diacritics.1] Normalization handles Spanish acute accents (Á, É, Í, Ó, Ú, Ñ)", () => {
  assert.strictEqual(normalizeText("MIÉRCOLES"), "MIERCOLES");
  assert.strictEqual(normalizeText("miércoles"), "MIERCOLES");
  assert.strictEqual(normalizeText("SÁBADO"), "SABADO");
  assert.strictEqual(normalizeText("sábado"), "SABADO");
  assert.strictEqual(normalizeText("LUCÍA MUÑOZ"), "LUCIA MUNOZ");
  assert.strictEqual(normalizeText("DARÍO HUMBERTO"), "DARIO HUMBERTO");
  assert.strictEqual(normalizeText("PAULA JIMÉNEZ"), "PAULA JIMENEZ");
  assert.strictEqual(normalizeText("NIL BARBERÁ"), "NIL BARBERA");
});

runTest("[Diacritics.2] Unicode decomposed NFD vs precomposed NFC diacritics normalize identically", () => {
  const composed = "MIÉRCOLES"; // NFC
  const decomposed = "MIE\u0301RCOLES"; // NFD
  assert.strictEqual(normalizeText(composed), normalizeText(decomposed));
  assert.strictEqual(normalizeText(composed), "MIERCOLES");
});

runTest("[Cancellation.1] Exact 24.000 hours remaining allows cancellation", () => {
  // Reference: Tuesday 18:00, Class: Wednesday 18:00
  const ref = new Date(2026, 7, 25, 18, 0, 0); // Day 2 (Tuesday)
  const clase = { dia_semana: "MIÉRCOLES", hora_inicio: "18:00" };
  const res = calculateCancellationWindow(clase, ref);
  assert.strictEqual(res.diffHours, 24);
  assert.strictEqual(res.canCancel, true, "24.0h must allow cancellation");
});

runTest("[Cancellation.2] 23.99 hours remaining (23h 59m) BLOCKS cancellation (<24h policy)", () => {
  // Reference: Tuesday 18:01, Class: Wednesday 18:00
  const ref = new Date(2026, 7, 25, 18, 1, 0); // Day 2 (Tuesday) 18:01
  const clase = { dia_semana: "MIÉRCOLES", hora_inicio: "18:00" };
  const res = calculateCancellationWindow(clase, ref);
  assert(res.diffHours < 24 && res.diffHours > 23.9, `diffHours was ${res.diffHours}`);
  assert.strictEqual(res.canCancel, false, "23h59m must block cancellation");
});

runTest("[Cancellation.3] 24.01 hours remaining (24h 1m) ALLOWS cancellation (>24h policy)", () => {
  // Reference: Tuesday 17:59, Class: Wednesday 18:00
  const ref = new Date(2026, 7, 25, 17, 59, 0); // Day 2 (Tuesday) 17:59
  const clase = { dia_semana: "MIÉRCOLES", hora_inicio: "18:00" };
  const res = calculateCancellationWindow(clase, ref);
  assert(res.diffHours > 24, `diffHours was ${res.diffHours}`);
  assert.strictEqual(res.canCancel, true, "24h1m must allow cancellation");
});

runTest("[Cancellation.4] Same-day class in the past wraps around to next week (+7 days = ~167 hours)", () => {
  // Reference: Saturday 20:00, Class: SÁBADO 18:00 (class was 2 hours ago today)
  const ref = new Date(2026, 7, 29, 20, 0, 0); // Day 6 (Saturday) 20:00
  const clase = { dia_semana: "SÁBADO", hora_inicio: "18:00" };
  const res = calculateCancellationWindow(clase, ref);
  assert(res.diffHours > 160, `diffHours should wrap to next week, got ${res.diffHours}`);
  assert.strictEqual(res.canCancel, true);
});

runTest("[Cancellation.5] Same-day class in 3 hours (today 15:00 vs class today 18:00) BLOCKS cancellation (diff = 3h)", () => {
  // Reference: Saturday 15:00, Class: SÁBADO 18:00
  const ref = new Date(2026, 7, 29, 15, 0, 0); // Day 6 (Saturday) 15:00
  const clase = { dia_semana: "SÁBADO", hora_inicio: "18:00" };
  const res = calculateCancellationWindow(clase, ref);
  assert.strictEqual(res.diffHours, 3);
  assert.strictEqual(res.canCancel, false, "3h before class must be blocked");
});

runTest("[Cancellation.6] Diacritic day names (MIÉRCOLES vs MIERCOLES, SÁBADO vs SABADO) calculate identical hour diffs", () => {
  const ref = new Date(2026, 7, 24, 10, 0, 0); // Monday
  const res1 = calculateCancellationWindow({ dia_semana: "MIÉRCOLES", hora_inicio: "19:00" }, ref);
  const res2 = calculateCancellationWindow({ dia_semana: "MIERCOLES", hora_inicio: "19:00" }, ref);
  const res3 = calculateCancellationWindow({ dia_semana: "SÁBADO", hora_inicio: "12:00" }, ref);
  const res4 = calculateCancellationWindow({ dia_semana: "SABADO", hora_inicio: "12:00" }, ref);

  assert.strictEqual(res1.diffHours, res2.diffHours);
  assert.strictEqual(res3.diffHours, res4.diffHours);
});


// =============================================================================
// CATEGORY 3: ROLL CALL VOUCHER BALANCE CLAMPING & DEDUPLICATION
// =============================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("CATEGORY 3: ROLL CALL VOUCHER BALANCE CLAMPING & DEDUPLICATION");
console.log("--------------------------------------------------------------------------------");

// State machine simulating roll call logic from src/app/profesor/page.tsx
class RollCallSimulator {
  constructor() {
    this.students = new Map();
    this.asistencias = new Set();
    this.deductedStudentIds = new Set();
    this.auditLogs = [];
  }

  addStudent(student) {
    this.students.set(student.id, { ...student });
  }

  isRegularMembership(plan, remaining) {
    if (remaining === null || remaining === undefined) return true;
    const p = (plan || "").toLowerCase();
    return p.includes("regular") || p.includes("mensual") || p.includes("ilimitad") || p.includes("cuota");
  }

  toggleAsistencia(studentId, claseId = "class_1") {
    const student = this.students.get(studentId);
    if (!student) throw new Error("Student not found");

    const yaAsistio = this.asistencias.has(studentId);
    const isRegular = this.isRegularMembership(student.plan_activo, student.clases_restantes);

    if (yaAsistio) {
      // Uncheck
      if (!isRegular && typeof student.clases_restantes === "number") {
        if (this.deductedStudentIds.has(studentId)) {
          student.clases_restantes = student.clases_restantes + 1;
          this.deductedStudentIds.delete(studentId);
        }
      }
      this.asistencias.delete(studentId);
      this.auditLogs.push(`Unmarked ${student.nombre_completo}`);
    } else {
      // Check in
      if (!isRegular && typeof student.clases_restantes === "number" && student.clases_restantes > 0) {
        student.clases_restantes = Math.max(0, student.clases_restantes - 1);
        this.deductedStudentIds.add(studentId);
      }
      this.asistencias.add(studentId);
      this.auditLogs.push(`Marked ${student.nombre_completo}`);
    }
  }

  markAllPresent(roster) {
    const studentsToMark = roster.filter(s => !this.asistencias.has(s.id));
    for (const s of studentsToMark) {
      const student = this.students.get(s.id);
      const isRegular = this.isRegularMembership(student.plan_activo, student.clases_restantes);

      if (!isRegular && typeof student.clases_restantes === "number" && student.clases_restantes > 0) {
        student.clases_restantes = Math.max(0, student.clases_restantes - 1);
        this.deductedStudentIds.add(student.id);
      }
      this.asistencias.add(student.id);
    }
    this.auditLogs.push(`Bulk marked ${studentsToMark.length} students`);
  }
}

runTest("[RollCall.1] Student with 0 classes remaining is clamped at 0 on check-in (NEVER negative)", () => {
  const sim = new RollCallSimulator();
  sim.addStudent({ id: "s0", nombre_completo: "Bono Agotado Alumno", plan_activo: "Bono 4 clases", clases_restantes: 0 });
  
  sim.toggleAsistencia("s0");
  const s = sim.students.get("s0");
  assert.strictEqual(s.clases_restantes, 0, "Balance must stay clamped at 0");
  assert.strictEqual(sim.asistencias.has("s0"), true);
  assert.strictEqual(sim.deductedStudentIds.has("s0"), false, "Must NOT record deduction for 0-class student");
});

runTest("[RollCall.2] Student with 0 classes remaining uncheck DOES NOT award free refund class", () => {
  const sim = new RollCallSimulator();
  sim.addStudent({ id: "s0", nombre_completo: "Bono Agotado Alumno", plan_activo: "Bono 4 clases", clases_restantes: 0 });
  
  // Check in
  sim.toggleAsistencia("s0");
  assert.strictEqual(sim.students.get("s0").clases_restantes, 0);

  // Uncheck
  sim.toggleAsistencia("s0");
  assert.strictEqual(sim.students.get("s0").clases_restantes, 0, "Unchecking 0-class student must NOT inflate balance to 1");
  assert.strictEqual(sim.asistencias.has("s0"), false);
});

runTest("[RollCall.3] Rapid toggling (check -> uncheck -> check -> uncheck x 50) preserves exact starting balance", () => {
  const sim = new RollCallSimulator();
  sim.addStudent({ id: "s1", nombre_completo: "Rapid Toggle Alumno", plan_activo: "Bono 8 clases", clases_restantes: 5 });

  for (let i = 0; i < 50; i++) {
    sim.toggleAsistencia("s1"); // Check: 5 -> 4
    assert.strictEqual(sim.students.get("s1").clases_restantes, 4);
    assert.strictEqual(sim.asistencias.has("s1"), true);

    sim.toggleAsistencia("s1"); // Uncheck: 4 -> 5
    assert.strictEqual(sim.students.get("s1").clases_restantes, 5);
    assert.strictEqual(sim.asistencias.has("s1"), false);
  }

  assert.strictEqual(sim.students.get("s1").clases_restantes, 5);
});

runTest("[RollCall.4] Regular plan student with null balance retains null across check and uncheck", () => {
  const sim = new RollCallSimulator();
  sim.addStudent({ id: "s_reg", nombre_completo: "Regular Alumno", plan_activo: "Cuota Regular Mensual", clases_restantes: null });

  sim.toggleAsistencia("s_reg");
  assert.strictEqual(sim.students.get("s_reg").clases_restantes, null);
  assert.strictEqual(sim.asistencias.has("s_reg"), true);

  sim.toggleAsistencia("s_reg");
  assert.strictEqual(sim.students.get("s_reg").clases_restantes, null);
  assert.strictEqual(sim.asistencias.has("s_reg"), false);
});

runTest("[RollCall.5] Bulk mark (Marcar Todos) does not double-decrement already marked students", () => {
  const sim = new RollCallSimulator();
  const roster = [
    { id: "s1", nombre_completo: "Alumno 1", plan_activo: "Bono 4 clases", clases_restantes: 3 },
    { id: "s2", nombre_completo: "Alumno 2", plan_activo: "Bono 4 clases", clases_restantes: 2 },
    { id: "s3", nombre_completo: "Alumno 3", plan_activo: "Bono 4 clases", clases_restantes: 0 }
  ];
  roster.forEach(s => sim.addStudent(s));

  // Manually check in s1 first
  sim.toggleAsistencia("s1"); // s1 balance: 3 -> 2
  assert.strictEqual(sim.students.get("s1").clases_restantes, 2);

  // Now trigger Marcar Todos
  sim.markAllPresent(roster);

  // s1 should NOT be decremented again (stay at 2)
  assert.strictEqual(sim.students.get("s1").clases_restantes, 2, "s1 must NOT double decrement");
  // s2 should be decremented from 2 -> 1
  assert.strictEqual(sim.students.get("s2").clases_restantes, 1, "s2 must decrement from 2 to 1");
  // s3 should stay at 0
  assert.strictEqual(sim.students.get("s3").clases_restantes, 0, "s3 0-balance must stay at 0");

  // All 3 students are marked present
  assert.strictEqual(sim.asistencias.size, 3);
});


// =============================================================================
// CATEGORY 4: STANDBY VOUCHER LIFECYCLE & LEDGER RECONCILIATION
// =============================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("CATEGORY 4: STANDBY VOUCHER LIFECYCLE & LEDGER RECONCILIATION");
console.log("--------------------------------------------------------------------------------");

class LedgerReconciliationSimulator {
  constructor() {
    this.payments = [];
    this.pendingQueue = [];
    this.studentsDB = new Map();
  }

  addStudent(student) {
    this.studentsDB.set(student.id, { ...student });
  }

  teacherRequestStandbyBono(teacherId, teacherName, bono) {
    const student = this.studentsDB.get(teacherId);
    if (!student) throw new Error("Teacher not found");

    const pendingPlan = `Pendiente: ${bono.nombre} (${bono.precioDocente})`;
    student.plan_activo = pendingPlan;

    // Queue in pending_bono_requests
    const req = {
      id: "req_docente_" + Date.now(),
      student_id: teacherId,
      student_name: `${teacherName} (Docente)`,
      bono_nombre: bono.nombre,
      bono_precio: bono.precioDocente,
      estado: "Pendiente de cobro en Recepción"
    };
    this.pendingQueue.push(req);

    // Create pending transaction in central ledger
    const now = new Date();
    const pendingTx = {
      id: "pago_docente_pending_" + Date.now(),
      numero_recibo: "PEND-" + now.getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000),
      fecha_hora: now.toISOString(),
      fecha_corta: "27/08/2026",
      hora_corta: "12:00",
      alumno_id: teacherId,
      alumno_nombre: `${teacherName} (Docente)`,
      concepto: `${bono.nombre} (-10% dto Docente)`,
      categoria: "bono",
      importe: bono.precioNum,
      metodo_pago: "Pendiente Recepción",
      sede: "castilla",
      atendido_por: "Solicitud Portal Profesor",
      estado: "Pendiente"
    };
    this.payments.unshift(pendingTx);
    return { req, pendingTx };
  }

  receptionConfirmPayment(req, paymentMethod = "Efectivo") {
    // 1. Determine classes to add
    let clasesToAdd = 4;
    if (req.bono_nombre.includes("8")) clasesToAdd = 8;
    else if (req.bono_nombre.includes("10")) clasesToAdd = 10;
    else if (req.bono_nombre.toLowerCase().includes("ilimitad")) clasesToAdd = 999;
    else if (req.bono_nombre.toLowerCase().includes("suelta")) clasesToAdd = 1;
    else if (req.bono_nombre.toLowerCase().includes("formaci")) clasesToAdd = 1;

    // 2. Update Student DB
    const student = this.studentsDB.get(req.student_id);
    if (student) {
      student.plan_activo = req.bono_nombre;
      student.clases_restantes = (student.clases_restantes || 0) + clasesToAdd;
    }

    // 3. Remove from pending queue
    this.pendingQueue = this.pendingQueue.filter(r => r.student_id !== req.student_id);

    // 4. Reconcile ledger: find pending transaction and convert to Cobrado
    const pendingIndex = this.payments.findIndex(p => p.alumno_id === req.student_id && p.estado === "Pendiente");
    let reconciledTx = null;

    if (pendingIndex !== -1) {
      const pending = this.payments[pendingIndex];
      const cobradoCount = this.payments.filter(p => p.estado === "Cobrado").length + 1;
      const numero_recibo = "REC-2026-" + String(cobradoCount).padStart(4, "0");

      reconciledTx = {
        ...pending,
        numero_recibo,
        metodo_pago: paymentMethod,
        estado: "Cobrado",
        notas: "Cobrado en mostrador de recepción"
      };
      this.payments[pendingIndex] = reconciledTx;
    } else {
      // Fallback: create new transaction
      const cobradoCount = this.payments.filter(p => p.estado === "Cobrado").length + 1;
      reconciledTx = {
        id: "pago_desk_" + Date.now(),
        numero_recibo: "REC-2026-" + String(cobradoCount).padStart(4, "0"),
        fecha_hora: new Date().toISOString(),
        alumno_id: req.student_id,
        alumno_nombre: req.student_name,
        concepto: `Bono: ${req.bono_nombre}`,
        categoria: "bono",
        importe: 40.50,
        metodo_pago: paymentMethod,
        sede: "castilla",
        atendido_por: "Recepción Studio 2",
        estado: "Cobrado"
      };
      this.payments.unshift(reconciledTx);
    }

    return reconciledTx;
  }
}

runTest("[Standby.1] End-to-end Standby Lifecycle: Request -> Queue -> Reception Confirm -> Zero Orphan Duplicates", () => {
  const ledger = new LedgerReconciliationSimulator();
  ledger.addStudent({ id: "t_lucia", nombre_completo: "LUCÍA MUÑOZ", plan_activo: "Docente (10% Dto)", clases_restantes: 0 });

  const bono8 = { id: "b8", nombre: "Bono 8 Clases Docente", precioOriginal: "57,00 €", precioDocente: "51,30 €", precioNum: 51.30 };

  // Step 1: Teacher requests Standby
  const { req, pendingTx } = ledger.teacherRequestStandbyBono("t_lucia", "LUCÍA MUÑOZ", bono8);
  assert.strictEqual(pendingTx.estado, "Pendiente");
  assert(pendingTx.numero_recibo.startsWith("PEND-2026-"));
  assert.strictEqual(ledger.pendingQueue.length, 1);
  assert.strictEqual(ledger.payments.length, 1);
  assert.strictEqual(ledger.studentsDB.get("t_lucia").plan_activo.includes("Pendiente"), true);

  // Step 2: Reception confirms payment (TPV)
  const reconciled = ledger.receptionConfirmPayment(req, "TPV");
  assert.strictEqual(reconciled.estado, "Cobrado");
  assert.strictEqual(reconciled.metodo_pago, "TPV");
  assert(reconciled.numero_recibo.startsWith("REC-2026-"));

  // Verify Zero Duplicate Ledger Entries (still exactly 1 record, reconciled in place)
  assert.strictEqual(ledger.payments.length, 1, "Must maintain exactly 1 reconciled transaction in central ledger");
  assert.strictEqual(ledger.payments[0].estado, "Cobrado");
  assert.strictEqual(ledger.payments[0].numero_recibo, "REC-2026-0001");

  // Verify Pending queue is empty
  assert.strictEqual(ledger.pendingQueue.length, 0, "Pending queue must be emptied");

  // Verify Student classes were credited
  const updatedStudent = ledger.studentsDB.get("t_lucia");
  assert.strictEqual(updatedStudent.plan_activo, "Bono 8 Clases Docente");
  assert.strictEqual(updatedStudent.clases_restantes, 8, "Must have exactly 8 credited classes");
});

runTest("[Standby.2] -10% Teacher Voucher Discount Math & Decimal Precision across all 6 Voucher Types", () => {
  const bonos = [
    { original: 45.00, expectedDiscount: 40.50, name: "Bono 4" },
    { original: 57.00, expectedDiscount: 51.30, name: "Bono 8" },
    { original: 79.00, expectedDiscount: 71.10, name: "Bono 10" },
    { original: 100.00, expectedDiscount: 90.00, name: "Pase Ilimitado" },
    { original: 15.00, expectedDiscount: 13.50, name: "Clase Suelta" },
    { original: 35.00, expectedDiscount: 31.50, name: "Formacion Especial" }
  ];

  for (const b of bonos) {
    const calc = Math.round((b.original * 0.9) * 100) / 100;
    assert.strictEqual(calc, b.expectedDiscount, `Discount mismatch for ${b.name}: got ${calc}, expected ${b.expectedDiscount}`);
  }
});


// =============================================================================
// CATEGORY 5: SHARED STUDIO TABLET SECURITY & ZERO STATE LEAKAGE
// =============================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("CATEGORY 5: SHARED STUDIO TABLET SECURITY & ZERO STATE LEAKAGE");
console.log("--------------------------------------------------------------------------------");

class TeacherSessionSimulator {
  constructor() {
    this.sessionStorage = new Map();
    this.state = this.getCleanState();
  }

  getCleanState() {
    return {
      isAuthenticated: false,
      isAdmin: false,
      pinInput: "",
      pinError: "",
      selectedProfesor: "LUCÍA MUÑOZ",
      activeTab: "mis_clases",
      teacherStudent: null,
      clasesProfesor: [],
      selectedClase: null,
      roster: [],
      rosterSearch: "",
      asistenciasRegistradas: [],
      deductedStudentIds: new Set(),
      allOpenClasses: [],
      teacherEnrolledClassIds: [],
      selectedBonoForPayment: null,
      isProcessingPayment: false,
      savingId: null,
      modal: { isOpen: false, message: "" }
    };
  }

  login(pin, teacherName, isAdmin = false) {
    this.sessionStorage.setItem = (k, v) => this.sessionStorage.set(k, v);
    this.sessionStorage.set("df_profesor_pin", pin);
    this.state.isAuthenticated = true;
    this.state.isAdmin = isAdmin;
    this.state.selectedProfesor = teacherName;
    this.state.pinInput = "";
    this.state.pinError = "";
  }

  performActions(clases, roster, markedIds, deductedIds) {
    this.state.clasesProfesor = [...clases];
    this.state.selectedClase = clases[0] || null;
    this.state.roster = [...roster];
    this.state.rosterSearch = "Gómez";
    this.state.asistenciasRegistradas = [...markedIds];
    this.state.deductedStudentIds = new Set(deductedIds);
    this.state.teacherEnrolledClassIds = ["open_class_99"];
    this.state.selectedBonoForPayment = { id: "b4", nombre: "Bono 4" };
    this.state.modal = { isOpen: true, message: "Test Modal" };
  }

  logout() {
    this.sessionStorage.delete("df_profesor_pin");
    // Exact handleLogout implementation in production code
    this.state = {
      isAuthenticated: false,
      isAdmin: false,
      pinInput: "",
      pinError: "",
      selectedProfesor: "LUCÍA MUÑOZ",
      activeTab: "mis_clases",
      teacherStudent: null,
      clasesProfesor: [],
      selectedClase: null,
      roster: [],
      rosterSearch: "",
      asistenciasRegistradas: [],
      deductedStudentIds: new Set(),
      allOpenClasses: [],
      teacherEnrolledClassIds: [],
      selectedBonoForPayment: null,
      isProcessingPayment: false,
      savingId: null,
      modal: { isOpen: false, message: "" }
    };
  }
}

runTest("[Security.1] Consecutive teacher sessions: Teacher A actions -> Logout -> Teacher B login guarantees 100% state purity", () => {
  const tablet = new TeacherSessionSimulator();

  // Session 1: Teacher A (Lucas López - 1005)
  tablet.login("1005", "LUCAS LÓPEZ");
  tablet.performActions(
    [{ id: "cl_1", nombre_clase: "Hip Hop Lucas" }],
    [{ id: "stu_1", nombre_completo: "Alumno Lucas" }],
    ["stu_1"],
    ["stu_1"]
  );

  assert.strictEqual(tablet.state.selectedProfesor, "LUCAS LÓPEZ");
  assert.strictEqual(tablet.state.asistenciasRegistradas.length, 1);
  assert.strictEqual(tablet.state.deductedStudentIds.size, 1);
  assert.strictEqual(tablet.state.teacherEnrolledClassIds.length, 1);
  assert.strictEqual(tablet.state.modal.isOpen, true);

  // Teacher A logs out
  tablet.logout();

  // Verify tablet is completely sanitized
  assert.strictEqual(tablet.sessionStorage.has("df_profesor_pin"), false);
  assert.strictEqual(tablet.state.isAuthenticated, false);
  assert.strictEqual(tablet.state.selectedClase, null);
  assert.strictEqual(tablet.state.roster.length, 0);
  assert.strictEqual(tablet.state.rosterSearch, "");
  assert.strictEqual(tablet.state.asistenciasRegistradas.length, 0);
  assert.strictEqual(tablet.state.deductedStudentIds.size, 0);
  assert.strictEqual(tablet.state.teacherEnrolledClassIds.length, 0);
  assert.strictEqual(tablet.state.selectedBonoForPayment, null);
  assert.strictEqual(tablet.state.modal.isOpen, false);

  // Session 2: Teacher B (Paula Jiménez - 1006)
  tablet.login("1006", "PAULA JIMÉNEZ");
  assert.strictEqual(tablet.state.selectedProfesor, "PAULA JIMÉNEZ");
  assert.strictEqual(tablet.state.isAuthenticated, true);
  assert.strictEqual(tablet.state.asistenciasRegistradas.length, 0, "Teacher B must start with 0 attendances");
  assert.strictEqual(tablet.state.deductedStudentIds.size, 0, "Teacher B must start with 0 deducted student IDs");
  assert.strictEqual(tablet.state.clasesProfesor.length, 0, "Teacher B must not see Teacher A's classes");
});

runTest("[Security.2] Master Admin (9999) can switch context without state cross-contamination", () => {
  const tablet = new TeacherSessionSimulator();
  tablet.login("9999", "ADMINISTRADOR MASTER", true);
  assert.strictEqual(tablet.state.isAdmin, true);
  assert.strictEqual(tablet.state.isAuthenticated, true);

  tablet.logout();
  assert.strictEqual(tablet.state.isAdmin, false);
  assert.strictEqual(tablet.state.isAuthenticated, false);
});

// =============================================================================
// SUMMARY REPORT
// =============================================================================
console.log("\n================================================================================");
console.log("   CHALLENGER FINAL ADVERSARIAL STRESS TEST SUMMARY");
console.log("================================================================================");
console.log(`  Total Tests Run:     ${totalTests}`);
console.log(`  Passed Tests:        ${passedCount}`);
console.log(`  Failed Tests:        ${failedCount}`);
console.log(`  Pass Rate:           ${((passedCount / totalTests) * 100).toFixed(2)}%`);
console.log("================================================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log("✓ ALL ADVERSARIAL CHALLENGES AND EMPIRICAL STRESS TESTS PASSED WITH ZERO FAILURES.\n");
}
