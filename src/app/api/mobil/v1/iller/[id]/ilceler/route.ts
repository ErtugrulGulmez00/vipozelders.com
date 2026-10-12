import { loadDistricts } from "@/server/catalog";
import { ApiError, json } from "@/server/mobile/http";
import { publicRoute } from "@/server/mobile/route";

export const GET = publicRoute<{ id: string }>(async ({ params }) => {
  const cityId = Number(params.id);
  if (!Number.isInteger(cityId) || cityId < 1 || cityId > 81) throw new ApiError(400, "INVALID_CITY", "Geçersiz il.");
  const districts = await loadDistricts(cityId);
  return json({ items: districts.map((d) => ({ id: d.id, name: d.name, slug: d.slug })) });
});
