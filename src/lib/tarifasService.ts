import { isPromoSeptiembreActive } from "./matriculaService";

export type TipoTarifa = "bono" | "regular_infantil" | "regular_adulto" | "matricula" | "otro";
export type PeriodicidadTarifa = "mensual" | "trimestral" | "anual" | "puntual";

export interface TarifaItem {
  id: string;
  tipo: TipoTarifa;
  nombre: string;
  descripcion: string;
  precio: number;
  periodicidad?: PeriodicidadTarifa;
  horas_semana?: number;
  clases_incluidas?: number;
  es_ilimitado?: boolean;
  activo: boolean;
}

export const TARIFAS_DEFAULT: TarifaItem[] = [
  // MATRÍCULAS Y APERTURA DE EXPEDIENTE
  {
    id: "matricula_general",
    tipo: "matricula",
    nombre: "Matrícula Anual / Apertura de Expediente",
    descripcion: "Cuota de inscripción obligatoria para reserva de plaza de temporada oficial Dance Factory",
    precio: 20.00,
    periodicidad: "anual",
    activo: true
  },
  {
    id: "matricula_bonos_anual",
    tipo: "matricula",
    nombre: "Matrícula Anual Alumnos de Bonos / Open Class",
    descripcion: "Cuota anual obligatoria de inscripción (15,00 €) abonada en la primera compra de bono de cada temporada",
    precio: 15.00,
    periodicidad: "anual",
    activo: true
  },
  {
    id: "matricula_promo",
    tipo: "matricula",
    nombre: "Matrícula Promocional (Apertura Gratuita)",
    descripcion: "Promoción especial de temporada: inscripción a coste 0€",
    precio: 0.00,
    periodicidad: "anual",
    activo: true
  },

  // BONOS Y PASES
  {
    id: "bono_4",
    tipo: "bono",
    nombre: "Bono 4 clases",
    descripcion: "Acceso a 4 clases en cualquier estudio",
    precio: 45.00,
    clases_incluidas: 4,
    periodicidad: "puntual",
    activo: true
  },
  {
    id: "bono_8",
    tipo: "bono",
    nombre: "Bono 8 clases",
    descripcion: "Acceso a 8 clases en cualquier estudio",
    precio: 57.00,
    clases_incluidas: 8,
    periodicidad: "puntual",
    activo: true
  },
  {
    id: "bono_10",
    tipo: "bono",
    nombre: "Bono 10 clases",
    descripcion: "Bono de 10 clases para toda la temporada",
    precio: 79.00,
    clases_incluidas: 10,
    periodicidad: "puntual",
    activo: true
  },
  {
    id: "mensualidad_ilimitada",
    tipo: "bono",
    nombre: "Mensualidad Ilimitada",
    descripcion: "Tarifa plana total sin límite de clases",
    precio: 100.00,
    es_ilimitado: true,
    periodicidad: "mensual",
    activo: true
  },
  {
    id: "clase_suelta",
    tipo: "bono",
    nombre: "Clase Suelta / Prueba",
    descripcion: "Acceso a una sola sesión",
    precio: 15.00,
    clases_incluidas: 1,
    periodicidad: "puntual",
    activo: true
  },

  // PROMO OPEN CLASS • SOLO SEPTIEMBRE 2026 (9 AL 30 DE SEPTIEMBRE)
  {
    id: "promo_sep_4_alumno",
    tipo: "bono",
    nombre: "Promo Septiembre • 4 Clases (Alumno DF)",
    descripcion: "Promo Septiembre exclusiva para Alumnos DF • Válido hasta 30 Sept • Matrícula Gratuita (0€)",
    precio: 25.00,
    clases_incluidas: 4,
    periodicidad: "puntual",
    activo: true
  },
  {
    id: "promo_sep_8_alumno",
    tipo: "bono",
    nombre: "Promo Septiembre • 8 Clases (Alumno DF)",
    descripcion: "Promo Septiembre exclusiva para Alumnos DF • Válido hasta 30 Sept • Matrícula Gratuita (0€)",
    precio: 35.00,
    clases_incluidas: 8,
    periodicidad: "puntual",
    activo: true
  },
  {
    id: "promo_sep_12_alumno",
    tipo: "bono",
    nombre: "Promo Septiembre • 12 Clases (Alumno DF)",
    descripcion: "Promo Septiembre exclusiva para Alumnos DF • Válido hasta 30 Sept • Matrícula Gratuita (0€)",
    precio: 45.00,
    clases_incluidas: 12,
    periodicidad: "puntual",
    activo: true
  },
  {
    id: "promo_sep_4_no_alumno",
    tipo: "bono",
    nombre: "Promo Septiembre • 4 Clases (No Alumno)",
    descripcion: "Promo Septiembre Bienvenida para No Alumnos • Válido hasta 30 Sept • Matrícula Gratuita (0€)",
    precio: 30.00,
    clases_incluidas: 4,
    periodicidad: "puntual",
    activo: true
  },
  {
    id: "promo_sep_8_no_alumno",
    tipo: "bono",
    nombre: "Promo Septiembre • 8 Clases (No Alumno)",
    descripcion: "Promo Septiembre Bienvenida para No Alumnos • Válido hasta 30 Sept • Matrícula Gratuita (0€)",
    precio: 42.00,
    clases_incluidas: 8,
    periodicidad: "puntual",
    activo: true
  },
  {
    id: "promo_sep_12_no_alumno",
    tipo: "bono",
    nombre: "Promo Septiembre • 12 Clases (No Alumno)",
    descripcion: "Promo Septiembre Bienvenida para No Alumnos • Válido hasta 30 Sept • Matrícula Gratuita (0€)",
    precio: 55.00,
    clases_incluidas: 12,
    periodicidad: "puntual",
    activo: true
  },

  // CLASES REGULARES INFANTIL (HASTA 14 AÑOS)
  {
    id: "reg_inf_antiguos_25",
    tipo: "regular_infantil",
    nombre: "1 hora / semana (Alumnos Antiguos)",
    descripcion: "Tarifa reducida especial de 25€/mes para alumnos antiguos de Comercial Baby (Martes Lucía Zamorano y Jueves Paula)",
    precio: 25.00,
    horas_semana: 1,
    periodicidad: "mensual",
    activo: true
  },
  {
    id: "reg_inf_1h",
    tipo: "regular_infantil",
    nombre: "1 hora / semana (Infantil)",
    descripcion: "Niños y jóvenes hasta 14 años (1 clase de 1h semanal)",
    precio: 27.00,
    horas_semana: 1,
    periodicidad: "mensual",
    activo: true
  },
  {
    id: "reg_inf_1_5h",
    tipo: "regular_infantil",
    nombre: "1 hora y media / semana (Infantil)",
    descripcion: "Niños y jóvenes hasta 14 años (1 clase de 1.5h semanal)",
    precio: 35.00,
    horas_semana: 1.5,
    periodicidad: "mensual",
    activo: true
  },
  {
    id: "reg_inf_2h",
    tipo: "regular_infantil",
    nombre: "2 horas / semana (Infantil)",
    descripcion: "Niños y jóvenes hasta 14 años (2 clases semanales)",
    precio: 41.00,
    horas_semana: 2,
    periodicidad: "mensual",
    activo: true
  },
  {
    id: "reg_inf_3h",
    tipo: "regular_infantil",
    nombre: "3 horas / semana (Infantil)",
    descripcion: "Niños y jóvenes hasta 14 años (3 clases semanales)",
    precio: 55.00,
    horas_semana: 3,
    periodicidad: "mensual",
    activo: true
  },
  {
    id: "reg_inf_4h",
    tipo: "regular_infantil",
    nombre: "4+ horas / semana (Infantil)",
    descripcion: "Tarifa intensiva infantil",
    precio: 70.00,
    horas_semana: 4,
    periodicidad: "mensual",
    activo: true
  },

  // CLASES REGULARES ADULTO (+14 AÑOS)
  {
    id: "reg_adu_1h",
    tipo: "regular_adulto",
    nombre: "1 hora / semana (Adultos)",
    descripcion: "Alumnos adultos (+14 años) (1 clase de 1h semanal)",
    precio: 30.00,
    horas_semana: 1,
    periodicidad: "mensual",
    activo: true
  },
  {
    id: "reg_adu_1_5h",
    tipo: "regular_adulto",
    nombre: "1 hora y media / semana (Adultos)",
    descripcion: "Alumnos adultos (+14 años) (1 clase de 1.5h semanal)",
    precio: 37.00,
    horas_semana: 1.5,
    periodicidad: "mensual",
    activo: true
  },
  {
    id: "reg_adu_2h",
    tipo: "regular_adulto",
    nombre: "2 horas / semana (Adultos)",
    descripcion: "Alumnos adultos (+14 años) (2 clases semanales)",
    precio: 45.00,
    horas_semana: 2,
    periodicidad: "mensual",
    activo: true
  },
  {
    id: "reg_adu_3h",
    tipo: "regular_adulto",
    nombre: "3 horas / semana (Adultos)",
    descripcion: "Alumnos adultos (+14 años) (3 clases semanales)",
    precio: 60.00,
    horas_semana: 3,
    periodicidad: "mensual",
    activo: true
  },
  {
    id: "reg_adu_4h",
    tipo: "regular_adulto",
    nombre: "4+ horas / semana (Adultos)",
    descripcion: "Tarifa intensiva adultos",
    precio: 80.00,
    horas_semana: 4,
    periodicidad: "mensual",
    activo: true
  }
];

const STORAGE_KEY = "df_tarifas_precios_v1";

export function getTarifas(): TarifaItem[] {
  if (typeof window === "undefined") return TARIFAS_DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(TARIFAS_DEFAULT));
      return TARIFAS_DEFAULT;
    }
    const parsed: TarifaItem[] = JSON.parse(raw);
    // Ensure all items have proper fields
    const formatted = parsed.map(item => ({
      ...item,
      precio: typeof item.precio === "number" && !isNaN(item.precio) ? item.precio : 0,
      periodicidad: item.periodicidad || (item.tipo === "matricula" ? "anual" : item.tipo === "bono" ? "puntual" : "mensual")
    }));

    const promoActive = isPromoSeptiembreActive();

    // Sincronizar automáticamente cualquier tarifa oficial nueva de TARIFAS_DEFAULT que no esté en localStorage
    const missingDefaults = TARIFAS_DEFAULT.filter(def => !formatted.some(p => p.id === def.id));
    const finalTarifas = missingDefaults.length > 0 ? [...formatted, ...missingDefaults] : formatted;
    
    // Desactivar automáticamente si la promo de septiembre ya no está activa
    const synced = finalTarifas.map(t => {
      if (t.id.startsWith("promo_sep_")) {
        return { ...t, activo: promoActive && t.activo };
      }
      return t;
    });

    if (missingDefaults.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
    }

    return synced;
  } catch (e) {
    const promoActive = isPromoSeptiembreActive();
    return TARIFAS_DEFAULT.map(t => t.id.startsWith("promo_sep_") ? { ...t, activo: promoActive } : t);
  }
}

export function saveTarifas(tarifas: TarifaItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tarifas));
    window.dispatchEvent(new Event("df_tarifas_updated"));
  } catch (e) {
    console.error("Error saving tarifas:", e);
  }
}

export function resetTarifasDefault(): TarifaItem[] {
  saveTarifas(TARIFAS_DEFAULT);
  return TARIFAS_DEFAULT;
}

/**
 * Calculates fee based on weekly hours and age bracket (Niño <=14 años vs Adulto)
 */
export function calcularCuotaPorHoras(
  horasSemana: number, 
  tipoAlumno: "adulto" | "infantil" = "adulto",
  tarifasCustom?: TarifaItem[]
): number {
  const tarifas = tarifasCustom || getTarifas();
  const tipoFiltro: TipoTarifa = tipoAlumno === "infantil" ? "regular_infantil" : "regular_adulto";
  const lista = tarifas
    .filter(t => t.tipo === tipoFiltro && t.activo)
    .sort((a, b) => (a.horas_semana || 0) - (b.horas_semana || 0));

  if (horasSemana <= 0) return tipoAlumno === "infantil" ? 27.00 : 30.00;

  // Exact match
  const exact = lista.find(t => t.horas_semana === horasSemana);
  if (exact) return exact.precio;

  // 1 hour
  if (horasSemana <= 1.0) {
    const t = lista.find(item => item.horas_semana === 1);
    return t ? t.precio : (tipoAlumno === "infantil" ? 27.00 : 30.00);
  }

  // 1.5 hours
  if (horasSemana <= 1.5) {
    const t = lista.find(item => item.horas_semana === 1.5);
    return t ? t.precio : (tipoAlumno === "infantil" ? 35.00 : 37.00);
  }

  // 2 hours
  if (horasSemana <= 2.0) {
    const t = lista.find(item => item.horas_semana === 2);
    return t ? t.precio : (tipoAlumno === "infantil" ? 41.00 : 45.00);
  }

  // 3 hours
  if (horasSemana <= 3.0) {
    const t = lista.find(item => item.horas_semana === 3);
    return t ? t.precio : (tipoAlumno === "infantil" ? 55.00 : 60.00);
  }

  // 4+ hours
  const tMax = lista.find(item => (item.horas_semana || 0) >= 4);
  return tMax ? tMax.precio : (tipoAlumno === "infantil" ? 70.00 : 80.00);
}
