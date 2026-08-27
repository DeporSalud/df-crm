import { supabase } from './supabase/client';

export type ActivityOrigin = 'recepcion' | 'profesor' | 'alumno';
export type ActivityType = 
  | 'checkin'
  | 'reserva_bono'
  | 'cobro_bono'
  | 'compra_bono'
  | 'solicitud_bono'
  | 'compra_bono_stripe'
  | 'inscripcion_clase'
  | 'alta_alumno'
  | 'baja_alumno'
  | 'edicion_alumno'
  | 'modificacion_perfil'
  | 'asistencia_profesor'
  | 'email_credenciales'
  | string;

export interface ActivityLogItem {
  id?: string;
  created_at?: string;
  origen: ActivityOrigin;
  tipo_evento: ActivityType;
  descripcion: string;
  usuario_afectado: string;
  detalles?: string;
  sede?: string;
}

export async function logActivity(item: ActivityLogItem) {
  try {
    const payload = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      created_at: new Date().toISOString(),
      origen: item.origen,
      tipo_evento: item.tipo_evento,
      descripcion: item.descripcion,
      usuario_afectado: item.usuario_afectado,
      detalles: item.detalles || "",
      sede: item.sede || "General"
    };

    // Save to local logs queue for instant sync
    saveToLocalLogs(payload);

    // Persist to Supabase asynchronously without blocking execution
    supabase.from("registros_actividad").insert([payload]).then(({ error }: any) => {
      if (error) {
        console.log("Registros actividad DB note:", error.message);
      }
    }, () => {});
  } catch (e) {
    console.warn("Activity logger silent catch:", e);
  }
}

function saveToLocalLogs(payload: any) {
  try {
    if (typeof window === "undefined") return;
    const logs = JSON.parse(localStorage.getItem("df_activity_logs") || "[]");
    // Prevent exact duplicates
    if (!logs.some((l: any) => l.id === payload.id)) {
      logs.unshift(payload);
      if (logs.length > 300) logs.length = 300;
      localStorage.setItem("df_activity_logs", JSON.stringify(logs));
      window.dispatchEvent(new Event("df_activity_updated"));
    }
  } catch (e) {
    // Silent catch
  }
}

export function getLocalLogs(): any[] {
  try {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem("df_activity_logs") || "[]");
  } catch (e) {
    return [];
  }
}
