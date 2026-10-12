import type { Booking, District, City } from "@/generated/prisma/client";
import type { CalendarEvent } from "@/lib/calendar";
import { formatLessonRange } from "@/lib/dates";
import { appUrl } from "./email";
import { getSiteSettings } from "./site";

type CalendarBooking = Booking & { district: (District & { city: City }) | null };

/** Onaylı ders için takvim kaydı. Öğretmen öğrencinin adını, veli öğretmenin adını görür. */
export async function lessonCalendarEvent(booking: CalendarBooking, viewer: "STUDENT" | "TEACHER", counterpartName: string): Promise<CalendarEvent> {
  const { siteName } = await getSiteSettings();
  const pageUrl = appUrl(viewer === "TEACHER" ? `/ogretmen-paneli/dersler/${booking.id}` : `/hesabim/derslerim/${booking.id}`);
  const lesson = `${booking.levelName} ${booking.subjectName}`;
  const location =
    booking.mode === "ONLINE"
      ? `Online - ${siteName} sanal sınıf`
      : [booking.address, booking.district ? `${booking.district.name} / ${booking.district.city.name}` : null].filter(Boolean).join(", ") || "Yüz yüze";
  const description = [
    `${booking.serviceName} · ${formatLessonRange(booking.startAt, booking.endAt)}`,
    viewer === "TEACHER" ? `Öğrenci: ${booking.learnerName}` : `Öğretmen: ${counterpartName}`,
    booking.mode === "ONLINE" ? `Derse katılım (10 dk önce açılır): ${appUrl(`/ders/${booking.id}`)}` : null,
    `Randevu: ${booking.code} · ${pageUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    uid: `${booking.id}@${new URL(appUrl()).hostname}`,
    start: booking.startAt,
    end: booking.endAt,
    title: viewer === "TEACHER" ? `${lesson} dersi - ${booking.learnerName}` : `${lesson} dersi - ${counterpartName}`,
    description,
    location,
    url: pageUrl,
  };
}
