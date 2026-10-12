import { shortName } from "@/lib/text";
import { db } from "@/server/db";
import { requireRole } from "@/server/mobile/auth";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Öğretmenin aldığı yorumlar; yönetimin gizlediği yorumlar da durumuyla listelenir. */
export const GET = withUser(async ({ user }) => {
  requireRole(user, "TEACHER");
  const reviews = await db.review.findMany({
    where: { teacherId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { student: { select: { firstName: true, lastName: true } }, booking: { select: { levelName: true, subjectName: true } } },
  });
  return json({
    items: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      studentName: shortName(r.student),
      lesson: `${r.booking.levelName} ${r.booking.subjectName}`,
      status: r.status,
      teacherReply: r.teacherReply,
      teacherRepliedAt: r.teacherRepliedAt,
      createdAt: r.createdAt,
    })),
  });
});
