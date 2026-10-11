import { Heart } from "lucide-react";
import type { Metadata } from "next";
import { TeacherCard } from "@/components/site/teacher-card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { shortName } from "@/lib/text";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { uploadUrl } from "@/server/storage";

export const metadata: Metadata = { title: "Favori öğretmenler" };

export default async function FavoritesPage() {
  const user = await requireRole("STUDENT");
  const favorites = await db.favorite.findMany({
    where: { studentId: user.id, teacher: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    include: {
      teacher: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          city: { select: { name: true } },
          offerings: { where: { isActive: true }, include: { subject: { select: { name: true } } } },
        },
      },
    },
  });

  return (
    <>
      <PageHeader title="Favori öğretmenler" />
      {favorites.length === 0 ? (
        <EmptyState icon={<Heart className="size-8" />} title="Henüz favori öğretmeniniz yok" description="Öğretmen profillerindeki kalp butonuyla favorilerinize ekleyebilirsiniz." action={<LinkButton href="/ogretmenler">Öğretmenlere göz at</LinkButton>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {favorites.map(({ teacher }) => (
            <TeacherCard
              key={teacher.userId}
              teacher={{
                userId: teacher.userId,
                slug: teacher.slug,
                name: shortName(teacher.user),
                headline: teacher.headline,
                photoUrl: uploadUrl(teacher.photoKey),
                ratingAvg: teacher.ratingAvg,
                ratingCount: teacher.ratingCount,
                completedLessons: teacher.completedLessons,
                experienceYears: teacher.experienceYears,
                cityName: teacher.city?.name ?? null,
                offersOnline: teacher.offersOnline,
                offersInPerson: teacher.offersInPerson,
                verified: teacher.verificationStatus === "VERIFIED",
                featured: teacher.isFeatured,
                minHourlyPrice: Math.min(...teacher.offerings.map((o) => o.hourlyPrice)),
                subjects: [...new Set(teacher.offerings.map((o) => o.subject.name))].slice(0, 4),
                avgResponseMinutes: teacher.avgResponseMinutes,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
