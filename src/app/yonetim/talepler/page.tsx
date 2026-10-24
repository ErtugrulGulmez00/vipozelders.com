import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardBody, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { db } from "@/server/db";
import { LessonRequestStatusForm } from "./request-form";

export const metadata: Metadata = { title: "Öğretmen talepleri" };

const STATUS: Record<string, { label: string; tone: "amber" | "sky" | "green" | "slate" }> = {
  NEW: { label: "Yeni", tone: "amber" },
  CONTACTED: { label: "Arandı", tone: "sky" },
  MATCHED: { label: "Eşleşti", tone: "green" },
  CLOSED: { label: "Kapandı", tone: "slate" },
};
const MODE: Record<string, string> = { online: "Online", "yuz-yuze": "Yüz yüze", farketmez: "Online / yüz yüze" };

export default async function LessonRequestsPage({ searchParams }: PageProps<"/yonetim/talepler">) {
  const { durum } = await searchParams;
  const filter = typeof durum === "string" && durum in STATUS ? durum : "acik";
  const requests = await db.lessonRequest.findMany({
    where: filter === "acik" ? { status: { in: ["NEW", "CONTACTED"] } } : { status: filter as "NEW" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader title="Öğretmen talepleri" description="Aradığı öğretmeni bulamayan velilerin bıraktığı talepler. Uygun öğretmeni bulup veliye dönün; o derste ders veren öğretmenlere iletişim bilgisi olmadan haber verildi." />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[["acik", "Açık"], ["MATCHED", "Eşleşen"], ["CLOSED", "Kapanan"]].map(([key, label]) => (
          <Link key={key} href={`/yonetim/talepler?durum=${key}`} className={`rounded-full px-3 py-1 ${filter === key ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
            {label}
          </Link>
        ))}
      </div>
      {requests.length === 0 ? (
        <Card>
          <EmptyState icon={<Inbox className="size-8" />} title="Talep yok" />
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardBody className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {[r.levelName, r.subjectName].filter(Boolean).join(" · ") || "Ders belirtilmedi"} <span className="font-normal text-slate-500">· {MODE[r.mode] ?? r.mode}{r.cityName ? ` · ${r.cityName}` : ""}</span>
                  </p>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                </div>
                <p className="text-slate-700">
                  <strong>{r.name}</strong> · <a href={`tel:${r.phone}`} className="text-brand-700 underline">{r.phone}</a>
                  {r.email ? <> · <a href={`mailto:${r.email}`} className="text-brand-700 underline">{r.email}</a></> : null}
                  <span className="text-xs text-slate-400"> · {formatCompact(r.createdAt)}{r.studentId ? " · üye" : ""} · {r.notifiedTeachers} öğretmene haber verildi</span>
                </p>
                {r.preferredTimes ? <p className="text-slate-600">Uygun saatler: {r.preferredTimes}</p> : null}
                {r.note ? <p className="rounded-lg bg-slate-50 p-2 text-slate-600">{r.note}</p> : null}
                <LessonRequestStatusForm id={r.id} status={r.status} note={r.adminNote ?? ""} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
