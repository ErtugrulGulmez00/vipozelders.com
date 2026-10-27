// Bildirim akışlarını rollere göre uçtan uca dener: öğrenci, veli, öğretmen ve kurum sahibi için test hesapları ve
// bir test dershanesi kurar (yoksa), sonra her role tipik bildirimleri gönderir ve kuyruğa ne girdiğini yazar.
//
//   npx tsx --env-file=.env scripts/bildirim-testi.ts [--kanal=email|whatsapp|hybrid] [--eposta=ad@gmail.com] [--telefon=05XXXXXXXXX]
//
//   --kanal    : bu çalıştırma için bildirim kanalı (site ayarı sonra eski haline döner). Verilmezse ayardaki kanal.
//   --eposta   : test hesaplarının e-postası gerçek kutunuza gelsin: ad+ogrenci@gmail.com, ad+veli@… (Gmail "+" adresleri)
//   --telefon  : test hesaplarının telefonu (WhatsApp denemesi için); verilmezse telefon eklenmez
//
// Hesaplar her çalıştırmada aynı kalır (kullanıcı adları bildirim.*); şifre: Bildirim123!
// E-postalar zamanlayıcıyla gönderilir; yerelde Yönetim → E-postalar ekranında görünür.

import { CENTER_ROLE_LABEL } from "../src/lib/center/permissions";
import { hashPassword } from "../src/server/auth/password";
import { centerContact, messageGuardians, notifyCenterManagers } from "../src/server/center/messages";
import { db } from "../src/server/db";
import { notify } from "../src/server/notifications";
import { loadSettings, saveSettings } from "../src/server/settings";
import { WA_TEMPLATES } from "../src/server/whatsapp";

const PASSWORD = "Bildirim123!";
const CENTER_SLUG = "bildirim-test-dershanesi";

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const kanal = arg("kanal");
const baseEmail = arg("eposta");
const phone = arg("telefon");
if (kanal && !["email", "whatsapp", "hybrid"].includes(kanal)) throw new Error("--kanal email, whatsapp ya da hybrid olmalı.");

function emailFor(role: string): string {
  if (!baseEmail) return `bildirim.${role}@bildirim-test.local`;
  const [local, domain] = baseEmail.split("@");
  return `${local}+${role}@${domain}`;
}

async function upsertUser(username: string, data: { role: "STUDENT" | "TEACHER" | "CENTER"; firstName: string; lastName: string; email: string }, passwordHash: string) {
  const existing = await db.user.findUnique({ where: { username } });
  const fields = { email: data.email, firstName: data.firstName, lastName: data.lastName, phone: phone ?? null, whatsappOptOut: false };
  if (existing) return db.user.update({ where: { id: existing.id }, data: fields });
  return db.user.create({ data: { ...fields, username, role: data.role, passwordHash, mustChangePassword: false, emailVerifiedAt: new Date() } });
}

async function setup() {
  const passwordHash = await hashPassword(PASSWORD);
  const ogrenci = await upsertUser("bildirim.ogrenci", { role: "STUDENT", firstName: "Deniz", lastName: "Öğrenci", email: emailFor("ogrenci") }, passwordHash);
  const veli = await upsertUser("bildirim.veli", { role: "STUDENT", firstName: "Ayşe", lastName: "Veli", email: emailFor("veli") }, passwordHash);
  const ogretmen = await upsertUser("bildirim.ogretmen", { role: "TEACHER", firstName: "Murat", lastName: "Öğretmen", email: emailFor("ogretmen") }, passwordHash);
  const kurum = await upsertUser("bildirim.kurum", { role: "CENTER", firstName: "Selin", lastName: "Kurum", email: emailFor("kurum") }, passwordHash);

  for (const [user, accountType] of [
    [ogrenci, "STUDENT"],
    [veli, "PARENT"],
  ] as const) {
    await db.studentProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, accountType, kvkkConsentAt: new Date() }, update: {} });
  }
  // Öğretmen profili taslak: vitrinde görünmez
  await db.teacherProfile.upsert({ where: { userId: ogretmen.id }, create: { userId: ogretmen.id, slug: "bildirim-test-ogretmen", status: "DRAFT" }, update: {} });

  const center =
    (await db.center.findUnique({ where: { slug: CENTER_SLUG } })) ??
    (await db.center.create({
      data: { name: "Bildirim Test Dershanesi", slug: CENTER_SLUG, kind: "DERSHANE", edition: "DERSHANE", plan: "PRO", studentLimit: 100, status: "ACTIVE", paidUntil: new Date(Date.now() + 365 * 86_400_000), phone: "0216 000 00 00" },
    }));
  if (!(await db.centerMember.findFirst({ where: { centerId: center.id, userId: kurum.id } }))) {
    await db.centerMember.create({ data: { centerId: center.id, userId: kurum.id, role: "OWNER", title: CENTER_ROLE_LABEL.OWNER } });
  }
  const student =
    (await db.centerStudent.findFirst({ where: { centerId: center.id, firstName: "Deniz", lastName: "Öğrenci" } })) ??
    (await db.centerStudent.create({ data: { centerId: center.id, firstName: "Deniz", lastName: "Öğrenci", studentNumber: "1001", gradeName: "8. sınıf" } }));
  const guardian = await db.centerGuardian.findFirst({ where: { studentId: student.id, isStudentAccount: false } });
  const guardianData = { fullName: "Ayşe Veli", relation: "Anne", phone: phone ?? null, email: veli.email, isPrimary: true, notifyWhatsapp: true, notifyEmail: true, userId: veli.id, linkedAt: new Date() };
  if (guardian) await db.centerGuardian.update({ where: { id: guardian.id }, data: guardianData });
  else await db.centerGuardian.create({ data: { centerId: center.id, studentId: student.id, ...guardianData } });
  if (!(await db.centerGuardian.findFirst({ where: { studentId: student.id, isStudentAccount: true } }))) {
    await db.centerGuardian.create({ data: { centerId: center.id, studentId: student.id, fullName: "Deniz Öğrenci", relation: "Öğrenci", isStudentAccount: true, notifyWhatsapp: false, notifyEmail: false, userId: ogrenci.id, linkedAt: new Date() } });
  }
  return { ogrenci, veli, ogretmen, kurum, center, student };
}

async function simulate(s: Awaited<ReturnType<typeof setup>>) {
  const lesson = "Ortaokul Matematik · Özel Ders — yarın 19:00–20:00";
  // Özel ders tarafı
  await notify({ userId: s.ogretmen.id, type: "booking.request", lesson, title: "Yeni ders talebi", body: `Ayşe Veli için ${lesson}. Lütfen onaylayın.`, link: "/ogretmen-paneli/talepler" });
  await notify({ userId: s.veli.id, type: "booking.confirmed", lesson, title: "Dersiniz onaylandı", body: `${lesson}. Ders sitemizdeki sanal sınıfta yapılacak.`, link: "/hesabim/derslerim" });
  await notify({ userId: s.veli.id, type: "reminder.1h", lesson, title: "Dersiniz 1 saat içinde başlıyor", body: lesson, link: "/hesabim/derslerim" });
  await notify({ userId: s.ogrenci.id, type: "question.solved", lesson: "Lise Fizik · Fotoğrafla soru", title: "Sorunuzun çözümü geldi", body: "Çözümü inceleyin; anlamadığınız yeri öğretmeninize yazabilirsiniz.", link: "/hesabim/derslerim" });
  // Kurum tarafı: veliye devamsızlık, tahsilat ve duyuru; öğrenci hesabına bildirim; kurum sahibine ön kayıt
  const base = { centerId: s.center.id, centerName: s.center.name, studentId: s.student.id };
  await messageGuardians({
    ...base,
    kind: "absence",
    messageTitle: "Devamsızlık",
    template: { name: WA_TEMPLATES.absence, params: ["Deniz Öğrenci", "bugün 10:00", "Matematik", centerContact(s.center)] },
    message: "Sayın veli, öğrenciniz Deniz Öğrenci bugün 10:00 saatindeki Matematik dersine katılmamıştır.",
    notification: { title: "Deniz derse katılmadı", body: "Bugün 10:00 · Matematik" },
  });
  await messageGuardians({ ...base, kind: "payment_receipt", messageTitle: "Ödemeniz alındı", message: "Deniz Öğrenci için 2.500 TL ödemeniz alınmıştır. Makbuz no: 1. Teşekkür ederiz.", notification: { title: "Ödemeniz alındı", body: "2.500 TL · makbuz 1" } });
  await messageGuardians({ ...base, kind: "announcement", messageTitle: "Duyuru: Veli toplantısı", message: "Cumartesi 11:00'de veli toplantımız var.", channels: { whatsapp: true, email: true }, notification: { title: "Duyuru: Veli toplantısı", body: "Cumartesi 11:00" } });
  await messageGuardians({ ...base, kind: "question_answered", notification: { title: "Matematik sorunun çözümü hazır", body: "Çözümü görmek için dokunun." } });
  await notifyCenterManagers(s.center.id, { type: "center.lead", title: "Yeni ön kayıt", body: "Can Aday · 0532 000 00 00", link: "/kurum/on-kayit" });
}

async function main() {
  const original = (await loadSettings()).notificationChannel;
  if (kanal) await saveSettings({ notificationChannel: kanal as "email" | "whatsapp" | "hybrid" });
  const started = new Date();
  try {
    const s = await setup();
    await simulate(s);
    const mode = (await loadSettings()).notificationChannel;
    console.log(`\nBildirim kanalı: ${mode}${kanal ? " (bu çalıştırma için)" : ""}\n`);
    const rows = [
      ["Öğrenci", s.ogrenci],
      ["Veli", s.veli],
      ["Öğretmen", s.ogretmen],
      ["Kurum sahibi", s.kurum],
    ] as const;
    for (const [label, user] of rows) {
      const since = { createdAt: { gte: started } };
      const [app, emails, whatsapps] = await Promise.all([
        db.notification.count({ where: { userId: user.id, ...since } }),
        db.emailMessage.count({ where: { OR: [{ userId: user.id }, { to: user.email ?? "-" }], ...since } }),
        db.whatsAppMessage.count({ where: { userId: user.id, ...since } }),
      ]);
      console.log(`${label.padEnd(13)} ${user.username?.padEnd(18)} bildirim: ${app}  e-posta: ${emails}  WhatsApp: ${whatsapps}`);
    }
    console.log(`\nGiriş: kullanıcı adları yukarıda, şifre ${PASSWORD} · Kurum paneli: /kurum-giris?kurum=${CENTER_SLUG}`);
  } finally {
    if (kanal) await saveSettings({ notificationChannel: original });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
