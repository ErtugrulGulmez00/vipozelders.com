import { Camera } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { QUESTION_STATUS } from "@/components/center/question-view";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";
import { uploadUrl } from "@/server/storage";

export const metadata: Metadata = { title: "Öğrenci soruları" };

const FILTERS = [
  { key: "OPEN", label: "Cevap bekleyen" },
  { key: "IN_PERSON", label: "Yüz yüze anlatılacak" },
  { key: "ANSWERED", label: "Çözülen" },
] as const;

export default async function QuestionsPage({ searchParams }: PageProps<"/kurum/sorular">) {
  const ctx = await requireCenter("questions.answer");
  const sp = await searchParams;
  const status = FILTERS.find((f) => f.key === sp.durum)?.key ?? "OPEN";
  const [questions, counts] = await Promise.all([
    db.centerQuestion.findMany({
      where: { centerId: ctx.center.id, status },
      include: { student: { select: { firstName: true, lastName: true, groups: { select: { group: { select: { name: true } } } } } } },
      orderBy: { createdAt: status === "OPEN" ? "asc" : "desc" },
      take: 100,
    }),
    db.centerQuestion.groupBy({ by: ["status"], where: { centerId: ctx.center.id }, _count: true }),
  ]);
  return (
    <>
      <PageHeader title="Öğrenci soruları" description="Öğrencilerin fotoğrafla gönderdiği sorular. Çözümü yazı, fotoğraf ya da videoyla gönderin veya yüz yüze anlatacağınızı bildirin." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/kurum/sorular?durum=${f.key}`} className={`rounded-full px-3 py-1 text-xs font-semibold ${status === f.key ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
            {f.label} ({counts.find((c) => c.status === f.key)?._count ?? 0})
          </Link>
        ))}
      </div>
      {questions.length === 0 ? (
        <EmptyState icon={<Camera className="size-8" />} title={status === "OPEN" ? "Bekleyen soru yok" : "Bu listede soru yok"} description="Öğrenciler soruları kendi hesaplarından (Hesabım → Kurumum → Sorular) fotoğrafla gönderir." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {questions.map((q) => (
            <Link key={q.id} href={`/kurum/sorular/${q.id}`} className="group">
              <Card className="h-full overflow-hidden transition group-hover:border-brand-300 group-hover:shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadUrl(q.imageKey)!} alt="" className="h-44 w-full bg-slate-100 object-cover" />
                <div className="space-y-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{q.subject}</p>
                    <Badge tone={QUESTION_STATUS[q.status].tone}>{QUESTION_STATUS[q.status].label}</Badge>
                  </div>
                  <p className="text-sm text-slate-600">
                    {q.student.firstName} {q.student.lastName}
                    {q.student.groups.length ? ` · ${q.student.groups.map((g) => g.group.name).join(", ")}` : ""}
                  </p>
                  {q.note ? <p className="line-clamp-2 text-xs text-slate-500">{q.note}</p> : null}
                  <p className="text-xs text-slate-400">{formatCompact(q.createdAt)}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
