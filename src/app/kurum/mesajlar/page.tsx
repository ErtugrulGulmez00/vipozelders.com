import type { Metadata } from "next";
import Form from "next/form";
import { buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { Alert, Badge, Card, EmptyState, PageHeader, Pagination, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import type { Prisma } from "@/generated/prisma/client";
import { MESSAGE_KIND_LABEL, MESSAGE_STATUS } from "@/lib/center/labels";
import { formatCompact, toLocalDateString } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { centerWhatsappUsage } from "@/server/center/messages";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Mesaj geçmişi" };

const CHANNEL: Record<string, { label: string; tone: "green" | "sky" | "violet" }> = {
  WHATSAPP: { label: "WhatsApp", tone: "green" },
  EMAIL: { label: "E-posta", tone: "sky" },
  SMS: { label: "SMS", tone: "violet" },
};

const PAGE_SIZE = 50;

export default async function MessagesPage({ searchParams }: PageProps<"/kurum/mesajlar">) {
  const ctx = await requireCenter("messages.send");
  const sp = await searchParams;
  const channel = sp.kanal === "WHATSAPP" || sp.kanal === "EMAIL" ? sp.kanal : "";
  const kind = String(sp.tur ?? "");
  const page = Math.max(1, Number(sp.sayfa) || 1);
  const where: Prisma.CenterMessageWhereInput = { centerId: ctx.center.id, ...(channel ? { channel } : {}), ...(kind ? { kind } : {}) };
  const monthStart = new Date(`${toLocalDateString(new Date()).slice(0, 7)}-01T00:00:00+03:00`);
  const [total, messages, whatsapp, emailThisMonth] = await Promise.all([
    db.centerMessage.count({ where }),
    db.centerMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    centerWhatsappUsage(ctx.center.id),
    db.centerMessage.count({ where: { centerId: ctx.center.id, channel: "EMAIL", createdAt: { gte: monthStart } } }),
  ]);
  const studentIds = [...new Set(messages.map((m) => m.studentId).filter((id): id is string => Boolean(id)))];
  const students = new Map((await db.centerStudent.findMany({ where: { id: { in: studentIds } }, select: { id: true, firstName: true, lastName: true } })).map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
  const href = (p: number) => `/kurum/mesajlar?${new URLSearchParams({ ...(channel ? { kanal: channel } : {}), ...(kind ? { tur: kind } : {}), sayfa: String(p) }).toString()}`;
  return (
    <>
      <PageHeader title="Mesaj geçmişi" description="Velilere giden tüm otomatik ve elle gönderilen WhatsApp ve e-posta mesajları" />
      {!whatsapp.enabled ? (
        <Alert tone="info" className="mb-4" title="WhatsApp: çok yakında">
          WhatsApp bildirimleri onay aşamasında. Şimdilik velilere tüm mesajlar e-posta ve site/uygulama bildirimi olarak gidiyor; onaylanınca kendiliğinden WhatsApp’a geçilir.
        </Alert>
      ) : whatsapp.used >= whatsapp.limit ? (
        <Alert tone="warning" className="mb-4" title="Aylık WhatsApp hakkı doldu">
          Bu ay {whatsapp.limit} WhatsApp mesajı hakkınız doldu. Ay sonuna kadar velilere e-posta ve site/uygulama bildirimi gidiyor. Ek kota için Pi Kampüs ile görüşün.
        </Alert>
      ) : whatsapp.used >= whatsapp.limit * 0.8 ? (
        <Alert tone="info" className="mb-4">
          Aylık WhatsApp hakkınızın %{Math.round((whatsapp.used / whatsapp.limit) * 100)} kadarını kullandınız.
        </Alert>
      ) : null}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard label="Bu ay WhatsApp" value={whatsapp.enabled ? `${whatsapp.used} / ${whatsapp.limit}` : "Onay aşamasında"} />
        <StatCard label="Bu ay e-posta" value={emailThisMonth} />
      </div>
      <Form action="/kurum/mesajlar" className="mb-4 flex flex-wrap gap-2">
        <Select name="kanal" defaultValue={channel} className="h-9 w-36" aria-label="Kanal">
          <option value="">Tüm kanallar</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="EMAIL">E-posta</option>
        </Select>
        <Select name="tur" defaultValue={kind} className="h-9 w-48" aria-label="Tür">
          <option value="">Tüm türler</option>
          {Object.entries(MESSAGE_KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <button type="submit" className={buttonClasses("secondary", "sm", "h-9")}>
          Süz
        </button>
      </Form>
      {messages.length === 0 ? (
        <EmptyState title="Mesaj yok" />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Zaman</Th>
                <Th>Kanal</Th>
                <Th>Alıcı</Th>
                <Th>Mesaj</Th>
                <Th>Durum</Th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap text-xs">{formatCompact(m.createdAt)}</Td>
                  <Td>
                    <Badge tone={CHANNEL[m.channel].tone}>{CHANNEL[m.channel].label}</Badge>
                    <p className="mt-1 text-[11px] text-slate-500">{MESSAGE_KIND_LABEL[m.kind] ?? m.kind}</p>
                  </Td>
                  <Td className="text-xs">
                    {m.to}
                    {m.studentId && students.get(m.studentId) ? <p className="text-slate-500">{students.get(m.studentId)}</p> : null}
                  </Td>
                  <Td className="max-w-md text-xs text-slate-700">
                    {m.subject ? <p className="font-semibold">{m.subject}</p> : null}
                    <p className="line-clamp-3 whitespace-pre-line">{m.body}</p>
                  </Td>
                  <Td>
                    <Badge tone={MESSAGE_STATUS[m.status].tone}>{MESSAGE_STATUS[m.status].label}</Badge>
                    {m.error && (m.status === "FAILED" || m.status === "SKIPPED") ? <p className="mt-1 max-w-40 text-[11px] text-rose-600">{m.error}</p> : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} hrefFor={href} />
    </>
  );
}
