export interface VentajaItem {
  id: string;
  categoria: "merch" | "bonos" | "salud" | "descuentos";
  titulo: string;
  badge: string;
  badgeColor?: string;
  precioAlumno: string;
  precioOriginal?: string;
  descuentoTexto?: string;
  descripcion: string;
  caracteristicas: string[];
  tallas?: string[];
  iconoTipo: "sudadera" | "camiseta" | "mochila" | "botella" | "bono" | "fisio" | "tienda";
  activo: boolean;
  creadoEn?: string;
}

export interface SolicitudVentaja {
  id: string;
  ventaja_id: string;
  ventaja_titulo: string;
  alumno_id: string;
  alumno_nombre: string;
  alumno_email?: string;
  alumno_telefono?: string;
  talla_elegida?: string;
  precio: string;
  fecha: string;
  estado: "Pendiente" | "Entregado" | "Cancelado";
  sede?: string;
}

export interface BonoAlumno {
  id: string;
  alumno_id?: string;
  alumno_nombre: string;
  alumno_dni?: string;
  alumno_telefono?: string;
  alumno_email?: string;
  tipo_bono: string;
  total_clases: number;
  clases_consumidas: number;
  clases_restantes: number;
  precio_pagado: number;
  fecha_compra: string; // YYYY-MM-DD
  fecha_caducidad: string; // YYYY-MM-DD
  estado: "Activo" | "Agotado" | "Caducado";
  sede: "tejar" | "castilla";
  notas?: string;
}

export const INITIAL_VENTAJAS: VentajaItem[] = [
  {
    id: "sudadera_df_black",
    categoria: "merch",
    titulo: "Sudadera Dance Factory (Oversize Black Edition)",
    badge: "OFERTA ALUMNOS",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    precioAlumno: "32,00 €",
    precioOriginal: "45,00 €",
    descuentoTexto: "-29% DTO",
    descripcion: "Sudadera con capucha de corte moderno oversize, tejido 100% algodón perchado de 340g con bordado frontal exclusivo y forro reforzado.",
    caracteristicas: ["Bordado frontal exclusivo Dance Factory", "Capucha con forro reforzado", "Unisex (S, M, L, XL)"],
    tallas: ["S", "M", "L", "XL"],
    iconoTipo: "sudadera",
    activo: true
  },
  {
    id: "camiseta_df_flow",
    categoria: "merch",
    titulo: "Camiseta Dance Factory 'Step & Flow'",
    badge: "EDICIÓN LIMITADA",
    badgeColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    precioAlumno: "16,00 €",
    precioOriginal: "25,00 €",
    descuentoTexto: "-36% DTO",
    descripcion: "Camiseta técnica y transpirable diseñada específicamente para entrenamientos de alta intensidad y clases de baile.",
    caracteristicas: ["Tejido ultra ligero y transpirable", "Diseño serigrafiado de máxima duración", "Ajuste cómodo loose-fit"],
    tallas: ["XS", "S", "M", "L", "XL"],
    iconoTipo: "camiseta",
    activo: true
  },
  {
    id: "mochila_df_duffel",
    categoria: "merch",
    titulo: "Bolsa Deportiva DF Pro Duffel (45L)",
    badge: "TOP VENTAS",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    precioAlumno: "24,00 €",
    precioOriginal: "38,00 €",
    descuentoTexto: "-37% DTO",
    descripcion: "Bolsa espaciosa de viaje y entrenamiento con compartimento lateral ventilado independiente para zapatillas de baile.",
    caracteristicas: ["Compartimento zapatero ventilado", "Bolsillo impermeable para ropa húmeda", "Correa acolchada ajustable"],
    iconoTipo: "mochila",
    activo: true
  },
  {
    id: "botella_df_inox",
    categoria: "merch",
    titulo: "Botella Térmica Inox DF (750 ml)",
    badge: "ECO LIFE",
    badgeColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    precioAlumno: "12,00 €",
    precioOriginal: "18,00 €",
    descuentoTexto: "-33% DTO",
    descripcion: "Botella de acero inoxidable de doble pared al vacío. Mantiene tus bebidas frías 24h o calientes 12h durante tus clases.",
    caracteristicas: ["Acero inoxidable 18/8 grado alimenticio", "Tapón a prueba de fugas", "Grabado láser Dance Factory"],
    iconoTipo: "botella",
    activo: true
  },
  {
    id: "bono_intensivo_master",
    categoria: "bonos",
    titulo: "Bono Especial Masterclasses & Intensivos (3 Sesiones)",
    badge: "PROMO ESPECIAL",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    precioAlumno: "45,00 €",
    precioOriginal: "65,00 €",
    descuentoTexto: "-31% DTO",
    descripcion: "Acceso preferente con descuento de alumno a 3 masterclasses o talleres intensivos de fin de semana con coreógrafos invitados.",
    caracteristicas: ["Válido durante toda la temporada", "Reserva prioritaria de plaza", "Acreditación y diploma de asistencia"],
    iconoTipo: "bono",
    activo: true
  },
  {
    id: "fisio_convenio",
    categoria: "salud",
    titulo: "Fisioterapia & Descarga Muscular para Bailarines",
    badge: "CONVENIO SALUD",
    badgeColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    precioAlumno: "35,00 €/sesión",
    precioOriginal: "50,00 €",
    descuentoTexto: "-30% DTO",
    descripcion: "Sesiones de fisioterapia deportiva, punción seca y terapia manual en la clínica colaboradora de Alcorcón.",
    caracteristicas: ["Especialistas en biomecánica de la danza", "Prevención y recuperación de sobrecargas", "Cita prioritaria para alumnos DF"],
    iconoTipo: "fisio",
    activo: true
  },
  {
    id: "calzado_descuento",
    categoria: "descuentos",
    titulo: "15% DTO en Calzado Urbano y Sneakers Dance",
    badge: "CÓDIGO EXCLUSIVO",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    precioAlumno: "Cupón 15%",
    precioOriginal: "",
    descuentoTexto: "15% DTO",
    descripcion: "Descuento directo en tienda física colaboradora de Alcorcón y en tienda online presentando tu carnet digital.",
    caracteristicas: ["Válido en marcas seleccionadas de calzado", "Canjeable mostrando el carnet QR en caja", "Código online: DANCEFACTORY15"],
    iconoTipo: "tienda",
    activo: true
  }
];

export const INITIAL_BONOS_ALUMNOS: BonoAlumno[] = [];

const STORAGE_KEY = "df_ventajas_catalog_v2";
const RESERVAS_KEY = "df_ventajas_reservas_v2";
const BONOS_KEY = "df_bonos_alumnos_v1";

export function getVentajasCatalog(): VentajaItem[] {
  if (typeof window === "undefined") return INITIAL_VENTAJAS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_VENTAJAS));
      return INITIAL_VENTAJAS;
    }
    const parsed = JSON.parse(raw);
    return parsed.map((i: any) => ({
      id: i.id || `ventaja_${Math.random()}`,
      categoria: i.categoria || "merch",
      titulo: i.titulo || i.title || "Artículo",
      badge: i.badge || "OFERTA",
      badgeColor: i.badgeColor || "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
      precioAlumno: i.precioAlumno || i.studentPrice || "0,00 €",
      precioOriginal: i.precioOriginal || i.originalPrice,
      descuentoTexto: i.descuentoTexto || i.discountBadge,
      descripcion: i.descripcion || i.description || "",
      caracteristicas: i.caracteristicas || i.details || [],
      tallas: i.tallas || i.sizes,
      iconoTipo: i.iconoTipo || i.iconType || "sudadera",
      activo: i.activo !== false,
      creadoEn: i.creadoEn || new Date().toISOString()
    }));
  } catch (e) {
    return INITIAL_VENTAJAS;
  }
}

export function saveVentajasCatalog(items: VentajaItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("df_ventajas_updated"));
  } catch (e) {
    console.error("Error saving ventajas catalog:", e);
  }
}

export function getSolicitudesVentajas(): SolicitudVentaja[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RESERVAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveSolicitudVentaja(solicitud: SolicitudVentaja): void {
  if (typeof window === "undefined") return;
  try {
    const current = getSolicitudesVentajas();
    const updated = [solicitud, ...current.filter(s => s.id !== solicitud.id)];
    localStorage.setItem(RESERVAS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("df_solicitudes_ventajas_updated"));
  } catch (e) {
    console.error("Error saving solicitud ventaja:", e);
  }
}

export function updateSolicitudStatus(id: string, estado: "Pendiente" | "Entregado" | "Cancelado"): void {
  if (typeof window === "undefined") return;
  try {
    const current = getSolicitudesVentajas();
    const updated = current.map(s => s.id === id ? { ...s, estado } : s);
    localStorage.setItem(RESERVAS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("df_solicitudes_ventajas_updated"));
  } catch (e) {
    console.error("Error updating solicitud status:", e);
  }
}

// -------------------------------------------------------------
// GESTIÓN DE BONOS DE ALUMNOS (SEGUIMIENTO Y SESIONES RESTANTES)
// -------------------------------------------------------------

export function getBonosAlumnos(): BonoAlumno[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BONOS_KEY);
    if (!raw) {
      localStorage.setItem(BONOS_KEY, JSON.stringify([]));
      return [];
    }
    const parsed: BonoAlumno[] = JSON.parse(raw);
    const todayStr = new Date().toISOString().slice(0, 10);
    
    // Purga automática de los 5 bonos de prueba iniciales
    const demoIds = new Set(["bono_alum_1", "bono_alum_2", "bono_alum_3", "bono_alum_4", "bono_alum_5"]);
    const demoDnis = new Set(["50894721K", "09483726L", "47382910M", "51829304N", "02938475P"]);
    const cleaned = parsed.filter(b => 
      !demoIds.has(b.id) && 
      !demoDnis.has(b.alumno_dni || "") && 
      !(b.alumno_id && b.alumno_id.startsWith("demo_"))
    );

    if (cleaned.length !== parsed.length) {
      localStorage.setItem(BONOS_KEY, JSON.stringify(cleaned));
      window.dispatchEvent(new Event("df_bonos_updated"));
    }

    // Auto-update status for expired or exhausted bonos
    return cleaned.map(b => {
      let estado = b.estado;
      if (b.clases_restantes <= 0) {
        estado = "Agotado";
      } else if (b.fecha_caducidad && b.fecha_caducidad < todayStr) {
        estado = "Caducado";
      }
      return { ...b, estado };
    });
  } catch (e) {
    return [];
  }
}

export function saveBonosAlumnos(bonos: BonoAlumno[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BONOS_KEY, JSON.stringify(bonos));
    window.dispatchEvent(new Event("df_bonos_updated"));
  } catch (e) {
    console.error("Error saving bonos alumnos:", e);
  }
}

export function deleteBonoAlumno(id: string): void {
  const all = getBonosAlumnos();
  const updated = all.filter(b => b.id !== id);
  saveBonosAlumnos(updated);
}

export function consumirSesionBono(id: string): { success: boolean; bono?: BonoAlumno; message: string } {
  const all = getBonosAlumnos();
  const index = all.findIndex(b => b.id === id);
  if (index === -1) return { success: false, message: "Bono no encontrado." };

  const target = all[index];
  if (target.clases_restantes <= 0) {
    return { success: false, message: "El bono ya no tiene clases restantes disponibles." };
  }
  if (target.estado === "Caducado") {
    return { success: false, message: "El bono ha caducado. No se pueden canjear más sesiones." };
  }

  const updatedTarget: BonoAlumno = {
    ...target,
    clases_consumidas: target.clases_consumidas + 1,
    clases_restantes: target.clases_restantes - 1,
    estado: target.clases_restantes - 1 === 0 ? "Agotado" : "Activo"
  };

  all[index] = updatedTarget;
  saveBonosAlumnos(all);
  return { success: true, bono: updatedTarget, message: `1 sesión consumida. Quedan ${updatedTarget.clases_restantes} clases.` };
}

export function recargarSesionesBono(id: string, clasesExtra: number, precioExtra: number = 0): BonoAlumno | null {
  const all = getBonosAlumnos();
  const index = all.findIndex(b => b.id === id);
  if (index === -1) return null;

  const target = all[index];
  const newTotal = target.total_clases + clasesExtra;
  const newRestantes = target.clases_restantes + clasesExtra;
  
  // Extend expiration by 3 months from now
  const future = new Date();
  future.setMonth(future.getMonth() + 3);
  const newExp = future.toISOString().slice(0, 10);

  const updatedTarget: BonoAlumno = {
    ...target,
    total_clases: newTotal,
    clases_restantes: newRestantes,
    precio_pagado: target.precio_pagado + precioExtra,
    fecha_caducidad: newExp,
    estado: "Activo"
  };

  all[index] = updatedTarget;
  saveBonosAlumnos(all);
  return updatedTarget;
}

export function crearBonoAlumno(data: {
  alumno_id?: string;
  alumno_nombre: string;
  alumno_dni?: string;
  alumno_telefono?: string;
  alumno_email?: string;
  tipo_bono: string;
  total_clases: number;
  precio_pagado: number;
  dias_validez?: number;
  sede: "tejar" | "castilla";
  notas?: string;
}): BonoAlumno {
  const all = getBonosAlumnos();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const expDate = new Date();
  expDate.setDate(expDate.getDate() + (data.dias_validez || 90));
  const expStr = expDate.toISOString().slice(0, 10);

  const nuevoBono: BonoAlumno = {
    id: "bono_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    alumno_id: data.alumno_id,
    alumno_nombre: data.alumno_nombre.trim(),
    alumno_dni: data.alumno_dni?.trim() || undefined,
    alumno_telefono: data.alumno_telefono?.trim() || undefined,
    alumno_email: data.alumno_email?.trim() || undefined,
    tipo_bono: data.tipo_bono,
    total_clases: data.total_clases,
    clases_consumidas: 0,
    clases_restantes: data.total_clases,
    precio_pagado: data.precio_pagado,
    fecha_compra: todayStr,
    fecha_caducidad: expStr,
    estado: "Activo",
    sede: data.sede,
    notas: data.notas?.trim() || undefined
  };

  const updated = [nuevoBono, ...all];
  saveBonosAlumnos(updated);
  return nuevoBono;
}
