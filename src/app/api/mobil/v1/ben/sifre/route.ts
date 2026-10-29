import { z } from "zod";
import { hashPassword, passwordProblem, verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { ApiError, json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Şifre değiştirme. Yöneticinin verdiği geçici şifreyle giren öğretmen önce bunu yapmak zorundadır. */
export const POST = withUser(
  async ({ request, user }) => {
    const input = await readBody(request, z.object({ currentPassword: z.string().min(1, "Mevcut şifrenizi yazın."), newPassword: z.string().min(1, "Yeni şifre yazın.") }));
    const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(input.currentPassword, record.passwordHash))) {
      throw new ApiError(422, "VALIDATION", "Mevcut şifreniz hatalı.", { currentPassword: "Mevcut şifre hatalı." });
    }
    const problem = passwordProblem(input.newPassword);
    if (problem) throw new ApiError(422, "VALIDATION", problem, { newPassword: problem });
    if (input.newPassword === input.currentPassword) {
      throw new ApiError(422, "VALIDATION", "Yeni şifre eskisiyle aynı olamaz.", { newPassword: "Farklı bir şifre seçin." });
    }

    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword), mustChangePassword: false } }),
      // Bu cihaz dışındaki tüm oturumlar (web dahil) kapatılır.
      db.session.deleteMany({ where: { userId: user.id, id: { not: user.sessionId } } }),
    ]);
    return json({ message: "Şifreniz değiştirildi. Diğer cihazlardaki oturumlarınız kapatıldı." });
  },
  { allowPasswordChange: true, allowCenter: true },
);
