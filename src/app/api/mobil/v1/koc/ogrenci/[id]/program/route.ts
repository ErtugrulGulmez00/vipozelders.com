import { json } from "@/server/mobile/http";
import { kocLink, kocProgramJson } from "@/server/mobile/koc";
import { withUser } from "@/server/mobile/route";

/** Haftalık program (?hafta=YYYY-AA-GG) ve veliye açık koç notları. */
export const GET = withUser<{ id: string }>(
  async ({ request, user, params }) => {
    const link = await kocLink(user.id, params.id);
    return json(await kocProgramJson(link.student.id, link.student.centerId, new URL(request.url).searchParams.get("hafta"), true));
  },
  { allowCenter: true },
);
