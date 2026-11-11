import { json } from "@/server/mobile/http";
import { coachStudentJson, mobileCoachContext } from "@/server/mobile/koc";
import { withUser } from "@/server/mobile/route";

/** Koçun öğrenci sayfası. */
export const GET = withUser<{ id: string }>(async ({ user, params }) => json(await coachStudentJson(await mobileCoachContext(user), params.id)), { allowCenter: true });
