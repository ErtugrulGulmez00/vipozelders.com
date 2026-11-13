import "server-only";
import { randomInt } from "node:crypto";
import { coachPlan, coachTierName } from "@/lib/pi-koc";
import { audit } from "./audit";
import { countRecentAttempts, recordLoginAttempt } from "./auth/rate-limit";
import { CenterError } from "./center/errors";
import { db } from "./db";
import { notify, notifyRole } from "./notifications";
import { loadSettings } from "./settings";

// Pi Koç deneme kodu: yönetim tek kullanımlık kod üretir; öğretmen/koç kodu girince belirli gün boyunca ücretli paket açılır.
// Kurallar: hesap (kullanıcı ve Pi Koç hesabı) ömründe tek kod; ücretli paketi olana kod uygulanmaz; deneme bitince fazla
// öğrenciler 7 gün içinde seçilmezse arşive alınır (processCoachOverLimit).

/** Karışan harfler (0/O, 1/I/L) yok; 8 karakter ≈ 30^8 olasılık. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
/** Kullanıcı başına saatte en fazla bu kadar kod denemesi (kod tahmin etmeyi engeller) */
const MAX_ATTEMPTS_PER_HOUR = 5;
/** Ücretsiz paketin sınırı aşıldıktan sonra fazlaların arşive alınmasına kadar süre */
export const OVER_LIMIT_GRACE_DAYS = 7;

function newCode(): string {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `PIKOC-${part()}-${part()}`;
}

/** "pikoc 7k2m q9xt" → "PIKOC-7K2M-Q9XT" */
export function normalizePromoCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = raw.startsWith("PIKOC") ? raw.slice(5) : raw;
  return body.length === 8 ? `PIKOC-${body.slice(0, 4)}-${body.slice(4)}` : input.trim().toUpperCase();
}

export async function generatePromoCodes(adminId: string, input: { count: number; days: number; note: string | null; expiresAt: Date | null }) {
  if (input.count < 1 || input.count > 50) throw new CenterError("Bir seferde 1-50 kod üretilir.");
  if (input.days < 1 || input.days > 90) throw new CenterError("Süre 1-90 gün olmalı.");
  const codes: string[] = [];
  for (let i = 0; i < input.count; i++) {
    // Çakışma neredeyse imkânsız; olursa yeniden üretilir
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      try {
        await db.coachPromoCode.create({ data: { code, days: input.days, students: 5, note: input.note, expiresAt: input.expiresAt, createdById: adminId } });
        codes.push(code);
        break;
      } catch {
        // benzersizlik çakışması
      }
    }
  }
  await audit({ actorId: adminId, action: "promo.generate", entityType: "CoachPromoCode", entityId: null, details: { count: codes.length, days: input.days } });
  return codes;
}

/** Öğretmen/koç kodu kullanır: Pi Koç hesabında belirtilen gün boyunca 5 öğrencilik ücretli paket açılır. */
export async function redeemPromoCode(user: { id: string; firstName: string; lastName: string }, centerId: string, rawCode: string, now = new Date()) {
  const key = `promo:${user.id}`;
  if ((await countRecentAttempts(key, 60 * 60 * 1000)) >= MAX_ATTEMPTS_PER_HOUR) throw new CenterError("Çok fazla kod denediniz; bir saat sonra tekrar deneyin.");
  await recordLoginAttempt(key, null, false);

  const code = normalizePromoCode(rawCode);
  const [promo, center, settings, used] = await Promise.all([
    db.coachPromoCode.findUnique({ where: { code } }),
    db.center.findUnique({ where: { id: centerId }, select: { id: true, kind: true, name: true, status: true, trialEndsAt: true, paidUntil: true, studentLimit: true, promoUntil: true, promoStudents: true } }),
    loadSettings(),
    db.coachPromoCode.count({ where: { redeemedByUserId: user.id } }),
  ]);
  if (!center || center.kind !== "COACH") throw new CenterError("Kod yalnızca Pi Koç hesabında kullanılır.");
  if (!promo || promo.revokedAt || (promo.expiresAt && promo.expiresAt.getTime() < now.getTime())) throw new CenterError("Kod geçersiz ya da süresi dolmuş.");
  if (promo.redeemedAt) throw new CenterError("Bu kod daha önce kullanılmış.");
  if (used > 0 || center.promoUntil) throw new CenterError("Deneme kodu hesap başına bir kez kullanılabilir.");
  if (coachPlan(center, settings.piKocFreeStudents, now).paid) throw new CenterError("Ücretli paketiniz açıkken deneme kodu kullanılamaz.");

  const until = new Date(now.getTime() + promo.days * 86_400_000);
  // Aynı kodun aynı anda iki kez kullanılmasını önler: yalnızca kullanılmamış kod güncellenir
  const claimed = await db.coachPromoCode.updateMany({ where: { id: promo.id, redeemedAt: null, revokedAt: null }, data: { redeemedAt: now, redeemedByUserId: user.id, centerId } });
  if (claimed.count !== 1) throw new CenterError("Bu kod daha önce kullanılmış.");
  await db.center.update({ where: { id: centerId }, data: { promoUntil: until, promoStudents: promo.students, overLimitSince: null } });
  await recordLoginAttempt(key, null, true);
  await audit({ actorId: user.id, action: "promo.redeem", entityType: "Center", entityId: centerId, details: { code: promo.code, days: promo.days } });
  await notifyRole("ADMIN", { type: "admin.promo_redeemed", title: "Deneme kodu kullanıldı", body: `${user.firstName} ${user.lastName} · ${center.name} · ${promo.days} gün${promo.note ? ` · ${promo.note}` : ""}`, link: `/yonetim/kurumlar/${centerId}`, email: false });
  return { until, tier: coachTierName(promo.students), students: promo.students };
}

/** Yönetim kodu iptal eder; kullanılmışsa deneme o an biter. */
export async function revokePromoCode(adminId: string, codeId: string, now = new Date()) {
  const promo = await db.coachPromoCode.findUnique({ where: { id: codeId } });
  if (!promo) throw new CenterError("Kod bulunamadı.");
  await db.coachPromoCode.update({ where: { id: codeId }, data: { revokedAt: now } });
  if (promo.centerId) await db.center.updateMany({ where: { id: promo.centerId, promoUntil: { gt: now } }, data: { promoUntil: now } });
  await audit({ actorId: adminId, action: "promo.revoke", entityType: "CoachPromoCode", entityId: codeId, details: { code: promo.code } });
}

/**
 * Dakikada bir (zamanlayıcı): ücretsiz pakette sınırın üstünde öğrencisi kalan Pi Koç hesabı (deneme kodu ya da ücretli paket
 * bitmiş). Önce koça haber verilir; 7 gün içinde öğrenci sayısını indirmezse en son eklenen fazla öğrenciler arşive alınır
 * (silinmez; paket yükselince yeniden açılabilir). Böylece sona eren paketin öğrencileri ücretsiz pakette kalıcı olarak kalamaz.
 */
export async function processCoachOverLimit(now = new Date()): Promise<number> {
  const settings = await loadSettings();
  const centers = await db.center.findMany({
    where: { kind: "COACH" },
    select: { id: true, name: true, status: true, trialEndsAt: true, paidUntil: true, studentLimit: true, promoUntil: true, promoStudents: true, overLimitSince: true, members: { where: { role: "OWNER", isActive: true }, select: { userId: true } } },
  });
  const counts = new Map((await db.centerStudent.groupBy({ by: ["centerId"], where: { status: "ACTIVE", center: { kind: "COACH" } }, _count: true })).map((g) => [g.centerId, g._count]));
  let done = 0;
  for (const c of centers) {
    const plan = coachPlan(c, settings.piKocFreeStudents, now);
    const active = counts.get(c.id) ?? 0;
    const over = !plan.paid && active > plan.studentLimit;
    if (!over) {
      if (c.overLimitSince) {
        await db.center.update({ where: { id: c.id }, data: { overLimitSince: null } });
        done++;
      }
      continue;
    }
    const owners = c.members.map((m) => m.userId);
    if (!c.overLimitSince) {
      await db.center.update({ where: { id: c.id }, data: { overLimitSince: now } });
      for (const userId of owners) {
        await notify({
          userId,
          type: "center.koc_over_limit",
          title: "Paketiniz ücretsiz pakete döndü",
          body: `Ücretsiz pakette en fazla ${plan.studentLimit} öğrenci aktif olur; şu an ${active} öğrenciniz var. ${OVER_LIMIT_GRACE_DAYS} gün içinde aktif kalacak öğrencileri seçin (diğerlerini arşive alın) ya da paketinizi yükseltin. Seçmezseniz en son eklenen öğrenciler arşive alınır; kayıtları silinmez.`,
          link: "/koc/ogrenciler",
        });
      }
      done++;
      continue;
    }
    if (now.getTime() - c.overLimitSince.getTime() < OVER_LIMIT_GRACE_DAYS * 86_400_000) continue;
    const extra = await db.centerStudent.findMany({ where: { centerId: c.id, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: active - plan.studentLimit, select: { id: true, firstName: true, lastName: true } });
    await db.centerStudent.updateMany({ where: { id: { in: extra.map((s) => s.id) } }, data: { status: "PASSIVE" } });
    await db.center.update({ where: { id: c.id }, data: { overLimitSince: null } });
    await audit({ actorId: null, action: "center.koc_auto_archive", entityType: "Center", entityId: c.id, details: { archived: extra.length } });
    for (const userId of owners) {
      await notify({
        userId,
        type: "center.koc_auto_archive",
        title: `${extra.length} öğrenci arşive alındı`,
        body: `${extra.map((s) => `${s.firstName} ${s.lastName}`).join(", ")} arşive alındı; kayıtları duruyor. Paketinizi yükseltince yeniden aktif yapabilirsiniz.`,
        link: "/koc/ogrenciler",
      });
    }
    done++;
  }
  return done;
}
