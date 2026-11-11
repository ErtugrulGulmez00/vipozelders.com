import { json } from "@/server/mobile/http";
import { kocStudentHomeJson } from "@/server/mobile/koc";
import { withUser } from "@/server/mobile/route";

/** Öğrenci / veli ana ekranı: bugünkü görevler, istatistikler, son kayıtlar, denemeler, hedefler. */
export const GET = withUser<{ id: string }>(async ({ user, params }) => json(await kocStudentHomeJson(user.id, params.id)), { allowCenter: true });
