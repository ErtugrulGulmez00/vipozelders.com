import { requireRole } from "@/server/mobile/auth";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { INQUIRY_MODE_LABEL, teacherInquiries } from "@/server/teacher-inquiries";
import { toWhatsAppNumber } from "@/server/whatsapp";

/**
 * Öğretmenin vitrinden gelen ders talepleri (en yeni önce, en fazla 100). Velinin telefonu ve e-postası yalnızca
 * kabul edilen talepte döner (sitedeki kural). → { pending, items: [...] }
 */
export const GET = withUser(async ({ user }) => {
  requireRole(user, "TEACHER");
  const items = await teacherInquiries(user.id);
  return json({
    pending: items.filter((q) => q.status === "PENDING").length,
    items: items.map((q) => {
      const accepted = q.status === "ACCEPTED";
      return {
        id: q.id,
        status: q.status,
        createdAt: q.createdAt.toISOString(),
        name: q.name,
        studentName: q.studentName,
        gradeName: q.gradeName,
        lessonName: q.lessonName,
        mode: q.mode,
        modeLabel: INQUIRY_MODE_LABEL[q.mode] ?? q.mode,
        preferredTimes: q.preferredTimes,
        note: q.note,
        phone: accepted ? q.phone : null,
        whatsapp: accepted ? toWhatsAppNumber(q.phone) || null : null,
        email: accepted ? q.email : null,
        // Pi Koç'a eklendiyse öğrencinin kimliği (koç ekranında açılır); kabul edilip eklenemediyse null
        coachStudentId: q.centerStudentId,
      };
    }),
  });
});
