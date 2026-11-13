import { ApiError, json, notFound } from "@/server/mobile/http";
import { coachMeetingAllowance, MEETING_RESUME_MINUTES } from "@/server/koc-meeting-usage";
import { announceMeeting, meetingAccess, meetingLive, meetingToken } from "@/server/koc-meeting";
import { withUser } from "@/server/mobile/route";

/**
 * Online görüşme odasına giriş anahtarı (uygulama LiveKit'e kendisi bağlanır). Koç ya da öğrencinin kendisi/velisi.
 * Koç girince öğrenciye bildirim gider.
 */
export const POST = withUser<{ studentId: string }>(
  async ({ user, params }) => {
    const access = await meetingAccess(user.id, params.studentId);
    if (!access.ok) throw notFound("Görüşme odası bulunamadı.");
    const name = { id: user.id, firstName: user.firstName, lastName: user.lastName };
    const allowance = await coachMeetingAllowance(params.studentId);
    if (!allowance.ok) {
      const studentText = allowance.scope === "meeting" ? `Bu görüşmenin süresi doldu. Koçunuz ${MEETING_RESUME_MINUTES} dakika sonra yeni görüşme başlatabilir.` : "Koçunuzun bu ayki görüşme süresi doldu. Koçunuzla iletişime geçin.";
      throw new ApiError(403, "MEETING_LIMIT", access.role === "teacher" ? allowance.reason : studentText);
    }
    // Öğrenci yalnızca koç görüşmeyi başlattıktan sonra girebilir
    if (access.role === "student" && !(await meetingLive(params.studentId))) throw new ApiError(409, "MEETING_NOT_STARTED", "Koçunuz görüşmeyi henüz başlatmadı. Başlatınca bildirim gelir.");
    const room = await meetingToken(params.studentId, access.role, name, allowance.minutes);
    if (access.role === "teacher") await announceMeeting(params.studentId, `${user.firstName} ${user.lastName}`);
    return json({ ...room, role: access.role === "teacher" ? "coach" : "student", title: `Koç görüşmesi · ${access.student.firstName} ${access.student.lastName}` });
  },
  { allowCenter: true },
);
