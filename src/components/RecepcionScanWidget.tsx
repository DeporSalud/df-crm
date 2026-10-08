'use client';

import { useState, useRef, useEffect } from 'react';
import { useScannerBridge } from '@/hooks/useScannerBridge';
import { supabase } from '@/lib/supabase/client';
import { logActivity } from '@/lib/activityLogger';
import { useSede } from '@/context/SedeContext';
import AccessDeniedOverlay from '@/components/AccessDeniedOverlay';
import { HardwareScannerDebouncer } from '@/lib/scannerDebounce';
import { evaluateReceptionAccess, dispatchAccessDenied } from '@/lib/accessControlService';
import { 
  findStudentByCodeOrText, 
  resolveClassForCheckIn, 
  marcarAsistenciaPorAlumnoYSesion,
  formatSedeName
} from '@/lib/openClassService';

interface ScanResult {
  status: 'idle' | 'success' | 'error';
  nombre?: string;
  plan?: string;
  mensaje: string;
  detalle?: string;
  timestamp: string;
}

interface RecepcionScanWidgetProps {
  selectedClaseId?: string | null;
  sedeName?: string;
  activeSede?: 'consolidado' | 'tejar' | 'castilla';
  onCheckInSuccess?: () => void;
}

export default function RecepcionScanWidget({
  selectedClaseId,
  sedeName = 'Paseo Castilla',
  activeSede: propActiveSede,
  onCheckInSuccess
}: RecepcionScanWidgetProps) {
  // Read active branch safely from context or props
  let contextSede: 'consolidado' | 'tejar' | 'castilla' | undefined;
  try {
    const sedeCtx = useSede();
    contextSede = sedeCtx?.activeSede;
  } catch {}

  const effectiveSede = propActiveSede || contextSede || (sedeName.toLowerCase().includes('tejar') ? 'tejar' : 'castilla');

  const [lastScan, setLastScan] = useState<ScanResult>({
    status: 'idle',
    mensaje: 'Esperando lectura del lector OBZ RF-70 o código QR...',
    timestamp: ''
  });
  const [historialReciente, setHistorialReciente] = useState<ScanResult[]>([]);

  // Hardware Scanner Debouncer (>= 2.5s) (R1.3)
  const debouncerRef = useRef(new HardwareScannerDebouncer(2500));

  // Access Denied Overlay State (R1.2)
  const [accessDeniedState, setAccessDeniedState] = useState<{
    isOpen: boolean;
    studentName?: string;
    motivo?: string;
    rawCode?: string;
  }>({
    isOpen: false
  });

  // Multi-channel sync for df_checkin_denied
  useEffect(() => {
    const handleDenied = (e: any) => {
      const detail = e.detail || e;
      setAccessDeniedState({
        isOpen: true,
        studentName: detail.student?.nombre_completo || detail.studentName,
        motivo: detail.motivo || detail.message,
        rawCode: detail.rawCode
      });
    };

    window.addEventListener("df_checkin_denied" as any, handleDenied);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("dance_factory_sync");
      bc.onmessage = (evt) => {
        if (evt.data?.type === "df_checkin_denied") {
          handleDenied(evt.data);
        }
      };
    } catch {}

    return () => {
      window.removeEventListener("df_checkin_denied" as any, handleDenied);
      if (bc) bc.close();
    };
  }, []);

  const procesarLecturaQR = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;

    // 1. Hardware Debounce Protection (>= 2.5s)
    const debounceRes = debouncerRef.current.processScan(trimmed);
    if (!debounceRes.accepted) {
      return;
    }

    const horaActual = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // 2. Student Lookup across token NFC, QR, DNI, phone, email, full name
    const alumno = await findStudentByCodeOrText(trimmed);

    if (!alumno) {
      playFeedbackSound('error');
      setAccessDeniedState({
        isOpen: true,
        studentName: undefined,
        motivo: 'Código escaneado no reconocido o alumno inexistente',
        rawCode: trimmed
      });
      dispatchAccessDenied({
        reason: 'ALUMNO_NO_ENCONTRADO',
        message: '⛔ ACCESO DENEGADO: Código no reconocido o alumno inexistente. Pasar por mostrador de recepción',
        rawCode: trimmed
      });
      const resultado: ScanResult = {
        status: 'error',
        mensaje: 'Alumno no reconocido',
        detalle: `Código escaneado: ${rawCode}`,
        timestamp: horaActual
      };
      setLastScan(resultado);
      setHistorialReciente((prev) => [resultado, ...prev.slice(0, 9)]);
      return;
    }

    // 3. Canonical Access Evaluation via evaluateReceptionAccess (R1.1)
    const evalResult = evaluateReceptionAccess(alumno);

    if (!evalResult.granted) {
      playFeedbackSound('error');
      setAccessDeniedState({
        isOpen: true,
        studentName: alumno.nombre_completo,
        motivo: evalResult.motivoDetallado || evalResult.message,
        rawCode: trimmed
      });
      dispatchAccessDenied({
        student: alumno,
        reason: evalResult.reason,
        message: evalResult.message,
        rawCode: trimmed
      });

      const resultado: ScanResult = {
        status: 'error',
        nombre: alumno.nombre_completo,
        mensaje: evalResult.message,
        detalle: 'Debe pasar por el mostrador de recepción para regularizar su cuota o bono.',
        timestamp: horaActual
      };
      setLastScan(resultado);
      setHistorialReciente((prev) => [resultado, ...prev.slice(0, 9)]);

      logActivity({
        origen: 'recepcion',
        tipo_evento: 'checkin_denegado',
        descripcion: `Acceso denegado en recepción: ${alumno.nombre_completo} está ${evalResult.motivoDetallado || evalResult.reason}`,
        usuario_afectado: alumno.nombre_completo,
        sede: formatSedeName(effectiveSede)
      });
      return;
    }

    // 4. Intelligent Class Resolution via resolveClassForCheckIn (R1.4)
    const resolved = await resolveClassForCheckIn(alumno, effectiveSede, selectedClaseId);

    // 5. Inserción de asistencia en tabla asistencias de Dance Factory
    const asistenciaPayload: { alumno_id: string; clase_id?: string; fecha_hora: string } = {
      alumno_id: alumno.id,
      fecha_hora: new Date().toISOString()
    };
    if (resolved.claseId) {
      asistenciaPayload.clase_id = resolved.claseId;
    }

    const { error: errorAsistencia } = await supabase
      .from('asistencias')
      .insert([asistenciaPayload]);

    if (errorAsistencia) {
      playFeedbackSound('error');
      const resultado: ScanResult = {
        status: 'error',
        nombre: alumno.nombre_completo,
        mensaje: 'Error al registrar la asistencia en base de datos',
        timestamp: horaActual
      };
      setLastScan(resultado);
      return;
    }

    // 6. Sincronizar asistencia en Open Class si la clase resuelta es una Open Class
    if (resolved.isOpenClass && resolved.claseId) {
      try {
        const todayNow = new Date();
        const todayISO = `${todayNow.getFullYear()}-${String(todayNow.getMonth() + 1).padStart(2, '0')}-${String(todayNow.getDate()).padStart(2, '0')}`;
        marcarAsistenciaPorAlumnoYSesion(alumno.id, resolved.claseId, todayISO);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('df_reservas_updated'));
        }
      } catch (e) {
        console.warn('[RecepcionScanWidget] Error sincronizando asistencia open class:', e);
      }
    }

    // 7. Disparar evento global de checkin
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('df_checkin_success', {
        detail: { alumno, resolved }
      }));
    }

    // 8. Check-in Exitoso: Feedback Sonoro y Notificación Visual
    playFeedbackSound('success');
    const planLower = (alumno.plan_activo || '').toLowerCase().trim();
    const isRegular =
      planLower.includes('regular') ||
      planLower.includes('mensual') ||
      planLower.includes('ilimitad') ||
      alumno.clases_restantes === null;

    const saldoInfo = !isRegular
      ? `(Bono: ${alumno.clases_restantes ?? 0} clases de saldo)`
      : '(Cuota Regular Mensual)';

    const classDetailStr = resolved.claseNombre ? ` • ${resolved.claseNombre}` : '';

    logActivity({
      origen: 'recepcion',
      tipo_evento: 'checkin',
      descripcion: `Validación automática vía WebSocket Lector OBZ RF-70 (${saldoInfo}${classDetailStr})`,
      usuario_afectado: alumno.nombre_completo,
      sede: resolved.sede ? formatSedeName(resolved.sede) : formatSedeName(effectiveSede)
    });

    const resultado: ScanResult = {
      status: 'success',
      nombre: alumno.nombre_completo,
      plan: `${alumno.plan_activo || 'Cuota Activa'} ${saldoInfo}`.trim(),
      mensaje: resolved.claseNombre ? `Entrada autorizada: ${resolved.claseNombre}` : 'Entrada autorizada',
      detalle: resolved.profesor 
        ? `Prof: ${resolved.profesor} • ${formatSedeName(resolved.sede || effectiveSede)}`
        : resolved.claseNombre || 'Acceso general a instalaciones',
      timestamp: horaActual
    };

    setLastScan(resultado);
    setHistorialReciente((prev) => [resultado, ...prev.slice(0, 9)]);

    if (onCheckInSuccess) {
      onCheckInSuccess();
    }
  };

  const { isConnected, playFeedbackSound } = useScannerBridge({
    onScan: procesarLecturaQR
  });

  return (
    <div className="space-y-6">
      {/* Indicador de estado del escáner WebSocket */}
      <div className="flex items-center justify-between bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4 rounded-2xl shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3.5 w-3.5">
            {isConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                isConnected ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            ></span>
          </div>
          <div>
            <span className="text-sm font-bold text-white block">
              {isConnected
                ? 'Lector OBZ RF-70 Conectado en Tiempo Real'
                : 'Modo Teclado USB Activo (Esperando ws://localhost:8080)'}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {isConnected
                ? 'Las lecturas por QR o NFC se procesan instantáneamente sin foco de ratón'
                : 'Puedes usar el lector por emulación de teclado o activar el puente Node'}
            </span>
          </div>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">
          ws://localhost:8080
        </span>
      </div>

      {/* Banner reactivo con feedback visual verde / rojo */}
      <div
        className={`p-6 rounded-2xl border-2 transition-all duration-300 shadow-xl ${
          lastScan.status === 'success'
            ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-100 shadow-emerald-950/20'
            : lastScan.status === 'error'
            ? 'bg-red-950/40 border-red-500/60 text-red-100 shadow-red-950/20'
            : 'bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-secondary)]'
        }`}
      >
        {lastScan.status === 'idle' ? (
          <div className="text-center py-6 text-[var(--color-text-secondary)] font-mono text-sm">
            Acerca el carnet digital o código QR del alumno al lector OBZ RF-70...
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-bold">
                  {lastScan.status === 'success' ? '✅' : '⛔️'} {lastScan.mensaje}
                </span>
              </div>
              {lastScan.nombre && (
                <p className="text-2xl font-extrabold text-white tracking-tight font-[family-name:var(--font-heading)]">
                  {lastScan.nombre}
                </p>
              )}
              {(lastScan.plan || lastScan.detalle) && (
                <p className="text-sm mt-1 text-slate-300 font-medium">
                  {lastScan.plan || lastScan.detalle}
                </p>
              )}
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-black/40 text-slate-300 border border-white/10 font-bold">
              {lastScan.timestamp}
            </span>
          </div>
        )}
      </div>

      {/* Historial de últimos fichajes de la sesión */}
      {historialReciente.length > 0 && (
        <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-bg-card)] overflow-hidden shadow-lg">
          <div className="px-4 py-3 border-b border-[var(--color-border)] text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] flex justify-between items-center">
            <span>Últimos accesos registrados por lector</span>
            <span className="text-[10px] text-emerald-400 font-mono">En vivo</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {historialReciente.map((item, idx) => (
              <div key={idx} className="px-4 py-3 flex items-center justify-between text-sm hover:bg-[var(--color-bg-hover)] transition-colors">
                <div className="flex items-center gap-3">
                  <span className={item.status === 'success' ? 'text-emerald-400 text-lg' : 'text-red-400 text-lg'}>
                    {item.status === 'success' ? '●' : '✕'}
                  </span>
                  <div>
                    <span className="font-bold text-white block">{item.nombre || item.detalle}</span>
                    {item.plan && <span className="text-xs text-[var(--color-text-secondary)]">{item.plan}</span>}
                  </div>
                </div>
                <span className="text-xs font-mono text-[var(--color-text-secondary)]">{item.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pantalla Completa de Alerta Roja Parpadeante de Acceso Denegado (R1.2) */}
      <AccessDeniedOverlay
        isOpen={accessDeniedState.isOpen}
        studentName={accessDeniedState.studentName}
        motivo={accessDeniedState.motivo}
        rawCode={accessDeniedState.rawCode}
        onClose={() => setAccessDeniedState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
