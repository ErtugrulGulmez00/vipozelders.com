import { Badge } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { uploadUrl } from "@/server/storage";

export const QUESTION_STATUS = {
  OPEN: { label: "Cevap bekliyor", tone: "amber" },
  ANSWERED: { label: "Çözüldü", tone: "green" },
  IN_PERSON: { label: "Yüz yüze anlatılacak", tone: "sky" },
} as const;

export type QuestionViewData = {
  subject: string;
  note: string | null;
  imageKey: string;
  status: keyof typeof QUESTION_STATUS;
  answerText: string | null;
  answerImageKey: string | null;
  answerVideoKey: string | null;
  answeredBy: string | null;
  answeredAt: Date | null;
  createdAt: Date;
};

/** Soru fotoğrafı ve çözüm (yazı, fotoğraf, video): kurum panelinde ve öğrenci/veli portalında ortak görünüm. */
export function QuestionView({ q, compact }: { q: QuestionViewData; compact?: boolean }) {
  const image = uploadUrl(q.imageKey)!;
  const answerImage = uploadUrl(q.answerImageKey);
  const answerVideo = uploadUrl(q.answerVideoKey);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">
          {q.subject} <span className="font-normal text-slate-500">· {formatCompact(q.createdAt)}</span>
        </p>
        <Badge tone={QUESTION_STATUS[q.status].tone}>{QUESTION_STATUS[q.status].label}</Badge>
      </div>
      {q.note ? <p className="text-sm text-slate-700">{q.note}</p> : null}
      <a href={image} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="Soru fotoğrafı" className={compact ? "max-h-56 rounded-xl border border-slate-200 object-contain" : "max-h-[28rem] w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"} />
      </a>
      {q.status !== "OPEN" ? (
        <div className="space-y-2 rounded-xl bg-emerald-50/60 p-3">
          <p className="text-xs font-semibold text-emerald-800">
            {q.status === "IN_PERSON" ? "Öğretmen bu soruyu yüz yüze anlatacak" : "Çözüm"}
            {q.answeredBy ? ` · ${q.answeredBy}` : ""}
            {q.answeredAt ? ` · ${formatCompact(q.answeredAt)}` : ""}
          </p>
          {q.answerText ? <p className="whitespace-pre-line text-sm text-slate-800">{q.answerText}</p> : null}
          {answerImage ? (
            <a href={answerImage} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={answerImage} alt="Çözüm fotoğrafı" className="max-h-[28rem] w-full rounded-xl border border-emerald-100 bg-white object-contain" />
            </a>
          ) : null}
          {answerVideo ? <video src={answerVideo} controls playsInline preload="metadata" className="max-h-[28rem] w-full rounded-xl bg-black" /> : null}
        </div>
      ) : null}
    </div>
  );
}
