import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";
import { AnnouncementForm, DeleteAnnouncementButton } from "./announcement-forms";

export const metadata: Metadata = { title: "Duyurular" };

export default async function AnnouncementsPage() {
  const ctx = await requireCenter("messages.send");
  const [announcements, groups] = await Promise.all([
    db.centerAnnouncement.findMany({ where: { centerId: ctx.center.id }, orderBy: { createdAt: "desc" }, take: 50, include: { group: { select: { name: true } } } }),
    db.centerGroup.findMany({
      where: { centerId: ctx.center.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { students: { where: { student: { status: "ACTIVE" } } } } } },
    }),
  ]);
  return (
    <>
      <PageHeader title="Duyurular" description="Tüm kuruma ya da bir sınıfa duyuru; velilere WhatsApp ve site/uygulama bildirimi, isterseniz e-posta" />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <Card>
          <CardHeader title="Yeni duyuru" />
          <CardBody>
            <AnnouncementForm groups={groups.map((g) => ({ id: g.id, name: g.name, count: g._count.students }))} />
          </CardBody>
        </Card>
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <EmptyState icon={<Megaphone className="size-8" />} title="Henüz duyuru yok" />
          ) : (
            announcements.map((a) => (
              <Card key={a.id}>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{a.title}</p>
                      <p className="text-xs text-slate-500">
                        {formatCompact(a.createdAt)} · {a.group ? a.group.name : "Tüm kurum"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {a.sendEmail ? <Badge tone="sky">E-posta</Badge> : null}
                      {a.sendWhatsapp ? <Badge tone="green">WhatsApp</Badge> : null}
                      <DeleteAnnouncementButton announcementId={a.id} />
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{a.body}</p>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
