import { Flag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ResolveReportButton } from "./resolve-button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { reasonLabel } from "@/server/safety";

export const metadata: Metadata = { title: "Kullanıcı bildirimleri" };

const KIND_LABEL: Record<string, string> = { thread: "Mesajlaşma", message: "Mesaj", inquiry: "Ders talebi", user: "Kişi" };
const name = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

/** Kullanıcıların "Bildir" ile gönderdiği şikâyetler; mesajlaşmada konuşmaya bağlantı verilir. */
export default async function UserReportsPage({ searchParams }: PageProps<"/yonetim/sikayetler">) {
  await requireRole("ADMIN");
  await connection();
  const { sekme } = await searchParams;
  const all = sekme === "tum";
  const reports = await db.contentReport.findMany({
    where: all ? {} : { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { reporter: { select: { firstName: true, lastName: true, role: true } }, target: { select: { id: true, firstName: true, lastName: true, role: true, status: true } } },
  });
  return (
    <>
      <PageHeader
        title="Kullanıcı bildirimleri"
        description="Kullanıcıların mesajlarda ve ders taleplerinde “Bildir” ile gönderdiği şikâyetler. İnceleyip kapatın; gerekiyorsa kişiyi Öğretmenler ya da Öğrenciler / Veliler sayfasından askıya alın."
      />
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/yonetim/sikayetler" className={!all ? "font-semibold text-brand-700" : "text-slate-500 hover:text-slate-800"}>
          Açık
        </Link>
        <span className="text-slate-300">·</span>
        <Link href="/yonetim/sikayetler?sekme=tum" className={all ? "font-semibold text-brand-700" : "text-slate-500 hover:text-slate-800"}>
          Tümü
        </Link>
      </div>
      {reports.length ? (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r.id} id={r.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {name(r.target)} <span className="font-normal text-slate-500">({r.target.role === "TEACHER" ? "öğretmen" : r.target.role === "STUDENT" ? "veli/öğrenci" : r.target.role.toLowerCase()})</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCompact(r.createdAt)} · {KIND_LABEL[r.kind] ?? r.kind} · bildiren: {name(r.reporter)}
                  </p>
                </div>
                <Badge tone={r.status === "OPEN" ? "amber" : "slate"}>{r.status === "OPEN" ? "Açık" : "Kapatıldı"}</Badge>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-800">{reasonLabel(r.reason)}</p>
              {r.note ? <p className="mt-2 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{r.note}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {r.kind === "thread" && r.refId ? (
                  <Link href={`/yonetim/mesajlar/${r.refId}`} className="font-semibold text-brand-700 hover:underline">
                    Konuşmayı aç
                  </Link>
                ) : null}
                {r.kind === "inquiry" ? (
                  <Link href="/yonetim/ders-talepleri" className="font-semibold text-brand-700 hover:underline">
                    Ders talepleri
                  </Link>
                ) : null}
                {r.status === "OPEN" ? <ResolveReportButton id={r.id} /> : null}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Flag className="size-8" />} title={all ? "Henüz bildirim yok" : "Açık bildirim yok"} description="Kullanıcılar bir mesajı ya da ders talebini bildirdiğinde burada görünür; size bildirim ve e-posta da gelir." />
      )}
    </>
  );
}
