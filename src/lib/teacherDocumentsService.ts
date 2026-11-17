import { supabase } from "@/lib/supabase/client";

export type TeacherDocCategory =
  | "nomina"
  | "contrato"
  | "dni_identidad"
  | "seguro_certificado"
  | "otro";

export interface TeacherDocumentMeta {
  id: string;
  profesor_uuid: string;
  profesor_pin: string | null;
  profesor_nombre: string;
  categoria: TeacherDocCategory;
  titulo: string;
  periodo_mes: string | null;
  nombre_archivo: string;
  mime_type: string;
  tamano_bytes: number;
  notas: string | null;
  subido_por: string | null;
  creado_en: string;
}

export interface UploadTeacherDocumentInput {
  profesorUuid: string;
  profesorPin?: string;
  profesorNombre: string;
  categoria: TeacherDocCategory;
  titulo: string;
  periodoMes?: string;
  file: File;
  notas?: string;
  subidoPor?: string;
}

export interface TeacherDocCountSummary {
  total: number;
  nominas: number;
}

export const TEACHER_DOC_CATEGORIES: {
  id: TeacherDocCategory;
  label: string;
  shortLabel: string;
}[] = [
  { id: "nomina", label: "Nómina Mensual", shortLabel: "Nómina" },
  { id: "contrato", label: "Contrato Laboral", shortLabel: "Contrato" },
  { id: "dni_identidad", label: "DNI / Identidad", shortLabel: "DNI / NIE" },
  { id: "seguro_certificado", label: "Seguro RC / Certificado", shortLabel: "Seguro / Cert." },
  { id: "otro", label: "Otro Documento", shortLabel: "Documento" },
];

const MONTHS_ES: Record<string, string> = {
  "01": "Enero",
  "02": "Febrero",
  "03": "Marzo",
  "04": "Abril",
  "05": "Mayo",
  "06": "Junio",
  "07": "Julio",
  "08": "Agosto",
  "09": "Septiembre",
  "10": "Octubre",
  "11": "Noviembre",
  "12": "Diciembre",
};

const META_COLUMNS =
  "id, profesor_uuid, profesor_pin, profesor_nombre, categoria, titulo, periodo_mes, nombre_archivo, mime_type, tamano_bytes, notas, subido_por, creado_en";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

export function getCurrentYearMonthISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatPeriodoMesSpanish(periodo?: string | null): string {
  if (!periodo) return "";
  const match = /^(\d{4})-(\d{2})$/.exec(periodo.trim());
  if (!match) return periodo;
  const [, year, month] = match;
  return `${MONTHS_ES[month] || month} ${year}`;
}

export function formatFileSize(bytes?: number | null): string {
  const b = Number(bytes || 0);
  if (b <= 0) return "PDF";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function getCategoryLabel(cat?: string | null): string {
  const found = TEACHER_DOC_CATEGORIES.find((c) => c.id === cat);
  return found ? found.shortLabel : "Documento";
}

export function getSuggestedDocTitle(
  categoria: TeacherDocCategory,
  periodoMes?: string | null
): string {
  const mesLabel = formatPeriodoMesSpanish(periodoMes);
  switch (categoria) {
    case "nomina":
      return mesLabel ? `Nómina ${mesLabel}` : "Nómina Mensual";
    case "contrato":
      return mesLabel ? `Contrato Laboral (${mesLabel})` : "Contrato Laboral";
    case "dni_identidad":
      return "DNI / Documento de Identidad";
    case "seguro_certificado":
      return "Seguro / Certificado Oficial";
    default:
      return mesLabel ? `Documento (${mesLabel})` : "Documento Docente";
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("No se pudo leer el contenido del archivo."));
      }
    };
    reader.onerror = () => reject(new Error("Error leyendo el archivo seleccionado."));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl: string, fallbackMime = "application/pdf"): Blob {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) {
    return new Blob([dataUrl], { type: fallbackMime });
  }
  const header = dataUrl.slice(0, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1);
  const mimeMatch = /data:([^;]+);base64/i.exec(header);
  const mime = mimeMatch ? mimeMatch[1] : fallbackMime;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function sortTeacherDocuments(docs: TeacherDocumentMeta[]): TeacherDocumentMeta[] {
  return [...docs].sort((a, b) => {
    const perA = a.periodo_mes || "";
    const perB = b.periodo_mes || "";
    if (perA !== perB) {
      return perB.localeCompare(perA);
    }
    return (b.creado_en || "").localeCompare(a.creado_en || "");
  });
}

export async function fetchTeacherDocuments(params: {
  uuid?: string | null;
  pin?: string | null;
  name?: string | null;
}): Promise<TeacherDocumentMeta[]> {
  const cleanUuid = (params.uuid || "").trim();
  const cleanPin = (params.pin || "").trim();
  const cleanName = (params.name || "").trim().toUpperCase();

  try {
    const queries: PromiseLike<{ data: any[] | null; error: any }>[] = [];

    if (cleanUuid) {
      queries.push(
        supabase
          .from("documentos_profesores")
          .select(META_COLUMNS)
          .eq("profesor_uuid", cleanUuid)
      );
    }
    if (cleanPin) {
      queries.push(
        supabase
          .from("documentos_profesores")
          .select(META_COLUMNS)
          .eq("profesor_pin", cleanPin)
      );
    }
    if (!cleanUuid && !cleanPin && cleanName) {
      queries.push(
        supabase
          .from("documentos_profesores")
          .select(META_COLUMNS)
          .ilike("profesor_nombre", cleanName)
      );
    }

    if (queries.length === 0) return [];

    const results = await Promise.all(queries);
    const byId = new Map<string, TeacherDocumentMeta>();
    for (const res of results) {
      if (!res.error && Array.isArray(res.data)) {
        for (const row of res.data) {
          if (row && row.id) {
            byId.set(row.id, row as TeacherDocumentMeta);
          }
        }
      }
    }
    return sortTeacherDocuments(Array.from(byId.values()));
  } catch (err) {
    console.error("[TeacherDocs] Error cargando documentos:", err);
    return [];
  }
}

export async function fetchAllTeacherDocumentCounts(): Promise<{
  byUuid: Record<string, TeacherDocCountSummary>;
  byPin: Record<string, TeacherDocCountSummary>;
  totalDocs: number;
}> {
  const byUuid: Record<string, TeacherDocCountSummary> = {};
  const byPin: Record<string, TeacherDocCountSummary> = {};

  try {
    const { data, error } = await supabase
      .from("documentos_profesores")
      .select("id, profesor_uuid, profesor_pin, categoria");

    if (error || !Array.isArray(data)) {
      return { byUuid, byPin, totalDocs: 0 };
    }

    for (const row of data) {
      const isNomina = row.categoria === "nomina";
      if (row.profesor_uuid) {
        const prev = byUuid[row.profesor_uuid] || { total: 0, nominas: 0 };
        byUuid[row.profesor_uuid] = {
          total: prev.total + 1,
          nominas: prev.nominas + (isNomina ? 1 : 0),
        };
      }
      if (row.profesor_pin) {
        const prev = byPin[row.profesor_pin] || { total: 0, nominas: 0 };
        byPin[row.profesor_pin] = {
          total: prev.total + 1,
          nominas: prev.nominas + (isNomina ? 1 : 0),
        };
      }
    }

    return { byUuid, byPin, totalDocs: data.length };
  } catch {
    return { byUuid, byPin, totalDocs: 0 };
  }
}

export async function uploadTeacherDocument(
  input: UploadTeacherDocumentInput
): Promise<{ success: boolean; doc?: TeacherDocumentMeta; error?: string }> {
  if (!input.file) {
    return { success: false, error: "Selecciona un archivo PDF o imagen para subir." };
  }
  if (input.file.size > MAX_FILE_BYTES) {
    return {
      success: false,
      error: "El archivo supera el tamaño máximo permitido (8 MB). Comprime el PDF e inténtalo de nuevo.",
    };
  }

  const ext = (input.file.name.split(".").pop() || "").toLowerCase();
  const allowedExts = ["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"];
  if (!allowedExts.includes(ext) && !input.file.type.startsWith("application/pdf") && !input.file.type.startsWith("image/")) {
    return {
      success: false,
      error: "Formato no soportado. Sube un archivo PDF, imagen (JPG/PNG) o documento.",
    };
  }

  try {
    const dataUrl = await readFileAsDataUrl(input.file);
    const cleanTitle =
      input.titulo.trim() || getSuggestedDocTitle(input.categoria, input.periodoMes);

    const payload = {
      profesor_uuid: input.profesorUuid.trim(),
      profesor_pin: input.profesorPin?.trim() || null,
      profesor_nombre: input.profesorNombre.trim().toUpperCase(),
      categoria: input.categoria,
      titulo: cleanTitle,
      periodo_mes: input.periodoMes?.trim() || null,
      nombre_archivo: input.file.name,
      mime_type: input.file.type || (ext === "pdf" ? "application/pdf" : "application/octet-stream"),
      tamano_bytes: input.file.size,
      archivo_data: dataUrl,
      notas: input.notas?.trim() || null,
      subido_por: input.subidoPor?.trim() || "Administración",
    };

    const { data, error } = await supabase
      .from("documentos_profesores")
      .insert([payload])
      .select(META_COLUMNS)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message || "No se pudo guardar el documento en la base de datos.",
      };
    }

    return { success: true, doc: data as TeacherDocumentMeta };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error inesperado al subir el documento.",
    };
  }
}

export async function openOrDownloadTeacherDocument(
  docId: string,
  mode: "view" | "download"
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("documentos_profesores")
      .select("id, archivo_data, nombre_archivo, mime_type")
      .eq("id", docId)
      .single();

    if (error || !data || !data.archivo_data) {
      return {
        success: false,
        error: "No se pudo recuperar el archivo del documento.",
      };
    }

    const blob = dataUrlToBlob(data.archivo_data, data.mime_type || "application/pdf");
    const blobUrl = URL.createObjectURL(blob);

    if (mode === "view") {
      const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        const link = document.createElement("a");
        link.href = blobUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } else {
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = data.nombre_archivo || "documento-profesor.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60_000);

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error al abrir o descargar el documento.",
    };
  }
}

export async function deleteTeacherDocument(
  docId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("documentos_profesores")
      .delete()
      .eq("id", docId);

    if (error) {
      return { success: false, error: error.message || "No se pudo eliminar el documento." };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error inesperado eliminando el documento." };
  }
}
