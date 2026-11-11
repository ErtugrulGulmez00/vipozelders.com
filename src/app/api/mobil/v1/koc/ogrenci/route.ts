import { json } from "@/server/mobile/http";
import { kocLinksJson } from "@/server/mobile/koc";
import { withUser } from "@/server/mobile/route";

/** Pi Koç öğrencisi ya da velisi: bağlı olduğu öğrenciler. */
export const GET = withUser(async ({ user }) => json(await kocLinksJson(user.id)), { allowCenter: true });
