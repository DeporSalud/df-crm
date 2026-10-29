import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const DESK_OTP_BUCKET_MS = 15 * 60 * 1000;
const OTP_HMAC_SECRET =
  process.env.OTP_HMAC_SECRET || "df-alcorcon-otp-hmac-v2-2026-9f4c8e2a1b7d";

function canonicalizeOtpEmail(email: string): string {
  const clean = (email || "").trim().toLowerCase();
  const atIdx = clean.indexOf("@");
  if (atIdx === -1) return clean;
  let local = clean.slice(0, atIdx);
  let domain = clean.slice(atIdx + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") {
    const plusIdx = local.indexOf("+");
    if (plusIdx !== -1) local = local.slice(0, plusIdx);
    local = local.replace(/\./g, "");
  }
  return `${local}@${domain}`;
}

function computeDeskOtpForWindow(email: string, windowIdx: number): string {
  const canonicalEmail = canonicalizeOtpEmail(email);
  const digest = crypto
    .createHmac("sha256", OTP_HMAC_SECRET)
    .update(`desk-v1|${canonicalEmail}|${windowIdx}`)
    .digest();
  const num = digest.readUInt32BE(0) % 900000;
  return String(100000 + num);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "El alumno debe tener un correo electrónico válido en su ficha." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const currentWindow = Math.floor(Date.now() / DESK_OTP_BUCKET_MS);
    const code = computeDeskOtpForWindow(cleanEmail, currentWindow);

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      code,
      validMinutes: 30,
    });
  } catch (err: any) {
    console.error("[CRM /api/admin/desk-otp] Error:", err);
    return NextResponse.json(
      { success: false, error: "No se pudo generar el código de mostrador." },
      { status: 500 }
    );
  }
}
