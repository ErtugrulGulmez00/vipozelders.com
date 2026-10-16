import { z } from "zod";
import { burnPasswordCheck, verifyPassword } from "@/server/auth/password";
import { isLoginBlocked, recordLoginAttempt } from "@/server/auth/rate-limit";
import { db } from "@/server/db";
import { clientIp, issueMobileSession } from "@/server/mobile/auth";
import { ApiError, json, readBody } from "@/server/mobile/http";
import { meJson } from "@/server/mobile/me";
import { publicRoute, withUser } from "@/server/mobile/route";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "E-posta veya kullanıcı adı gerekli."),
  password: z.string().min(1, "Şifre gerekli."),
  deviceName: z.string().max(120).optional(),
});

/** Giriş: veli/öğrenci e-postasıyla, öğretmen kullanıcı adıyla. Yanıttaki token her istekte Bearer olarak gönderilir. */
export const POST = publicRoute(async ({ request }) => {
  const input = await readBody(request, loginSchema);
  const identifier = input.identifier.toLocaleLowerCase("tr-TR").replace(/ı/g, "i");
  const ipAddress = clientIp(request);
  if (await isLoginBlocked(identifier, ipAddress)) {
    throw new ApiError(429, "TOO_MANY_ATTEMPTS", "Çok fazla hatalı deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.");
  }

  const user = await db.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] } });
  const valid = user ? await verifyPassword(input.password, user.passwordHash) : (await burnPasswordCheck(input.password), false);
  await recordLoginAttempt(identifier, ipAddress, valid);
  if (!user || !valid) throw new ApiError(401, "INVALID_CREDENTIALS", "Kullanıcı adı/e-posta veya şifre hatalı.");
  if (user.status !== "ACTIVE") throw new ApiError(403, "ACCOUNT_SUSPENDED", "Hesabınız askıya alınmış. Destek ekibimizle iletişime geçin.");
  if (user.role === "ADMIN") throw new ApiError(403, "ADMIN_NOT_SUPPORTED", "Yönetici hesabı mobil uygulamada kullanılamaz; web panelini kullanın.");
  if (user.role === "CENTER") throw new ApiError(403, "CENTER_NOT_SUPPORTED", "Kurum paneli hesabı mobil uygulamada henüz kullanılamıyor; web panelini kullanın.");

  const token = await issueMobileSession(user.id, request, input.deviceName);
  return json({ token, user: await meJson(user.id) });
});

/** Çıkış: bu cihazın oturumu ve (gönderildiyse) push kaydı silinir. */
export const DELETE = withUser(
  async ({ request, user }) => {
    const deviceToken = new URL(request.url).searchParams.get("cihaz");
    await db.$transaction([
      db.session.deleteMany({ where: { id: user.sessionId } }),
      ...(deviceToken ? [db.device.deleteMany({ where: { token: deviceToken, userId: user.id } })] : []),
    ]);
    return new Response(null, { status: 204 });
  },
  { allowPasswordChange: true },
);
