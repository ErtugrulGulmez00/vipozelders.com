import { json } from "@/server/mobile/http";
import { publicRoute } from "@/server/mobile/route";
import { teacherCardJson } from "@/server/mobile/serialize";
import { searchTeachers, type TeacherSearchParams } from "@/server/teachers";

const PARAMS: (keyof TeacherSearchParams)[] = ["level", "subject", "service", "mode", "city", "district", "minPrice", "maxPrice", "rating", "gender", "time", "verified", "intro", "abonelik", "q", "sort", "page"];

/**
 * Öğretmen arama (vitrindeki filtrelerle aynı). Parametreler:
 * level, subject, service, city, district (slug) · mode=online|yuz-yuze · minPrice, maxPrice (TL) ·
 * rating=4 · gender=kadin|erkek · time=hafta-ici-gunduz|hafta-ici-aksam|hafta-sonu · verified=1 · intro=1 (ücretsiz tanışma) ·
 * abonelik=1 (aylık soru aboneliği veren) · q · sort · page
 */
export const GET = publicRoute(async ({ request }) => {
  const url = new URL(request.url);
  const params: TeacherSearchParams = {};
  for (const key of PARAMS) {
    const value = url.searchParams.get(key)?.trim();
    if (value) params[key] = value.slice(0, 100);
  }
  const result = await searchTeachers(params);
  return json({ items: result.items.map(teacherCardJson), total: result.total, page: result.page, pageCount: result.pageCount });
});
