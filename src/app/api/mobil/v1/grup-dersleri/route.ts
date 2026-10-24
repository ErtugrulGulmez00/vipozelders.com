import { optionalUser } from "@/server/mobile/auth";
import { groupCoursesJson, myGroupsJson, teacherGroupsJson } from "@/server/mobile/commerce";
import { json } from "@/server/mobile/http";
import { publicRoute } from "@/server/mobile/route";

/**
 * Grup dersleri: herkese açık, kayıtları süren dersler. ?kapsam=benim → öğrencinin kayıtları ya da öğretmenin
 * kendi dersleri (oturum açmış olmalı).
 */
export const GET = publicRoute(async ({ request }) => {
  const scope = new URL(request.url).searchParams.get("kapsam");
  if (scope === "benim") {
    const user = await optionalUser(request);
    if (user?.role === "TEACHER") return json(await teacherGroupsJson(user.id));
    if (user?.role === "STUDENT") return json(await myGroupsJson(user.id));
    return json({ items: [] });
  }
  return json(await groupCoursesJson());
});
