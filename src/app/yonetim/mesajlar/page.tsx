import { MessageCircleWarning } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatCompact } from "@/lib/dates";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Mesaj denetimi" };

const TABS = [
  { key: "incelenecek", label: "İncelenecek" },
  { key: "isaretli", label: "Tüm işaretliler" },
  { key: "tum", label: "Tüm konuşmalar" },
] as const;

const name = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

export default async function MessageModerationPage({ searchParams }: PageProps<"/yonetim/mesajlar">) {
  const { sekme, ogretmen } = await searchParams;
  const tab = TABS.find((t) => t.key === sekme)?.key ?? "incelenecek";
  const teacherId = typeof ogretmen === "string" ? ogretmen : undefined;

  let ids: string[] | null = null;
  if (tab === "incelenecek") {
    const rows = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "MessageThread" WHERE "flaggedAt" IS NOT NULL AND ("reviewedAt" IS NULL OR "reviewedAt" < "flaggedAt") ORDER BY "flaggedAt" DESC LIMIT 200`;
    ids = rows.map((r) => r.id);
  }
  const where: Prisma.MessageThreadWhereInput = {
    ...(ids ? { id: { in: ids } } : {}),
    ...(tab === "isaretli" ? { flaggedAt: { not: null } } : {}),
    ...(teacherId ? { teacherId } : {}),
  };
  const threads = await db.messageThread.findMany({
    where,
    orderBy: [{ flaggedAt: { sort: "desc", nulls: "last" } }, { lastMessageAt: "desc" }],
    take: 100,
    include: {
      student: { select: { firstName: true, lastName: true } },
      teacher: { select: { id: true, firstName: true, lastName: true, teacherProfile: { select: { status: true } } } },
      messages: { where: { flagReason: { not: null } }, orderBy: { createdAt: "desc" }, select: { flagReason: true, authorId: true, createdAt: true } },
      _count: { select: { messages: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Mesaj denetimi"
        description="Veli ile öğretmen yazışmaları. İletişim bilgisi gizlenen ya da “WhatsApp, elden ödeme, IBAN” gibi platform dışına yönlendirme içeren mesajlar işaretlenir; öğretmene otomatik uyarı gider. Son 30 günde 3 işaretli mesaj yazan öğretmen size ayrıca bildirilir."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/yonetim/mesajlar?sekme=${t.key}${teacherId ? `&ogretmen=${teacherId}` : ""}`} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold ring-1", t.key === tab ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300")}>
            {t.label}
          </Link>
        ))}
        {teacherId ? (
          <Link href={`/yonetim/mesajlar?sekme=${tab}`} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 underline">
            Öğretmen süzgecini kaldır
          </Link>
        ) : null}
      </div>
      {threads.length === 0 ? (
        <Card>
          <EmptyState icon={<MessageCircleWarning className="size-8" />} title={tab === "incelenecek" ? "İncelenecek konuşma yok" : "Konuşma yok"} />
        </Card>
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Öğretmen</Th>
                <Th>Veli / öğrenci</Th>
                <Th>İşaret</Th>
                <Th>Son mesaj</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {threads.map((t) => {
                const teacherFlags = t.messages.filter((m) => m.authorId === t.teacher.id).length;
                const pending = t.flaggedAt && (!t.reviewedAt || t.reviewedAt < t.flaggedAt);
                return (
                  <tr key={t.id}>
                    <Td>
                      <Link href={`/yonetim/mesajlar?sekme=isaretli&ogretmen=${t.teacher.id}`} className="font-medium text-slate-900 hover:underline">
                        {name(t.teacher)}
                      </Link>
                      {t.teacher.teacherProfile?.status === "SUSPENDED" ? <Badge tone="rose" className="ml-2">Askıda</Badge> : null}
                    </Td>
                    <Td>{name(t.student)}</Td>
                    <Td>
                      {t.messages.length ? (
                        <>
                          <Badge tone={pending ? "rose" : "slate"}>{t.messages.length} işaretli</Badge>
                          <p className="mt-1 text-xs text-slate-500">{t.messages[0].flagReason}</p>
                          {teacherFlags ? <p className="text-xs text-rose-700">{teacherFlags} tanesi öğretmenden</p> : null}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {formatCompact(t.lastMessageAt)} · {t._count.messages} mesaj
                    </Td>
                    <Td className="text-right">
                      <Link href={`/yonetim/mesajlar/${t.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                        Aç
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
