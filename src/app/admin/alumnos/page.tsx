"use client";

import { useState, useEffect } from "react";
import TopHeader from "@/components/layout/TopHeader";
import { supabase } from "@/lib/supabase/client";
import { useSede } from "@/context/SedeContext";
import AppModal, { ModalState } from "@/components/AppModal";
import { logActivity } from "@/lib/activityLogger";
import { getStudentFee, calculateFeeFromClasses, saveStudentFeeOverride } from "@/lib/studentFees";
import { openGlobalCobro } from "@/components/GlobalCobroModal";
import { getPagosByAlumno } from "@/lib/pagosService";
import { syncReservasFromSupabase } from "@/lib/openClassService";
import { CheckCircle2 } from "lucide-react";

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

// Validation Helpers
function validateDNI(dni: string): { valid: boolean; message?: string } {
  if (!dni || !dni.trim()) return { valid: true };
  const clean = dni.toUpperCase().replace(/[\s\-]/g, "");
  // Permite DNI, NIE y pasaportes internacionales alfanuméricos de entre 4 y 20 caracteres
  if (/^[A-Z0-9]{4,20}$/i.test(clean)) {
    return { valid: true };
  }
  return { valid: false, message: "El documento debe tener entre 4 y 20 caracteres alfanuméricos." };
}

function validatePhone(phone: string): { valid: boolean; message?: string } {
  if (!phone || !phone.trim()) return { valid: true }; // Opcional en edición
  const clean = phone.replace(/[\s\-\(\)\.]/g, "");
  // Permite números españoles e internacionales (7 a 15 dígitos)
  if (/^(?:\+?\d{1,4})?[0-9]{7,15}$/.test(clean)) {
    return { valid: true };
  }
  return { valid: false, message: "El teléfono debe contener entre 7 y 15 dígitos numéricos." };
}

function validateEmail(email: string): { valid: boolean; message?: string } {
  if (!email || !email.trim()) return { valid: true };
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  if (!isValid) {
    return { valid: false, message: "Formato de correo electrónico inválido." };
  }
  return { valid: true };
}

function validateIBAN(iban: string): { valid: boolean; message?: string } {
  if (!iban || !iban.trim()) return { valid: true };
  const clean = iban.toUpperCase().replace(/[\s\-]/g, "");
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(clean)) {
    return { valid: false, message: "Formato de IBAN bancario incorrecto (ej. ES91...)." };
  }
  return { valid: true };
}

export default function AlumnosPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [appModal, setAppModal] = useState<ModalState>({ isOpen: false, message: "" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [modalSedeFilter, setModalSedeFilter] = useState<"all" | "tejar" | "castilla">("all");

  // Attendance History Modal State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyStudent, setHistoryStudent] = useState<any | null>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState<"pagos" | "reservas" | "asistencias" | "ficha">("pagos");
  const [historyPayments, setHistoryPayments] = useState<any[]>([]);
  const [historyReservas, setHistoryReservas] = useState<any[]>([]);
  const { activeSede } = useSede();

  // Expiration check state
  const [isCheckingExpirations, setIsCheckingExpirations] = useState(false);

  const handleCheckExpirations = async () => {
    setIsCheckingExpirations(true);
    try {
      const res = await fetch("https://app.dancefactoryalcorcon.es/api/cron/check-expirations");
      const data = await res.json();
      if (data.success) {
        alert(`✅ Verificación de caducidades completada:\n\n• Alumnos con bonos revisados: ${data.processedCount}\n• Emails de aviso enviados (≤ 7 días restantes): ${data.emailsSent}`);
      } else {
        alert("Aviso: " + (data.error || "No se pudo completar la verificación."));
      }
    } catch (e: any) {
      alert("No se pudo conectar con el servicio de alertas: " + e.message);
    } finally {
      setIsCheckingExpirations(false);
    }
  };

  // State for students from DB
  const [students, setStudents] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const initialFormState = {
    sede: "tejar",
    nombre_completo: "",
    telefono: "",
    email: "",
    dni: "",
    direccion: "",
    iban: "",
    fecha_nacimiento: "",
    tipo_alumno: "adulto" as "adulto" | "infantil",
    plan_activo: "Sin Plan Activo",
    cuota_mensual: 30,
    nfc_token: "",
    estado: "Activo",
    clases_asignadas: [] as string[]
  };

  // Form state
  const [formData, setFormData] = useState(initialFormState);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch students
    let queryStudents = supabase.from("alumnos").select("*");
    if (activeSede !== "consolidado") {
      if (activeSede === "tejar") {
        queryStudents = queryStudents.in("sede", ["tejar", "studio", "mostoles"]);
      } else {
        queryStudents = queryStudents.in("sede", ["castilla", "alcorcon"]);
      }
    }
    queryStudents = queryStudents.order("creado_en", { ascending: false });
    const { data: studentsData } = await queryStudents;
      
    const enriched = (studentsData || []).map((s: any) => ({
      ...s,
      iban: s.iban || getStoredIBAN(s.id)
    }));
    setStudents(enriched);

    // Fetch classes for assignment
    let queryClasses = supabase.from("clases_cuadrante").select("*");
    if (activeSede !== "consolidado") {
      if (activeSede === "tejar") {
        queryClasses = queryClasses.in("sede", ["tejar", "studio", "mostoles"]);
      } else {
        queryClasses = queryClasses.in("sede", ["castilla", "alcorcon"]);
      }
    }
    queryClasses = queryClasses.order("dia_semana", { ascending: true }).order("hora_inicio", { ascending: true });
    const { data: classesData } = await queryClasses;
    setAvailableClasses(classesData || []);

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();

    const handleUpdate = () => {
      fetchData();
    };
    window.addEventListener("df_student_fees_updated", handleUpdate);
    window.addEventListener("df_pagos_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("df_student_fees_updated", handleUpdate);
      window.removeEventListener("df_pagos_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [activeSede]);

  // Open Comprehensive History Modal for a Student (Bonos, Payments, Calendar Bookings, Attendances)
  const handleOpenHistory = async (student: any) => {
    setHistoryStudent(student);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryTab("pagos");

    // 1. Load Payments / Bonos history
    const payments = getPagosByAlumno(student.id, student.nombre_completo);
    setHistoryPayments(payments);

    // 2. Load Calendar Open Class reservations
    if (typeof window !== "undefined") {
      try {
        await syncReservasFromSupabase();
        const rawRes = localStorage.getItem("df_openclass_reservas_v2");
        const allRes = rawRes ? JSON.parse(rawRes) : [];
        const studentRes = allRes.filter((r: any) => 
          r.alumno_id === student.id || 
          (r.alumno_nombre && student.nombre_completo && r.alumno_nombre.toLowerCase() === student.nombre_completo.toLowerCase())
        );
        setHistoryReservas(studentRes);
      } catch (e) {
        setHistoryReservas([]);
      }
    }

    // 3. Load In-Person Attendances from Supabase
    try {
      const { data, error } = await supabase
        .from("asistencias")
        .select(`
          id,
          fecha_hora,
          clases_cuadrante (
            nombre_clase,
            profesor,
            sede,
            dia_semana,
            hora_inicio
          )
        `)
        .eq("alumno_id", student.id)
        .order("fecha_hora", { ascending: false });

      if (!error) {
        setHistoryRecords(data || []);
      } else {
        setHistoryRecords([]);
      }
    } catch (e) {
      setHistoryRecords([]);
    }

    setHistoryLoading(false);
  };

  const handleOpenCreate = async () => {
    setIsEditing(false);
    setEditingId(null);

    const { data: allClases } = await supabase
      .from("clases_cuadrante")
      .select("*")
      .order("sede", { ascending: true })
      .order("dia_semana", { ascending: true })
      .order("hora_inicio", { ascending: true });

    setAvailableClasses(allClases || []);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (student: any) => {
    setIsEditing(true);
    setEditingId(student.id);
    
    // Fetch all classes across sedes so all enrolled classes can be displayed
    const { data: allClases } = await supabase
      .from("clases_cuadrante")
      .select("*")
      .order("sede", { ascending: true })
      .order("dia_semana", { ascending: true })
      .order("hora_inicio", { ascending: true });

    setAvailableClasses(allClases || []);

    // Fetch student assigned classes
    const { data: assigned } = await supabase
      .from("alumnos_clases")
      .select("clase_id")
      .eq("alumno_id", student.id);
      
    const assignedIds = assigned ? assigned.map(a => a.clase_id) : [];
    const studentIban = student.iban || getStoredIBAN(student.id);
    const feeInfo = getStudentFee(student);

    setFormData({
      sede: student.sede || "tejar",
      nombre_completo: student.nombre_completo || "",
      telefono: student.telefono || "",
      email: student.email || "",
      dni: student.dni || "",
      direccion: student.direccion || "",
      iban: studentIban || "",
      fecha_nacimiento: student.fecha_nacimiento || "",
      tipo_alumno: (student.tipo_alumno || (student.fecha_nacimiento && (new Date().getFullYear() - new Date(student.fecha_nacimiento).getFullYear() <= 14) ? "infantil" : "adulto")) as "adulto" | "infantil",
      plan_activo: student.plan_activo || `Clases Regulares (${feeInfo.cuotaBase}€/mes)`,
      cuota_mensual: feeInfo.cuotaBase,
      nfc_token: student.nfc_token || "",
      estado: student.estado || "Activo",
      clases_asignadas: assignedIds
    });
    setIsModalOpen(true);
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este alumno y todos sus datos?")) return;
    
    try {
      // Clean up relations first
      await supabase.from("alumnos_clases").delete().eq("alumno_id", id);
      await supabase.from("asistencias").delete().eq("alumno_id", id);

      const { error } = await supabase.from("alumnos").delete().eq("id", id);
      
      if (error) {
        console.error("Error al eliminar alumno:", error);
        alert("Hubo un error al eliminar el alumno.");
      } else {
        deleteStoredIBAN(id);
        fetchData();
      }
    } catch (err) {
      console.error("Excepción al eliminar alumno:", err);
      alert("Hubo un error al eliminar el alumno.");
    }
  };

    const handleTipoAlumnoChange = (tipo: "adulto" | "infantil") => {
    setFormData(prev => {
      let newPlan = prev.plan_activo;
      let newFee = prev.cuota_mensual;
      if (prev.clases_asignadas.length > 0) {
        const selectedObjs = availableClasses.filter(c => prev.clases_asignadas.includes(c.id));
        newFee = calculateFeeFromClasses(selectedObjs, tipo);
        newPlan = `Clases Regulares (${newFee}€/mes)`;
      } else {
        newFee = tipo === "infantil" ? 27 : 30;
        if (newPlan.toLowerCase().includes("regulares")) {
          newPlan = `Clases Regulares (${newFee}€/mes)`;
        }
      }
      return {
        ...prev,
        tipo_alumno: tipo,
        cuota_mensual: newFee,
        plan_activo: newPlan
      };
    });
  };

  const handleClassToggle = (classId: string) => {
    setFormData(prev => {
      const isSelected = prev.clases_asignadas.includes(classId);
      const newAssigned = isSelected 
        ? prev.clases_asignadas.filter(id => id !== classId)
        : [...prev.clases_asignadas, classId];
      
      let newPlan = prev.plan_activo;
      let newFee = prev.cuota_mensual;
      if (newAssigned.length === 0) {
        newPlan = "Sin Plan Activo";
        newFee = 0;
      } else {
        const selectedObjs = availableClasses.filter(c => newAssigned.includes(c.id));
        newFee = calculateFeeFromClasses(selectedObjs, prev.tipo_alumno || "adulto");
        newPlan = `Clases Regulares (${newFee}€/mes)`;
      }

      return { 
        ...prev, 
        clases_asignadas: newAssigned,
        cuota_mensual: newFee,
        plan_activo: newPlan
      };
    });
  };

  const handleCuotaChange = (newCuota: number) => {
    setFormData(prev => {
      const isBono = prev.plan_activo.toLowerCase().includes("bono") || prev.plan_activo.toLowerCase().includes("promo") || prev.plan_activo.toLowerCase().includes("suelta");
      const newPlan = isBono 
        ? prev.plan_activo 
        : (newCuota === 0 && prev.clases_asignadas.length === 0 ? "Sin Plan Activo" : `Clases Regulares (${newCuota}€/mes)`);
      return {
        ...prev,
        cuota_mensual: newCuota,
        plan_activo: newPlan
      };
    });
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validation Checks
    const phoneCheck = validatePhone(formData.telefono);
    if (!phoneCheck.valid) {
      alert(phoneCheck.message || "Teléfono inválido");
      return;
    }

    const dniCheck = validateDNI(formData.dni);
    if (!dniCheck.valid) {
      alert(dniCheck.message || "DNI/NIE inválido");
      return;
    }

    const emailCheck = validateEmail(formData.email);
    if (!emailCheck.valid) {
      alert(emailCheck.message || "Email inválido");
      return;
    }

    const ibanCheck = validateIBAN(formData.iban);
    if (!ibanCheck.valid) {
      alert(ibanCheck.message || "IBAN inválido");
      return;
    }
    
    let clases_restantes = 0;
    if (formData.plan_activo === "Bono 4 clases") {
      clases_restantes = 4;
    } else if (formData.plan_activo === "Bono 8 clases") {
      clases_restantes = 8;
    } else if (formData.plan_activo === "Bono 10 clases") {
      clases_restantes = 10;
    } else if (formData.plan_activo === "Mensualidad Ilimitada") {
      clases_restantes = 999;
    } else if (formData.plan_activo === "Clase Suelta") {
      clases_restantes = 1;
    }

    // Ensure regular students have their custom cuota in plan_activo
    let finalPlan = formData.plan_activo;
    const isBonoOrPromo = finalPlan.toLowerCase().includes("bono") || finalPlan.toLowerCase().includes("promo") || finalPlan.toLowerCase().includes("suelta");
    if (!isBonoOrPromo && formData.cuota_mensual > 0) {
      finalPlan = `Clases Regulares (${formData.cuota_mensual}€/mes)`;
    }

    // Prepare clean payload containing only columns present in Supabase 'alumnos' table
    const payload: Record<string, any> = {
      sede: formData.sede || (activeSede !== "consolidado" ? activeSede : "tejar"),
      nombre_completo: formData.nombre_completo.trim(),
      telefono: formData.telefono.trim(),
      email: formData.email.trim() || null,
      dni: formData.dni.trim() || null,
      direccion: formData.direccion.trim() || null,
      fecha_nacimiento: formData.fecha_nacimiento || null,
      plan_activo: finalPlan,
      nfc_token: formData.nfc_token.trim() || null,
      estado: formData.estado
    };

    let error: any = null;
    let studentId = editingId;

    if (isEditing && editingId) {
      let toUpdate = { ...payload };
      let { error: updateError } = await supabase.from("alumnos").update(toUpdate).eq("id", editingId);
      
      // Auto-retry loop if any column is not in schema cache
      while (updateError && updateError.code === "PGRST204" && updateError.message) {
        const match = updateError.message.match(/'([^']+)' column/);
        if (match && match[1] && match[1] in toUpdate) {
          delete toUpdate[match[1]];
          const retry = await supabase.from("alumnos").update(toUpdate).eq("id", editingId);
          updateError = retry.error;
        } else {
          break;
        }
      }
      error = updateError;
    } else {
      let insertPayload: Record<string, any> = { ...payload, clases_restantes };
      let { data, error: insertError } = await supabase.from("alumnos").insert([insertPayload]).select("id").single();
      
      while (insertError && insertError.code === "PGRST204" && insertError.message) {
        const match = insertError.message.match(/'([^']+)' column/);
        if (match && match[1] && match[1] in insertPayload) {
          delete insertPayload[match[1]];
          const retry = await supabase.from("alumnos").insert([insertPayload]).select("id").single();
          data = retry.data;
          insertError = retry.error;
        } else {
          break;
        }
      }
      error = insertError;
      if (data) studentId = data.id;
    }

    if (error) {
      console.error("Error saving student:", error);
      alert("Hubo un error al guardar el alumno: " + (error.message || "Error en base de datos"));
      return;
    }

    // Persist IBAN and Fee overrides in local cache
    if (studentId) {
      saveStoredIBAN(studentId, formData.iban);
      if (formData.cuota_mensual > 0) {
        saveStudentFeeOverride(studentId, formData.cuota_mensual);
        if (formData.nombre_completo) {
          saveStudentFeeOverride(formData.nombre_completo.toLowerCase().trim(), formData.cuota_mensual);
        }
        if (formData.nfc_token) {
          saveStudentFeeOverride("card_" + formData.nfc_token.trim(), formData.cuota_mensual);
        }
        if (formData.email) {
          saveStudentFeeOverride("email_" + formData.email.toLowerCase().trim(), formData.cuota_mensual);
        }
      }
    }

    // Update assigned classes
    if (studentId) {
      try {
        await supabase.from("alumnos_clases").delete().eq("alumno_id", studentId);
        
        if (formData.clases_asignadas.length > 0) {
          const insertData = formData.clases_asignadas.map(claseId => ({
            alumno_id: studentId,
            clase_id: claseId
          }));
          await supabase.from("alumnos_clases").insert(insertData);
        }
      } catch (errAssign) {
        console.warn("Aviso al guardar clases asignadas:", errAssign);
      }
    }

    logActivity({
      origen: "recepcion",
      tipo_evento: "edicion_alumno",
      descripcion: isEditing 
        ? `Alumno editado: ${formData.nombre_completo}`
        : `Nuevo alumno matriculado: ${formData.nombre_completo}`,
      usuario_afectado: formData.nombre_completo,
      sede: formData.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
    });

    setIsModalOpen(false);
    fetchData();

    setAppModal({
      isOpen: true,
      title: isEditing ? "Alumno Actualizado" : "Alumno Matriculado",
      message: isEditing 
        ? `Los datos de "${formData.nombre_completo}" se han guardado correctamente.`
        : `El alumno "${formData.nombre_completo}" ha sido matriculado con éxito.`,
      type: "success",
      confirmText: "Aceptar"
    });
  };

  const parseCSVLine = (text: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result.map(s => s.replace(/^["']|["']$/g, "").trim());
  };

  const handleProcessCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    setCsvLoading(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) {
        setCsvLoading(false);
        return;
      }

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length <= 1) {
        alert("El archivo CSV está vacío o solo contiene cabeceras.");
        setCsvLoading(false);
        return;
      }

      // Skip header
      const dataRows = lines.slice(1);
      const newStudents = [];

      for (const row of dataRows) {
        const columns = parseCSVLine(row);
        if (columns.length >= 2) {
          // Detect 10-column Dance Factory official layout vs simple 5-column layout
          if (columns.length >= 7) {
            // [0] Nombre Completo, [1] Número Tarjeta, [2] Teléfono, [3] Email, [4] Sede, [5] Plan Activo, [6] Clase, [7] Pago, [8] DNI, [9] Dirección
            const nombre_completo = columns[0] || "Sin Nombre";
            const rawNfc = columns[1];
            const nfc_token = rawNfc && rawNfc !== "-" ? rawNfc : null;
            const telefono = columns[2] || "600000000";
            const rawEmail = columns[3];
            const email = rawEmail && rawEmail.includes("@") ? rawEmail : null;
            const rawSede = (columns[4] || "").toLowerCase();
            const sede = (rawSede.includes("2") || rawSede.includes("castilla") || rawSede.includes("alcorcon")) ? "castilla" : "tejar";
            const plan_activo = columns[5] || "Clases Regulares";
            const rawDni = columns[8];
            const dni = rawDni && rawDni !== "-" ? rawDni : null;
            const rawDir = columns[9];
            const direccion = rawDir && rawDir !== "-" ? rawDir : null;

            let clases_restantes = 0;
            const planLower = plan_activo.toLowerCase();
            if (planLower.includes("bono 4")) clases_restantes = 4;
            else if (planLower.includes("bono 8")) clases_restantes = 8;
            else if (planLower.includes("bono 10")) clases_restantes = 10;
            else if (planLower.includes("ilimitad")) clases_restantes = 999;
            else if (planLower.includes("suelta")) clases_restantes = 1;

            newStudents.push({
              nombre_completo,
              nfc_token,
              telefono,
              email,
              sede,
              plan_activo,
              dni,
              direccion,
              clases_restantes,
              estado: "Activo"
            });
          } else {
            // Simplified 5-column fallback: [Nombre, Telefono, Email, Sede, Plan]
            const nombre_completo = columns[0] || "Sin Nombre";
            const telefono = columns[1] || "600000000";
            const email = columns[2] || null;
            const rawSede = (columns[3] || "").toLowerCase();
            const sede = (rawSede.includes("2") || rawSede.includes("castilla") || rawSede.includes("alcorcon")) ? "castilla" : "tejar";
            const plan_activo = columns[4] || "Clases Regulares";

            let clases_restantes = 0;
            const planLower = plan_activo.toLowerCase();
            if (planLower.includes("bono 4")) clases_restantes = 4;
            else if (planLower.includes("bono 8")) clases_restantes = 8;
            else if (planLower.includes("bono 10")) clases_restantes = 10;
            else if (planLower.includes("ilimitad")) clases_restantes = 999;
            else if (planLower.includes("suelta")) clases_restantes = 1;

            newStudents.push({
              nombre_completo,
              telefono,
              email,
              sede,
              plan_activo,
              clases_restantes,
              estado: "Activo"
            });
          }
        }
      }

      if (newStudents.length > 0) {
        const { error } = await supabase.from("alumnos").insert(newStudents);
        if (error) {
          console.error("Error volcando CSV:", error);
          alert("Hubo un error al importar los alumnos.");
        } else {
          alert(`¡Éxito! Se han importado ${newStudents.length} alumnos correctamente.`);
          setIsCsvModalOpen(false);
          setCsvFile(null);
          fetchData();
        }
      }
      setCsvLoading(false);
    };

    reader.readAsText(csvFile);
  };

  const displayedModalClasses = availableClasses.filter(c => {
    if (modalSedeFilter === "tejar") return c.sede === "tejar";
    if (modalSedeFilter === "castilla") return c.sede === "castilla";
    return true;
  });

  const filteredStudents = students
    .filter(student => 
      student.nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.telefono?.includes(searchTerm) ||
      student.nfc_token?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.dni?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const nameA = a.nombre_completo || "";
      const nameB = b.nombre_completo || "";
      return sortOrder === "asc"
        ? nameA.localeCompare(nameB, "es", { sensitivity: "base" })
        : nameB.localeCompare(nameA, "es", { sensitivity: "base" });
    });

  return (
    <div className="space-y-6">
      {/* TopHeader */}
      <TopHeader 
        title="Gestión de Alumnos" 
        subtitle="Directorio, matriculaciones, fichas de contacto y asignación de cursos" 
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, tarjeta NFC, teléfono..." 
              className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 absolute left-3 top-2.5 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filtro Orden A-Z / Z-A */}
          <div className="flex items-center gap-1.5 shrink-0">
            <select 
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              className="bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-title)] text-xs font-semibold rounded-lg px-3 py-2.5 outline-none focus:border-[var(--color-primary)] cursor-pointer transition-colors"
            >
              <option value="asc">Nombre (A ➔ Z)</option>
              <option value="desc">Nombre (Z ➔ A)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button 
            onClick={handleCheckExpirations}
            disabled={isCheckingExpirations}
            className="bg-[var(--color-bg-card)] hover:bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
            title="Comprobar bonos que caducan en 7 días y enviar emails de aviso"
          >
            <span>⏰</span>
            <span>{isCheckingExpirations ? "Comprobando..." : "Avisar Caducidades"}</span>
          </button>
          <button 
            onClick={() => setIsCsvModalOpen(true)}
            className="bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-title)] border border-[var(--color-border)] px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-[var(--color-secondary)]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Importar CSV
          </button>
          <button 
            onClick={handleOpenCreate}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-[var(--color-primary)]/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Alumno
          </button>
        </div>
      </div>

      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg-hover)] border-b border-[var(--color-border)]">
                <th className="py-3 px-4 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  <button 
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    className="flex items-center gap-2 hover:text-[var(--color-text-title)] transition-colors group cursor-pointer"
                  >
                    <span>Alumno</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] group-hover:border-[var(--color-primary)] font-bold text-[var(--color-primary)]">
                      {sortOrder === "asc" ? "A-Z ↓" : "Z-A ↑"}
                    </span>
                  </button>
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Contacto / Info</th>
                <th className="py-3 px-4 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Plan Activo</th>
                <th className="py-3 px-4 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Saldo</th>
                <th className="py-3 px-4 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Estado</th>
                <th className="py-3 px-4 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-xs text-[var(--color-text-secondary)]">
                    Cargando alumnos...
                  </td>
                </tr>
              ) : filteredStudents.length > 0 ? (
                filteredStudents.map((student) => {
                  const plan = (student.plan_activo || "").toLowerCase();
                  const isSinPlan = plan.includes("sin plan") || plan.includes("pendiente");
                  const isRegular = !isSinPlan && (plan.includes("regular") || student.plan_activo === "Clases Regulares" || (student.clases_restantes === null && !plan.includes("bono")));
                  const feeInfo = getStudentFee(student);

                  return (
                    <tr key={student.id} className="hover:bg-[var(--color-bg-hover)] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {student.nombre_completo.split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                          </div>
                          <div>
                             <span className="font-bold text-[var(--color-text-title)] text-xs block">{student.nombre_completo}</span>
                             <span className="text-[10px] text-amber-400 font-mono font-medium flex items-center gap-1">
                               <span>🏷️</span>
                               <span>{student.nfc_token ? (student.nfc_token.startsWith('DF-') ? student.nfc_token : 'DF-' + student.nfc_token) : 'Sin Llavero NFC'}</span>
                             </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--color-text-secondary)]">
                        <div>{student.telefono}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{student.email || student.direccion}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--color-text-body)]">
                        {isRegular ? (
                          <span className="font-bold text-[var(--color-text-title)] text-xs block">
                            Clases Regulares ({feeInfo.cuotaBase}€/mes)
                          </span>
                        ) : isSinPlan ? (
                          <span className="text-amber-400 font-semibold text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 inline-block">
                            Sin Plan Activo
                          </span>
                        ) : (
                          <span className="font-semibold text-[var(--color-text-title)] text-xs block">
                            {student.plan_activo}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isSinPlan ? (
                          <span className="text-slate-400 font-semibold text-xs bg-slate-500/10 px-2 py-0.5 rounded-full border border-slate-500/20">
                            0 clases
                          </span>
                        ) : isRegular ? (
                          <span className="text-[var(--color-primary)] font-semibold text-xs bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-full border border-[var(--color-primary)]/20">
                            Mensualidad
                          </span>
                        ) : (
                          <div>
                            <span className={`font-semibold text-xs ${student.clases_restantes === 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-title)]'}`}>
                              {student.clases_restantes} clases
                            </span>
                            {student.bono_caducidad && (
                              <span className="text-[10px] text-slate-400 font-mono block mt-0.5" title={`Caducidad: ${student.bono_caducidad}`}>
                                Exp: {new Date(student.bono_caducidad).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full border ${student.estado === 'Activo' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20' : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20'}`}>
                          {student.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button 
                            onClick={() => handleOpenHistory(student)}
                            className="flex items-center gap-1 text-[var(--color-secondary)] hover:brightness-110 transition-all text-xs font-semibold bg-[var(--color-secondary)]/10 px-2 py-1 rounded-lg border border-[var(--color-secondary)]/20"
                            title="Ver histórico de asistencias"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Histórico
                          </button>
                          <button
                            onClick={() => openGlobalCobro(student)}
                            className="text-emerald-400 hover:text-emerald-300 transition-colors p-1"
                            title={`Cobrar mensualidad o bono a ${student.nombre_completo}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleOpenEdit(student)}
                            className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors p-1"
                            title="Editar alumno"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleDeleteStudent(student.id)}
                            className="text-[var(--color-danger)] hover:opacity-80 transition-colors p-1"
                            title="Eliminar alumno"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 px-6 text-center text-[var(--color-text-secondary)]">
                    No se encontraron alumnos con esos datos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ficha e Histórico Integral del Alumno (Bonos, Cobros, Reservas y Asistencias) */}
      {isHistoryOpen && historyStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-3xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header del Alumno */}
            <div className="flex justify-between items-start pb-4 border-b border-[var(--color-border)] mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] flex items-center justify-center text-white font-extrabold text-base shadow-lg shadow-[var(--color-primary)]/25">
                  {historyStudent.nombre_completo.split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-[family-name:var(--font-heading)] text-white tracking-wide">
                      {historyStudent.nombre_completo}
                    </h3>
                    <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                      historyStudent.estado === 'Activo' 
                        ? 'bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/30' 
                        : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)] border-[var(--color-danger)]/30'
                    }`}>
                      {historyStudent.estado}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 flex items-center gap-2">
                    <span>DNI: <strong className="text-slate-300 font-mono">{historyStudent.dni || "Sin DNI"}</strong></span>
                    <span>•</span>
                    <span>Plan: <strong className="text-white">{historyStudent.plan_activo || "Sin Plan"}</strong></span>
                    <span>•</span>
                    <span>Saldo: <strong className="text-amber-400 font-mono">{typeof historyStudent.clases_restantes === "number" ? `${historyStudent.clases_restantes} clases` : "Mensualidad"}</strong></span>
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsHistoryOpen(false)} 
                className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Selector de Pestañas del Historial */}
            <div className="flex bg-[var(--color-bg)] p-1 rounded-xl border border-[var(--color-border)] mb-4 shrink-0 gap-1">
              <button
                onClick={() => setHistoryTab("pagos")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                  historyTab === "pagos"
                    ? "bg-[var(--color-secondary)] text-slate-950 shadow-md font-extrabold"
                    : "text-[var(--color-text-secondary)] hover:text-white"
                }`}
              >
                <span>🎟️</span>
                <span>Histórico de Bonos y Cobros ({historyPayments.length})</span>
              </button>

              <button
                onClick={() => setHistoryTab("reservas")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                  historyTab === "reservas"
                    ? "bg-amber-400 text-slate-950 shadow-md font-extrabold"
                    : "text-[var(--color-text-secondary)] hover:text-white"
                }`}
              >
                <span>📅</span>
                <span>Reservas en Calendario ({historyReservas.length})</span>
              </button>

              <button
                onClick={() => setHistoryTab("asistencias")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                  historyTab === "asistencias"
                    ? "bg-[var(--color-primary)] text-white shadow-md font-extrabold"
                    : "text-[var(--color-text-secondary)] hover:text-white"
                }`}
              >
                <span>🕒</span>
                <span>Asistencias Físicas ({historyRecords.length})</span>
              </button>

              <button
                onClick={() => setHistoryTab("ficha")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                  historyTab === "ficha"
                    ? "bg-slate-700 text-white shadow-md font-extrabold"
                    : "text-[var(--color-text-secondary)] hover:text-white"
                }`}
              >
                <span>👤</span>
                <span>Ficha y Alta</span>
              </button>
            </div>

            {/* Contenido de la Pestaña Seleccionada */}
            <div className="flex-1 overflow-y-auto pr-1">
              {historyLoading ? (
                <div className="p-12 text-center text-xs text-[var(--color-text-secondary)]">
                  Cargando información del alumno...
                </div>
              ) : historyTab === "pagos" ? (
                /* PESTAÑA 1: HISTÓRICO DE BONOS Y COBROS */
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Registro de Cuotas, Bonos y Transacciones
                    </span>
                    <button
                      onClick={() => {
                        setIsHistoryOpen(false);
                        openGlobalCobro(historyStudent);
                      }}
                      className="text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1 rounded-lg border border-emerald-500/30 transition-all flex items-center gap-1"
                    >
                      + Cobrar Nuevo Bono / Cuota
                    </button>
                  </div>

                  {historyPayments.length === 0 ? (
                    <div className="p-8 text-center bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] space-y-2">
                      <p>No se han registrado pagos o compras de bonos aún para este alumno.</p>
                      <button
                        onClick={() => {
                          setIsHistoryOpen(false);
                          openGlobalCobro(historyStudent);
                        }}
                        className="text-xs font-bold text-emerald-400 hover:underline"
                      >
                        Emitir primer cobro en recepción
                      </button>
                    </div>
                  ) : (
                    historyPayments.map((pago) => (
                      <div 
                        key={pago.id} 
                        className="p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex justify-between items-center text-xs hover:border-[var(--color-secondary)]/40 transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm block">{pago.concepto}</span>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                              {pago.numero_recibo}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--color-text-secondary)]">
                            Método: <strong className="text-slate-300">{pago.metodo_pago}</strong> • Sede: {pago.sede === "tejar" ? "Studio 1" : "Studio 2"} • Atendido por: <span className="text-slate-400">{pago.atendido_por}</span>
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-base font-extrabold text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-3 py-1 rounded-lg border border-[var(--color-secondary)]/30 block">
                            {pago.importe.toFixed(2)} €
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block mt-1">
                            {pago.fecha_corta} {pago.hora_corta || ""}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : historyTab === "reservas" ? (
                /* PESTAÑA 2: RESERVAS DE OPEN CLASS EN CALENDARIO */
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Sesiones de Open Class Reservadas por Calendario
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      Total: {historyReservas.length} reservas
                    </span>
                  </div>

                  {historyReservas.length === 0 ? (
                    <div className="p-8 text-center bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
                      El alumno no tiene reservas de sesiones en el calendario actualmente.
                    </div>
                  ) : (
                    historyReservas.map((reserva: any) => (
                      <div 
                        key={reserva.id}
                        className="p-3.5 rounded-xl bg-[var(--color-bg)] border border-amber-500/30 flex justify-between items-center text-xs hover:border-amber-400/60 transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{reserva.nombre_clase}</span>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                              ✓ {reserva.estado || "Confirmada"}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--color-text-secondary)]">
                            Profesor/a: <strong className="text-white">{reserva.profesor}</strong> • Sede: {reserva.sede === "tejar" ? "Studio 1 (El Tejar)" : "Studio 2 (Paseo Castilla)"}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/25 block">
                            📅 {reserva.fecha_formateada || reserva.fecha_iso}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block mt-1">
                            ⏰ {reserva.hora_inicio}h - {reserva.hora_fin || "20:00"}h
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : historyTab === "asistencias" ? (
                /* PESTAÑA 3: ASISTENCIAS FÍSICAS REGISTRADAS */
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Fichajes Presenciales en Mostrador y Tornos
                    </span>
                    <span className="text-xs font-mono font-bold text-[var(--color-success)]">
                      Total: {historyRecords.length} asistencias
                    </span>
                  </div>

                  {historyRecords.length === 0 ? (
                    <div className="p-8 text-center bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
                      No hay asistencias presenciales registradas aún para este alumno.
                    </div>
                  ) : (
                    historyRecords.map((item) => {
                      const dateObj = new Date(item.fecha_hora);
                      const fechaFormatted = dateObj.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
                      const horaFormatted = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                      return (
                        <div key={item.id} className="p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex justify-between items-center text-xs hover:border-[var(--color-primary)]/40 transition-all">
                          <div>
                            <span className="font-bold text-[var(--color-text-title)] text-sm block">
                              {item.clases_cuadrante?.nombre_clase || "Clase Presencial"}
                            </span>
                            <span className="text-[var(--color-text-secondary)] mt-0.5 block">
                              Profesor/a: <strong className="text-white">{item.clases_cuadrante?.profesor || "Dance Factory"}</strong> • Sede: {item.clases_cuadrante?.sede?.toUpperCase() || "STUDIO 1"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-xs font-bold text-[var(--color-success)] bg-[var(--color-success)]/10 px-2.5 py-1 rounded-md border border-[var(--color-success)]/20 block">
                              {fechaFormatted}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-secondary)] font-mono block mt-1">
                              Hora: {horaFormatted}h
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* PESTAÑA 4: FICHA DE ALTA Y DATOS COMPLETOS */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fecha de Alta en el Sistema</span>
                      <strong className="text-white font-mono text-sm block">
                        {historyStudent.created_at ? new Date(historyStudent.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }) : "Temporada 2026-2027"}
                      </strong>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sede Principal</span>
                      <strong className="text-white text-sm block">
                        {historyStudent.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"}
                      </strong>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Teléfono de Contacto</span>
                      <strong className="text-white font-mono text-sm block">{historyStudent.telefono || "Sin registrar"}</strong>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Correo Electrónico</span>
                      <strong className="text-white text-sm block truncate">{historyStudent.email || "Sin registrar"}</strong>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DNI / NIE</span>
                      <strong className="text-white font-mono text-sm block">{historyStudent.dni || "Sin DNI"}</strong>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Código Carnet NFC</span>
                      <strong className="text-[var(--color-secondary)] font-mono text-sm block">
                        {historyStudent.nfc_token ? `DF-${historyStudent.nfc_token}` : "DF-AUTO"}
                      </strong>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] col-span-2 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dirección Domicilio</span>
                      <strong className="text-white text-sm block">{historyStudent.direccion || "Sin dirección registrada"}</strong>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] col-span-2 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cuenta Bancaria IBAN (Remesas SEPA)</span>
                      <strong className="text-emerald-400 font-mono text-sm block">{historyStudent.iban || "ES91 **** **** **** **** 4821"}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div className="pt-4 border-t border-[var(--color-border)] flex justify-between items-center shrink-0 mt-4">
              <button
                onClick={() => {
                  setIsHistoryOpen(false);
                  handleOpenEdit(historyStudent);
                }}
                className="text-xs font-bold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <span>✏️ Editar Ficha del Alumno</span>
              </button>

              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-[var(--color-primary)]/20"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal Importar CSV */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)]">
                Importación Masiva de Alumnos
              </h3>
              <button onClick={() => setIsCsvModalOpen(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleProcessCsv} className="space-y-4">
              <p className="text-xs text-[var(--color-text-secondary)]">
                Selecciona un archivo CSV con el formato oficial (*Nombre Completo, Teléfono, Email, Sede, Plan*).
              </p>

              <div className="border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] rounded-xl p-6 text-center cursor-pointer bg-[var(--color-bg)]">
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-[var(--color-text-body)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-primary)] file:text-white hover:file:opacity-90"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
                <button 
                  type="button" 
                  onClick={() => setIsCsvModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)]"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={csvLoading || !csvFile}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {csvLoading ? "Importando..." : "Subir y Volcar a BDD"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nuevo/Editar Alumno */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 md:p-6 overflow-hidden">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header Fijo */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-card)] shrink-0">
              <h3 className="text-xl font-[family-name:var(--font-heading)] text-[var(--color-text-title)]">
                {isEditing ? "Editar Alumno" : "Registro de Nuevo Alumno"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Cuerpo del Formulario con Scroll Interno */}
            <form onSubmit={handleSaveStudent} className="p-6 space-y-6 overflow-y-auto flex-1">
              
              {/* Sección: Datos Personales */}
              <div>
                 <h4 className="text-xs font-bold text-[var(--color-primary)] mb-3 uppercase tracking-wider">Datos Personales</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Nombre y Apellidos *</label>
                     <input 
                       type="text" 
                       value={formData.nombre_completo}
                       onChange={(e) => setFormData({...formData, nombre_completo: e.target.value})}
                       className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)] transition-colors" 
                       required 
                     />
                   </div>
                   <div>
                     <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">DNI / NIF</label>
                     <input 
                       type="text" 
                       value={formData.dni}
                       onChange={(e) => setFormData({...formData, dni: e.target.value})}
                       className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)] transition-colors" 
                     />
                   </div>
                   <div>
                     <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Número de Tarjeta / Llavero NFC</label>
                     <input 
                       type="text" 
                       value={formData.nfc_token}
                       onChange={(e) => setFormData({...formData, nfc_token: e.target.value})}
                       placeholder="Ej. 3918"
                       className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)] font-mono transition-colors" 
                     />
                   </div>
                   <div>
                     <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Fecha de Nacimiento</label>
                     <input 
                       type="date" 
                       value={formData.fecha_nacimiento}
                       onChange={(e) => setFormData({...formData, fecha_nacimiento: e.target.value})}
                       className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)] transition-colors" 
                     />
                   </div>
                   <div className="md:col-span-2">
                     <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Dirección Postal</label>
                     <input 
                       type="text" 
                       value={formData.direccion}
                       onChange={(e) => setFormData({...formData, direccion: e.target.value})}
                       className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)] transition-colors" 
                     />
                   </div>
                 </div>
              </div>

                             {/* Selector Explícito: Adulto vs Infantil */}
               <div className="bg-[var(--color-bg)] border border-[var(--color-border)] p-3.5 rounded-2xl">
                 <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                   Tipo de Alumno (Cálculo Automático de Tarifas) *
                 </label>
                 <div className="grid grid-cols-2 gap-3">
                   <button
                     type="button"
                     onClick={() => handleTipoAlumnoChange("adulto")}
                     className={`p-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-between cursor-pointer ${
                       formData.tipo_alumno === "adulto"
                         ? "bg-purple-500/20 text-purple-300 border-purple-500 shadow-md ring-2 ring-purple-500/30"
                         : "bg-[var(--color-bg-card)] text-slate-400 border-[var(--color-border)] hover:border-slate-600"
                     }`}
                   >
                     <div className="flex items-center gap-2">
                       <span className="text-base">👤</span>
                       <div className="text-left">
                         <span className="block font-black text-white">Adulto (+14 años)</span>
                         <span className="text-[10px] text-slate-400 font-normal">1h: 30€ • 1.5h: 37€ • 2h: 45€</span>
                       </div>
                     </div>
                     {formData.tipo_alumno === "adulto" && <CheckCircle2 size={16} className="text-purple-400" />}
                   </button>

                   <button
                     type="button"
                     onClick={() => handleTipoAlumnoChange("infantil")}
                     className={`p-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-between cursor-pointer ${
                       formData.tipo_alumno === "infantil"
                         ? "bg-cyan-500/20 text-cyan-300 border-cyan-500 shadow-md ring-2 ring-cyan-500/30"
                         : "bg-[var(--color-bg-card)] text-slate-400 border-[var(--color-border)] hover:border-slate-600"
                     }`}
                   >
                     <div className="flex items-center gap-2">
                       <span className="text-base">🧒</span>
                       <div className="text-left">
                         <span className="block font-black text-white">Infantil (hasta 14 años)</span>
                         <span className="text-[10px] text-slate-400 font-normal">1h: 27€ • 1.5h: 35€ • 2h: 41€</span>
                       </div>
                     </div>
                     {formData.tipo_alumno === "infantil" && <CheckCircle2 size={16} className="text-cyan-400" />}
                   </button>
                 </div>
               </div>

               {/* Sección: Contacto */}
              <div className="border-t border-[var(--color-border)] pt-4">
                 <h4 className="text-xs font-bold text-[var(--color-primary)] mb-3 uppercase tracking-wider">Contacto y Tarifa</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Teléfono *</label>
                      <input 
                        type="tel" 
                        value={formData.telefono}
                        onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)] transition-colors" 
                        required 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Email</label>
                      <input 
                        type="email" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)] transition-colors" 
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-[var(--color-text-secondary)]">
                          Cuota Mensual (€/mes) *
                        </label>
                        {formData.clases_asignadas.length > 0 && (
                          <span className="text-[10px] font-bold text-emerald-400">
                            ⚡ Sugerido por clases
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input 
                          type="number"
                          step="1"
                          min="0"
                          value={formData.cuota_mensual || ""}
                          onChange={(e) => handleCuotaChange(parseFloat(e.target.value) || 0)}
                          placeholder="Ej. 41"
                          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-emerald-400 text-sm font-extrabold font-mono rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)] transition-colors pr-14"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono pointer-events-none">
                          €/mes
                        </span>
                      </div>
                      
                      {/* Presets rápidos */}
                      <div className="flex gap-1 flex-wrap mt-2">
                        {[25, 27, 30, 35, 37, 41, 45, 50].map((tarifa) => (
                          <button
                            key={tarifa}
                            type="button"
                            onClick={() => handleCuotaChange(tarifa)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                              formData.cuota_mensual === tarifa
                                ? "bg-emerald-500 text-slate-950 shadow-sm"
                                : "bg-[var(--color-bg)] text-slate-400 hover:text-white border border-[var(--color-border)]"
                            }`}
                          >
                            {tarifa}€
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-[var(--color-text-secondary)]">Plan / Tarifa Activa</label>
                        {formData.clases_asignadas.length > 0 && (
                          <span className="text-[10px] font-bold text-emerald-400">
                            ⚡ Auto-calculado ({formData.clases_asignadas.length} {formData.clases_asignadas.length === 1 ? "clase" : "clases"})
                          </span>
                        )}
                      </div>
                      <input 
                        type="text"
                        value={formData.plan_activo}
                        onChange={(e) => setFormData({...formData, plan_activo: e.target.value})}
                        placeholder="Ej. Clases Regulares (41€/mes)"
                        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs font-bold font-mono rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Estado</label>
                      <select 
                        value={formData.estado}
                        onChange={(e) => setFormData({...formData, estado: e.target.value})}
                        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)] transition-colors"
                      >
                        <option value="Activo">Activo</option>
                        <option value="Inactivo">Inactivo</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Sede Principal *</label>
                      <select 
                        value={formData.sede}
                        onChange={(e) => setFormData({...formData, sede: e.target.value})}
                        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)] transition-colors"
                      >
                        <option value="tejar">Studio 1 Plaza El Tejar</option>
                        <option value="castilla">Studio 2 Paseo Castilla</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Cuenta Bancaria / IBAN (para Domiciliación SEPA)</label>
                      <input 
                        type="text" 
                        value={formData.iban}
                        onChange={(e) => setFormData({...formData, iban: e.target.value.toUpperCase()})}
                        placeholder="ES91 2100 0418 4502 0005 1332"
                        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-body)] text-sm font-mono rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)] transition-colors" 
                      />
                    </div>
                 </div>
              </div>

              {/* Sección: Credenciales de Acceso App Alumnos */}
              <div className="border-t border-[var(--color-border)] pt-4">
                 <h4 className="text-xs font-bold text-[var(--color-primary)] mb-2 uppercase tracking-wider">Acceso a la App de Alumnos</h4>
                 <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                   <div className="text-xs space-y-1">
                     <p className="text-white font-semibold flex items-center gap-1.5">
                       <span>🔑 Usuario:</span>
                       <strong className="font-mono text-[var(--color-secondary)]">{formData.email || "fran.sarciat@gmail.com"}</strong>
                     </p>
                     <p className="text-[var(--color-text-secondary)] flex items-center gap-1.5">
                       <span>🔒 Contraseña generada por Recepción:</span>
                       <strong className="font-mono text-white bg-white/10 px-2 py-0.5 rounded">1234</strong>
                     </p>
                   </div>
                   <button
                     type="button"
                     onClick={() => {
                       logActivity({
                         origen: "recepcion",
                         tipo_evento: "email_credenciales",
                         descripcion: `Envío de credenciales de acceso por correo a ${formData.nombre_completo || "alumno"}`,
                         usuario_afectado: formData.nombre_completo || "Alumno",
                         sede: formData.sede === "tejar" ? "Studio 1 Plaza El Tejar" : "Studio 2 Paseo Castilla"
                       });

                       setAppModal({
                         isOpen: true,
                         title: "Credenciales Enviadas",
                         message: `Email de credenciales enviado a ${formData.email || "fran.sarciat@gmail.com"}:\n\nEstimado/a ${formData.nombre_completo || "alumno"},\n\n¡Bienvenido/a a Dance Factory!\n\nTus credenciales para entrar a tu App de Alumnos (Carnet Digital & QR) son:\n\n• Usuario (Email): ${formData.email || "fran.sarciat@gmail.com"}\n• Contraseña: 1234\n\nPuedes iniciar sesión en la app desde tu smartphone.`,
                         type: "email",
                         confirmText: "Genial"
                       });
                     }}
                     className="px-3.5 py-2 rounded-lg bg-[var(--color-secondary)]/15 border border-[var(--color-secondary)]/30 text-[var(--color-secondary)] hover:bg-[var(--color-secondary)] hover:text-white transition-all text-xs font-bold shrink-0 flex items-center gap-1.5 active:scale-95"
                   >
                     ✉️ Enviar Credenciales por Email
                   </button>
                 </div>
              </div>

              {/* Sección: Asignación a Cursos */}
              <div className="border-t border-[var(--color-border)] pt-4">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                   <div>
                     <h4 className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">Inscripción en Cursos / Clases</h4>
                     <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Clases matriculadas para este alumno en el cuadrante oficial:</p>
                   </div>
                   <span className="text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2.5 py-0.5 rounded-full border border-[var(--color-primary)]/20 shrink-0">
                     {formData.clases_asignadas.length} {formData.clases_asignadas.length === 1 ? 'clase asignada' : 'clases asignadas'}
                   </span>
                 </div>

                 {/* Selector de Estudio / Sede dentro del modal */}
                 <div className="flex items-center gap-2 mb-3 bg-[var(--color-bg)] p-1.5 rounded-xl border border-[var(--color-border)] w-fit">
                   <button
                     type="button"
                     onClick={() => setModalSedeFilter("all")}
                     className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                       modalSedeFilter === "all"
                         ? "bg-[var(--color-primary)] text-white shadow-sm"
                         : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)]"
                     }`}
                   >
                     Ambas Sedes ({availableClasses.length})
                   </button>
                   <button
                     type="button"
                     onClick={() => setModalSedeFilter("tejar")}
                     className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                       modalSedeFilter === "tejar"
                         ? "bg-[var(--color-secondary)] text-white shadow-sm"
                         : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)]"
                     }`}
                   >
                     Estudio 1 - Plaza El Tejar
                   </button>
                   <button
                     type="button"
                     onClick={() => setModalSedeFilter("castilla")}
                     className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                       modalSedeFilter === "castilla"
                         ? "bg-[var(--color-accent)] text-white shadow-sm"
                         : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)]"
                     }`}
                   >
                     Estudio 2 - Paseo Castilla
                   </button>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-2">
                    {displayedModalClasses.map(clase => {
                       const isEnrolled = formData.clases_asignadas.includes(clase.id);
                       const isTejar = clase.sede === 'tejar';

                       return (
                         <label 
                           key={clase.id} 
                           className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                             isEnrolled 
                               ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 shadow-sm' 
                               : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]/50'
                           }`}
                         >
                            <input 
                              type="checkbox" 
                              checked={isEnrolled}
                              onChange={() => handleClassToggle(clase.id)}
                              className="accent-[var(--color-primary)] w-4 h-4 rounded shrink-0"
                            />
                            <div className="flex flex-col flex-1 min-w-0">
                               <div className="flex justify-between items-center gap-1">
                                 <span className="text-xs font-bold text-[var(--color-text-title)] truncate">{clase.nombre_clase}</span>
                                 <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                                   isTejar ? 'bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border border-[var(--color-secondary)]/20' : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20'
                                 }`}>
                                   {isTejar ? 'Estudio 1' : 'Estudio 2'}
                                 </span>
                               </div>
                               <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                                 {clase.dia_semana} {clase.hora_inicio}-{clase.hora_fin} • Prof: {clase.profesor}
                               </span>
                            </div>
                         </label>
                       );
                    })}
                 </div>
              </div>

              {/* Footer Fijo en la parte inferior */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-[var(--color-primary)]/20"
                >
                  {isEditing ? "Guardar Cambios" : "Guardar Alumno"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop-up Modal In-App Component */}
      <AppModal modal={appModal} onClose={() => setAppModal({ ...appModal, isOpen: false })} />
    </div>
  );
}

