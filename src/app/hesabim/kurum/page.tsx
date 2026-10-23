import { Building2, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CenterFlash } from "@/components/center/center-ui";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/server/auth/current-user";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { portalChildren, portalChildSummaries } from "@/server/center/portal";
import { uploadUrl } from "@/server/storage";

export const metadata: Metadata = { title: "Kurumum" };

export default async function GuardianPortalPage({ searchParams }: PageProps<"/hesabim/kurum">) {
  const user = await requireRole("STUDENT");
  const sp = await searchParams;
  const children = await portalChildren(user.id);
  const summaries = await portalChildSummaries(children.map((c) => c.studentId));
  return (
    <>
      <PageHeader title="Kurumum" description="Çocuğunuzun etüt merkezi / dershanesindeki devam, deneme ve ödeme bilgileri" />
      <CenterFlash code={sp.durum} />
      {children.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-8" />}
          title="Bağlı öğrenci yok"
          description="Çocuğunuzun kurumu Pi Kampüs kullanıyorsa sizden telefon ya da e-posta ile veli portalı daveti göndermesini isteyin. Davet bağlantısını açıp bu hesapla onaylamanız yeterli."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((link) => {
            const logo = uploadUrl(link.student.center.logoKey);
            const summary = summaries.get(link.studentId);
            return (
              <Link key={link.id} href={`/hesabim/kurum/${link.id}`} className="group">
                <Card className="h-full p-5 transition group-hover:border-brand-300 group-hover:shadow-md">
                  <div className="flex items-center gap-3">
                    {logo ? (
                      <Image src={logo} alt="" width={44} height={44} unoptimized className="size-11 rounded-xl border border-slate-100 object-contain" />
                    ) : (
                      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-50 font-bold text-brand-700">{link.student.center.name.charAt(0)}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-bold text-slate-900 group-hover:text-brand-700">
                        {link.student.firstName} {link.student.lastName}
                      </p>
                      <p className="truncate text-sm text-slate-500">{link.student.center.name}</p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {[link.student.gradeName, link.student.groups.map((g) => g.group.name).join(", ")].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {summary ? (
                    <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-slate-50 px-2 py-2">
                        <dt className="text-[11px] text-slate-500">Devamsızlık (30 gün)</dt>
                        <dd className={`font-bold ${summary.absent ? "text-rose-600" : "text-emerald-700"}`}>{summary.sessions ? summary.absent : "—"}</dd>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-2">
                        <dt className="text-[11px] text-slate-500">Son deneme</dt>
                        <dd className="font-bold text-slate-900">{summary.lastNet !== null ? `${summary.lastNet.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} net` : "—"}</dd>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-2">
                        <dt className="text-[11px] text-slate-500">Sıradaki ödeme</dt>
                        <dd className="text-sm font-bold text-slate-900">{summary.nextDue ? formatMoney(summary.nextDue.amount) : "—"}</dd>
                        {summary.nextDue ? <dd className="text-[11px] text-slate-500">{formatDate(summary.nextDue.date)}</dd> : null}
                      </div>
                    </dl>
                  ) : null}
                  <p className="mt-3 text-sm font-semibold text-brand-700">Ayrıntıları gör</p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
