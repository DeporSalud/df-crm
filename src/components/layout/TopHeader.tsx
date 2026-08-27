"use client";

import { useState, useEffect } from "react";
import { useSede } from "@/context/SedeContext";

export default function TopHeader({ 
  title, 
  subtitle 
}: { 
  title: string; 
  subtitle: string 
}) {
  const [isLightMode, setIsLightMode] = useState(false);
  const { activeSede, setActiveSede } = useSede();

  useEffect(() => {
    // Check initial state
    if (document.body.classList.contains("light-mode")) {
      setIsLightMode(true);
    }
  }, []);

  const toggleTheme = () => {
    if (isLightMode) {
      document.body.classList.remove("light-mode");
      setIsLightMode(false);
    } else {
      document.body.classList.add("light-mode");
      setIsLightMode(true);
    }
  };

  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3.5 mb-5 border-b border-[var(--color-border)] gap-3">
      <div>
        <h1 className="text-xl font-[family-name:var(--font-heading)] tracking-wide text-[var(--color-text-title)]">{title}</h1>
        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <div>
          <select 
            value={activeSede}
            onChange={(e) => setActiveSede(e.target.value as any)}
            className="bg-[var(--color-bg)] text-[var(--color-text-body)] border border-[var(--color-border)] rounded-xl px-3 py-1.5 text-xs font-medium outline-none focus:border-[var(--color-primary)] transition-colors cursor-pointer"
          >
            <option value="consolidado">Consolidado (Ambas sedes)</option>
            <option value="tejar">Studio 1 Plaza El Tejar</option>
            <option value="castilla">Studio 2 Paseo Castilla</option>
          </select>
        </div>
        
        <button 
          onClick={toggleTheme}
          className="p-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-title)] transition-colors"
          title={isLightMode ? "Cambiar a Modo Oscuro" : "Cambiar a Modo Claro"}
        >
          {isLightMode ? (
            // Moon icon for dark mode toggle
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
            </svg>
          ) : (
            // Sun icon for light mode toggle
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
