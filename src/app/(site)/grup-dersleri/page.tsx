import { CalendarRange, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar, Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { scheduleSummary } from "@/lib/groups";
import { formatMoney } from "@/lib/money";
import { fullName, initials } from "@/lib/text";
import { db } from "@/server/db";
import { loadSettings } from "@/server/settings";
import { uploadUrl } from "@/server/storage";

export const metadata: Metadata = {
  title: "Grup dersleri: sanal dershane",
  description: "Onaylı öğretmenlerle 4–10 kişilik online grup dersleri ve kamplar. Kişi başı uygun fiyat; en az kişi dolmazsa ücretin tamamı iade.",
};

export const instant = false;

export default async function GroupCoursesPage() {
  const settings = await loadSettings();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-brand-700">Sanal dershane</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Grup dersleri</h1>
        <p className="mt-3 text-slate-600">
          {settings.groupMinParticipants}–{settings.groupMaxCapacity} kişilik online sınıflarda, birebir dersten çok daha uygun fiyata. Ders, kayıt bitişinde en az kişi sayısına ulaşırsa açılır; ulaşmazsa ödediğiniz ücretin tamamı iade edilir.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="mt-8 h-64 rounded-2xl" />}>
        <CourseList />
      </Suspense>
    </div>
  );
}

async function CourseList() {
  await connection();
  const now = new Date();
  const courses = await db.groupCourse.findMany({
    where: { status: "OPEN", isPublic: true, enrollDeadline: { gt: now }, teacher: { status: "PUBLISHED", user: { status: "ACTIVE" } } },
    orderBy: { enrollDeadline: "asc" },
    take: 60,
    include: {
      sessions: { orderBy: { index: "asc" }, select: { startAt: true, endAt: true } },
      teacher: { select: { photoKey: true, user: { select: { firstName: true, lastName: true } } } },
      _count: { select: { enrollments: { where: { status: "PAID" } } } },
    },
  });
  if (!courses.length) {
    return (
      <div className="mt-8">
        <EmptyState icon={<Users className="size-8" />} title="Şu an kayıt alan grup dersi yok" description="Yeni programlar açıldıkça burada listelenir. Bu arada birebir ders için öğretmenlerimize göz atabilirsiniz." />
      </div>
    );
  }
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2">
      {courses.map((c) => {
        const left = Math.max(0, c.capacity - c._count.enrollments);
        return (
          <Link key={c.id} href={`/grup-dersleri/${c.code}`} className="group">
            <Card className="h-full p-5 transition group-hover:border-brand-300 group-hover:shadow-md">
              <p className="text-xs font-semibold text-brand-700">
                {c.levelName} · {c.subjectName}
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900 group-hover:text-brand-700">{c.title}</h2>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <Avatar src={uploadUrl(c.teacher.photoKey)} name={fullName(c.teacher.user)} initials={initials(c.teacher.user)} size={28} />
                {fullName(c.teacher.user)}
              </div>
              <p className="mt-3 flex gap-2 text-sm text-slate-600">
                <CalendarRange className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden /> {scheduleSummary(c.sessions)}
              </p>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
                <p>
                  <span className="text-xl font-bold text-slate-900">{formatMoney(c.price)}</span>
                  <span className="text-sm text-slate-500"> / kişi, tüm program</span>
                </p>
                <p className="text-xs text-slate-500">
                  {left ? `${left} yer kaldı` : "Kontenjan doldu"} · son kayıt {formatDateTime(c.enrollDeadline)}
                </p>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
