import type { PoolQuestion } from "@/generated/prisma/client";
import { Badge, Card, CardBody, CardHeader, Stars } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { POOL_STATUS } from "@/lib/labels";
import { uploadUrl } from "@/server/storage";

function Photo({ fileKey, alt }: { fileKey: string | null; alt: string }) {
  const src = uploadUrl(fileKey);
  if (!src) return null;
  return (
    <a href={src} target="_blank" rel="noreferrer" className="mt-2 block" title="Büyütmek için tıklayın">
      {/* eslint-disable-next-line @next/next/no-img-element -- özel dosya, boyutu bilinmiyor */}
      <img src={src} alt={alt} className="max-h-[32rem] w-full rounded-lg border border-slate-200 bg-white object-contain" />
    </a>
  );
}

/** Havuz sorusu: soru, çözüm ve ek soru/cevap. Öğrenci adı hiçbir görünümde yer almaz. */
export function PoolQuestionView({ question, viewer }: { question: PoolQuestion; viewer: "student" | "teacher" | "admin" }) {
  const status = POOL_STATUS[question.status];
  const video = uploadUrl(question.answerVideoKey);
  return (
    <Card>
      <CardHeader
        title={`${question.levelName} · ${question.subjectName}`}
        description={`${question.code} · ${formatCompact(question.createdAt)}`}
        action={<Badge tone={status?.tone}>{status?.label ?? question.status}</Badge>}
      />
      <CardBody className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Soru</p>
          <Photo fileKey={question.imageKey} alt="Soru fotoğrafı" />
          {question.note ? <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{question.note}</p> : null}
        </div>

        {question.answerText ? (
          <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
            <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-emerald-800">
              <span className="font-semibold">{viewer === "teacher" ? "Çözümünüz" : "Öğretmenin çözümü"}</span>
              {question.answeredAt ? <span>{formatCompact(question.answeredAt)}</span> : null}
            </p>
            <p className="whitespace-pre-line text-sm text-slate-800">{question.answerText}</p>
            <Photo fileKey={question.answerImageKey} alt="Çözüm fotoğrafı" />
            {video ? <video src={video} controls playsInline preload="metadata" className="mt-2 max-h-[28rem] w-full rounded-lg bg-black" /> : null}
          </div>
        ) : null}

        {question.followUpText ? (
          <div className="space-y-2">
            <div className="rounded-xl bg-brand-50/60 p-3">
              <p className="mb-1 text-xs font-semibold text-slate-600">{viewer === "student" ? "Ek sorunuz" : "Öğrencinin ek sorusu"}</p>
              <p className="whitespace-pre-line text-sm text-slate-800">{question.followUpText}</p>
            </div>
            {question.followUpAnswer ? (
              <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                <p className="mb-1 text-xs font-semibold text-emerald-800">{viewer === "teacher" ? "Cevabınız" : "Öğretmenin cevabı"}</p>
                <p className="whitespace-pre-line text-sm text-slate-800">{question.followUpAnswer}</p>
              </div>
            ) : viewer === "student" ? (
              <p className="text-xs text-slate-500">Öğretmenin cevabı bekleniyor; gelince bildirim alacaksınız.</p>
            ) : null}
          </div>
        ) : null}

        {question.rating ? (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            Öğrencinin puanı: <Stars value={question.rating} /> {question.rating}/5
          </p>
        ) : null}
        {question.rejectReason ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">Geri çevrilme nedeni: {question.rejectReason}</p> : null}
        {question.disputeReason ? <p className="rounded-lg bg-violet-50 p-3 text-sm text-violet-800">Bildirilen sorun: {question.disputeReason}</p> : null}
        {question.resolutionNote ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">İnceleme sonucu: {question.resolutionNote}</p> : null}
      </CardBody>
    </Card>
  );
}
