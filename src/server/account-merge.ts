import "server-only";
import { db } from "./db";

// Çift öğrenci hesabını birleştirme (yönetim): koçun ya da kurumun açtığı fazla hesap, öğrencinin asıl hesabına katılır.
// Kurum/Pi Koç bağlantıları ve bildirimler asıl hesaba taşınır; fazla hesap kapatılır. Özel derste işlemi olan hesap
// "fazla hesap" olarak seçilemez (ters yönde birleştirin).

export class MergeError extends Error {}

export async function findAccount(identifier: string) {
  const value = identifier.trim().toLowerCase();
  if (!value) return null;
  return db.user.findFirst({ where: { OR: [{ email: value }, { username: value }] }, select: { id: true, role: true, firstName: true, lastName: true, status: true } });
}

export async function mergeStudentAccounts(sourceId: string, targetId: string) {
  if (sourceId === targetId) throw new MergeError("Aynı hesap seçildi.");
  const [source, target] = await Promise.all([
    db.user.findUnique({ where: { id: sourceId }, select: { id: true, role: true, firstName: true, lastName: true } }),
    db.user.findUnique({ where: { id: targetId }, select: { id: true, role: true, status: true } }),
  ]);
  if (!source || !target) throw new MergeError("Hesap bulunamadı.");
  if (source.role !== "STUDENT" || target.role !== "STUDENT") throw new MergeError("Yalnızca veli/öğrenci hesapları birleştirilir.");
  if (target.status !== "ACTIVE") throw new MergeError("Asıl hesap askıda; önce etkinleştirin.");
  const where = { studentId: sourceId };
  const activity = await Promise.all([
    db.booking.count({ where }),
    db.lessonPackage.count({ where }),
    db.messageThread.count({ where }),
    db.teacherInquiry.count({ where: { requesterId: sourceId } }),
    db.creditPurchase.count({ where }),
  ]);
  if (activity.some((n) => n > 0)) throw new MergeError("Bu hesabın özel derste kaydı var (ders, paket, mesaj, talep ya da kredi). Ters yönde birleştirin: bu hesabı asıl hesap yapın.");

  const links = await db.centerGuardian.findMany({ where: { userId: sourceId }, select: { id: true, studentId: true, isStudentAccount: true } });
  const targetLinks = await db.centerGuardian.findMany({ where: { userId: targetId }, select: { id: true, studentId: true, isStudentAccount: true } });
  await db.$transaction(async (tx) => {
    for (const link of links) {
      const existing = targetLinks.find((t) => t.studentId === link.studentId);
      if (existing) {
        // Asıl hesap bu öğrenciye zaten bağlı: öğrenci hesabı bilgisi korunur, fazla bağlantı silinir
        if (link.isStudentAccount && !existing.isStudentAccount) await tx.centerGuardian.update({ where: { id: existing.id }, data: { isStudentAccount: true, relation: "Öğrenci" } });
        await tx.centerGuardian.delete({ where: { id: link.id } });
      } else {
        await tx.centerGuardian.update({ where: { id: link.id }, data: { userId: targetId, linkedAt: new Date() } });
      }
    }
    await tx.notification.updateMany({ where: { userId: sourceId }, data: { userId: targetId } });
    await tx.session.deleteMany({ where: { userId: sourceId } });
    await tx.device.deleteMany({ where: { userId: sourceId } });
    await tx.user.update({ where: { id: sourceId }, data: { status: "SUSPENDED" } });
  });
  return { moved: links.length, sourceName: `${source.firstName} ${source.lastName}` };
}
