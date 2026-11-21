import { meetingAccess } from "@/server/koc-meeting";
import { webLoginLink } from "@/server/mobile/auth";
import { json, notFound } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/**
 * Görüşme ekranındaki beyaz tahta: tahta sayfası (/gorusme/<öğrenci>/tahta) için tek kullanımlık web oturumu bağlantısı.
 * Uygulama bunu görüşme ekranının içinde web görünümüyle açar. → { url }
 */
export const POST = withUser<{ studentId: string }>(
  async ({ user, params }) => {
    const access = await meetingAccess(user.id, params.studentId);
    if (!access.ok) throw notFound("Görüşme odası bulunamadı.");
    return json({ url: await webLoginLink(user.id, `/gorusme/${params.studentId}/tahta`) });
  },
  { allowCenter: true },
);
