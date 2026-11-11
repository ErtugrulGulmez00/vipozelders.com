import { json, notFound } from "@/server/mobile/http";
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
    const room = await meetingToken(params.studentId, access.role, name);
    if (access.role === "teacher") await announceMeeting(params.studentId, `${user.firstName} ${user.lastName}`);
    return json({ ...room, role: access.role === "teacher" ? "coach" : "student", title: `Koç görüşmesi · ${access.student.firstName} ${access.student.lastName}` });
  },
  { allowCenter: true },
);
