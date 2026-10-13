"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Camera, X, RefreshCw, AlertCircle, Scan, Sparkles } from "lucide-react";

export interface WebcamScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedCode: string) => void;
}

export default function WebcamScannerModal({
  isOpen,
  onClose,
  onScan
}: WebcamScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isScanningRef = useRef<boolean>(false);

  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSupportedBarcodeDetector, setIsSupportedBarcodeDetector] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [manualCode, setManualCode] = useState<string>("");

  // Detener la cámara y cancelar animación
  const stopCamera = useCallback(() => {
    isScanningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Iniciar la cámara web
  const startCamera = useCallback(async () => {
    stopCamera();
    setErrorMessage(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCameraAccess(false);
      setErrorMessage("La API de cámara (getUserMedia) no está disponible en este navegador o contexto.");
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setHasCameraAccess(true);
      isScanningRef.current = true;

      // Iniciar detección si BarcodeDetector está disponible
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        setIsSupportedBarcodeDetector(true);
        const BarcodeDetectorClass = (window as any).BarcodeDetector;
        const detector = new BarcodeDetectorClass({
          formats: ["qr_code", "ean_13", "code_128", "code_39"]
        });

        const scanFrame = async () => {
          if (!isScanningRef.current || !videoRef.current) return;

          if (videoRef.current.readyState >= 2) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const detected = barcodes[0].rawValue;
                if (detected && detected.trim()) {
                  isScanningRef.current = false;
                  stopCamera();
                  onScan(detected.trim());
                  onClose();
                  return;
                }
              }
            } catch (err) {
              // Frame dropped or not ready, continue
            }
          }

          animationFrameRef.current = requestAnimationFrame(scanFrame);
        };

        animationFrameRef.current = requestAnimationFrame(scanFrame);
      } else {
        setIsSupportedBarcodeDetector(false);
      }
    } catch (err: any) {
      console.warn("[WebcamScanner] Error accediendo a la cámara:", err);
      setHasCameraAccess(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMessage("Permiso denegado para acceder a la cámara. Por favor autoriza el acceso en el navegador.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setErrorMessage("No se encontró ninguna cámara conectada en este equipo.");
      } else {
        setErrorMessage(err.message || "No se pudo inicializar la cámara web.");
      }
    }
  }, [facingMode, onScan, onClose, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Tecla Escape para salir
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Cambiar entre cámara frontal y trasera
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Enviar código manual si la cámara no detecta o se prueba sin hardware
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    stopCamera();
    onScan(manualCode.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full bg-[var(--color-bg-card)] border-2 border-[var(--color-border)] rounded-3xl p-6 shadow-2xl space-y-5 relative text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Camera size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold font-[family-name:var(--font-heading)] text-white">
                Escáner por Cámara Web
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Mostrador de Recepción • Respaldo de Lectura QR
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Visor de Cámara */}
        <div className="relative aspect-video sm:aspect-square bg-black rounded-2xl overflow-hidden border border-purple-500/30 flex items-center justify-center group shadow-inner">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Máscara de enfoque y retícula de escaneo */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Esquinas del visor */}
            <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-purple-400/40 rounded-2xl">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-purple-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-purple-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-purple-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-purple-400 rounded-br-lg" />

              {/* Línea animada de escáner láser */}
              <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_12px_rgba(192,132,252,0.8)] animate-pulse" />
            </div>
          </div>

          {/* Mensajes de error o permisos */}
          {errorMessage && (
            <div className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center space-y-3 z-10">
              <AlertCircle size={40} className="text-amber-400" />
              <p className="text-sm font-semibold text-amber-200">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw size={14} /> Reintentar conexión de cámara
              </button>
            </div>
          )}

          {/* Botón flotante para alternar cámara frontal / trasera */}
          {hasCameraAccess && (
            <button
              type="button"
              onClick={handleToggleFacingMode}
              className="absolute bottom-3 right-3 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white/90 border border-white/20 transition-all shadow-lg cursor-pointer"
              title="Alternar cámara"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>

        {/* Guía contextual para la recepción */}
        <div className="text-center space-y-1">
          <p className="text-xs text-slate-300 font-medium">
            Muestra el código QR del carnet digital del alumno frente a la cámara.
          </p>
          <p className="text-[11px] text-[var(--color-text-secondary)] font-mono">
            {isSupportedBarcodeDetector
              ? "⚡ Detección automática por BarcodeDetector activada"
              : "📷 Sensor de cámara activo (enfoque en el centro del visor)"}
          </p>
        </div>

        {/* Fallback de entrada manual dentro del modal */}
        <form onSubmit={handleManualSubmit} className="pt-2 border-t border-[var(--color-border)] flex items-center gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="O escribe código QR / NFC manual..."
            className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs rounded-xl px-3 py-2.5 outline-none focus:border-purple-500 font-mono transition-all"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-xs font-bold transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
          >
            Validar
          </button>
        </form>
      </div>
    </div>
  );
}
