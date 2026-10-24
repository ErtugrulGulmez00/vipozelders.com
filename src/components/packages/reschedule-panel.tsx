import type { Booking } from "@/generated/prisma/client";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { formatLessonRange, toLocalDateString } from "@/lib/dates";
import { db } from "@/server/db";
import { rescheduleAllowed } from "@/server/reschedule";
import { RescheduleForm, RescheduleResponse } from "./forms";

/** Ders sayfasında erteleme: bekleyen öneri (yanıt/geri çekme) ya da yeni saat önerme formu. */
export async function ReschedulePanel({ booking, viewerId }: { booking: Booking; viewerId: string }) {
  if (booking.status !== "CONFIRMED" || booking.mode === "QUESTION") return null;
  const now = new Date();
  const [pending, allowed] = await Promise.all([db.rescheduleRequest.findFirst({ where: { bookingId: booking.id, status: "PENDING" } }), rescheduleAllowed(booking, now)]);
  if (!pending && !allowed.ok) return null;
  const otherParty = booking.teacherId === viewerId ? "Öğrenci" : "Öğretmen";
  return (
    <Card>
      <CardHeader title="Ders saatini değiştir" description={allowed.ok ? `Yeni saat önerebilirsiniz; ${otherParty.toLocaleLowerCase("tr-TR")} kabul ederse ders taşınır. Dersten en az ${allowed.minHours} saat önce önerilmelidir.` : undefined} />
      <CardBody className="space-y-3">
        {pending ? (
          <>
            <Alert tone="info">
              {pending.requestedById === viewerId ? "Öneriniz yanıt bekliyor" : `${otherParty} saat değişikliği öneriyor`}: {formatLessonRange(pending.newStartAt, new Date(pending.newStartAt.getTime() + booking.durationMinutes * 60_000))}
              {pending.note ? ` · “${pending.note}”` : ""}
            </Alert>
            <RescheduleResponse requestId={pending.id} mine={pending.requestedById === viewerId} />
          </>
        ) : (
          <RescheduleForm bookingId={booking.id} teacherId={booking.teacherId} duration={booking.durationMinutes} today={toLocalDateString(now)} />
        )}
      </CardBody>
    </Card>
  );
}
