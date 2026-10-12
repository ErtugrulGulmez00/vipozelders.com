import { CalendarPlus } from "lucide-react";
import { googleCalendarUrl, type CalendarEvent } from "@/lib/calendar";

/** Onaylı ders için "Takvime ekle" bağlantıları. */
export function CalendarLinks({ bookingId, event }: { bookingId: string; event: CalendarEvent }) {
  const link = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={`/api/takvim/${bookingId}`} className={link} download>
        <CalendarPlus className="size-4" aria-hidden /> Takvime ekle (.ics)
      </a>
      <a href={googleCalendarUrl(event)} className={link} target="_blank" rel="noopener noreferrer">
        <CalendarPlus className="size-4" aria-hidden /> Google Takvim
      </a>
    </div>
  );
}
