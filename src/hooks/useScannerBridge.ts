'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface UseScannerBridgeOptions {
  onScan: (code: string) => void | Promise<void>;
  wsUrl?: string;
}

export function useScannerBridge({ onScan, wsUrl = 'ws://localhost:8080' }: UseScannerBridgeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const onScanRef = useRef(onScan);

  // Mantenemos la referencia más reciente sin forzar reinicios del WebSocket
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Sonidos inmediatos generados vía Web Audio API (cero dependencias de archivos de audio)
  const playFeedbackSound = useCallback((type: 'success' | 'error') => {
    try {
      if (typeof window === 'undefined') return;
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        // Tono doble de confirmación rápido y armónico
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // La5
        osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // La6
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
      } else {
        // Tono grave disuasorio
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); // La3
        osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.22);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn('AudioContext no disponible o bloqueado por el navegador:', e);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let isDestroyed = false;

    const connect = () => {
      if (isDestroyed) return;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (!isDestroyed) {
            setIsConnected(true);
          }
        };

        ws.onclose = () => {
          if (!isDestroyed) {
            setIsConnected(false);
            reconnectTimeout = setTimeout(connect, 3000); // Reintento automático cada 3s
          }
        };

        ws.onerror = () => {
          // El cierre del socket disparará ws.onclose y programará el reintento
          try {
            ws?.close();
          } catch {}
        };

        ws.onmessage = async (event) => {
          try {
            let code = '';
            if (typeof event.data === 'string') {
              try {
                const parsed = JSON.parse(event.data);
                // Soporta tanto { type: 'SCANNER_READ', code: '...' } como { code: '...' } o { qr: '...' }
                code = parsed.code || parsed.qr || parsed.payload || (parsed.type === 'SCANNER_READ' ? parsed.data : '');
                if (!code && typeof parsed === 'string') {
                  code = parsed;
                }
              } catch {
                // Si el WebSocket envía directamente el string del código en texto plano
                code = event.data;
              }
            }

            if (code && typeof code === 'string' && code.trim()) {
              await onScanRef.current(code.trim());
            }
          } catch (err) {
            console.error('Error procesando lectura del escáner en WebSocket:', err);
          }
        };
      } catch {
        // En caso de que falle la inicialización inmediata (e.g. offline)
        if (!isDestroyed) {
          setIsConnected(false);
          reconnectTimeout = setTimeout(connect, 3000);
        }
      }
    };

    connect();

    return () => {
      isDestroyed = true;
      clearTimeout(reconnectTimeout);
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [wsUrl]);

  return { isConnected, playFeedbackSound };
}
