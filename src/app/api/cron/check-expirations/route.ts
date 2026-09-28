import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return forwardCheck(request);
}

export async function POST(request: NextRequest) {
  return forwardCheck(request);
}

async function forwardCheck(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = new URL("https://app.dancefactoryalcorcon.es/api/cron/check-expirations");
    searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });

    const res = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[CRM Proxy Check Expirations Error]:", error);
    return NextResponse.json(
      { success: false, error: "Error de conexión con el servidor de alertas: " + (error.message || "desconocido") },
      { status: 500 }
    );
  }
}
