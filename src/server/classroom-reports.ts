import { REPORT_REASONS } from "@/lib/classroom-report";
import { audit } from "./audit";
import { db } from "./db";
import { notify, notifyRole } from "./notifications";
import { closeClassroom } from "./video";

// Sanal sınıfta "uygunsuz durum bildir": ders odası hemen kapanır, yöneticilere acil bildirim gider.
// Öğrenci tarafı bildirdiyse öğretmenin profili inceleme bitene kadar askıya alınır (aramada görünmez, randevu alamaz).

export class ReportError extends Error {}


export async function reportClassroom(bookingId: string, reporterId: string, reason: string, details: string | null, now = new Date()) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { teacher: { select: { status: true } } } });
  if (!booking || (booking.studentId !== reporterId && booking.teacherId !== reporterId)) throw new ReportError("Ders bulunamadı.");
  if (!REPORT_REASONS.includes(reason as (typeof REPORT_REASONS)[number])) throw new ReportError("Bir neden seçin.");
  const byStudent = booking.studentId === reporterId;
  const suspend = byStudent && booking.teacher.status === "PUBLISHED";

  const report = await db.$transaction(async (tx) => {
    const created = await tx.classroomReport.create({
      data: { bookingId, reporterId, reason, details: details?.trim().slice(0, 2000) || null, teacherSuspended: suspend, createdAt: now },
    });
    if (suspend) await tx.teacherProfile.update({ where: { userId: booking.teacherId }, data: { status: "SUSPENDED" } });
    await notifyRole(
      "ADMIN",
      {
        type: "admin.classroom_report",
        title: `ACİL: derste uygunsuz durum bildirildi (${booking.code})`,
        body: `${byStudent ? "Öğrenci/veli" : "Öğretmen"} bildirdi: ${reason}.${suspend ? " Öğretmen profili inceleme için askıya alındı." : ""}`,
        link: "/yonetim/ders-bildirimleri",
      },
      tx,
    );
    if (suspend) {
      await notify(
        {
          userId: booking.teacherId,
          type: "teacher.suspended_review",
          title: "Profiliniz incelemeye alındı",
          body: `${booking.code} numaralı derste bir bildirim yapıldı. İnceleme sürerken profiliniz aramada görünmez. Ekibimiz sizinle iletişime geçecek.`,
          link: "/ogretmen-paneli",
        },
        tx,
      );
    }
    return created;
  });
  await audit({ actorId: reporterId, action: "classroom.report", entityType: "Booking", entityId: bookingId, details: { reason, suspended: suspend } });
  if (booking.videoRoomName) await closeClassroom(booking.videoRoomName);
  return report;
}

/** Yönetici kararı: öğretmen yeniden yayına alınabilir ya da askıda bırakılır. */
export async function resolveClassroomReport(adminId: string, reportId: string, restoreTeacher: boolean, note: string, now = new Date()) {
  const report = await db.classroomReport.findUnique({ where: { id: reportId }, include: { booking: { select: { teacherId: true, code: true } } } });
  if (!report || report.resolvedAt) throw new ReportError("Açık bildirim bulunamadı.");
  const text = note.trim().slice(0, 1000);
  if (text.length < 3) throw new ReportError("İnceleme notunu yazın.");
  await db.$transaction(async (tx) => {
    await tx.classroomReport.update({ where: { id: reportId }, data: { resolvedAt: now, resolutionNote: text } });
    if (restoreTeacher && report.teacherSuspended) {
      const otherOpen = await tx.classroomReport.count({ where: { id: { not: reportId }, resolvedAt: null, teacherSuspended: true, booking: { teacherId: report.booking.teacherId } } });
      if (!otherOpen) {
        await tx.teacherProfile.update({ where: { userId: report.booking.teacherId }, data: { status: "PUBLISHED" } });
        await notify({ userId: report.booking.teacherId, type: "teacher.restored", title: "Profiliniz yeniden yayında", body: "İnceleme tamamlandı; profiliniz aramada tekrar görünüyor.", link: "/ogretmen-paneli" }, tx);
      }
    }
  });
  await audit({ actorId: adminId, action: restoreTeacher ? "classroom.report_restored" : "classroom.report_closed", entityType: "ClassroomReport", entityId: reportId, details: { note: text } });
}
