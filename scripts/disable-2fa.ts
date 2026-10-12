/**
 * Telefonu kaybolan yöneticinin iki adımlı doğrulamasını kapatır (sunucuda çalıştırılır).
 * Kullanım: npm run admin:2fa-kapat -- <kullanıcı adı veya e-posta>
 */
import { db } from "@/server/db";

const who = process.argv[2]?.trim().toLowerCase();
if (!who) {
  console.error("Kullanım: npm run admin:2fa-kapat -- <kullanıcı adı veya e-posta>");
  process.exit(1);
}

const user = await db.user.findFirst({ where: { OR: [{ username: who }, { email: who }] } });
if (!user) {
  console.error(`Kullanıcı bulunamadı: ${who}`);
  process.exit(1);
}
await db.user.update({ where: { id: user.id }, data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null } });
await db.auditLog.create({ data: { action: "security.2fa_reset_cli", entityType: "User", entityId: user.id } });
console.log(`${user.firstName} ${user.lastName} için iki adımlı doğrulama kapatıldı. Girişten sonra panelden yeniden kurabilir.`);
await db.$disconnect();
