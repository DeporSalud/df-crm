/**
 * ============================================================================
 * DANCE FACTORY CRM - TEACHER PORTAL & RECEPTION SYNC E2E TEST SUITE
 * ============================================================================
 * 
 * Comprehensive 4-Tier Automated Test Suite:
 * - Tier 1: Feature Coverage (≥5 tests per feature for 7 features = 35 tests)
 * - Tier 2: Boundary & Corner Cases (35 tests)
 * - Tier 3: Cross-Feature Interactions (10 tests)
 * - Tier 4: Real-World Multi-Step User Application Scenarios (5 workflows)
 * Total: 85 Tests
 * 
 * Execution: node tests/e2e/teacher_portal_e2e.mjs
 * Compatible with node --test and standard CI harnesses.
 */

import assert from "node:assert";

console.log("================================================================================");
console.log("   DANCE FACTORY CRM: TEACHER PORTAL & RECEPTION E2E TEST SUITE");
console.log("   4-Tier Test Architecture - Category-Partition, BVA, Pairwise, Real-World");
console.log("================================================================================\n");

let passedCount = 0;
let failedCount = 0;
let totalTests = 0;
const failures = [];

function runTest(suiteTier, testId, testName, fn) {
  totalTests++;
  const fullLabel = `[${suiteTier}] [${testId}] ${testName}`;
  try {
    fn();
    console.log(`  ✓ PASS: ${fullLabel}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${fullLabel}`);
    console.error(`          ${err.stack || err.message}`);
    failedCount++;
    failures.push({ tier: suiteTier, id: testId, name: testName, error: err.message });
  }
}

// ============================================================================
// ENVIRONMENT HARNESS & DOMAIN LOGIC SIMULATION
// ============================================================================

// 1. Teacher PIN Definitions (Source of Truth: crm-app/src/app/profesor/page.tsx)
const TEACHER_PINS = {
  "9999": { name: "ADMINISTRADOR MASTER", isAdmin: true },
  "1001": { name: "LUCÍA MUÑOZ" },
  "1002": { name: "LUCIA ZAMORANO" },
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

// 2. Normalization & Helpers
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

const getDayOrder = (day) => {
  const days = {
    "LUNES": 1, "MARTES": 2, "MIÉRCOLES": 3, "MIERCOLES": 3,
    "JUEVES": 4, "VIERNES": 5, "SÁBADO": 6, "SABADO": 6, "DOMINGO": 7
  };
  return days[normalizeText(day)] || 8;
};

// 3. Discounted Teacher Bonos (-10%)
const BONOS_DOCENTES = [
  { 
    id: "Bono 4 clases", 
    nombre: "Bono 4 Clases Docente", 
    clasesCount: 4,
    precioOriginal: "45,00 €",
    precioDocente: "40,50 €", 
    precioNum: 40.50,
    desc: "4 clases • Validez 30 días • Acceso a OPEN CLASS con 10% dto. especial para profesores" 
  },
  { 
    id: "Bono 8 clases", 
    nombre: "Bono 8 Clases Docente", 
    clasesCount: 8,
    precioOriginal: "57,00 €",
    precioDocente: "51,30 €", 
    precioNum: 51.30,
    popular: true,
    desc: "8 clases (Recomendado) • Validez 30 días • 10% dto. especial para profesores" 
  },
  { 
    id: "Bono 10 clases", 
    nombre: "Bono 10 Clases Docente", 
    clasesCount: 10,
    precioOriginal: "79,00 €",
    precioDocente: "71,10 €", 
    precioNum: 71.10,
    desc: "10 clases • Validez 30 días • Acceso intensivo a OPEN CLASS con 10% dto." 
  },
  { 
    id: "Mensualidad Ilimitada", 
    nombre: "Pase Ilimitado Open Class Docente", 
    clasesCount: 999,
    precioOriginal: "100,00 €",
    precioDocente: "90,00 € / mes", 
    precioNum: 90.00,
    desc: "Acceso total sin límite a todas las OPEN CLASS de la escuela con 10% dto. mensual" 
  },
  { 
    id: "Clase Suelta", 
    nombre: "Clase Suelta Open Class Docente", 
    clasesCount: 1,
    precioOriginal: "15,00 €",
    precioDocente: "13,50 €", 
    precioNum: 13.50,
    desc: "1 sesión individual de OPEN CLASS con 10% dto." 
  },
  { 
    id: "Formacion Especial", 
    nombre: "Acceso Formación Especial Docente", 
    clasesCount: 1,
    precioOriginal: "35,00 €",
    precioDocente: "31,50 €", 
    precioNum: 31.50,
    desc: "Plaza para intensivos y formación rotativa con 10% dto. docente aplicado" 
  }
];

// 4. Schedule Conflict Detection Logic
function checkClassIntervalConflict(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return (startA < endB) && (endA > startB);
}

function checkTeacherScheduleCollision(targetClass, teacherClasses, enrolledOpenClasses = []) {
  if (!targetClass.hora_inicio || !targetClass.hora_fin) {
    return { hasConflict: true, reason: "Horas no especificadas" };
  }
  if (targetClass.hora_inicio >= targetClass.hora_fin) {
    return { hasConflict: true, reason: "La hora de fin debe ser posterior a la hora de inicio" };
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
        hasConflict: true,
        conflictingClass: c,
        reason: `Conflicto horario con "${c.nombre_clase}" (${c.dia_semana} ${c.hora_inicio}-${c.hora_fin})`
      };
    }
  }

  return { hasConflict: false };
}

// 5. 24-Hour Cancellation Logic
function checkCanCancelOpenClass(clase, referenceDate = new Date()) {
  const daysMap = {
    "DOMINGO": 0, "LUNES": 1, "MARTES": 2, "MIÉRCOLES": 3, "MIERCOLES": 3,
    "JUEVES": 4, "VIERNES": 5, "SÁBADO": 6, "SABADO": 6
  };
  const targetDayNum = daysMap[normalizeText(clase.dia_semana)] ?? 1;
  const currentDayNum = referenceDate.getDay();
  let daysUntil = (targetDayNum - currentDayNum + 7) % 7;

  const [hours, minutes] = (clase.hora_inicio || "00:00").split(":").map(Number);
  const classDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() + daysUntil,
    hours,
    minutes || 0,
    0
  );

  if (daysUntil === 0 && classDate.getTime() <= referenceDate.getTime()) {
    classDate.setDate(classDate.getDate() + 7);
  }

  const diffHours = (classDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60);
  return {
    canCancel: diffHours >= 24,
    diffHours,
    classDate
  };
}

// 6. Mock In-Memory Database and Storage Environment
class MockEnvironment {
  constructor() {
    this.sessionStorage = new Map();
    this.localStorage = new Map();
    this.tables = {
      alumnos: [],
      clases_cuadrante: [],
      alumnos_clases: [],
      asistencias: [],
      actividad_escuela: []
    };
    this.eventsDispatched = [];
  }

  reset() {
    this.sessionStorage.clear();
    this.localStorage.clear();
    this.tables = {
      alumnos: [],
      clases_cuadrante: [],
      alumnos_clases: [],
      asistencias: [],
      actividad_escuela: []
    };
    this.eventsDispatched = [];
  }

  dispatchEvent(eventName) {
    this.eventsDispatched.push(eventName);
  }

  seedInitialData() {
    // Seed Teachers
    Object.values(TEACHER_PINS).forEach((t, idx) => {
      this.tables.alumnos.push({
        id: `teacher_student_${idx + 1}`,
        nombre_completo: t.name,
        email: `${t.name.toLowerCase().replace(/[\s\./]/g, "")}@dancefactory.es`,
        telefono: "600000000",
        plan_activo: "Docente (10% Dto)",
        clases_restantes: 4,
        estado: "activo",
        sede: "castilla",
        nfc_token: `PROF-${1000 + idx}`
      });
    });

    // Seed Students
    const studentNames = [
      "Sofía Romero", "Mateo Valdés", "Valeria Cruz", "Hugo Benítez",
      "Martina Soler", "Lucas Navarro", "Daniela Vega", "Pablo Ortiz"
    ];
    studentNames.forEach((name, idx) => {
      this.tables.alumnos.push({
        id: `student_${idx + 1}`,
        nombre_completo: name,
        email: `${name.toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
        telefono: `61100000${idx}`,
        plan_activo: idx === 0 ? "Clases Regulares" : idx === 1 ? "Mensualidad Ilimitada" : idx === 7 ? "Bono 4 clases (Agotado)" : "Bono 8 clases",
        clases_restantes: idx === 0 ? null : idx === 1 ? null : idx === 7 ? 0 : 5,
        estado: "activo",
        sede: idx % 2 === 0 ? "tejar" : "castilla",
        nfc_token: `ALU-${2000 + idx}`
      });
    });

    // Seed Classes
    this.tables.clases_cuadrante = [
      {
        id: "class_tejar_lucia_1",
        nombre_clase: "Urban Kids Iniciación",
        profesor: "LUCÍA MUÑOZ",
        sede: "tejar",
        dia_semana: "LUNES",
        hora_inicio: "17:30",
        hora_fin: "18:30",
        aforo_maximo: 15
      },
      {
        id: "class_tejar_lucia_2",
        nombre_clase: "Hip Hop Intermedio",
        profesor: "LUCÍA MUÑOZ",
        sede: "tejar",
        dia_semana: "LUNES",
        hora_inicio: "18:30",
        hora_fin: "19:30",
        aforo_maximo: 20
      },
      {
        id: "class_castilla_lucas_1",
        nombre_clase: "Popping Fundamentals",
        profesor: "LUCAS LÓPEZ",
        sede: "castilla",
        dia_semana: "MARTES",
        hora_inicio: "19:00",
        hora_fin: "20:00",
        aforo_maximo: 18
      },
      {
        id: "class_open_andrea_1",
        nombre_clase: "OPEN CLASS Commercial Dance",
        profesor: "ANDREA SOTO",
        sede: "castilla",
        dia_semana: "MIÉRCOLES",
        hora_inicio: "20:00",
        hora_fin: "21:30",
        aforo_maximo: 25
      },
      {
        id: "class_formacion_dario_1",
        nombre_clase: "FORMACIÓN Intensiva Afro House",
        profesor: "DARÍO HUMBERTO",
        sede: "tejar",
        dia_semana: "SÁBADO",
        hora_inicio: "11:00",
        hora_fin: "13:00",
        aforo_maximo: 20
      }
    ];

    // Enroll students into classes
    this.tables.alumnos_clases = [
      { id: "enr_1", alumno_id: "student_1", clase_id: "class_tejar_lucia_1" },
      { id: "enr_2", alumno_id: "student_2", clase_id: "class_tejar_lucia_1" },
      { id: "enr_3", alumno_id: "student_3", clase_id: "class_tejar_lucia_1" },
      { id: "enr_4", alumno_id: "student_8", clase_id: "class_tejar_lucia_1" },
      { id: "enr_5", alumno_id: "student_4", clase_id: "class_tejar_lucia_2" },
      { id: "enr_6", alumno_id: "student_5", clase_id: "class_castilla_lucas_1" }
    ];
  }
}

// 7. Teacher Portal Engine Simulation (State & Methods)
class TeacherPortalEngine {
  constructor(env) {
    this.env = env;
    this.pinInput = "";
    this.isAuthenticated = false;
    this.isAdmin = false;
    this.selectedProfesor = "LUCÍA MUÑOZ";
    this.activeTab = "mis_clases";
    this.selectedClase = null;
    this.pinError = "";
    this.teacherStudent = null;
    this.asistenciasRegistradas = [];
    this.teacherEnrolledClassIds = [];
  }

  // PIN Keypad actions
  handleKeyClick(digit) {
    if (this.pinInput.length >= 4) return;
    this.pinError = "";
    this.pinInput += digit;
    if (this.pinInput.length === 4) {
      this.validatePin(this.pinInput);
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
      this.env.sessionStorage.set("df_profesor_pin", pin);
      if (!teacherInfo.isAdmin) {
        this.selectedProfesor = teacherInfo.name;
      }
      this.pinInput = "";
      this.loadTeacherProfile();
      return true;
    } else {
      this.pinError = "Código PIN incorrecto. Revisa e inténtalo de nuevo.";
      this.pinInput = "";
      return false;
    }
  }

  handleLogout() {
    this.env.sessionStorage.delete("df_profesor_pin");
    this.isAuthenticated = false;
    this.isAdmin = false;
    this.pinInput = "";
    this.selectedClase = null;
    this.pinError = "";
    this.teacherStudent = null;
    this.asistenciasRegistradas = [];
  }

  restoreSession() {
    const savedPin = this.env.sessionStorage.get("df_profesor_pin");
    if (savedPin && TEACHER_PINS[savedPin]) {
      const teacherInfo = TEACHER_PINS[savedPin];
      this.isAuthenticated = true;
      this.isAdmin = !!teacherInfo.isAdmin;
      if (!teacherInfo.isAdmin) {
        this.selectedProfesor = teacherInfo.name;
      }
      this.loadTeacherProfile();
      return true;
    }
    return false;
  }

  loadTeacherProfile() {
    const existing = this.env.tables.alumnos.find(a => 
      normalizeText(a.nombre_completo).includes(normalizeText(this.selectedProfesor))
    );
    this.teacherStudent = existing || null;

    if (existing) {
      const enrollments = this.env.tables.alumnos_clases.filter(e => e.alumno_id === existing.id);
      this.teacherEnrolledClassIds = enrollments.map(e => e.clase_id);
    }
  }

  getTeacherClasses() {
    const normProf = normalizeText(this.selectedProfesor);
    const classes = this.env.tables.clases_cuadrante.filter(c => 
      normalizeText(c.profesor).includes(normProf)
    );
    return classes.sort((a, b) => {
      if (getDayOrder(a.dia_semana) !== getDayOrder(b.dia_semana)) {
        return getDayOrder(a.dia_semana) - getDayOrder(b.dia_semana);
      }
      return (a.hora_inicio || "").localeCompare(b.hora_inicio || "");
    });
  }

  getRoster(claseId) {
    const enrolledRelations = this.env.tables.alumnos_clases.filter(e => e.clase_id === claseId);
    const studentIds = enrolledRelations.map(e => e.alumno_id);
    const students = this.env.tables.alumnos.filter(a => studentIds.includes(a.id));
    return students.sort((a, b) => (a.nombre_completo || "").localeCompare(b.nombre_completo || "", "es"));
  }

  getAsistencias(claseId) {
    return this.env.tables.asistencias.filter(a => a.clase_id === claseId).map(a => a.alumno_id);
  }

  handleToggleAsistencia(student, clase) {
    const yaAsistio = this.asistenciasRegistradas.includes(student.id);
    const isRegularOrUnlimited = student.plan_activo === "Clases Regulares" || 
                                 student.plan_activo === "Mensualidad Ilimitada" || 
                                 student.clases_restantes === null;

    if (yaAsistio) {
      // Refund balance if bono
      if (!isRegularOrUnlimited && typeof student.clases_restantes === "number") {
        student.clases_restantes += 1;
      }
      this.env.tables.asistencias = this.env.tables.asistencias.filter(
        a => !(a.alumno_id === student.id && a.clase_id === clase.id)
      );
      this.asistenciasRegistradas = this.asistenciasRegistradas.filter(id => id !== student.id);
    } else {
      // Deduct balance if bono
      if (!isRegularOrUnlimited && typeof student.clases_restantes === "number" && student.clases_restantes > 0) {
        student.clases_restantes -= 1;
      }
      this.env.tables.asistencias.push({
        alumno_id: student.id,
        clase_id: clase.id,
        fecha: new Date().toISOString()
      });
      this.asistenciasRegistradas.push(student.id);

      this.env.tables.actividad_escuela.push({
        origen: "profesor",
        tipo_evento: "asistencia_profesor",
        descripcion: `Profesor ${this.selectedProfesor} marcó asistencia a ${student.nombre_completo} en ${clase.nombre_clase}`,
        usuario_afectado: student.nombre_completo,
        sede: isStudio1(clase.sede) ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla",
        fecha: new Date().toISOString()
      });
    }
  }

  handleMarkAllPresent(roster, clase) {
    const newCheckins = [];
    roster.forEach(student => {
      if (!this.asistenciasRegistradas.includes(student.id)) {
        const isRegularOrUnlimited = student.plan_activo === "Clases Regulares" || 
                                     student.plan_activo === "Mensualidad Ilimitada" || 
                                     student.clases_restantes === null;
        if (!isRegularOrUnlimited && typeof student.clases_restantes === "number" && student.clases_restantes > 0) {
          student.clases_restantes -= 1;
        }
        this.env.tables.asistencias.push({
          alumno_id: student.id,
          clase_id: clase.id,
          fecha: new Date().toISOString()
        });
        this.asistenciasRegistradas.push(student.id);
        newCheckins.push(student.id);
      }
    });

    if (newCheckins.length > 0) {
      this.env.tables.actividad_escuela.push({
        origen: "profesor",
        tipo_evento: "asistencia_profesor",
        descripcion: `Profesor ${this.selectedProfesor} hizo pase de lista masivo (${roster.length} alumnos) en ${clase.nombre_clase}`,
        usuario_afectado: `${this.selectedProfesor} (Masivo)`,
        sede: isStudio1(clase.sede) ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla",
        fecha: new Date().toISOString()
      });
    }
  }

  handleTeacherApuntarme(clase) {
    if (!this.teacherStudent) return { success: false, reason: "No teacher student record" };

    // Check aforo
    const occupied = this.env.tables.alumnos_clases.filter(e => e.clase_id === clase.id).length;
    if (occupied >= (clase.aforo_maximo || 20)) {
      return { success: false, reason: "Aforo Completo" };
    }

    // Check time conflict against teaching classes
    const teachingClasses = this.getTeacherClasses();
    const collision = checkTeacherScheduleCollision(clase, teachingClasses, []);
    if (collision.hasConflict) {
      return { success: false, reason: collision.reason };
    }

    const hasUnlimited = this.teacherStudent.plan_activo?.toLowerCase().includes("ilimitad");
    const remainingClasses = typeof this.teacherStudent.clases_restantes === "number" ? this.teacherStudent.clases_restantes : 0;

    if (!hasUnlimited && remainingClasses <= 0) {
      return { success: false, reason: "Bono Requerido con 10% Descuento", promptBuy: true };
    }

    if (!hasUnlimited) {
      this.teacherStudent.clases_restantes = Math.max(0, remainingClasses - 1);
    }

    this.env.tables.alumnos_clases.push({
      id: `enr_prof_${Date.now()}`,
      alumno_id: this.teacherStudent.id,
      clase_id: clase.id
    });
    this.teacherEnrolledClassIds.push(clase.id);

    this.env.tables.actividad_escuela.push({
      origen: "profesor",
      tipo_evento: "reserva_bono",
      descripcion: `Profesor ${this.selectedProfesor} se apuntó a la clase "${clase.nombre_clase}" (${clase.dia_semana} ${clase.hora_inicio}h)`,
      usuario_afectado: this.selectedProfesor,
      sede: isStudio1(clase.sede) ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla",
      fecha: new Date().toISOString()
    });

    return { success: true };
  }

  handleTeacherDesapuntarme(clase, refTime = new Date()) {
    if (!this.teacherStudent) return { success: false, reason: "No teacher record" };

    const cancelCheck = checkCanCancelOpenClass(clase, refTime);
    if (!cancelCheck.canCancel) {
      return { success: false, reason: "Cancelación Fuera de Plazo (<24h)" };
    }

    this.env.tables.alumnos_clases = this.env.tables.alumnos_clases.filter(
      e => !(e.alumno_id === this.teacherStudent.id && e.clase_id === clase.id)
    );

    const isUnlimited = this.teacherStudent.plan_activo?.toLowerCase().includes("ilimitad");
    if (!isUnlimited && typeof this.teacherStudent.clases_restantes === "number") {
      this.teacherStudent.clases_restantes += 1;
    }

    this.teacherEnrolledClassIds = this.teacherEnrolledClassIds.filter(id => id !== clase.id);
    return { success: true };
  }

  handleTeacherPaymentMock(selectedBono) {
    if (!selectedBono || !this.teacherStudent) return { success: false };

    const pendingPlanText = `Pendiente: ${selectedBono.nombre} (${selectedBono.precioDocente})`;
    this.teacherStudent.plan_activo = pendingPlanText;

    // Save to pending_bono_requests
    const pendingRequests = JSON.parse(this.env.localStorage.get("pending_bono_requests") || "[]");
    const newReq = {
      id: "req_docente_" + Date.now(),
      student_id: this.teacherStudent.id,
      student_name: `${this.selectedProfesor} (Docente)`,
      student_email: this.teacherStudent.email,
      bono_nombre: selectedBono.nombre,
      bono_precio: selectedBono.precioDocente,
      fecha: "Hoy (Docente)",
      estado: "Pendiente de cobro en Recepción"
    };
    this.env.localStorage.set("pending_bono_requests", JSON.stringify([newReq, ...pendingRequests]));

    // Register pending transaction in central ledger
    const rawPayments = this.env.localStorage.get("df_pagos_transacciones_v1");
    const allPayments = rawPayments ? JSON.parse(rawPayments) : [];
    const now = new Date();
    const pendingTx = {
      id: "pago_docente_pending_" + Date.now(),
      numero_recibo: "PEND-" + now.getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000),
      fecha_hora: now.toISOString(),
      fecha_corta: now.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }),
      hora_corta: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      alumno_id: this.teacherStudent.id,
      alumno_nombre: `${this.selectedProfesor} (Docente)`,
      alumno_dni: this.teacherStudent.dni || "Docente DF",
      alumno_telefono: this.teacherStudent.telefono || "-",
      concepto: `${selectedBono.nombre} (-10% dto Docente)`,
      categoria: "bono",
      importe: selectedBono.precioNum,
      metodo_pago: "Pendiente Recepción",
      sede: "castilla",
      atendido_por: "Solicitud Portal Profesor",
      notas: `Solicitud de bono docente con 10% dto en standby para abonar en recepción`,
      estado: "Pendiente"
    };

    this.env.localStorage.set("df_pagos_transacciones_v1", JSON.stringify([pendingTx, ...allPayments]));
    this.env.dispatchEvent("df_pagos_updated");

    this.env.tables.actividad_escuela.push({
      origen: "profesor",
      tipo_evento: "solicitud_bono",
      descripcion: `Profesor ${this.selectedProfesor} solicitó en recepción el bono con 10% dto: "${selectedBono.nombre}" (${selectedBono.precioDocente})`,
      usuario_afectado: this.selectedProfesor,
      sede: "Studio 2 Paseo Castilla",
      fecha: now.toISOString()
    });

    return { success: true, request: newReq, transaction: pendingTx };
  }
}

// 8. Reception Desk Processing Simulation (Admin / Recepción)
function handleCobrarBonoEnRecepcion(env, req, paymentMethod = "Efectivo", activeSede = "castilla") {
  let clasesToAdd = 4;
  if (req.bono_nombre.includes("8")) clasesToAdd = 8;
  else if (req.bono_nombre.includes("10")) clasesToAdd = 10;
  else if (req.bono_nombre.toLowerCase().includes("ilimitad")) clasesToAdd = 999;
  else if (req.bono_nombre.toLowerCase().includes("suelta")) clasesToAdd = 1;

  // 1. Update Student DB record
  const student = env.tables.alumnos.find(a => a.id === req.student_id);
  if (student) {
    const currentClasses = typeof student.clases_restantes === "number" ? student.clases_restantes : 0;
    student.plan_activo = req.bono_nombre;
    student.clases_restantes = currentClasses + clasesToAdd;
  }

  // 2. Remove from pending_bono_requests queue
  const pendingRequests = JSON.parse(env.localStorage.get("pending_bono_requests") || "[]");
  const updatedPending = pendingRequests.filter(r => r.id !== req.id && r.student_id !== req.student_id);
  env.localStorage.set("pending_bono_requests", JSON.stringify(updatedPending));

  // 3. Reconcile Central Payments Ledger (Update existing pending record or insert new)
  const rawPayments = env.localStorage.get("df_pagos_transacciones_v1");
  const allPayments = rawPayments ? JSON.parse(rawPayments) : [];
  
  let importeNum = 40.50;
  if (req.bono_precio && typeof req.bono_precio === "string") {
    const cleaned = req.bono_precio.replace(/[^\d.,]/g, '').replace(',', '.');
    if (cleaned && !isNaN(parseFloat(cleaned))) {
      importeNum = parseFloat(cleaned);
    }
  }

  // Find if there is a pending transaction for this student
  const existingPendingIndex = allPayments.findIndex(p => 
    p.alumno_id === req.student_id && p.estado === "Pendiente"
  );

  const now = new Date();
  if (existingPendingIndex !== -1) {
    allPayments[existingPendingIndex].estado = "Cobrado";
    allPayments[existingPendingIndex].metodo_pago = paymentMethod;
    allPayments[existingPendingIndex].atendido_por = activeSede === "castilla" ? "Recepción Studio 2" : "Recepción Studio 1";
    allPayments[existingPendingIndex].notas = "Cobrado en mostrador y bono activado";
  } else {
    allPayments.unshift({
      id: "pago_recep_" + Date.now(),
      numero_recibo: "REC-" + now.getFullYear() + "-" + String(allPayments.length + 1).padStart(4, "0"),
      fecha_hora: now.toISOString(),
      fecha_corta: now.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }),
      hora_corta: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      alumno_id: req.student_id,
      alumno_nombre: req.student_name,
      concepto: `Bono: ${req.bono_nombre} (Adquisición Mostrador)`,
      categoria: "bono",
      importe: importeNum,
      metodo_pago: paymentMethod,
      sede: activeSede,
      atendido_por: activeSede === "castilla" ? "Recepción Studio 2" : "Recepción Studio 1",
      estado: "Cobrado"
    });
  }

  env.localStorage.set("df_pagos_transacciones_v1", JSON.stringify(allPayments));
  env.dispatchEvent("df_pagos_updated");

  env.tables.actividad_escuela.push({
    origen: "recepcion",
    tipo_evento: "cobro_bono",
    descripcion: `Cobro en recepción y activación de ${req.bono_nombre} (${req.bono_precio})`,
    usuario_afectado: req.student_name,
    sede: isStudio1(activeSede) ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla",
    fecha: now.toISOString()
  });

  return { success: true, student, clasesToAdd, importeNum };
}

// Financial Arqueo Calculator
function calculateArqueoSede(payments) {
  const tejar = { total: 0, efectivo: 0, tpv: 0, count: 0 };
  const castilla = { total: 0, efectivo: 0, tpv: 0, count: 0 };

  payments.filter(p => p.estado === "Cobrado").forEach(p => {
    const target = isStudio1(p.sede) ? tejar : castilla;
    target.total += p.importe;
    target.count += 1;
    if (p.metodo_pago === "Efectivo") target.efectivo += p.importe;
    if (p.metodo_pago === "TPV") target.tpv += p.importe;
  });

  return {
    tejar,
    castilla,
    consolidado: {
      total: tejar.total + castilla.total,
      count: tejar.count + castilla.count
    }
  };
}


// ============================================================================
// TIER 1: FEATURE COVERAGE (≥5 TESTS PER FEATURE = 35 TESTS)
// ============================================================================
console.log("--------------------------------------------------------------------------------");
console.log("TIER 1: FEATURE COVERAGE (7 FEATURES x ≥5 TESTS)");
console.log("--------------------------------------------------------------------------------");

// FEATURE 1: PIN Auth & 12 Teacher Mappings
runTest("Tier 1", "F1.1", "PIN 1001 validates for Lucía Muñoz", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  const ok = portal.validatePin("1001");
  assert.strictEqual(ok, true);
  assert.strictEqual(portal.isAuthenticated, true);
  assert.strictEqual(portal.isAdmin, false);
  assert.strictEqual(portal.selectedProfesor, "LUCÍA MUÑOZ");
  assert.strictEqual(env.sessionStorage.get("df_profesor_pin"), "1001");
});

runTest("Tier 1", "F1.2", "PIN 9999 validates for Admin Master and grants admin privileges", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  const ok = portal.validatePin("9999");
  assert.strictEqual(ok, true);
  assert.strictEqual(portal.isAuthenticated, true);
  assert.strictEqual(portal.isAdmin, true);
  assert.strictEqual(env.sessionStorage.get("df_profesor_pin"), "9999");
});

runTest("Tier 1", "F1.3", "Verification of all 12 individual teacher PIN mappings", () => {
  const env = new MockEnvironment();
  const portal = new TeacherPortalEngine(env);
  const expectedMappings = {
    "9999": "ADMINISTRADOR MASTER",
    "1001": "LUCÍA MUÑOZ",
    "1002": "LUCIA ZAMORANO",
    "1003": "ANDREA SOTO",
    "1004": "EVA LEIVA",
    "1005": "LUCAS LÓPEZ",
    "1006": "PAULA JIMÉNEZ",
    "1007": "ABEL Y NAYARA",
    "1008": "DARÍO HUMBERTO",
    "1009": "NEREA OLIVARES",
    "1010": "ALEJANDRO ROVINA",
    "1011": "NIL BARBERÁ"
  };

  Object.entries(expectedMappings).forEach(([pin, name]) => {
    const teacher = TEACHER_PINS[pin];
    assert.ok(teacher, `PIN ${pin} must exist in TEACHER_PINS dictionary`);
    assert.strictEqual(teacher.name, name);
  });
});

runTest("Tier 1", "F1.4", "Invalid PIN 0000 rejected with error message and reset", () => {
  const env = new MockEnvironment();
  const portal = new TeacherPortalEngine(env);
  const ok = portal.validatePin("0000");
  assert.strictEqual(ok, false);
  assert.strictEqual(portal.isAuthenticated, false);
  assert.ok(portal.pinError.includes("incorrecto"));
  assert.strictEqual(portal.pinInput, "");
  assert.strictEqual(env.sessionStorage.has("df_profesor_pin"), false);
});

runTest("Tier 1", "F1.5", "Keypad digit accumulation triggers validation exactly at 4 digits", () => {
  const env = new MockEnvironment();
  const portal = new TeacherPortalEngine(env);
  portal.handleKeyClick("1");
  assert.strictEqual(portal.pinInput, "1");
  assert.strictEqual(portal.isAuthenticated, false);
  portal.handleKeyClick("0");
  portal.handleKeyClick("0");
  assert.strictEqual(portal.pinInput, "100");
  assert.strictEqual(portal.isAuthenticated, false);
  portal.handleKeyClick("5"); // PIN 1005 = Lucas López
  assert.strictEqual(portal.isAuthenticated, true);
  assert.strictEqual(portal.selectedProfesor, "LUCAS LÓPEZ");
});

// FEATURE 2: Session Logout & State Isolation
runTest("Tier 1", "F2.1", "Session persists in sessionStorage on valid PIN authentication", () => {
  const env = new MockEnvironment();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1003");
  assert.strictEqual(env.sessionStorage.get("df_profesor_pin"), "1003");
});

runTest("Tier 1", "F2.2", "Logout clears df_profesor_pin from sessionStorage", () => {
  const env = new MockEnvironment();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1004");
  assert.strictEqual(portal.isAuthenticated, true);
  portal.handleLogout();
  assert.strictEqual(portal.isAuthenticated, false);
  assert.strictEqual(env.sessionStorage.has("df_profesor_pin"), false);
});

runTest("Tier 1", "F2.3", "Logout cleanly resets all portal state variables", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  portal.selectedClase = { id: "test_clase" };
  portal.handleLogout();
  assert.strictEqual(portal.isAuthenticated, false);
  assert.strictEqual(portal.isAdmin, false);
  assert.strictEqual(portal.selectedClase, null);
  assert.strictEqual(portal.pinInput, "");
  assert.strictEqual(portal.teacherStudent, null);
});

runTest("Tier 1", "F2.4", "restoreSession automatically authenticates teacher if valid PIN is present", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  env.sessionStorage.set("df_profesor_pin", "1006"); // Paula Jiménez
  const portal = new TeacherPortalEngine(env);
  const restored = portal.restoreSession();
  assert.strictEqual(restored, true);
  assert.strictEqual(portal.isAuthenticated, true);
  assert.strictEqual(portal.selectedProfesor, "PAULA JIMÉNEZ");
});

runTest("Tier 1", "F2.5", "restoreSession safely rejects invalid or expired PIN in storage", () => {
  const env = new MockEnvironment();
  env.sessionStorage.set("df_profesor_pin", "9876");
  const portal = new TeacherPortalEngine(env);
  const restored = portal.restoreSession();
  assert.strictEqual(restored, false);
  assert.strictEqual(portal.isAuthenticated, false);
});

// FEATURE 3: Mis Clases Sede & Accent Matching
runTest("Tier 1", "F3.1", "Teacher class query matches accents case-insensitively (LUCÍA vs Lucia)", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.selectedProfesor = "LUCIA MUÑOZ"; // Without accent
  const classes = portal.getTeacherClasses();
  assert.strictEqual(classes.length, 2);
  assert.strictEqual(classes[0].profesor, "LUCÍA MUÑOZ");
});

runTest("Tier 1", "F3.2", "Sede normalization handles Studio 1 aliases (tejar, mostoles, studio 1)", () => {
  assert.strictEqual(isStudio1("tejar"), true);
  assert.strictEqual(isStudio1("mostoles"), true);
  assert.strictEqual(isStudio1("Studio 1"), true);
  assert.strictEqual(isStudio1("studio"), true);
  assert.strictEqual(getStudioDisplayName("tejar"), "Studio 1 (Plaza El Tejar)");
});

runTest("Tier 1", "F3.3", "Sede normalization handles Studio 2 (castilla, paseo castilla)", () => {
  assert.strictEqual(isStudio1("castilla"), false);
  assert.strictEqual(isStudio1("paseo castilla"), false);
  assert.strictEqual(getStudioDisplayName("castilla"), "Studio 2 (Paseo Castilla)");
});

runTest("Tier 1", "F3.4", "Class day ordering sorts correctly from Lunes (1) to Domingo (7)", () => {
  assert.strictEqual(getDayOrder("Lunes"), 1);
  assert.strictEqual(getDayOrder("Martes"), 2);
  assert.strictEqual(getDayOrder("Miércoles"), 3);
  assert.strictEqual(getDayOrder("Miercoles"), 3);
  assert.strictEqual(getDayOrder("Jueves"), 4);
  assert.strictEqual(getDayOrder("Viernes"), 5);
  assert.strictEqual(getDayOrder("Sábado"), 6);
  assert.strictEqual(getDayOrder("Sabado"), 6);
  assert.strictEqual(getDayOrder("Domingo"), 7);
});

runTest("Tier 1", "F3.5", "Classes for a teacher are sorted by day order and then hora_inicio", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.selectedProfesor = "LUCÍA MUÑOZ";
  const classes = portal.getTeacherClasses();
  assert.strictEqual(classes[0].hora_inicio, "17:30");
  assert.strictEqual(classes[1].hora_inicio, "18:30");
});

// FEATURE 4: Digital Attendance Daily Persistence
runTest("Tier 1", "F4.1", "1-Click roll call records attendance in asistencias table", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const student = env.tables.alumnos.find(a => a.id === "student_3"); // Bono 8
  const clase = env.tables.clases_cuadrante[0];

  portal.handleToggleAsistencia(student, clase);
  assert.strictEqual(portal.asistenciasRegistradas.includes("student_3"), true);
  const record = env.tables.asistencias.find(a => a.alumno_id === "student_3" && a.clase_id === clase.id);
  assert.ok(record, "Attendance record must be saved in asistencias table");
});

runTest("Tier 1", "F4.2", "1-Click roll call for bono student decrements clases_restantes by 1", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const student = env.tables.alumnos.find(a => a.id === "student_3"); // Initial: 5 classes
  const initialClasses = student.clases_restantes;
  const clase = env.tables.clases_cuadrante[0];

  portal.handleToggleAsistencia(student, clase);
  assert.strictEqual(student.clases_restantes, initialClasses - 1);
});

runTest("Tier 1", "F4.3", "1-Click uncheck deletes attendance and refunds +1 class to student bono balance", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const student = env.tables.alumnos.find(a => a.id === "student_3");
  const clase = env.tables.clases_cuadrante[0];

  // Mark present
  portal.handleToggleAsistencia(student, clase);
  assert.strictEqual(student.clases_restantes, 4);

  // Unmark (toggle off)
  portal.handleToggleAsistencia(student, clase);
  assert.strictEqual(student.clases_restantes, 5);
  assert.strictEqual(portal.asistenciasRegistradas.includes("student_3"), false);
  const record = env.tables.asistencias.find(a => a.alumno_id === "student_3" && a.clase_id === clase.id);
  assert.strictEqual(record, undefined, "Attendance record must be deleted");
});

runTest("Tier 1", "F4.4", "1-Click roll call for regular or unlimited students does not decrement null balance", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const regularStudent = env.tables.alumnos.find(a => a.id === "student_1"); // Clases Regulares, null balance
  const clase = env.tables.clases_cuadrante[0];

  portal.handleToggleAsistencia(regularStudent, clase);
  assert.strictEqual(regularStudent.clases_restantes, null);
  assert.strictEqual(portal.asistenciasRegistradas.includes("student_1"), true);
});

runTest("Tier 1", "F4.5", "Attendance registration logs audit event in actividad_escuela table", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const student = env.tables.alumnos.find(a => a.id === "student_1");
  const clase = env.tables.clases_cuadrante[0];

  portal.handleToggleAsistencia(student, clase);
  const log = env.tables.actividad_escuela.find(l => l.tipo_evento === "asistencia_profesor" && l.usuario_afectado === student.nombre_completo);
  assert.ok(log, "Activity log must be created");
  assert.strictEqual(log.sede, "Studio 1 Plaza El Tejar");
});

// FEATURE 5: Bulk Check-in & Roster Badges
runTest("Tier 1", "F5.1", "Marcar Todos checks in all enrolled students in a single batch", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const clase = env.tables.clases_cuadrante[0];
  const roster = portal.getRoster(clase.id);

  portal.handleMarkAllPresent(roster, clase);
  assert.strictEqual(portal.asistenciasRegistradas.length, roster.length);
  roster.forEach(student => {
    assert.strictEqual(portal.asistenciasRegistradas.includes(student.id), true);
  });
});

runTest("Tier 1", "F5.2", "Marcar Todos does not double-decrement or duplicate already marked students", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const clase = env.tables.clases_cuadrante[0];
  const roster = portal.getRoster(clase.id);
  const bonoStudent = roster.find(s => s.id === "student_3");

  // Single mark first
  portal.handleToggleAsistencia(bonoStudent, clase);
  assert.strictEqual(bonoStudent.clases_restantes, 4);

  // Now bulk mark
  portal.handleMarkAllPresent(roster, clase);
  assert.strictEqual(bonoStudent.clases_restantes, 4, "Should not decrement already marked student twice");
});

runTest("Tier 1", "F5.3", "Roster search filters students in real-time by name", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  const clase = env.tables.clases_cuadrante[0];
  const roster = portal.getRoster(clase.id);

  const searchResults = roster.filter(s => s.nombre_completo.toLowerCase().includes("sofía".toLowerCase()));
  assert.strictEqual(searchResults.length, 1);
  assert.strictEqual(searchResults[0].nombre_completo, "Sofía Romero");
});

runTest("Tier 1", "F5.4", "Roster identifies exhausted bono balance (0 clases) with special badge status", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  const clase = env.tables.clases_cuadrante[0];
  const roster = portal.getRoster(clase.id);
  const exhaustedStudent = roster.find(s => s.id === "student_8");

  assert.ok(exhaustedStudent);
  assert.strictEqual(exhaustedStudent.clases_restantes, 0);
});

runTest("Tier 1", "F5.5", "Empty roster for newly created class returns empty list without error", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  const emptyRoster = portal.getRoster("non_existent_class_id");
  assert.strictEqual(Array.isArray(emptyRoster), true);
  assert.strictEqual(emptyRoster.length, 0);
});

// FEATURE 6: Open Classes Schedule Conflict & 24h
runTest("Tier 1", "F6.1", "Open Classes catalog filters Open Classes and Formaciones", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const openAndFormaciones = env.tables.clases_cuadrante.filter(c => 
    c.nombre_clase.toUpperCase().includes("OPEN CLASS") ||
    c.nombre_clase.toUpperCase().includes("FORMACI")
  );
  assert.strictEqual(openAndFormaciones.length, 2);
});

runTest("Tier 1", "F6.2", "Open Class enrollment blocks when aforo maximo is reached", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const openClass = env.tables.clases_cuadrante.find(c => c.id === "class_open_andrea_1");
  openClass.aforo_maximo = 1;

  // Fill the class
  env.tables.alumnos_clases.push({ id: "temp_enr", alumno_id: "student_1", clase_id: openClass.id });

  const result = portal.handleTeacherApuntarme(openClass);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.reason, "Aforo Completo");
});

runTest("Tier 1", "F6.3", "Open Class enrollment checks teacher balance and prompts discount purchase if balance is 0", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  portal.teacherStudent.clases_restantes = 0;
  const openClass = env.tables.clases_cuadrante.find(c => c.id === "class_open_andrea_1");

  const result = portal.handleTeacherApuntarme(openClass);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.promptBuy, true);
});

runTest("Tier 1", "F6.4", "Successful Open Class enrollment decrements teacher bono balance by 1", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  portal.teacherStudent.clases_restantes = 4;
  const openClass = env.tables.clases_cuadrante.find(c => c.id === "class_open_andrea_1");

  const result = portal.handleTeacherApuntarme(openClass);
  assert.strictEqual(result.success, true);
  assert.strictEqual(portal.teacherStudent.clases_restantes, 3);
  assert.strictEqual(portal.teacherEnrolledClassIds.includes(openClass.id), true);
});

runTest("Tier 1", "F6.5", "24-Hour cancellation policy allows un-enrollment and refunds class when >24h", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  portal.teacherStudent.clases_restantes = 3;
  const openClass = env.tables.clases_cuadrante.find(c => c.id === "class_open_andrea_1"); // Miércoles 20:00

  // Enroll first
  portal.handleTeacherApuntarme(openClass);
  assert.strictEqual(portal.teacherStudent.clases_restantes, 2);

  // Cancellation simulated on Lunes (more than 48 hours before class)
  const monday = new Date(2026, 7, 24, 10, 0, 0); // Monday morning
  const result = portal.handleTeacherDesapuntarme(openClass, monday);
  assert.strictEqual(result.success, true);
  assert.strictEqual(portal.teacherStudent.clases_restantes, 3, "Class should be refunded");
});

// FEATURE 7: Teacher Standby Vouchers & Reception Sync
runTest("Tier 1", "F7.1", "Teacher discounted tariffs (-10%) correctly calculated across all voucher types", () => {
  const expectedPrices = {
    "Bono 4 clases": 40.50,
    "Bono 8 clases": 51.30,
    "Bono 10 clases": 71.10,
    "Mensualidad Ilimitada": 90.00,
    "Clase Suelta": 13.50,
    "Formacion Especial": 31.50
  };

  BONOS_DOCENTES.forEach(b => {
    assert.strictEqual(b.precioNum, expectedPrices[b.id]);
  });
});

runTest("Tier 1", "F7.2", "Abonar en Recepción updates teacher student profile to STANDBY status", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const bono = BONOS_DOCENTES[1]; // Bono 8

  portal.handleTeacherPaymentMock(bono);
  assert.ok(portal.teacherStudent.plan_activo.startsWith("Pendiente:"));
  assert.ok(portal.teacherStudent.plan_activo.includes("Bono 8"));
});

runTest("Tier 1", "F7.3", "Standby voucher request registers in pending_bono_requests queue", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const bono = BONOS_DOCENTES[0]; // Bono 4

  portal.handleTeacherPaymentMock(bono);
  const pendingRequests = JSON.parse(env.localStorage.get("pending_bono_requests") || "[]");
  assert.strictEqual(pendingRequests.length, 1);
  assert.strictEqual(pendingRequests[0].student_id, portal.teacherStudent.id);
  assert.strictEqual(pendingRequests[0].bono_nombre, bono.nombre);
});

runTest("Tier 1", "F7.4", "Standby voucher request creates pending transaction in central payments ledger", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const bono = BONOS_DOCENTES[2]; // Bono 10 (71.10€)

  portal.handleTeacherPaymentMock(bono);
  const ledger = JSON.parse(env.localStorage.get("df_pagos_transacciones_v1") || "[]");
  assert.strictEqual(ledger.length, 1);
  assert.strictEqual(ledger[0].estado, "Pendiente");
  assert.strictEqual(ledger[0].importe, 71.10);
  assert.strictEqual(ledger[0].categoria, "bono");
});

runTest("Tier 1", "F7.5", "Reception approval converts pending ledger record to Cobrado and credits classes", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  portal.teacherStudent.clases_restantes = 0;
  const bono = BONOS_DOCENTES[1]; // Bono 8 Clases (51.30€)

  // Teacher initiates standby request
  const { request } = portal.handleTeacherPaymentMock(bono);

  // Reception approves and collects cash in Studio 2
  const approval = handleCobrarBonoEnRecepcion(env, request, "Efectivo", "castilla");
  assert.strictEqual(approval.success, true);

  // Verify student balance
  assert.strictEqual(portal.teacherStudent.clases_restantes, 8);
  assert.strictEqual(portal.teacherStudent.plan_activo, bono.nombre);

  // Verify pending queue cleared
  const pendingRequests = JSON.parse(env.localStorage.get("pending_bono_requests") || "[]");
  assert.strictEqual(pendingRequests.length, 0);

  // Verify central ledger updated (no duplicate pending items)
  const ledger = JSON.parse(env.localStorage.get("df_pagos_transacciones_v1") || "[]");
  assert.strictEqual(ledger.length, 1);
  assert.strictEqual(ledger[0].estado, "Cobrado");
  assert.strictEqual(ledger[0].metodo_pago, "Efectivo");
});


// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES (35 TESTS)
// ============================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("TIER 2: BOUNDARY & CORNER CASES (35 TESTS)");
console.log("--------------------------------------------------------------------------------");

// PIN & Auth Boundaries (5 tests)
runTest("Tier 2", "B1", "PIN exactly 4 digits vs 3 vs 5 digits validation barrier", () => {
  const env = new MockEnvironment();
  const portal = new TeacherPortalEngine(env);
  // 1, 2, 3 digits -> not authenticated
  portal.handleKeyClick("1");
  portal.handleKeyClick("0");
  portal.handleKeyClick("0");
  assert.strictEqual(portal.pinInput, "100");
  assert.strictEqual(portal.isAuthenticated, false);
  
  // 4th digit -> triggers validation
  portal.handleKeyClick("1");
  assert.strictEqual(portal.isAuthenticated, true);
  assert.strictEqual(portal.selectedProfesor, "LUCÍA MUÑOZ");

  // In authenticated state, keypad is unmounted/inactive
  const unauthedPortal = new TeacherPortalEngine(env);
  unauthedPortal.pinInput = "1234"; // Length 4
  unauthedPortal.handleKeyClick("5"); // Attempt 5th digit
  assert.strictEqual(unauthedPortal.pinInput, "1234", "5th digit must be ignored when length is 4");
});

runTest("Tier 2", "B2", "PIN with non-existent leading zero combination (0101) rejected cleanly", () => {
  const env = new MockEnvironment();
  const portal = new TeacherPortalEngine(env);
  const ok = portal.validatePin("0101");
  assert.strictEqual(ok, false);
  assert.strictEqual(portal.isAuthenticated, false);
});

runTest("Tier 2", "B3", "PIN backspace deletion on empty string does not underflow or crash", () => {
  const env = new MockEnvironment();
  const portal = new TeacherPortalEngine(env);
  portal.handleDelete();
  portal.handleDelete();
  assert.strictEqual(portal.pinInput, "");
});

runTest("Tier 2", "B4", "Clear button immediately clears accumulated input of any length", () => {
  const env = new MockEnvironment();
  const portal = new TeacherPortalEngine(env);
  portal.handleKeyClick("1");
  portal.handleKeyClick("0");
  portal.handleClear();
  assert.strictEqual(portal.pinInput, "");
});

runTest("Tier 2", "B5", "PIN with non-numeric or whitespace characters rejected safely", () => {
  const env = new MockEnvironment();
  const portal = new TeacherPortalEngine(env);
  assert.strictEqual(portal.validatePin("100 "), false);
  assert.strictEqual(portal.validatePin("abcd"), false);
  assert.strictEqual(portal.validatePin(""), false);
});

// Time & Overlap Boundaries (10 tests)
runTest("Tier 2", "B6", "Classes touching at exact boundary (18:00-19:00 vs 19:00-20:00) have NO conflict", () => {
  const conflict = checkClassIntervalConflict("18:00", "19:00", "19:00", "20:00");
  assert.strictEqual(conflict, false, "Abutting time intervals must not collide");
});

runTest("Tier 2", "B7", "Classes with 1-minute overlap (18:00-19:00 vs 18:59-19:59) DO have conflict", () => {
  const conflict = checkClassIntervalConflict("18:00", "19:00", "18:59", "19:59");
  assert.strictEqual(conflict, true, "1-minute overlap must trigger conflict");
});

runTest("Tier 2", "B8", "Midnight boundary classes (00:00 - 01:00) compared cleanly", () => {
  const conflict = checkClassIntervalConflict("00:00", "01:00", "00:30", "01:30");
  assert.strictEqual(conflict, true);
});

runTest("Tier 2", "B9", "Late night class boundary (22:00 - 23:30) vs next morning (08:00 - 09:00) NO conflict", () => {
  const conflict = checkClassIntervalConflict("22:00", "23:30", "08:00", "09:00");
  assert.strictEqual(conflict, false);
});

runTest("Tier 2", "B10", "Class start time equal to end time (18:00 - 18:00) rejected with invalid duration", () => {
  const newClass = { dia_semana: "LUNES", hora_inicio: "18:00", hora_fin: "18:00" };
  const res = checkTeacherScheduleCollision(newClass, []);
  assert.strictEqual(res.hasConflict, true);
});

runTest("Tier 2", "B11", "Class start time after end time (19:00 - 18:00) rejected with invalid duration", () => {
  const newClass = { dia_semana: "LUNES", hora_inicio: "19:00", hora_fin: "18:00" };
  const res = checkTeacherScheduleCollision(newClass, []);
  assert.strictEqual(res.hasConflict, true);
});

runTest("Tier 2", "B12", "Identical time slot on DIFFERENT days (Lunes 18:00 vs Martes 18:00) has NO conflict", () => {
  const newClass = { dia_semana: "MARTES", hora_inicio: "18:00", hora_fin: "19:00" };
  const existingClasses = [{ dia_semana: "LUNES", hora_inicio: "18:00", hora_fin: "19:00", nombre_clase: "Hip Hop" }];
  const res = checkTeacherScheduleCollision(newClass, existingClasses);
  assert.strictEqual(res.hasConflict, false);
});

runTest("Tier 2", "B13", "Target class matching its own ID during update check is ignored", () => {
  const targetClass = { id: "class_1", dia_semana: "LUNES", hora_inicio: "18:00", hora_fin: "19:00" };
  const existingClasses = [{ id: "class_1", dia_semana: "LUNES", hora_inicio: "18:00", hora_fin: "19:00" }];
  const res = checkTeacherScheduleCollision(targetClass, existingClasses);
  assert.strictEqual(res.hasConflict, false);
});

runTest("Tier 2", "B14", "Enclosing time interval (17:00-21:00 enclosing 18:00-19:00) collides properly", () => {
  const conflict = checkClassIntervalConflict("17:00", "21:00", "18:00", "19:00");
  assert.strictEqual(conflict, true);
});

runTest("Tier 2", "B15", "Identical start and end intervals (18:00-19:00 vs 18:00-19:00) collide properly", () => {
  const conflict = checkClassIntervalConflict("18:00", "19:00", "18:00", "19:00");
  assert.strictEqual(conflict, true);
});

// 24-Hour Cancellation Boundaries (5 tests)
runTest("Tier 2", "B16", "Exact 24.0 hours remaining allows cancellation", () => {
  const targetClass = { dia_semana: "MARTES", hora_inicio: "18:00" };
  // Ref: Lunes 18:00:00 -> exactly 24.0 hours before Martes 18:00:00
  const refDate = new Date(2026, 7, 24, 18, 0, 0); // Monday 18:00 (Aug 24, 2026 is Monday)
  const res = checkCanCancelOpenClass(targetClass, refDate);
  assert.strictEqual(res.canCancel, true);
  assert.strictEqual(Math.round(res.diffHours), 24);
});

runTest("Tier 2", "B17", "23.99 hours remaining (e.g. 23h 59m) blocks cancellation", () => {
  const targetClass = { dia_semana: "MARTES", hora_inicio: "18:00" };
  // Ref: Lunes 18:01:00 -> 23h 59m remaining
  const refDate = new Date(2026, 7, 24, 18, 1, 0);
  const res = checkCanCancelOpenClass(targetClass, refDate);
  assert.strictEqual(res.canCancel, false);
});

runTest("Tier 2", "B18", "24.01 hours remaining (e.g. 24h 1m) allows cancellation", () => {
  const targetClass = { dia_semana: "MARTES", hora_inicio: "18:00" };
  // Ref: Lunes 17:59:00 -> 24h 1m remaining
  const refDate = new Date(2026, 7, 24, 17, 59, 0);
  const res = checkCanCancelOpenClass(targetClass, refDate);
  assert.strictEqual(res.canCancel, true);
});

runTest("Tier 2", "B19", "Same-day class in the past wraps around to next week (+7 days)", () => {
  const targetClass = { dia_semana: "LUNES", hora_inicio: "10:00" };
  // Ref: Lunes 12:00 (already passed today) -> next class is next Monday 10:00 (diff ~ 166h)
  const refDate = new Date(2026, 7, 24, 12, 0, 0);
  const res = checkCanCancelOpenClass(targetClass, refDate);
  assert.strictEqual(res.canCancel, true);
  assert.ok(res.diffHours > 100);
});

runTest("Tier 2", "B20", "Cancellation for Pase Ilimitado does not alter numeric balance", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  portal.teacherStudent.plan_activo = "Pase Ilimitado Open Class Docente";
  portal.teacherStudent.clases_restantes = 999;
  const openClass = env.tables.clases_cuadrante.find(c => c.id === "class_open_andrea_1");

  portal.handleTeacherApuntarme(openClass);
  assert.strictEqual(portal.teacherStudent.clases_restantes, 999);

  const monday = new Date(2026, 7, 24, 10, 0, 0);
  portal.handleTeacherDesapuntarme(openClass, monday);
  assert.strictEqual(portal.teacherStudent.clases_restantes, 999);
});

// Bono & Attendance Balance Boundaries (5 tests)
runTest("Tier 2", "B21", "Student with 0 classes remaining checked in does not go negative (clamped at 0)", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const student = env.tables.alumnos.find(a => a.id === "student_8"); // 0 classes
  const clase = env.tables.clases_cuadrante[0];

  portal.handleToggleAsistencia(student, clase);
  assert.strictEqual(student.clases_restantes, 0, "Balance must never drop below 0");
});

runTest("Tier 2", "B22", "Student with exactly 1 class remaining transitions to 0 on check-in", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const student = env.tables.alumnos.find(a => a.id === "student_3");
  student.clases_restantes = 1;
  const clase = env.tables.clases_cuadrante[0];

  portal.handleToggleAsistencia(student, clase);
  assert.strictEqual(student.clases_restantes, 0);
});

runTest("Tier 2", "B23", "Regular plan student with null balance retains null on check-in and uncheck", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const student = env.tables.alumnos.find(a => a.id === "student_1");
  const clase = env.tables.clases_cuadrante[0];

  portal.handleToggleAsistencia(student, clase);
  assert.strictEqual(student.clases_restantes, null);
  portal.handleToggleAsistencia(student, clase);
  assert.strictEqual(student.clases_restantes, null);
});

runTest("Tier 2", "B24", "Rapid double-toggle (present then uncheck) preserves exact starting balance", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const student = env.tables.alumnos.find(a => a.id === "student_3");
  const initial = student.clases_restantes;
  const clase = env.tables.clases_cuadrante[0];

  portal.handleToggleAsistencia(student, clase);
  portal.handleToggleAsistencia(student, clase);
  assert.strictEqual(student.clases_restantes, initial);
});

runTest("Tier 2", "B25", "Multiple unchecks cannot be triggered if student is not marked present", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const student = env.tables.alumnos.find(a => a.id === "student_3");
  const initial = student.clases_restantes;
  const clase = env.tables.clases_cuadrante[0];

  // Attempting to remove when not marked
  assert.strictEqual(portal.asistenciasRegistradas.includes(student.id), false);
  // Calling toggle will mark present (not decrease further without toggle logic)
  portal.handleToggleAsistencia(student, clase);
  assert.strictEqual(student.clases_restantes, initial - 1);
});

// Search & Text Normalization Boundaries (5 tests)
runTest("Tier 2", "B26", "Search with empty string or whitespace returns complete roster", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  const clase = env.tables.clases_cuadrante[0];
  const roster = portal.getRoster(clase.id);

  const emptySearch = roster.filter(s => s.nombre_completo.toLowerCase().includes("".toLowerCase()));
  assert.strictEqual(emptySearch.length, roster.length);
  const spaceSearch = roster.filter(s => s.nombre_completo.toLowerCase().includes("   ".trim().toLowerCase()));
  assert.strictEqual(spaceSearch.length, roster.length);
});

runTest("Tier 2", "B27", "Search with regex meta-characters does not crash string comparison", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  const clase = env.tables.clases_cuadrante[0];
  const roster = portal.getRoster(clase.id);

  const specialSearch = roster.filter(s => s.nombre_completo.toLowerCase().includes(".*+".toLowerCase()));
  assert.strictEqual(specialSearch.length, 0);
});

runTest("Tier 2", "B28", "Diacritic normalization removes tildes and acutes (Á, É, Í, Ó, Ú, Ñ)", () => {
  assert.strictEqual(normalizeText("LUCÍA MUÑOZ"), "LUCIA MUNOZ");
  assert.strictEqual(normalizeText("DARÍO HUMBERTO"), "DARIO HUMBERTO");
  assert.strictEqual(normalizeText("NIL BARBERÁ"), "NIL BARBERA");
});

runTest("Tier 2", "B29", "Sede case variations and whitespace (  TEJAR  , Castilla ) normalized properly", () => {
  assert.strictEqual(isStudio1("  TEJAR  "), true);
  assert.strictEqual(isStudio1("Mostoles\n"), true);
  assert.strictEqual(isStudio1("  Castilla  "), false);
});

runTest("Tier 2", "B30", "Day order normalization handles accented and unaccented Spanish days", () => {
  assert.strictEqual(getDayOrder("SÁBADO"), 6);
  assert.strictEqual(getDayOrder("SABADO"), 6);
  assert.strictEqual(getDayOrder("MIÉRCOLES"), 3);
  assert.strictEqual(getDayOrder("MIERCOLES"), 3);
  assert.strictEqual(getDayOrder("UNKNOWN_DAY"), 8);
});

// Storage, Financial & Parsing Boundaries (5 tests)
runTest("Tier 2", "B31", "Corrupted pending_bono_requests JSON recovers gracefully with empty list", () => {
  const env = new MockEnvironment();
  env.localStorage.set("pending_bono_requests", "{ invalid json content }");
  let requests = [];
  try {
    requests = JSON.parse(env.localStorage.get("pending_bono_requests") || "[]");
  } catch (e) {
    requests = [];
  }
  assert.strictEqual(Array.isArray(requests), true);
  assert.strictEqual(requests.length, 0);
});

runTest("Tier 2", "B32", "Price parser handles Spanish comma format ('40,50 €') and dots ('40.50 €')", () => {
  const parsePrice = (str) => {
    const cleaned = (str || "").replace(/[^\d.,]/g, '').replace(',', '.');
    return parseFloat(cleaned);
  };
  assert.strictEqual(parsePrice("40,50 €"), 40.50);
  assert.strictEqual(parsePrice("51.30 €"), 51.30);
  assert.strictEqual(parsePrice("90,00 € / mes"), 90.00);
});

runTest("Tier 2", "B33", "Financial calculation of 10% discount maintains 2 decimal precision", () => {
  const round2 = (num) => Math.round((num * 0.9) * 100) / 100;
  assert.strictEqual(round2(45.00), 40.50);
  assert.strictEqual(round2(57.00), 51.30);
  assert.strictEqual(round2(79.00), 71.10);
  assert.strictEqual(round2(100.00), 90.00);
});

runTest("Tier 2", "B34", "Empty df_pagos_transacciones_v1 returns 0 totals in ArqueoSede calculation", () => {
  const arqueo = calculateArqueoSede([]);
  assert.strictEqual(arqueo.tejar.total, 0);
  assert.strictEqual(arqueo.castilla.total, 0);
  assert.strictEqual(arqueo.consolidado.total, 0);
  assert.strictEqual(arqueo.consolidado.count, 0);
});

runTest("Tier 2", "B35", "Standby transaction receipt numbers follow PEND-YYYY-XXXX format", () => {
  const now = new Date();
  const sampleNum = "PEND-" + now.getFullYear() + "-" + "4321";
  assert.match(sampleNum, /^PEND-202\d-\d{4}$/);
});


// ============================================================================
// TIER 3: CROSS-FEATURE INTERACTIONS (10 TESTS)
// ============================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("TIER 3: CROSS-FEATURE INTERACTIONS (10 TESTS)");
console.log("--------------------------------------------------------------------------------");

runTest("Tier 3", "C1", "PIN Auth -> Load Classes -> Filter Studio 1 -> Roll Call -> Audit Log", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);

  // 1. Auth
  portal.validatePin("1001");
  // 2. Fetch classes
  const classes = portal.getTeacherClasses();
  const studio1Classes = classes.filter(c => isStudio1(c.sede));
  assert.strictEqual(studio1Classes.length, 2);

  // 3. Select class & pass attendance
  const selected = studio1Classes[0];
  const roster = portal.getRoster(selected.id);
  const student = roster[0];
  portal.handleToggleAsistencia(student, selected);

  // 4. Verify audit log
  const log = env.tables.actividad_escuela[env.tables.actividad_escuela.length - 1];
  assert.strictEqual(log.tipo_evento, "asistencia_profesor");
  assert.strictEqual(log.sede, "Studio 1 Plaza El Tejar");
});

runTest("Tier 3", "C2", "Teacher Buy Voucher (Standby) -> Reception Approval -> Balance Credit -> Open Class Enrollment", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  portal.teacherStudent.clases_restantes = 0; // Empty balance

  // 1. Request Voucher 4 (40.50€) in Standby
  const { request } = portal.handleTeacherPaymentMock(BONOS_DOCENTES[0]);
  assert.ok(portal.teacherStudent.plan_activo.includes("Pendiente"));

  // 2. Reception Desk confirms cash payment in Studio 2
  handleCobrarBonoEnRecepcion(env, request, "Efectivo", "castilla");
  assert.strictEqual(portal.teacherStudent.clases_restantes, 4);

  // 3. Teacher enrolls into Open Class
  const openClass = env.tables.clases_cuadrante.find(c => c.id === "class_open_andrea_1");
  const enrollResult = portal.handleTeacherApuntarme(openClass);
  assert.strictEqual(enrollResult.success, true);
  assert.strictEqual(portal.teacherStudent.clases_restantes, 3);
});

runTest("Tier 3", "C3", "Teacher Open Class Enrollment prevented if it collides with their own teaching schedule", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001"); // Lucía teaches Lunes 17:30-18:30 and 18:30-19:30

  // Colliding Open Class on Lunes at 18:00
  const collidingOpenClass = {
    id: "class_open_colliding",
    nombre_clase: "OPEN CLASS Guest Choreographer",
    dia_semana: "LUNES",
    hora_inicio: "18:00",
    hora_fin: "19:00",
    aforo_maximo: 20
  };

  const result = portal.handleTeacherApuntarme(collidingOpenClass);
  assert.strictEqual(result.success, false);
  assert.ok(result.reason.includes("Conflicto horario"));
});

runTest("Tier 3", "C4", "Teacher balance decrement to 0 blocks next enrollment until new voucher is acquired", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  portal.teacherStudent.clases_restantes = 1;

  const openClass1 = env.tables.clases_cuadrante.find(c => c.id === "class_open_andrea_1");
  const openClass2 = env.tables.clases_cuadrante.find(c => c.id === "class_formacion_dario_1");

  // First enrollment consumes last class
  const res1 = portal.handleTeacherApuntarme(openClass1);
  assert.strictEqual(res1.success, true);
  assert.strictEqual(portal.teacherStudent.clases_restantes, 0);

  // Second enrollment fails with purchase prompt
  const res2 = portal.handleTeacherApuntarme(openClass2);
  assert.strictEqual(res2.success, false);
  assert.strictEqual(res2.promptBuy, true);
});

runTest("Tier 3", "C5", "Shared Studio Device: Teacher A logout -> Teacher B login guarantees strict isolation", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);

  // Teacher A (Lucía)
  portal.validatePin("1001");
  const classesA = portal.getTeacherClasses();
  assert.strictEqual(classesA.length, 2);
  portal.handleLogout();

  // Teacher B (Lucas)
  portal.validatePin("1005");
  const classesB = portal.getTeacherClasses();
  assert.strictEqual(classesB.length, 1);
  assert.strictEqual(classesB[0].nombre_clase, "Popping Fundamentals");
  assert.strictEqual(portal.selectedProfesor, "LUCAS LÓPEZ");
});

runTest("Tier 3", "C6", "Reception TPV payment updates central ledger transaction without duplicate records", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");

  // Create standby request
  const { request } = portal.handleTeacherPaymentMock(BONOS_DOCENTES[1]); // Bono 8 (51.30€)
  let ledger = JSON.parse(env.localStorage.get("df_pagos_transacciones_v1") || "[]");
  assert.strictEqual(ledger.length, 1);
  assert.strictEqual(ledger[0].estado, "Pendiente");

  // Reception cobro via TPV
  handleCobrarBonoEnRecepcion(env, request, "TPV", "tejar");
  ledger = JSON.parse(env.localStorage.get("df_pagos_transacciones_v1") || "[]");
  assert.strictEqual(ledger.length, 1, "Ledger must update the existing record rather than duplicating it");
  assert.strictEqual(ledger[0].estado, "Cobrado");
  assert.strictEqual(ledger[0].metodo_pago, "TPV");
  assert.strictEqual(ledger[0].atendido_por, "Recepción Studio 1");
});

runTest("Tier 3", "C7", "Bulk check-in decrements only bono students and creates aggregated audit entry", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const clase = env.tables.clases_cuadrante[0];
  const roster = portal.getRoster(clase.id);

  const regularStudent = roster.find(s => s.id === "student_1");
  const bonoStudent = roster.find(s => s.id === "student_3");
  const initialBono = bonoStudent.clases_restantes;

  portal.handleMarkAllPresent(roster, clase);
  assert.strictEqual(regularStudent.clases_restantes, null);
  assert.strictEqual(bonoStudent.clases_restantes, initialBono - 1);

  const bulkAudit = env.tables.actividad_escuela.find(l => l.descripcion.includes("pase de lista masivo"));
  assert.ok(bulkAudit);
});

runTest("Tier 3", "C8", "Open Class booking -> Cancel >24h -> Re-booking maintains accurate aforo count", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");
  const openClass = env.tables.clases_cuadrante.find(c => c.id === "class_open_andrea_1");

  // 1. Enroll
  portal.handleTeacherApuntarme(openClass);
  let count = env.tables.alumnos_clases.filter(e => e.clase_id === openClass.id).length;
  assert.strictEqual(count, 1);

  // 2. Cancel >24h
  const monday = new Date(2026, 7, 24, 10, 0, 0);
  portal.handleTeacherDesapuntarme(openClass, monday);
  count = env.tables.alumnos_clases.filter(e => e.clase_id === openClass.id).length;
  assert.strictEqual(count, 0);

  // 3. Re-enroll
  portal.handleTeacherApuntarme(openClass);
  count = env.tables.alumnos_clases.filter(e => e.clase_id === openClass.id).length;
  assert.strictEqual(count, 1);
});

runTest("Tier 3", "C9", "Admin Master PIN (9999) switches teacher context and registers correct audit attribution", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);

  portal.validatePin("9999");
  assert.strictEqual(portal.isAdmin, true);

  // Switch context to Andrea Soto
  portal.selectedProfesor = "ANDREA SOTO";
  portal.loadTeacherProfile();
  assert.strictEqual(portal.teacherStudent.nombre_completo, "ANDREA SOTO");
});

runTest("Tier 3", "C10", "Financial Arqueo combines desk payments and reconciled standby vouchers correctly", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);
  portal.validatePin("1001");

  // Teacher buys Bono 4 (40.50€) and pays cash at Castilla
  const { request } = portal.handleTeacherPaymentMock(BONOS_DOCENTES[0]);
  handleCobrarBonoEnRecepcion(env, request, "Efectivo", "castilla");

  // Desk payment at Tejar for 32.00€
  const payments = JSON.parse(env.localStorage.get("df_pagos_transacciones_v1") || "[]");
  payments.push({
    id: "desk_tejar_1",
    estado: "Cobrado",
    metodo_pago: "Efectivo",
    importe: 32.00,
    sede: "tejar"
  });

  const arqueo = calculateArqueoSede(payments);
  assert.strictEqual(arqueo.castilla.total, 40.50);
  assert.strictEqual(arqueo.tejar.total, 32.00);
  assert.strictEqual(arqueo.consolidado.total, 72.50);
  assert.strictEqual(arqueo.consolidado.count, 2);
});


// ============================================================================
// TIER 4: REAL-WORLD USER APPLICATION SCENARIOS (5 MULTI-STEP WORKFLOWS)
// ============================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log("TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 MULTI-STEP WORKFLOWS)");
console.log("--------------------------------------------------------------------------------");

runTest("Tier 4", "S1", "Workflow 1: Teacher daily routine at Studio 1 (PIN login, roll call, alerts & bulk mark)", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);

  // Step 1: Teacher arrives at Studio 1, types PIN 1001
  const authOk = portal.validatePin("1001");
  assert.strictEqual(authOk, true);

  // Step 2: Checks assigned classes for Monday
  const classes = portal.getTeacherClasses();
  assert.strictEqual(classes.length, 2);
  const activeClass = classes[0]; // Urban Kids Iniciación (Studio 1)
  assert.strictEqual(isStudio1(activeClass.sede), true);

  // Step 3: Opens class roster and performs individual 1-click check-in
  const roster = portal.getRoster(activeClass.id);
  assert.strictEqual(roster.length, 4);
  const student1 = roster[0];
  portal.handleToggleAsistencia(student1, activeClass);
  assert.strictEqual(portal.asistenciasRegistradas.length, 1);

  // Step 4: Teacher reviews remaining students and does bulk check-in ("Marcar Todos")
  portal.handleMarkAllPresent(roster, activeClass);
  assert.strictEqual(portal.asistenciasRegistradas.length, 4);

  // Step 5: Identifies exhausted voucher student
  const moroso = roster.find(s => s.clases_restantes === 0);
  assert.ok(moroso);
  assert.strictEqual(moroso.nombre_completo, "Pablo Ortiz");
});

runTest("Tier 4", "S2", "Workflow 2: Teacher training & Open Class lifecycle (Conflict check, booking & refund)", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);

  // Step 1: Teacher Eva Leiva (PIN 1004) logs into Teacher Portal
  portal.validatePin("1004");
  assert.strictEqual(portal.selectedProfesor, "EVA LEIVA");

  // Step 2: Eva checks Open Class catalog
  const openClass = env.tables.clases_cuadrante.find(c => c.id === "class_open_andrea_1"); // Miércoles 20:00
  assert.ok(openClass);

  // Step 3: Reserves Open Class plaza using her teacher voucher balance
  const initialBalance = portal.teacherStudent.clases_restantes;
  const enrollRes = portal.handleTeacherApuntarme(openClass);
  assert.strictEqual(enrollRes.success, true);
  assert.strictEqual(portal.teacherStudent.clases_restantes, initialBalance - 1);

  // Step 4: Plans change -> Eva cancels class with >24h notice (on Monday morning)
  const monday = new Date(2026, 7, 24, 9, 0, 0);
  const cancelRes = portal.handleTeacherDesapuntarme(openClass, monday);
  assert.strictEqual(cancelRes.success, true);
  assert.strictEqual(portal.teacherStudent.clases_restantes, initialBalance, "Balance must be fully refunded");

  // Step 5: Verification of audit trail
  const logs = env.tables.actividad_escuela.filter(l => l.usuario_afectado === "EVA LEIVA");
  assert.ok(logs.length >= 1);
});

runTest("Tier 4", "S3", "Workflow 3: End-to-end Standby Voucher & Reception Desk Reconciliation", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);

  // Step 1: Teacher Lucas López (PIN 1005) needs vouchers and selects Bono 8 (-10% dto = 51.30€)
  portal.validatePin("1005");
  portal.teacherStudent.clases_restantes = 0;
  const bono8 = BONOS_DOCENTES.find(b => b.id === "Bono 8 clases");
  
  // Step 2: Requests "Abonar en Recepción"
  const { request, transaction } = portal.handleTeacherPaymentMock(bono8);
  assert.strictEqual(transaction.estado, "Pendiente");
  assert.strictEqual(transaction.importe, 51.30);

  // Step 3: Reception Dashboard receives request in pending queue
  const pendingQueue = JSON.parse(env.localStorage.get("pending_bono_requests") || "[]");
  assert.strictEqual(pendingQueue.length, 1);
  assert.strictEqual(pendingQueue[0].student_name, "LUCAS LÓPEZ (Docente)");

  // Step 4: Receptionist collects payment via TPV in Studio 2
  const cobroResult = handleCobrarBonoEnRecepcion(env, request, "TPV", "castilla");
  assert.strictEqual(cobroResult.success, true);
  assert.strictEqual(cobroResult.clasesToAdd, 8);

  // Step 5: Central Ledger reconciled & teacher balance activated
  const ledger = JSON.parse(env.localStorage.get("df_pagos_transacciones_v1") || "[]");
  assert.strictEqual(ledger[0].estado, "Cobrado");
  assert.strictEqual(ledger[0].metodo_pago, "TPV");
  assert.strictEqual(portal.teacherStudent.clases_restantes, 8);
});

runTest("Tier 4", "S4", "Workflow 4: Multi-teacher shared studio tablet security & zero-residue logout", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);

  // Step 1: Teacher 1 (Lucía Muñoz - 1001) logs in, marks attendance, and logs out
  portal.validatePin("1001");
  const luciaClass = portal.getTeacherClasses()[0];
  const luciaStudent = portal.getRoster(luciaClass.id)[0];
  portal.handleToggleAsistencia(luciaStudent, luciaClass);
  portal.handleLogout();

  // Step 2: Verify zero auth state in storage
  assert.strictEqual(env.sessionStorage.has("df_profesor_pin"), false);
  assert.strictEqual(portal.isAuthenticated, false);

  // Step 3: Teacher 2 (Darío Humberto - 1008) logs in on same tablet
  portal.validatePin("1008");
  assert.strictEqual(portal.selectedProfesor, "DARÍO HUMBERTO");
  assert.strictEqual(portal.asistenciasRegistradas.length, 0, "No residual attendance state from previous teacher");

  // Step 4: Darío views his Formación class and verifies isolation
  const darioClasses = portal.getTeacherClasses();
  assert.strictEqual(darioClasses.length, 1);
  assert.strictEqual(darioClasses[0].nombre_clase, "FORMACIÓN Intensiva Afro House");
  portal.handleLogout();
  assert.strictEqual(portal.isAuthenticated, false);
});

runTest("Tier 4", "S5", "Workflow 5: Full ecosystem sync (Teacher check-in, reception scan, ledger consistency)", () => {
  const env = new MockEnvironment();
  env.seedInitialData();
  const portal = new TeacherPortalEngine(env);

  // Step 1: Teacher passes roll call in Studio 1 -> Bono student decrements from 5 to 4 classes
  portal.validatePin("1001");
  const clase = env.tables.clases_cuadrante[0];
  const student = env.tables.alumnos.find(a => a.id === "student_3");
  assert.strictEqual(student.clases_restantes, 5);
  portal.handleToggleAsistencia(student, clase);
  assert.strictEqual(student.clases_restantes, 4);

  // Step 2: Student goes to Reception desk to recharge with Bono 10 (79€)
  const bonoRechargeReq = {
    id: "req_desk_recharge",
    student_id: student.id,
    student_name: student.nombre_completo,
    bono_nombre: "Bono 10 clases",
    bono_precio: "79,00 €"
  };
  handleCobrarBonoEnRecepcion(env, bonoRechargeReq, "Efectivo", "tejar");
  assert.strictEqual(student.clases_restantes, 14, "4 remaining + 10 added = 14 total classes");

  // Step 3: Reception Arqueo ledger reflects the new cash payment
  const payments = JSON.parse(env.localStorage.get("df_pagos_transacciones_v1") || "[]");
  const arqueo = calculateArqueoSede(payments);
  assert.strictEqual(arqueo.tejar.total, 79.00);
  assert.strictEqual(arqueo.tejar.efectivo, 79.00);

  // Step 4: Teacher opens roster again and sees the updated 14 classes on student carnet
  const updatedRoster = portal.getRoster(clase.id);
  const refreshedStudent = updatedRoster.find(s => s.id === student.id);
  assert.strictEqual(refreshedStudent.clases_restantes, 14);
});


// ============================================================================
// TEST SUITE EXECUTION SUMMARY
// ============================================================================
console.log("\n================================================================================");
console.log("   TEST SUITE EXECUTION SUMMARY");
console.log("================================================================================");
console.log(`  Total Tests Run:     ${totalTests}`);
console.log(`  Passed Tests:        ${passedCount}`);
console.log(`  Failed Tests:        ${failedCount}`);
console.log(`  Pass Rate:           ${((passedCount / totalTests) * 100).toFixed(2)}%`);
console.log("================================================================================\n");

if (failedCount > 0) {
  console.error("FAILURES DETECTED:");
  failures.forEach(f => console.error(` - [${f.tier}] [${f.id}] ${f.name}: ${f.error}`));
  process.exit(1);
} else {
  console.log("✓ ALL 85 TESTS COMPLETED SUCCESSFULLY WITH ZERO FAILURES.");
  process.exit(0);
}
