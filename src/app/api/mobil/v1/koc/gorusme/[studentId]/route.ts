import { ApiError, json, notFound } from "@/server/mobile/http";
import { coachMeetingAllowance } from "@/server/koc-meeting-usage";
import { announceMeeting, meetingAccess, meetingToken } from "@/server/koc-meeting";
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
    if (!allowance.ok) throw new ApiError(403, "MEETING_LIMIT", access.role === "teacher" ? allowance.reason : "Koçunuzun bu ayki görüşme süresi doldu. Koçunuzla iletişime geçin.");
    const room = await meetingToken(params.studentId, access.role, name, allowance.minutes);
    if (access.role === "teacher") await announceMeeting(params.studentId, `${user.firstName} ${user.lastName}`);
    return json({ ...room, role: access.role === "teacher" ? "coach" : "student", title: `Koç görüşmesi · ${access.student.firstName} ${access.student.lastName}` });
  },
  { allowCenter: true },
);
