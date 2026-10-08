'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { HardwareScannerDebouncer } from '@/lib/scannerDebounce';
import { playSawtoothAlarm, playSuccessChime } from '@/lib/soundUtils';

interface UseScannerBridgeOptions {
  onScan: (code: string) => void | Promise<void>;
  wsUrl?: string;
  debounceMs?: number;
}

export function useScannerBridge({ 
  onScan, 
  wsUrl = 'ws://localhost:8080',
  debounceMs = 2500
}: UseScannerBridgeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const onScanRef = useRef(onScan);
  const debouncerRef = useRef<HardwareScannerDebouncer>(new HardwareScannerDebouncer(debounceMs));

  // Mantenemos la referencia más reciente sin forzar reinicios del WebSocket
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Sonidos inmediatos generados vía Web Audio API canónicos
  const playFeedbackSound = useCallback((type: 'success' | 'error') => {
    if (type === 'success') {
      playSuccessChime();
    } else {
      playSawtoothAlarm();
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
              const debounceResult = debouncerRef.current.processScan(code.trim());
              if (debounceResult.accepted) {
                await onScanRef.current(code.trim());
              }
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
