import { z } from "zod";
import { normalizePhone } from "@/lib/text";
import { AccountError, registerStudent } from "@/server/accounts";
import { passwordProblem } from "@/server/auth/password";
import { countRecentAttempts, recordLoginAttempt } from "@/server/auth/rate-limit";
import { maintenanceState } from "@/server/maintenance";
import { clientIp, issueMobileSession } from "@/server/mobile/auth";
import { ApiError, json, readBody } from "@/server/mobile/http";
import { meJson } from "@/server/mobile/me";
import { publicRoute } from "@/server/mobile/route";

const registerSchema = z.object({
  firstName: z.string().trim().min(2, "Adınızı yazın.").max(50),
  lastName: z.string().trim().min(2, "Soyadınızı yazın.").max(50),
  email: z.email("Geçerli bir e-posta adresi yazın.").max(120),
  phone: z.string().trim().optional(),
  password: z.string().min(1, "Şifre belirleyin."),
  accountType: z.enum(["PARENT", "STUDENT"], { error: "Hesap tipini seçin." }),
  kvkk: z.literal(true, { error: "Devam etmek için aydınlatma metnini onaylayın." }),
  terms: z.literal(true, { error: "Devam etmek için kullanım şartlarını kabul edin." }),
  marketing: z.boolean().optional(),
  deviceName: z.string().max(120).optional(),
});

/** Veli/öğrenci kaydı; başarılıysa doğrudan oturum açılır. */
export const POST = publicRoute(async ({ request }) => {
  if ((await maintenanceState()).on) throw new ApiError(503, "MAINTENANCE", "Site şu an bakımda; kayıt birazdan yeniden açılacak.");
  const input = await readBody(request, registerSchema);

  const problem = passwordProblem(input.password);
  if (problem) throw new ApiError(422, "VALIDATION", problem, { password: problem });
  let phone: string | null = null;
  if (input.phone) {
    phone = normalizePhone(input.phone);
    if (!phone) throw new ApiError(422, "VALIDATION", "Telefon numarası 05XX XXX XX XX biçiminde olmalı.", { phone: "Geçersiz telefon numarası." });
  }

  const ipAddress = clientIp(request);
  if (ipAddress && (await countRecentAttempts(`register:${ipAddress}`, 60 * 60 * 1000)) >= 10) {
    throw new ApiError(429, "TOO_MANY_ATTEMPTS", "Bu bağlantıdan çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin.");
  }
  if (ipAddress) await recordLoginAttempt(`register:${ipAddress}`, null, false);

  let userId: string;
  try {
    const user = await registerStudent({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone,
      password: input.password,
      accountType: input.accountType,
      marketingConsent: input.marketing ?? false,
    });
    userId = user.id;
  } catch (error) {
    if (error instanceof AccountError) throw new ApiError(409, "EMAIL_TAKEN", error.message, { email: error.message });
    throw error;
  }
  const token = await issueMobileSession(userId, request, input.deviceName);
  return json({ token, user: await meJson(userId) }, 201);
});
