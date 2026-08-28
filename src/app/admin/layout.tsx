"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { SedeProvider, useSede } from "@/context/SedeContext";
import GlobalCobroModal from "@/components/GlobalCobroModal";
import { 
  Menu, 
  Lock, 
  ShieldCheck, 
  Sun, 
  Moon, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldAlert, 
  Timer, 
  AlertTriangle,
  Building2 
} from "lucide-react";
import { logActivity } from "@/lib/activityLogger";

interface StaffUser {
  name: string;
  role: string;
  username: string;
  password?: string;
}

const DEFAULT_ADMIN_USERS: StaffUser[] = [
  {
    name: "Enrique Zamorano",
    role: "Director & Master Admin",
    username: "Enrique Admin",
    password: "DF.26!!factory"
  },
  {
    name: "Recepción Studio 1",
    role: "Recepción El Tejar",
    username: "recepcion1",
    password: "DF.26!!factory"
  },
  {
    name: "Recepción Studio 2",
    role: "Recepción Castilla",
    username: "recepcion2",
    password: "DF.26!!factory"
  }
];

const STORAGE_SESSION_KEY = "df_admin_auth_user_v2";
const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 60;

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { activeSede, setActiveSede } = useSede();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  
  // Login Form States
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [authenticatedUser, setAuthenticatedUser] = useState<StaffUser | null>(null);

  // Security Lockout State
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

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

      // Check lockout in storage
      const rawLockout = localStorage.getItem("df_admin_lockout_until");
      if (rawLockout) {
        const lockoutUntil = parseInt(rawLockout, 10);
        const now = Date.now();
        if (now < lockoutUntil) {
          setLockoutRemaining(Math.ceil((lockoutUntil - now) / 1000));
        } else {
          localStorage.removeItem("df_admin_lockout_until");
        }
      }

      // Check session
      const sessionRaw = sessionStorage.getItem(STORAGE_SESSION_KEY) || localStorage.getItem(STORAGE_SESSION_KEY);
      if (sessionRaw) {
        const parsed = JSON.parse(sessionRaw);
        if (parsed && parsed.name) {
          setIsAuthenticated(true);
          setAuthenticatedUser(parsed);
        }
      }
    } catch (e) {
      console.warn("Session check error:", e);
    } finally {
      setIsCheckingSession(false);
    }
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining <= 0) return;

    const interval = setInterval(() => {
      setLockoutRemaining(prev => {
        if (prev <= 1) {
          localStorage.removeItem("df_admin_lockout_until");
          setAuthError("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  const normalizeStr = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0 || isSubmitting) return;

    setAuthError("");
    setIsSubmitting(true);

    const userClean = usernameInput.trim();
    const passClean = passwordInput.trim();

    // Check credentials for Enrique Admin
    const isEnriqueMatch = (
      normalizeStr(userClean) === normalizeStr("Enrique Admin") ||
      normalizeStr(userClean) === "enrique" ||
      normalizeStr(userClean) === "enrique admin" ||
      normalizeStr(userClean) === "admin" ||
      normalizeStr(userClean) === "admin@dancefactory.es" ||
      normalizeStr(userClean) === "director"
    ) && passClean === "DF.26!!factory";

    const isReception1Match = (
      normalizeStr(userClean) === "recepcion1" ||
      normalizeStr(userClean) === "recepcion tejar"
    ) && passClean === "DF.26!!factory";

    const isReception2Match = (
      normalizeStr(userClean) === "recepcion2" ||
      normalizeStr(userClean) === "recepcion castilla"
    ) && passClean === "DF.26!!factory";

    let matchedUser: StaffUser | null = null;
    if (isEnriqueMatch) {
      matchedUser = DEFAULT_ADMIN_USERS[0];
    } else if (isReception1Match) {
      matchedUser = DEFAULT_ADMIN_USERS[1];
    } else if (isReception2Match) {
      matchedUser = DEFAULT_ADMIN_USERS[2];
    }

    if (matchedUser) {
      // Success
      setIsAuthenticated(true);
      setAuthenticatedUser(matchedUser);
      setFailedAttempts(0);
      localStorage.removeItem("df_admin_lockout_until");

      const sessionData = {
        name: matchedUser.name,
        role: matchedUser.role,
        username: matchedUser.username,
        loginAt: new Date().toISOString()
      };

      try {
        if (rememberDevice) {
          localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionData));
        } else {
          sessionStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionData));
        }
      } catch (e) {}

      logActivity({
        origen: "recepcion",
        tipo_evento: "acceso_admin",
        descripcion: `Acceso autorizado al CRM de administración por ${matchedUser.name} (${matchedUser.role})`,
        usuario_afectado: matchedUser.name,
        sede: activeSede === "tejar" ? "Studio 1 Plaza El Tejar" : activeSede === "castilla" ? "Studio 2 Paseo Castilla" : "Consolidado"
      });
    } else {
      // Failure
      const newFails = failedAttempts + 1;
      setFailedAttempts(newFails);

      if (newFails >= MAX_ATTEMPTS) {
        const lockoutUntil = Date.now() + LOCKOUT_SECONDS * 1000;
        localStorage.setItem("df_admin_lockout_until", lockoutUntil.toString());
        setLockoutRemaining(LOCKOUT_SECONDS);
        setAuthError(`Límite de ${MAX_ATTEMPTS} intentos fallidos alcanzado. Acceso bloqueado temporalmente por seguridad.`);

        logActivity({
          origen: "recepcion",
          tipo_evento: "seguridad_bloqueo",
          descripcion: `🚨 BLOQUEO CRM: Demasiados intentos fallidos de acceso al panel de administración (usuario: ${userClean}). Bloqueado 60s.`,
          usuario_afectado: userClean || "Admin Desconocido",
          sede: "Consolidado"
        });
      } else {
        const remaining = MAX_ATTEMPTS - newFails;
        setAuthError(`Usuario o contraseña incorrectos. Te quedan ${remaining} intento(s) antes del bloqueo.`);
      }
    }

    setIsSubmitting(false);
  };

  const handleLockSession = () => {
    try {
      sessionStorage.removeItem(STORAGE_SESSION_KEY);
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch (e) {}
    setIsAuthenticated(false);
    setAuthenticatedUser(null);
    setUsernameInput("");
    setPasswordInput("");
    setAuthError("");
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
  // ADMIN USER + PASSWORD AUTH GUARD
  // ----------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-body)] flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Glow Effects */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-[var(--color-primary)]/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-[var(--color-accent)]/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-7 sm:p-9 w-full max-w-md shadow-2xl relative z-10 space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white flex items-center justify-center font-[family-name:var(--font-heading)] text-2xl mx-auto shadow-xl shadow-[var(--color-primary)]/25 mb-3 font-bold border border-white/10">
              DF
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[var(--color-primary)] text-xs font-bold uppercase tracking-wider">
              <ShieldCheck size={14} />
              <span>Panel de Dirección & Administración</span>
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl text-[var(--color-text-title)] tracking-wide pt-1">
              Acceso Restringido
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Introduce tus credenciales de administrador para acceder a la gestión de Dance Factory
            </p>
          </div>

          {/* LOCKOUT ALERT */}
          {lockoutRemaining > 0 ? (
            <div className="p-4 rounded-2xl bg-red-950/60 border-2 border-red-500/50 text-red-200 text-xs space-y-3 shadow-xl animate-in fade-in">
              <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-wider text-[11px]">
                <ShieldAlert size={18} className="animate-bounce" />
                <span>Bloqueo de Seguridad Activo</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Has alcanzado el límite de 3 intentos fallidos. El panel de administración ha sido bloqueado temporalmente.
              </p>
              <div className="bg-black/60 border border-red-500/30 rounded-xl p-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                  <Timer size={14} className="text-red-400" />
                  Tiempo de espera restante:
                </span>
                <span className="text-base font-mono font-black text-red-400 animate-pulse">
                  00:{lockoutRemaining.toString().padStart(2, '0')} s
                </span>
              </div>
            </div>
          ) : (
            <>
              {authError && (
                <div className="p-3.5 rounded-xl bg-[var(--color-danger)]/15 border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}
            </>
          )}

          {/* LOGIN FORM */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider block">
                Usuario Administrador
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  disabled={lockoutRemaining > 0 || isSubmitting}
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="ej. Enrique Admin"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs focus:outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-slate-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider block">
                Contraseña
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={lockoutRemaining > 0 || isSubmitting}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-white text-xs focus:outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-slate-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
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

            <button
              type="submit"
              disabled={lockoutRemaining > 0 || isSubmitting}
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-3.5 rounded-xl text-xs transition-all shadow-lg shadow-[var(--color-primary)]/25 flex items-center justify-center gap-2 group cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              <span>{isSubmitting ? "Verificando..." : "Acceder al Panel de Control"}</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          {/* Footer Note */}
          <div className="pt-3 border-t border-[var(--color-border)] text-center text-[10px] text-[var(--color-text-secondary)] flex items-center justify-center gap-1.5">
            <Building2 size={13} className="text-[var(--color-primary)]" />
            <span>Dance Factory Alcorcón & Móstoles • Portal de Dirección</span>
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
