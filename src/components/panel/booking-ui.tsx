import { CalendarClock, MapPin, Monitor } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import { formatCompact, formatLessonRange } from "@/lib/dates";
import { BOOKING_STATUS, MODE_LABEL } from "@/lib/labels";
import { formatMoney } from "@/lib/money";

export function BookingStatusBadge({ status }: { status: string }) {
  const meta = BOOKING_STATUS[status] ?? { label: status, tone: "slate" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export type BookingRowData = {
  id: string;
  code: string;
  status: string;
  startAt: Date;
  endAt: Date;
  levelName: string;
  subjectName: string;
  serviceName: string;
  mode: string;
  price: number;
  learnerName: string;
  counterpart: string;
};

/** Ders listelerinde kullanılan satır. */
export function BookingRow({ booking, href }: { booking: BookingRowData; href: string }) {
  return (
    <Link href={href} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-200 hover:shadow-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900">
            {booking.levelName} · {booking.subjectName}
          </p>
          <BookingStatusBadge status={booking.status} />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3.5" aria-hidden /> {booking.mode === "QUESTION" ? `Gönderildi: ${formatCompact(booking.startAt)}` : formatLessonRange(booking.startAt, booking.endAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            {booking.mode === "ONLINE" ? <Monitor className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
            {MODE_LABEL[booking.mode]}
          </span>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {[booking.counterpart, booking.serviceName, booking.learnerName !== booking.counterpart && booking.learnerName, booking.code].filter(Boolean).join(" · ")}
        </p>
      </div>
      <p className="font-semibold text-slate-900">{formatMoney(booking.price)}</p>
    </Link>
  );
}
