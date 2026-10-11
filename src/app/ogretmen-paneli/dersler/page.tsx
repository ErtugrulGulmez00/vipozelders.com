import type { Metadata } from "next";
import Link from "next/link";
import { BookingRow } from "@/components/panel/booking-ui";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Derslerim" };

export default async function TeacherLessonsPage({ searchParams }: PageProps<"/ogretmen-paneli/dersler">) {
  const user = await requireRole("TEACHER");
  const tab = (await searchParams).sekme === "gecmis" ? "gecmis" : "yaklasan";
  const now = new Date();
  const lessons = await db.booking.findMany({
    where:
      tab === "yaklasan"
        ? { teacherId: user.id, status: "CONFIRMED", endAt: { gt: now } }
        : { teacherId: user.id, status: { in: ["COMPLETED", "NO_SHOW_STUDENT", "NO_SHOW_TEACHER", "DISPUTED", "CANCELLED_BY_STUDENT", "CANCELLED_BY_TEACHER", "CANCELLED_BY_ADMIN"] } },
    orderBy: { startAt: tab === "yaklasan" ? "asc" : "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader title="Derslerim" />
      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold sm:w-fit">
        {[
          { key: "yaklasan", label: "Yaklaşan" },
          { key: "gecmis", label: "Geçmiş ve iptaller" },
        ].map((t) => (
          <Link key={t.key} href={`/ogretmen-paneli/dersler?sekme=${t.key}`} className={cn("flex-1 rounded-lg px-4 py-1.5 text-center", tab === t.key ? "bg-white text-brand-700 shadow-xs" : "text-slate-600")}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="space-y-3">
        {lessons.length ? (
          lessons.map((b) => <BookingRow key={b.id} booking={{ ...b, price: b.teacherAmount, counterpart: b.learnerName }} href={`/ogretmen-paneli/dersler/${b.id}`} />)
        ) : (
          <EmptyState title="Bu bölümde ders yok" />
        )}
      </div>
    </>
  );
}
