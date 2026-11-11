import { json } from "@/server/mobile/http";
import { coachHomeJson, mobileCoachContext } from "@/server/mobile/koc";
import { withUser } from "@/server/mobile/route";

/** Koç ana ekranı: hesap durumu ve öğrenci kartları (uyarılarla). */
export const GET = withUser(async ({ user }) => json(await coachHomeJson(await mobileCoachContext(user))), { allowCenter: true });
