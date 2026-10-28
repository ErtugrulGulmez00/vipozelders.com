import { connection, NextResponse } from "next/server";
import { db } from "@/server/db";

/** Sağlık kontrolü (dış izleme ve sunucu bekçisi): uygulama ve veritabanı yanıt veriyor mu. */
export async function GET() {
  await connection();
  const headers = { "Cache-Control": "no-store" };
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    console.error("[sağlık]", error);
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
