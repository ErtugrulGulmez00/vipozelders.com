import type { BookingStatus } from "@/generated/prisma/client";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatCompact, formatDateTime } from "@/lib/dates";
import { threadOpen, questionThread } from "@/server/question-bookings";
import { uploadUrl } from "@/server/storage";
import { QuestionMessageForm } from "./question-message-form";

type ThreadBooking = { id: string; status: BookingStatus; earningsReleasedAt: Date | null; approvalDeadline: Date | null; teacherId: string };

/** Fotoğrafla sorunun yazışması: soru, çözüm ve sonraki mesajlar; altında yeni mesaj formu. */
export async function QuestionThread({ booking, viewerId }: { booking: ThreadBooking; viewerId: string }) {
  const messages = await questionThread(booking.id);
  const asTeacher = booking.teacherId === viewerId;
  const awaitingSolution = booking.status === "PENDING_APPROVAL";
  const open = threadOpen(booking);
  return (
    <Card>
      <CardHeader
        title="Soru ve çözüm"
        description={awaitingSolution && booking.approvalDeadline ? `Çözüm için son: ${formatDateTime(booking.approvalDeadline)}. Gelmezse ücret iade edilir.` : undefined}
      />
      <CardBody className="space-y-4">
        <ol className="space-y-3">
          {messages.map((m) => {
            const mine = m.author.id === viewerId;
            const image = uploadUrl(m.imageKey);
            const video = uploadUrl(m.videoKey);
            return (
              <li key={m.id} className={cn("rounded-xl p-3", m.isSolution ? "bg-emerald-50 ring-1 ring-emerald-200" : mine ? "bg-brand-50/60" : "bg-slate-50")}>
                <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{mine ? "Siz" : `${m.author.firstName} ${m.author.id === booking.teacherId ? m.author.lastName : `${m.author.lastName.charAt(0)}.`}`}</span>
                  <span>{formatCompact(m.createdAt)}</span>
                  {m.isSolution ? <Badge tone="green">Çözüm</Badge> : null}
                </p>
                {m.body ? <p className="whitespace-pre-line text-sm text-slate-800">{m.body}</p> : null}
                {image ? (
                  <a href={image} target="_blank" rel="noreferrer" className="mt-2 block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- özel dosya, boyutu bilinmiyor */}
                    <img src={image} alt={m.isSolution ? "Çözüm fotoğrafı" : "Soru fotoğrafı"} className="max-h-[28rem] w-full rounded-lg border border-slate-200 bg-white object-contain" />
                  </a>
                ) : null}
                {video ? <video src={video} controls playsInline preload="metadata" className="mt-2 max-h-[28rem] w-full rounded-lg bg-black" /> : null}
              </li>
            );
          })}
        </ol>
        {open ? (
          <div className="border-t border-slate-100 pt-4">
            <QuestionMessageForm bookingId={booking.id} asTeacher={asTeacher} awaitingSolution={awaitingSolution} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Bu soru için yazışma kapandı.</p>
        )}
      </CardBody>
    </Card>
  );
}
