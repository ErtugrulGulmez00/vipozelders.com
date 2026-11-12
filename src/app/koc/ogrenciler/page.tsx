import { PlusCircle, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CenterFlash } from "@/components/center/center-ui";
import { StudentAvatar, StudentCard } from "@/components/koc/student-card";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { toLocalDateString } from "@/lib/dates";
import { normalizeSearch } from "@/lib/text";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";
import { kocOverview } from "@/server/koc";

export const metadata: Metadata = { title: "Öğrencilerim" };

export default async function KocStudentsPage({ searchParams }: PageProps<"/koc/ogrenciler">) {
  await connection();
  const ctx = await requireCenter();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const archived = sp.arsiv === "1";
  const today = toLocalDateString(new Date());
  const [{ cards }, archivedList] = await Promise.all([
    kocOverview(ctx, today),
    db.centerStudent.findMany({ where: { centerId: ctx.center.id, status: { not: "ACTIVE" } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true, gradeName: true } }),
  ]);
  const needle = normalizeSearch(q);
  const shown = needle ? cards.filter((c) => normalizeSearch(`${c.name} ${c.gradeName ?? ""} ${c.targetExam ?? ""}`).includes(needle)) : cards;
  return (
    <>
      <PageHeader
        title="Öğrencilerim"
        description={`${cards.length} aktif öğrenci · paket sınırı ${ctx.center.studentLimit}`}
        actions={
          <LinkButton href="/koc/ogrenciler/yeni" size="sm">
            <PlusCircle className="size-4" aria-hidden /> Öğrenci ekle
          </LinkButton>
        }
      />
      <CenterFlash code={sp.durum} />
      <form method="get" className="mb-5 flex gap-2 lg:hidden">
        <input name="q" type="search" defaultValue={q} placeholder="Öğrenci ara" aria-label="Öğrenci ara" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm" />
      </form>
      {q ? (
        <p className="mb-4 text-sm text-slate-600">
          “{q}” için {shown.length} sonuç ·{" "}
          <Link href="/koc/ogrenciler" className="font-semibold text-brand-700 hover:underline">
            Temizle
          </Link>
        </p>
      ) : null}
      {shown.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => (
            <StudentCard key={s.id} s={s} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Users className="size-8" />}
          title={q ? "Eşleşen öğrenci yok" : "Henüz öğrenci yok"}
          description={q ? undefined : "İlk öğrencinizi ekleyin; görüşme, program, soru ve deneme takibi öğrenci sayfasında."}
          action={q ? undefined : <LinkButton href="/koc/ogrenciler/yeni">Öğrenci ekle</LinkButton>}
        />
      )}
      {archivedList.length ? (
        <div className="mt-10">
          <Link href={archived ? "/koc/ogrenciler" : "/koc/ogrenciler?arsiv=1"} className="text-sm font-semibold text-slate-600 hover:text-ink-900">
            {archived ? "Arşivi gizle" : `Arşivdeki öğrenciler (${archivedList.length})`}
          </Link>
          {archived ? (
            <Card className="mt-3">
              <ul className="divide-y divide-slate-100">
                {archivedList.map((s) => (
                  <li key={s.id}>
                    <Link href={`/koc/ogrenciler/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                      <StudentAvatar id={s.id} firstName={s.firstName} lastName={s.lastName} />
                      <span className="text-sm font-medium text-slate-700">
                        {s.firstName} {s.lastName}
                      </span>
                      <span className="text-xs text-slate-400">{s.gradeName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
