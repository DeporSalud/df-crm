"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type SedeType = "consolidado" | "tejar" | "castilla";

interface SedeContextType {
  activeSede: SedeType;
  setActiveSede: (sede: SedeType) => void;
}

const SedeContext = createContext<SedeContextType | undefined>(undefined);

const STORAGE_KEY = "dance_factory_active_sede";
const LEGACY_STORAGE_KEY = "df_active_sede";

export function SedeProvider({ children }: { children: ReactNode }) {
  const [activeSede, setActiveSedeState] = useState<SedeType>("consolidado");

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = (localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)) as SedeType | null;
        if (saved && (saved === "consolidado" || saved === "tejar" || saved === "castilla")) {
          setActiveSedeState(saved);
        }
      }
    } catch (e) {
      console.warn("Failed to read active sede from localStorage:", e);
    }
  }, []);

  const setActiveSede = (sede: SedeType) => {
    setActiveSedeState(sede);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, sede);
        localStorage.setItem(LEGACY_STORAGE_KEY, sede);
        window.dispatchEvent(new CustomEvent("df_sede_changed", { detail: sede }));
      }
    } catch (e) {
      console.warn("Failed to save active sede to localStorage:", e);
    }
  };

  return (
    <SedeContext.Provider value={{ activeSede, setActiveSede }}>
      {children}
    </SedeContext.Provider>
  );
}

export function useSede() {
  const context = useContext(SedeContext);
  if (context === undefined) {
    throw new Error("useSede must be used within a SedeProvider");
  }
  return context;
}

