import "server-only";
import { randomInt } from "node:crypto";
import { coachPlan, coachTierName, parseCoachTiers } from "@/lib/pi-koc";
import { formatMoney } from "@/lib/money";
import { audit } from "./audit";
import { adminRecordSubscriptionPayment } from "./center/admin";
import { countRecentAttempts, recordLoginAttempt } from "./auth/rate-limit";
import { CenterError } from "./center/errors";
import { db } from "./db";
import { emailChannel } from "./notification-service";
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

/**
 * Yönetim satılan paket kodlarını üretir: kademe (öğrenci sayısı) ve ay. Tutar site ayarındaki kademe fiyatından hesaplanır
 * ve kod girilince ödeme kaydına yazılır (havale/WhatsApp ile alınan paket uygulamada kodla açılır).
 */
export async function generatePackageCodes(adminId: string, input: { count: number; students: number; months: number; note: string | null; expiresAt: Date | null }) {
  if (input.count < 1 || input.count > 50) throw new CenterError("Bir seferde 1-50 kod üretilir.");
  if (input.months < 1 || input.months > 12) throw new CenterError("Süre 1-12 ay olmalı.");
  const tier = parseCoachTiers((await loadSettings()).piKocTiers).find((t) => t.students === input.students);
  if (!tier) throw new CenterError("Paket bulunamadı; Ayarlar'daki Pi Koç kademelerinden birini seçin.");
  const amount = tier.priceTl * 100 * input.months;
  const codes: string[] = [];
  for (let i = 0; i < input.count; i++) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      try {
        await db.coachPromoCode.create({
          data: { code, kind: "PACKAGE", days: input.months * 30, students: tier.students, months: input.months, amount, note: input.note, expiresAt: input.expiresAt, createdById: adminId },
        });
        codes.push(code);
        break;
      } catch {
        // benzersizlik çakışması
      }
    }
  }
  await audit({ actorId: adminId, action: "promo.generate_package", entityType: "CoachPromoCode", entityId: null, details: { count: codes.length, students: tier.students, months: input.months } });
  return codes;
}

/**
 * Paket kodu: kod sahiplenilir, ödeme kaydı oluşur ve ücretli paket `months` ay uzar (öğrenci sınırı kodun kademesi).
 * Deneme kodundaki "hesap başına bir kez" ve "ücretli paketi olan kullanamaz" kuralları yoktur: yenileme ve yükseltme de kodla olur.
 */
async function redeemPackageCode(
  user: { id: string; firstName: string; lastName: string },
  center: { id: string; name: string },
  promo: { id: string; code: string; students: number; months: number | null; amount: number | null; note: string | null; createdById: string | null },
  key: string,
  now: Date,
) {
  const claimed = await db.coachPromoCode.updateMany({ where: { id: promo.id, redeemedAt: null, revokedAt: null }, data: { redeemedAt: now, redeemedByUserId: user.id, centerId: center.id } });
  if (claimed.count !== 1) throw new CenterError("Bu kod daha önce kullanılmış.");
  const months = promo.months ?? 1;
  let until: Date;
  try {
    // Ödeme kaydını kodu üreten yönetici adına yazar (ödeme ona yapıldı)
    until = await adminRecordSubscriptionPayment(promo.createdById ?? user.id, center.id, { amount: promo.amount ?? 0, months, method: "Paket kodu", reference: promo.code, plan: null, coachStudents: promo.students });
  } catch (error) {
    await db.coachPromoCode.update({ where: { id: promo.id }, data: { redeemedAt: null, redeemedByUserId: null, centerId: null } });
    throw error;
  }
  await db.center.update({ where: { id: center.id }, data: { overLimitSince: null } });
  await recordLoginAttempt(key, null, true);
  await audit({ actorId: user.id, action: "promo.redeem_package", entityType: "Center", entityId: center.id, details: { code: promo.code, students: promo.students, months } });
  await notifyRole("ADMIN", {
    type: "admin.promo_redeemed",
    title: "Paket kodu kullanıldı",
    body: `${user.firstName} ${user.lastName} · ${center.name} · ${coachTierName(promo.students)}, ${months} ay${promo.note ? ` · ${promo.note}` : ""}`,
    link: `/yonetim/kurumlar/${center.id}`,
    email: false,
  });
  return { until, tier: coachTierName(promo.students), students: promo.students, kind: "PACKAGE" as const };
}

/** Öğretmen/koç kodu kullanır. Deneme kodu: belirtilen gün boyunca 5 öğrencilik ücretli paket. Paket kodu: redeemPackageCode. */
export async function redeemPromoCode(user: { id: string; firstName: string; lastName: string }, centerId: string, rawCode: string, now = new Date()) {
  const key = `promo:${user.id}`;
  if ((await countRecentAttempts(key, 60 * 60 * 1000)) >= MAX_ATTEMPTS_PER_HOUR) throw new CenterError("Çok fazla kod denediniz; bir saat sonra tekrar deneyin.");
  await recordLoginAttempt(key, null, false);

  const code = normalizePromoCode(rawCode);
  const [promo, center, settings, used] = await Promise.all([
    db.coachPromoCode.findUnique({ where: { code } }),
    db.center.findUnique({ where: { id: centerId }, select: { id: true, kind: true, name: true, status: true, trialEndsAt: true, paidUntil: true, studentLimit: true, promoUntil: true, promoStudents: true } }),
    loadSettings(),
    db.coachPromoCode.count({ where: { redeemedByUserId: user.id, kind: "TRIAL" } }),
  ]);
  if (!center || center.kind !== "COACH") throw new CenterError("Kod yalnızca Pi Koç hesabında kullanılır.");
  if (!promo || promo.revokedAt || (promo.expiresAt && promo.expiresAt.getTime() < now.getTime())) throw new CenterError("Kod geçersiz ya da süresi dolmuş.");
  if (promo.redeemedAt) throw new CenterError("Bu kod daha önce kullanılmış.");
  if (promo.kind === "PACKAGE") return redeemPackageCode(user, center, promo, key, now);
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
  return { until, tier: coachTierName(promo.students), students: promo.students, kind: "TRIAL" as const };
}

/** Yönetim kodu iptal eder; kullanılmışsa deneme o an biter. */
export async function revokePromoCode(adminId: string, codeId: string, now = new Date()) {
  const promo = await db.coachPromoCode.findUnique({ where: { id: codeId } });
  if (!promo) throw new CenterError("Kod bulunamadı.");
  await db.coachPromoCode.update({ where: { id: codeId }, data: { revokedAt: now } });
  // Kullanılmış paket kodunun ödemesi kayıtlıdır; iptal yalnızca deneme kodunda denemeyi bitirir
  if (promo.centerId && promo.kind === "TRIAL") await db.center.updateMany({ where: { id: promo.centerId, promoUntil: { gt: now } }, data: { promoUntil: now } });
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
    // Sistemin arşivlediği öğrencinin arşiv zamanı tutulmaz: koltuk kuralına girmez, ödeme gelince hemen geri açılır
    await db.centerStudent.updateMany({ where: { id: { in: extra.map((s) => s.id) } }, data: { status: "PASSIVE", archivedAt: null } });
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

/** Aynı hesaba "sınır doldu" e-postasının en sık gönderilme aralığı */
const LIMIT_MAIL_EVERY_DAYS = 14;

/**
 * Dakikada bir (zamanlayıcı): öğrenci sınırı dolan Pi Koç hesabının sahibine üst paketleri (fiyat ve sitedeki Paketler
 * bağlantısıyla) yalnızca e-postayla bildirir. Uygulama içi bildirim gönderilmez: mobil uygulamada satış ve satışa
 * yönlendirme yok (Google Play ödeme politikası). En fazla 14 günde bir; en büyük pakette olana gönderilmez.
 */
export async function sendCoachLimitMails(now = new Date()): Promise<number> {
  const settings = await loadSettings();
  const tiers = parseCoachTiers(settings.piKocTiers);
  if (!tiers.length) return 0;
  const since = new Date(now.getTime() - LIMIT_MAIL_EVERY_DAYS * 86_400_000);
  const centers = await db.center.findMany({
    where: { kind: "COACH", OR: [{ limitMailAt: null }, { limitMailAt: { lt: since } }] },
    select: {
      id: true,
      status: true,
      trialEndsAt: true,
      paidUntil: true,
      studentLimit: true,
      promoUntil: true,
      promoStudents: true,
      members: { where: { role: "OWNER", isActive: true }, select: { user: { select: { id: true, email: true, firstName: true } } } },
    },
  });
  if (!centers.length) return 0;
  const counts = new Map(
    (await db.centerStudent.groupBy({ by: ["centerId"], where: { status: "ACTIVE", centerId: { in: centers.map((c) => c.id) } }, _count: true })).map((g) => [g.centerId, g._count]),
  );
  let sent = 0;
  for (const c of centers) {
    const plan = coachPlan(c, settings.piKocFreeStudents, now);
    const active = counts.get(c.id) ?? 0;
    const higher = tiers.filter((t) => t.students > plan.studentLimit);
    if (active < plan.studentLimit || !higher.length) continue;
    await db.$transaction(async (tx) => {
      for (const { user } of c.members) {
        if (!user.email) continue;
        await emailChannel.enqueue(tx, {
          userId: user.id,
          to: user.email,
          subject: `Öğrenci sınırınız doldu · ${settings.siteName}`,
          senderName: settings.siteName,
          greetingName: user.firstName,
          title: `Pi Koç paketinizdeki ${plan.studentLimit} öğrencilik yer doldu`,
          lines: [
            "Yeni öğrenci eklemek için paketinizi büyütebilirsiniz. Bütün ücretli paketlerde özellikler aynıdır; fark öğrenci sayısıdır:",
            ...higher.map((t) => `• ${t.name}: ${t.students} öğrenciye kadar, aylık ${formatMoney(t.priceTl * 100)}`),
            "Paketi sitedeki Paketler sayfasından ya da WhatsApp'tan alabilirsiniz. Size verilen paket kodunu mobil uygulamada Hesap → Paketler'den de girebilirsiniz.",
          ],
          action: { label: "Paketleri görün", url: "/koc/abonelik" },
        });
      }
      await tx.center.update({ where: { id: c.id }, data: { limitMailAt: now } });
    });
    sent++;
  }
  return sent;
}
