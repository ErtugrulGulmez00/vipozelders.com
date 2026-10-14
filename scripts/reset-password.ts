/**
 * Kullanıcıya yeni geçici şifre verir; ilk girişte şifre değiştirmesi istenir (sunucuda çalıştırılır).
 * Kullanım: npm run admin:sifre-sifirla -- <kullanıcı adı veya e-posta>
 */
import { generateTemporaryPassword, hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";

const who = process.argv[2]?.trim().toLowerCase();
if (!who) {
  console.error("Kullanım: npm run admin:sifre-sifirla -- <kullanıcı adı veya e-posta>");
  process.exit(1);
}

const user = await db.user.findFirst({ where: { OR: [{ username: who }, { email: who }] } });
if (!user) {
  console.error(`Kullanıcı bulunamadı: ${who}`);
  process.exit(1);
}
const password = generateTemporaryPassword(14);
await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: true } });
await db.auditLog.create({ data: { action: "security.password_reset_cli", entityType: "User", entityId: user.id } });
console.log(`${user.firstName} ${user.lastName} → kullanıcı adı: ${user.username ?? user.email}  geçici şifre: ${password}`);
await db.$disconnect();
