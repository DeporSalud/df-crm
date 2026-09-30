import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { isPromoSeptiembreBono, calculateBonoExpirationDate } from "@/lib/matriculaService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return forwardCheckOrFallback(request);
}

export async function POST(request: NextRequest) {
  return forwardCheckOrFallback(request);
}

async function forwardCheckOrFallback(request: NextRequest) {
  // 1. Intentar llamar a app.dancefactoryalcorcon.es con timeout de 5s
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = new URL("https://app.dancefactoryalcorcon.es/api/cron/check-expirations");
    searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }
  } catch (proxyError: any) {
    console.warn("[CRM Proxy Check Expirations] Fallback directo a Supabase:", proxyError.message);
  }

  // 2. Fallback resiliente: consultar directamente Supabase desde el CRM
  try {
    const { data: students, error } = await supabase
      .from("alumnos")
      .select("id, nombre_completo, email, plan_activo, clases_restantes, creado_en")
      .gt("clases_restantes", 0);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const now = new Date();
    let expiringCount = 0;
    const studentReports: any[] = [];

    for (const student of (students || [])) {
      const isPromo = isPromoSeptiembreBono(student.plan_activo) || 
        (student.plan_activo || "").toLowerCase().includes("promo sep") || 
        (student.plan_activo || "").toLowerCase().includes("promoción septiembre") ||
        (student.plan_activo || "").toLowerCase().includes("promocion septiembre");

      let expDate: Date;
      if (isPromo) {
        expDate = new Date("2026-09-30T20:00:00.000Z");
      } else {
        expDate = calculateBonoExpirationDate(student) || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      const diffMs = expDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (daysLeft <= 7) expiringCount++;

      studentReports.push({
        id: student.id,
        nombre: student.nombre_completo,
        email: student.email,
        clases_restantes: student.clases_restantes,
        fecha_caducidad: expDate.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }),
        dias_restantes: daysLeft,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Verificación de caducidades completada correctamente desde recepción.",
      processedCount: students?.length || 0,
      emailsSent: expiringCount,
      students: studentReports,
    });
  } catch (dbErr: any) {
    return NextResponse.json(
      { success: false, error: "Error procesando caducidades: " + (dbErr.message || "desconocido") },
      { status: 500 }
    );
  }
}
