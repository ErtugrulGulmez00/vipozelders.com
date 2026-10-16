import { connection } from "next/server";
import { MOBILE_APP_LINK_PATHS } from "@/lib/mobile-app";

/** iOS Universal Links: IOS_APP_ID (<TeamID>.com.pikampus.app) ayarlıysa sitenin bağlantıları uygulamada açılır; değilse 404. */
export async function GET() {
  await connection();
  const appId = process.env.IOS_APP_ID?.trim();
  if (!appId) return new Response("Not found", { status: 404 });
  return Response.json(
    { applinks: { details: [{ appIDs: [appId], components: MOBILE_APP_LINK_PATHS.map((path) => ({ "/": `${path}*` })) }] } },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
