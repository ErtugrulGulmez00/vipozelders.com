import { maskContacts } from "@/lib/text";
import { db } from "./db";
import { notify, notifyRole } from "./notifications";

// Veli/öğrenci ile öğretmen arasında mesajlaşma (randevu öncesi soru, ders sonrası takip).
// İletişim bilgileri (telefon, e-posta, adres, sosyal medya) otomatik gizlenir; platform dışına çıkışı önler.

export class MessageError extends Error {}

const MAX_LENGTH = 2000;
/** Öğrencinin, öğretmen henüz cevap vermemişken art arda gönderebileceği en fazla mesaj. */
const MAX_UNANSWERED = 3;
/** Bir öğrencinin günde başlatabileceği en fazla yeni konuşma (spam önlemi). */
const MAX_NEW_THREADS_PER_DAY = 5;
/** Yeni mesaj bildirimi aynı konuşma için en fazla bu aralıkla gider. */
const NOTIFY_EVERY_MS = 10 * 60_000;
/** Öğretmen son 30 günde bu kadar şüpheli mesaj yazarsa yöneticiye bildirilir (günde en fazla bir kez). */
const ADMIN_ALERT_THRESHOLD = 3;

// Platform dışına yönlendirme işaretleri (küçük harfe çevrilmiş metinde aranır). Gizleme yapılmasa da
// "WhatsApp'tan yazalım", "elden ödersiniz" gibi ifadeler yönetici denetimine düşer.
const OFF_PLATFORM: [RegExp, string][] = [
  [/whats\s*app|watsap|vatsap|whatsap|\bwp\b|wpden|telegram|instagram|\binsta\b|\bdm\b|snapchat|facebook|\bface\b/, "Başka uygulamaya yönlendirme"],
  [/(numara|telefon)(n|m)?(ı|i|ı|u)?(n|m)?\s*(ver|yaz|at|gönder|söyle|paylaş)|beni\s+ara|ararım|ara\s+beni|arayın|arar\s*mısın/, "Telefon isteme / verme"],
  [/\biban\b|havale|\beft\b|elden|nakit|hesabıma|hesap\s*numara/, "Platform dışı ödeme"],
  [/site\s*dışı|platform\s*dışı|siteden\s*(değil|bağımsız)|dışarıda\s*(ders|görüş|anlaş)|özelden|komisyon\s*(vermeden|ödemeden|olmadan)|aracısız|direkt\s*(ödeme|anlaş)|doğrudan\s*(ödeme|anlaş)/, "Platform dışına yönlendirme"],
  [/gmail|hotmail|outlook|yandex|e-?posta\s*adres|mail\s*adres/, "E-posta isteme / verme"],
];

/** Mesajda platform dışına çıkma işareti var mı? Varsa nedeni döner. */
export function offPlatformReason(text: string): string | null {
  // Türkçe küçük harfte "IBAN" → "ıban" olur; ı'sız hâli de aranır.
  const lower = text.toLocaleLowerCase("tr-TR");
  const dotted = lower.replace(/ı/g, "i");
  const reasons = OFF_PLATFORM.filter(([re]) => re.test(lower) || re.test(dotted)).map(([, reason]) => reason);
  return reasons.length ? [...new Set(reasons)].join(", ") : null;
}

type Sender = { id: string; role: string };

async function getOrCreateThread(studentId: string, teacherId: string, now: Date) {
  const existing = await db.messageThread.findUnique({ where: { studentId_teacherId: { studentId, teacherId } } });
  if (existing) return existing;
  const today = await db.messageThread.count({ where: { studentId, createdAt: { gte: new Date(now.getTime() - 24 * 3_600_000) } } });
  if (today >= MAX_NEW_THREADS_PER_DAY) throw new MessageError("Bugün çok sayıda öğretmene yazdınız; yarın tekrar deneyin.");
  return db.messageThread.create({ data: { studentId, teacherId, lastMessageAt: now } });
}

/** Öğrenci öğretmen profilinden ilk mesajı yazar (ya da var olan konuşmaya ekler). */
export async function messageTeacher(studentId: string, teacherId: string, text: string, now = new Date()) {
  const teacher = await db.teacherProfile.findUnique({ where: { userId: teacherId }, select: { status: true, user: { select: { status: true } } } });
  if (!teacher || teacher.status !== "PUBLISHED" || teacher.user.status !== "ACTIVE") throw new MessageError("Bu öğretmene şu an mesaj gönderilemiyor.");
  if (teacherId === studentId) throw new MessageError("Kendinize mesaj gönderemezsiniz.");
  const thread = await getOrCreateThread(studentId, teacherId, now);
  await sendMessage(thread.id, { id: studentId, role: "STUDENT" }, text, now);
  return thread;
}

export async function sendMessage(threadId: string, sender: Sender, text: string, now = new Date()) {
  const thread = await db.messageThread.findUnique({ where: { id: threadId } });
  if (!thread || (thread.studentId !== sender.id && thread.teacherId !== sender.id)) throw new MessageError("Konuşma bulunamadı.");
  const raw = text.trim();
  if (raw.length < 2) throw new MessageError("Mesajınızı yazın.");
  if (raw.length > MAX_LENGTH) throw new MessageError(`Mesaj en fazla ${MAX_LENGTH} karakter olabilir.`);
  const fromStudent = sender.id === thread.studentId;

  if (fromStudent) {
    // Öğretmen cevap vermeden art arda çok mesaj atılmasın
    const last = await db.directMessage.findMany({ where: { threadId }, orderBy: { createdAt: "desc" }, take: MAX_UNANSWERED, select: { authorId: true } });
    if (last.length === MAX_UNANSWERED && last.every((m) => m.authorId === sender.id)) {
      throw new MessageError("Öğretmenin cevabını bekleyin; cevap gelince yazışmaya devam edebilirsiniz.");
    }
  }

  const body = maskContacts(raw);
  const masked = body !== raw;
  const detected = offPlatformReason(raw);
  const flagReason = masked ? ["İletişim bilgisi paylaşıldı (gizlendi)", detected].filter(Boolean).join(", ") : detected;
  const previous = await db.directMessage.findFirst({ where: { threadId, authorId: sender.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  await db.$transaction([
    db.directMessage.create({ data: { threadId, authorId: sender.id, body, masked, flagReason, originalBody: masked ? raw : null, createdAt: now } }),
    db.messageThread.update({
      where: { id: threadId },
      data: { lastMessageAt: now, ...(fromStudent ? { studentReadAt: now } : { teacherReadAt: now }), ...(flagReason ? { flaggedAt: now } : {}) },
    }),
  ]);
  if (flagReason && !fromStudent) await warnTeacher(thread.teacherId, threadId, now);

  // Karşı tarafa bildirim (art arda mesajlarda 10 dakikada bir)
  if (!previous || now.getTime() - previous.createdAt.getTime() > NOTIFY_EVERY_MS) {
    const author = await db.user.findUniqueOrThrow({ where: { id: sender.id }, select: { firstName: true, lastName: true } });
    await notify({
      userId: fromStudent ? thread.teacherId : thread.studentId,
      type: "message.new",
      title: `${author.firstName} ${fromStudent ? author.lastName.charAt(0) + "." : author.lastName} size mesaj gönderdi`,
      body: body.slice(0, 160),
      link: fromStudent ? `/ogretmen-paneli/mesajlar/${threadId}` : `/hesabim/mesajlar/${threadId}`,
    });
  }
  return { masked };
}

/** Konuşma ve mesajlar; açan taraf için okundu işaretlenir. */
export async function loadThread(threadId: string, viewerId: string, now = new Date()) {
  const thread = await db.messageThread.findUnique({
    where: { id: threadId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      teacher: { select: { id: true, firstName: true, lastName: true, teacherProfile: { select: { slug: true, photoKey: true } } } },
      messages: { orderBy: { createdAt: "asc" }, take: 300 },
    },
  });
  if (!thread || (thread.studentId !== viewerId && thread.teacherId !== viewerId)) return null;
  await db.messageThread.update({ where: { id: threadId }, data: thread.studentId === viewerId ? { studentReadAt: now } : { teacherReadAt: now } });
  return thread;
}

/** Kullanıcının konuşmaları (son mesaj ve okunmamış işaretiyle). */
export async function listThreads(userId: string, as: "student" | "teacher") {
  const threads = await db.messageThread.findMany({
    where: as === "student" ? { studentId: userId } : { teacherId: userId },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      student: { select: { firstName: true, lastName: true } },
      teacher: { select: { firstName: true, lastName: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, authorId: true, createdAt: true } },
    },
  });
  return threads.map((t) => {
    const readAt = as === "student" ? t.studentReadAt : t.teacherReadAt;
    const last = t.messages[0];
    return { ...t, last, unread: Boolean(last && last.authorId !== userId && (!readAt || readAt < last.createdAt)) };
  });
}

export async function unreadThreadCount(userId: string, as: "student" | "teacher") {
  return (await listThreads(userId, as)).filter((t) => t.unread).length;
}

/**
 * Öğretmenin şüpheli mesajı: öğretmene kural hatırlatması (saatte en fazla bir), son 30 günde eşik aşılırsa
 * yöneticiye bildirim (günde en fazla bir).
 */
async function warnTeacher(teacherId: string, threadId: string, now: Date) {
  const hourAgo = new Date(now.getTime() - 3_600_000);
  if (!(await db.notification.count({ where: { userId: teacherId, type: "message.warning", createdAt: { gte: hourAgo } } }))) {
    await notify({
      userId: teacherId,
      type: "message.warning",
      title: "Uyarı: kişisel iletişim ve platform dışı anlaşma yasaktır",
      body: "Mesajınızda iletişim bilgisi ya da platform dışına yönlendirme tespit edildi ve ekibimize iletildi. Tekrarı hâlinde hesabınız kalıcı olarak kapatılır.",
      link: `/ogretmen-paneli/mesajlar/${threadId}`,
    });
  }
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
  const flagged = await db.directMessage.count({ where: { authorId: teacherId, flagReason: { not: null }, createdAt: { gte: monthAgo } } });
  if (flagged < ADMIN_ALERT_THRESHOLD) return;
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const link = `/yonetim/mesajlar?ogretmen=${teacherId}`;
  if (await db.notification.count({ where: { type: "admin.message_flags", link, createdAt: { gte: dayAgo } } })) return;
  const teacher = await db.user.findUniqueOrThrow({ where: { id: teacherId }, select: { firstName: true, lastName: true } });
  await notifyRole("ADMIN", {
    type: "admin.message_flags",
    title: `Öğretmen tekrar tekrar platform dışına yönlendiriyor olabilir: ${teacher.firstName} ${teacher.lastName}`,
    body: `Son 30 günde ${flagged} şüpheli mesaj. İnceleyip gerekirse hesabı askıya alın.`,
    link,
  });
}

/** Yönetici denetimi: incelenecek konuşma sayısı (son şüpheli mesaj son incelemeden sonra). */
export async function threadsToReviewCount() {
  const rows = await db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "MessageThread" WHERE "flaggedAt" IS NOT NULL AND ("reviewedAt" IS NULL OR "reviewedAt" < "flaggedAt")`;
  return Number(rows[0]?.n ?? 0);
}
