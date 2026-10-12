import { z } from "zod";
import { sendPasswordResetEmail } from "@/server/accounts";
import { countRecentAttempts, recordLoginAttempt } from "@/server/auth/rate-limit";
import { json, readBody } from "@/server/mobile/http";
import { publicRoute } from "@/server/mobile/route";

/** Şifre sıfırlama bağlantısı e-postayla gönderilir (bağlantı web sitesinde açılır). */
export const POST = publicRoute(async ({ request }) => {
  const { email } = await readBody(request, z.object({ email: z.email("Geçerli bir e-posta adresi yazın.") }));
  const normalized = email.trim().toLowerCase();
  const key = `reset:${normalized}`;
  if ((await countRecentAttempts(key, 60 * 60 * 1000)) < 5) {
    await recordLoginAttempt(key, null, false);
    await sendPasswordResetEmail(normalized);
  }
  // Hesabın var olup olmadığı belli edilmez.
  return json({ message: "Bu adresle kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin." });
});
