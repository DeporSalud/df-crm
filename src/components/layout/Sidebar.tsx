"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSede } from "@/context/SedeContext";
import { 
  Building2, 
  Sun, 
  Moon,
  ChevronLeft,
  ChevronRight,
  X,
  Lock
} from "lucide-react";

interface SidebarProps {
  onCloseMobile?: () => void;
  onLockSession?: () => void;
}

export default function Sidebar({ onCloseMobile, onLockSession }: SidebarProps) {
  const pathname = usePathname();
  const { activeSede, setActiveSede } = useSede();
  const [isLightMode, setIsLightMode] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("dance_factory_theme") || localStorage.getItem("df_theme");
      if (savedTheme === "light" || (typeof document !== "undefined" && document.body.classList.contains("light-mode"))) {
        setIsLightMode(true);
        if (typeof document !== "undefined") {
          document.body.classList.add("light-mode");
        }
      } else if (savedTheme === "dark") {
        setIsLightMode(false);
        if (typeof document !== "undefined") {
          document.body.classList.remove("light-mode");
        }
      }

      const savedCollapsed = localStorage.getItem("df_sidebar_collapsed");
      if (savedCollapsed !== null) {
        setIsCollapsed(savedCollapsed === "true");
      }
    } catch (e) {
      console.error("Error reading sidebar preferences:", e);
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("df_sidebar_collapsed", String(next));
      } catch (e) {}
      return next;
    });
  };

  const toggleTheme = () => {
    if (typeof document === "undefined") return;
    const nextLight = !isLightMode;
    setIsLightMode(nextLight);
    if (nextLight) {
      document.body.classList.add("light-mode");
      try {
        localStorage.setItem("dance_factory_theme", "light");
        localStorage.setItem("df_theme", "light");
      } catch (e) {}
    } else {
      document.body.classList.remove("light-mode");
      try {
        localStorage.setItem("dance_factory_theme", "dark");
        localStorage.setItem("df_theme", "dark");
      } catch (e) {}
    }
  };

  const cycleSede = () => {
    if (activeSede === "consolidado") setActiveSede("tejar");
    else if (activeSede === "tejar") setActiveSede("castilla");
    else setActiveSede("consolidado");
  };

  const handleLinkClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navItems = [
    { name: "Dashboard & Recepción", href: "/admin", exact: true, icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    )},
    { name: "Alumnos", href: "/admin/alumnos", exact: false, icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )},
    { name: "Pagos & Facturación", href: "/admin/pagos", exact: false, icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    )},
    { name: "Clases", href: "/admin/clases", exact: false, icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )},
    { name: "Ventajas y Bonos", href: "/admin/ventajas", exact: false, icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    )},
    { name: "Tarifas & Precios", href: "/admin/tarifas", exact: false, icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
      </svg>
    )},
    { name: "Analítica", href: "/admin/analytics", exact: false, icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )},
    { name: "Registro", href: "/admin/registro", exact: false, icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )}
  ];

  return (
    <aside className={`bg-[var(--color-bg-card)] border-r border-[var(--color-border)] flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out relative ${
      isCollapsed ? "w-20" : "w-72"
    }`}>
      
      {/* Collapse Toggle Button (Top Floating Pill - only on desktop) */}
      <button
        onClick={toggleCollapse}
        className="hidden md:flex absolute -right-3.5 top-7 z-20 w-7 h-7 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] hover:border-[var(--color-primary)] items-center justify-center shadow-lg transition-all cursor-pointer hover:scale-110"
        title={isCollapsed ? "Expandir Menú (Ver textos)" : "Plegar Menú (Solo iconos)"}
      >
        {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>

      {/* Brand Header */}
      <div className={`p-5 pb-3 flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
        <div className="flex items-center gap-3.5 min-w-0">
          <div 
            onClick={isCollapsed ? toggleCollapse : undefined}
            className={`w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white flex items-center justify-center font-[family-name:var(--font-heading)] text-xl shadow-lg shrink-0 ${
              isCollapsed ? "cursor-pointer hover:opacity-90" : ""
            }`}
            title={isCollapsed ? "DANCE FACTORY - Clic para desplegar" : undefined}
          >
            DF
          </div>
          {!isCollapsed && (
            <div className="min-w-0 animate-in fade-in duration-200">
              <div className="font-[family-name:var(--font-heading)] text-2xl tracking-wide text-[var(--color-text-title)] leading-none font-bold whitespace-nowrap">
                DANCE <span className="font-light">FACTORY</span>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Close Button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-2 rounded-xl text-[var(--color-text-secondary)] hover:text-[var(--color-text-title)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] transition-colors"
            title="Cerrar Menú"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Sede Selector & Theme */}
      <div className="px-3.5 py-2">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 p-2 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] shadow-inner">
            <button
              onClick={cycleSede}
              className="w-9 h-9 rounded-xl bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] flex items-center justify-center text-xs font-bold font-mono text-[var(--color-primary)] transition-all cursor-pointer"
              title={`Sede Activa: ${activeSede === "consolidado" ? "Consolidado" : activeSede === "tejar" ? "Studio 1 (Tejar)" : "Studio 2 (Castilla)"} • Clic para cambiar`}
            >
              {activeSede === "consolidado" ? "🏢" : activeSede === "tejar" ? "S1" : "S2"}
            </button>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--color-text-title)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
              title={isLightMode ? "Cambiar a Modo Oscuro" : "Cambiar a Modo Claro"}
            >
              {isLightMode ? <Moon size={14} className="text-amber-400" /> : <Sun size={14} className="text-amber-400" />}
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-2 shadow-inner animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs uppercase font-bold text-[var(--color-text-secondary)] tracking-wider">
              <span className="flex items-center gap-1.5 text-[var(--color-text-body)]">
                <Building2 size={14} className="text-[var(--color-primary)]" />
                Sede Activa
              </span>
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--color-text-title)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                title={isLightMode ? "Cambiar a Modo Oscuro" : "Cambiar a Modo Claro"}
              >
                {isLightMode ? <Moon size={15} className="text-amber-400" /> : <Sun size={15} className="text-amber-400" />}
              </button>
            </div>
            <select 
              value={activeSede}
              onChange={(e) => setActiveSede(e.target.value as any)}
              className="w-full bg-[var(--color-bg-card)] text-[var(--color-text-title)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[var(--color-primary)] transition-colors cursor-pointer"
            >
              <option value="consolidado">🏢 Consolidado (Ambas)</option>
              <option value="tejar">Studio 1 Plaza El Tejar</option>
              <option value="castilla">Studio 2 Paseo Castilla</option>
            </select>
          </div>
        )}
      </div>
      
      {/* Navigation Links */}
      <nav className={`flex-1 py-3 space-y-1.5 overflow-y-auto ${isCollapsed ? "px-2" : "px-4"}`}>
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link 
              key={item.href}
              href={item.href} 
              onClick={handleLinkClick}
              title={isCollapsed ? item.name : undefined}
              className={`flex items-center rounded-xl font-semibold transition-all relative group ${
                isCollapsed 
                  ? "justify-center p-3 text-sm" 
                  : "gap-3 px-4 py-3 text-sm"
              } ${
                isActive 
                  ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] border-l-4 border-[var(--color-primary)] font-bold shadow-sm" 
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-title)] border-l-4 border-transparent"
              }`}
            >
              {item.icon}
              {!isCollapsed && <span className="truncate">{item.name}</span>}

              {/* Floating Tooltip when Collapsed */}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-title)] text-xs font-bold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>
      
      {/* Profile & Security Footer */}
      <div className={`p-4 border-t border-[var(--color-border)] ${isCollapsed ? "flex justify-center" : ""}`}>
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div 
              className="w-9 h-9 rounded-full bg-[var(--color-bg-hover)] border border-[var(--color-border)] flex items-center justify-center font-bold text-xs text-[var(--color-text-title)] shrink-0"
              title="Enrique Zamorano - Director & Admin"
            >
              EZ
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 animate-in fade-in duration-200">
                <span className="text-sm font-bold text-[var(--color-text-title)] truncate">Enrique Zamorano</span>
                <span className="text-xs text-[var(--color-text-secondary)] truncate">Director & Admin</span>
              </div>
            )}
          </div>

          {!isCollapsed && onLockSession && (
            <button
              onClick={onLockSession}
              className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)] border border-transparent hover:border-[var(--color-border)] transition-colors"
              title="Bloquear / Cerrar Sesión Admin"
            >
              <Lock size={15} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
