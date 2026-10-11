import { NextResponse, type NextRequest } from "next/server";
import { loadDistricts } from "@/server/catalog";

/** Seçilen ilin ilçeleri (bağımlı açılır listeler için). */
export async function GET(request: NextRequest) {
  const cityId = Number(request.nextUrl.searchParams.get("il"));
  if (!Number.isInteger(cityId) || cityId < 1 || cityId > 81) {
    return NextResponse.json({ error: "Geçersiz il." }, { status: 400 });
  }
  const districts = await loadDistricts(cityId);
  return NextResponse.json(districts.map((d) => ({ id: d.id, name: d.name })), {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
