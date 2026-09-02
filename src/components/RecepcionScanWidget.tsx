'use client';

import { useState } from 'react';
import { useScannerBridge } from '@/hooks/useScannerBridge';
import { supabase } from '@/lib/supabase/client';
import { logActivity } from '@/lib/activityLogger';

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
  onCheckInSuccess?: () => void;
}

export default function RecepcionScanWidget({
  selectedClaseId,
  sedeName = 'Paseo Castilla',
  onCheckInSuccess
}: RecepcionScanWidgetProps) {
  const [lastScan, setLastScan] = useState<ScanResult>({
    status: 'idle',
    mensaje: 'Esperando lectura del lector OBZ RF-70 o código QR...',
    timestamp: ''
  });
  const [historialReciente, setHistorialReciente] = useState<ScanResult[]>([]);

  const procesarLecturaQR = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;

    const horaActual = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // 1. Limpieza y extracción del token (DF-STUDENT-XXXX, UUID, DNI o Token NFC)
    const normalized = trimmed.replace(/[':_]/g, '-').trim();
    const cleanToken = normalized
      .replace(/^DF-STUDENT-/i, '')
      .replace(/^DF-ALUMNO-/i, '')
      .replace(/^STUDENT-/i, '')
      .replace(/^ALUMNO-/i, '')
      .replace(/^DF-/i, '')
      .trim();
    const pureToken = trimmed.replace(/[^a-zA-Z0-9]/g, '').replace(/^(DFSTUDENT|DFALUMNO|STUDENT|ALUMNO|DF)/i, '').trim();

    const candidates = Array.from(new Set([
      cleanToken,
      pureToken,
      normalized,
      trimmed,
      `DF-${cleanToken}`,
      `DF-${pureToken}`
    ])).filter(Boolean);

    // 2. Consulta a Supabase en tabla alumnos de Dance Factory
    let alumno: any = null;
    for (const token of candidates) {
      // Búsqueda por nfc_token
      const { data: byNfc } = await supabase
        .from('alumnos')
        .select('*')
        .eq('nfc_token', token)
        .limit(1)
        .maybeSingle();
      if (byNfc) {
        alumno = byNfc;
        break;
      }

      // Búsqueda por DNI
      const { data: byDni } = await supabase
        .from('alumnos')
        .select('*')
        .ilike('dni', token)
        .limit(1)
        .maybeSingle();
      if (byDni) {
        alumno = byDni;
        break;
      }

      // Búsqueda por UUID id
      const { data: byId } = await supabase
        .from('alumnos')
        .select('*')
        .eq('id', token)
        .limit(1)
        .maybeSingle();
      if (byId) {
        alumno = byId;
        break;
      }
    }

    // Fallback con LIKE si no se encontró exacto
    if (!alumno && cleanToken && cleanToken.length >= 3) {
      const { data: byLike } = await supabase
        .from('alumnos')
        .select('*')
        .or(`nfc_token.ilike.%${cleanToken}%,dni.ilike.%${cleanToken}%,id.ilike.%${cleanToken}%`)
        .limit(1)
        .maybeSingle();
      if (byLike) alumno = byLike;
    }

    // Si no existe el alumno
    if (!alumno) {
      playFeedbackSound('error');
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

    // 3. Validación de estado (solo "Activo")
    if (alumno.estado !== 'Activo') {
      playFeedbackSound('error');
      const resultado: ScanResult = {
        status: 'error',
        nombre: alumno.nombre_completo,
        mensaje: `Acceso denegado: Alumno ${alumno.estado}`,
        detalle: `Plan: ${alumno.plan_activo || 'Sin plan activo'}`,
        timestamp: horaActual
      };
      setLastScan(resultado);
      setHistorialReciente((prev) => [resultado, ...prev.slice(0, 9)]);
      return;
    }

    // 4. Inserción de asistencia en tabla asistencias de Dance Factory
    const asistenciaPayload: { alumno_id: string; clase_id?: string; fecha_hora?: string } = {
      alumno_id: alumno.id,
      fecha_hora: new Date().toISOString()
    };
    if (selectedClaseId) {
      asistenciaPayload.clase_id = selectedClaseId;
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

    // 5. Check-in Exitoso
    playFeedbackSound('success');
    const planLower = (alumno.plan_activo || '').toLowerCase();
    const isRegular =
      planLower.includes('regular') ||
      planLower.includes('mensual') ||
      planLower.includes('ilimitad') ||
      alumno.clases_restantes === null;

    const saldoInfo = !isRegular
      ? `(Bono: ${alumno.clases_restantes ?? 0} clases de saldo)`
      : '(Cuota Regular Mensual)';

    logActivity({
      origen: 'recepcion',
      tipo_evento: 'checkin',
      descripcion: `Validación automática vía WebSocket Lector OBZ RF-70 (${saldoInfo})`,
      usuario_afectado: alumno.nombre_completo,
      sede: sedeName
    });

    const resultado: ScanResult = {
      status: 'success',
      nombre: alumno.nombre_completo,
      plan: `${alumno.plan_activo || 'Cuota Activa'} ${saldoInfo}`.trim(),
      mensaje: 'Entrada autorizada',
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
    </div>
  );
}
