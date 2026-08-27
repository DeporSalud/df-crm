"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { SedeProvider, useSede } from "@/context/SedeContext";
import GlobalCobroModal from "@/components/GlobalCobroModal";
import { Menu, Lock, ShieldCheck, Sun, Moon, Building2, KeyRound } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";

const DEFAULT_ADMIN_PINS: Record<string, { name: string; role: string }> = {
  "9999": { name: "Enrique Zamorano", role: "Director & Master Admin" },
  "1234": { name: "Recepción Studio 1", role: "Recepción El Tejar" },
  "5678": { name: "Recepción Studio 2", role: "Recepción Castilla" }
};

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { activeSede, setActiveSede } = useSede();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<{ name: string; role: string } | null>(null);

  // Mobile drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  // Check saved session on mount
  useEffect(() => {
    try {
      // Sync theme
      const savedTheme = localStorage.getItem("dance_factory_theme") || localStorage.getItem("df_theme");
      if (savedTheme === "light" || (typeof document !== "undefined" && document.body.classList.contains("light-mode"))) {
        setIsLightMode(true);
      }

      // Check session
      const sessionPin = sessionStorage.getItem("df_admin_session") || localStorage.getItem("df_admin_session");
      if (sessionPin) {
        const user = validatePinValue(sessionPin);
        if (user) {
          setIsAuthenticated(true);
          setAuthenticatedUser(user);
        }
      }
    } catch (e) {
      console.warn("Session check error:", e);
    } finally {
      setIsCheckingSession(false);
    }
  }, []);

  const getKnownStaff = (): Record<string, { name: string; role: string }> => {
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("df_staff_users");
        if (raw) {
          const list = JSON.parse(raw);
          const map: Record<string, { name: string; role: string }> = { ...DEFAULT_ADMIN_PINS };
          list.forEach((u: any) => {
            if (u.pin && u.estado !== "inactivo") {
              map[u.pin] = {
                name: u.nombre_completo || u.nombre,
                role: u.rol === "director" ? "Director & Admin" : u.rol === "recepcion" ? "Recepción" : "Profesor"
              };
            }
          });
          return map;
        }
      }
    } catch (e) {}
    return DEFAULT_ADMIN_PINS;
  };

  const validatePinValue = (pin: string): { name: string; role: string } | null => {
    const known = getKnownStaff();
    return known[pin] || null;
  };

  const handleKeyClick = (digit: string) => {
    if (pinInput.length >= 4) return;
    setPinError("");
    const next = pinInput + digit;
    setPinInput(next);

    if (next.length === 4) {
      submitPin(next);
    }
  };

  const handleDelete = () => {
    setPinError("");
    setPinInput(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPinError("");
    setPinInput("");
  };

  const submitPin = (pin: string) => {
    const user = validatePinValue(pin);
    if (user) {
      setIsAuthenticated(true);
      setAuthenticatedUser(user);
      setPinError("");
      setPinInput("");

      try {
        if (rememberDevice) {
          localStorage.setItem("df_admin_session", pin);
        } else {
          sessionStorage.setItem("df_admin_session", pin);
        }
      } catch (e) {}

      logActivity({
        origen: "recepcion",
        tipo_evento: "acceso_admin",
        descripcion: `Acceso autorizado al portal de administración por ${user.name} (${user.role})`,
        usuario_afectado: user.name,
        sede: activeSede === "tejar" ? "Studio 1 Plaza El Tejar" : activeSede === "castilla" ? "Studio 2 Paseo Castilla" : "Consolidado"
      });
    } else {
      setPinError("Código PIN no autorizado. Revisa tus credenciales.");
      setTimeout(() => {
        setPinInput("");
      }, 700);
    }
  };

  const handleLockSession = () => {
    try {
      sessionStorage.removeItem("df_admin_session");
      localStorage.removeItem("df_admin_session");
    } catch (e) {}
    setIsAuthenticated(false);
    setAuthenticatedUser(null);
    setPinInput("");
    setPinError("");
    setIsMobileDrawerOpen(false);
  };

  const toggleTheme = () => {
    if (typeof document === "undefined") return;
    const next = !isLightMode;
    setIsLightMode(next);
    if (next) {
      document.body.classList.add("light-mode");
      try {
        localStorage.setItem("dance_factory_theme", "light");
      } catch (e) {}
    } else {
      document.body.classList.remove("light-mode");
      try {
        localStorage.setItem("dance_factory_theme", "dark");
      } catch (e) {}
    }
  };

  // Loading state while checking session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // ----------------------------------------------------
  // ADMIN PIN AUTH GUARD (PANTALLA DE ACCESO PROTEGIDO)
  // ----------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-body)] flex items-center justify-center p-4">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl relative overflow-hidden text-center">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-[var(--color-primary)]/15 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white flex items-center justify-center font-[family-name:var(--font-heading)] text-2xl mx-auto shadow-lg mb-3">
              DF
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs font-bold mb-2">
              <ShieldCheck size={14} />
              Área de Administración
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-text-title)] tracking-wide">
              Acceso Restringido
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Introduce tu código PIN de 4 dígitos para acceder al sistema
            </p>
          </div>

          {/* 4 Digit Indicators */}
          <div className="flex justify-center gap-4 mb-5">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pinInput.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    pinError
                      ? "border-[var(--color-danger)] bg-[var(--color-danger)]/20 animate-shake"
                      : isFilled
                      ? "bg-[var(--color-primary)] border-[var(--color-primary)] scale-110 shadow-lg shadow-[var(--color-primary)]/50"
                      : "border-[var(--color-border)] bg-transparent"
                  }`}
                />
              );
            })}
          </div>

          {pinError && (
            <div className="mb-4 text-xs font-semibold text-[var(--color-danger)] animate-pulse">
              {pinError}
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto mb-4">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyClick(num)}
                className="w-16 h-16 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-title)] text-2xl font-bold font-mono flex items-center justify-center hover:bg-[var(--color-primary)] hover:text-white hover:border-[var(--color-primary)] active:scale-95 transition-all shadow-md mx-auto touch-manipulation select-none"
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              className="w-16 h-16 rounded-2xl bg-transparent text-[var(--color-text-secondary)] text-[11px] font-bold uppercase tracking-wider flex items-center justify-center hover:text-[var(--color-text-title)] active:scale-95 transition-all mx-auto select-none"
            >
              Borrar
            </button>

            <button
              type="button"
              onClick={() => handleKeyClick("0")}
              className="w-16 h-16 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-title)] text-2xl font-bold font-mono flex items-center justify-center hover:bg-[var(--color-primary)] hover:text-white hover:border-[var(--color-primary)] active:scale-95 transition-all shadow-md mx-auto touch-manipulation select-none"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="w-16 h-16 rounded-2xl bg-transparent text-[var(--color-text-secondary)] flex items-center justify-center hover:text-[var(--color-text-title)] active:scale-95 transition-all mx-auto select-none"
              title="Borrar último número"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58-4.92-2.674 2.87a1.5 1.5 0 0 0 0 2.1l2.674 2.87A1.5 1.5 0 0 0 10.605 18h7.645a1.5 1.5 0 0 0 1.5-1.5V7.5a1.5 1.5 0 0 0-1.5-1.5h-7.645a1.5 1.5 0 0 0-1.07.45Z" />
              </svg>
            </button>
          </div>

          {/* Remember option */}
          <div className="flex items-center justify-center gap-2 mb-4 pt-2">
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-primary)] focus:ring-0 cursor-pointer"
              />
              <span>Recordar sesión en este equipo</span>
            </label>
          </div>

          <div className="pt-3 border-t border-[var(--color-border)] text-center text-[10px] text-[var(--color-text-secondary)]">
            <span>Dance Factory Móstoles & Alcorcón • Sistema de Gestión</span>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN ADMIN DASHBOARD LAYOUT (AUTHENTICATED)
  // ----------------------------------------------------
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Mobile Backdrop Drawer */}
      {isMobileDrawerOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileDrawerOpen(false)}
        />
      )}

      {/* Responsive Slide-over Sidebar Drawer */}
      <div className={`fixed inset-y-0 left-0 z-50 transform ${
        isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
      } md:relative md:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <Sidebar 
          onCloseMobile={() => setIsMobileDrawerOpen(false)} 
          onLockSession={handleLockSession} 
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Mobile Topbar */}
        <div className="md:hidden flex items-center justify-between p-3.5 bg-[var(--color-bg-card)] border-b border-[var(--color-border)] shrink-0 z-30">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="p-2 rounded-xl bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] border border-[var(--color-border)] active:scale-95 transition-transform"
              title="Abrir Menú de Navegación"
            >
              <Menu size={20} />
            </button>
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white flex items-center justify-center font-[family-name:var(--font-heading)] text-sm shadow-md font-bold">
                DF
              </div>
              <span className="font-bold text-[var(--color-text-title)] font-[family-name:var(--font-heading)] text-base tracking-wide">
                DANCE FACTORY
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-[var(--color-bg)] text-[var(--color-primary)] border border-[var(--color-border)] uppercase">
              {activeSede === "tejar" ? "S1 Tejar" : activeSede === "castilla" ? "S2 Castilla" : "Consolidado"}
            </span>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-[var(--color-bg)] text-amber-400 border border-[var(--color-border)]"
              title="Cambiar Tema"
            >
              {isLightMode ? <Moon size={15} /> : <Sun size={15} />}
            </button>

            <button
              onClick={handleLockSession}
              className="p-2 rounded-lg bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] border border-[var(--color-border)]"
              title="Bloquear Sesión"
            >
              <Lock size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable Page Container */}
        <main className="flex-1 overflow-y-auto bg-[var(--color-bg)] p-4 sm:p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      <GlobalCobroModal />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SedeProvider>
      <AdminLayoutInner>
        {children}
      </AdminLayoutInner>
    </SedeProvider>
  );
}
