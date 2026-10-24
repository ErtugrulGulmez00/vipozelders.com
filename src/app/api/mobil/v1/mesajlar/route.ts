import { json } from "@/server/mobile/http";
import { threadsJson } from "@/server/mobile/messages";
import { withUser } from "@/server/mobile/route";

/** Konuşmalar (veli/öğrenci ya da öğretmen olarak), son mesaj ve okunmamış işaretiyle. */
export const GET = withUser(async ({ user }) => json(await threadsJson(user.id, user.role === "TEACHER" ? "teacher" : "student")));
