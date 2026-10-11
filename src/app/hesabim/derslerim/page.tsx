import type { Metadata } from "next";
import Link from "next/link";
import { BookingRow } from "@/components/panel/booking-ui";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { requireRole } from "@/server/auth/current-user";
import { CANCELLED_STATUSES, PAST_STATUSES, studentBookings, UPCOMING } from "@/server/student-queries";

export const metadata: Metadata = { title: "Derslerim" };

const TABS = [
  { key: "yaklasan", label: "Yaklaşan" },
  { key: "gecmis", label: "Geçmiş" },
  { key: "iptal", label: "İptal / iade" },
] as const;

export default async function StudentLessonsPage({ searchParams }: PageProps<"/hesabim/derslerim">) {
  const user = await requireRole("STUDENT");
  const tab = (await searchParams).sekme === "gecmis" ? "gecmis" : (await searchParams).sekme === "iptal" ? "iptal" : "yaklasan";
  const now = new Date();
  const bookings =
    tab === "yaklasan"
      ? await studentBookings(user.id, { OR: [{ ...UPCOMING, endAt: { gt: now } }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }] })
      : tab === "gecmis"
        ? await studentBookings(user.id, { status: { in: [...PAST_STATUSES] } }, { startAt: "desc" })
        : await studentBookings(user.id, { status: { in: [...CANCELLED_STATUSES] } }, { startAt: "desc" });

  return (
    <>
      <PageHeader title="Derslerim" actions={<LinkButton href="/ogretmenler">Yeni ders al</LinkButton>} />
      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold sm:w-fit">
        {TABS.map((t) => (
          <Link key={t.key} href={`/hesabim/derslerim?sekme=${t.key}`} className={cn("flex-1 rounded-lg px-4 py-1.5 text-center", tab === t.key ? "bg-white text-brand-700 shadow-xs" : "text-slate-600")}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="space-y-3">
        {bookings.length ? (
          bookings.map((b) => <BookingRow key={b.id} booking={b} href={`/hesabim/derslerim/${b.id}`} />)
        ) : (
          <EmptyState title="Bu bölümde ders yok" />
        )}
      </div>
    </>
  );
}
