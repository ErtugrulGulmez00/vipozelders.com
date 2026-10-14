import { fullName } from "@/lib/text";
import { db } from "@/server/db";
import { requireRole } from "@/server/mobile/auth";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { absoluteUpload } from "@/server/mobile/serialize";

/** Favori öğretmenler (yayından kalkanlar listelenmez). */
export const GET = withUser(async ({ user }) => {
  requireRole(user, "STUDENT");
  const favorites = await db.favorite.findMany({
    where: { studentId: user.id, teacher: { status: "PUBLISHED", user: { status: "ACTIVE" } } },
    orderBy: { createdAt: "desc" },
    include: {
      teacher: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          offerings: { where: { isActive: true }, select: { hourlyPrice: true, subject: { select: { name: true } } } },
        },
      },
    },
  });
  return json({
    items: favorites.map(({ teacher }) => ({
      userId: teacher.userId,
      slug: teacher.slug,
      name: fullName(teacher.user),
      headline: teacher.headline,
      photoUrl: absoluteUpload(teacher.photoKey),
      ratingAvg: teacher.ratingAvg,
      ratingCount: teacher.ratingCount,
      verified: teacher.verificationStatus === "VERIFIED",
      minHourlyPrice: teacher.offerings.length ? Math.min(...teacher.offerings.map((o) => o.hourlyPrice)) : null,
      subjects: [...new Set(teacher.offerings.map((o) => o.subject.name))].slice(0, 4),
    })),
  });
});
