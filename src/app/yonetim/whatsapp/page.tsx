import type { Metadata } from "next";
import { connection } from "next/server";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { db } from "@/server/db";
import { loadSettings } from "@/server/settings";
import { letsbotConfigured, whatsappSessionStatus } from "@/server/whatsapp";
import { WhatsAppTestForm } from "./test-form";

export const metadata: Metadata = { title: "WhatsApp" };

const STATUS = { PENDING: { label: "Sırada", tone: "amber" }, SENT: { label: "Gönderildi", tone: "green" }, FAILED: { label: "Gönderilemedi", tone: "rose" } } as const;

export default async function WhatsAppAdminPage() {
  // LetsBot durumu her açılışta sorgulanır (derlemede önceden hazırlanmaz)
  await connection();
  const since = new Date();
  since.setHours(since.getHours() - 24);
  const [settings, session, counts, recent] = await Promise.all([
    loadSettings(),
    whatsappSessionStatus(),
    db.whatsAppMessage.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: true }),
    db.whatsAppMessage.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { firstName: true, lastName: true } } } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  return (
    <>
      <PageHeader title="WhatsApp bildirimleri" description="Önemli bildirimler (ders talebi, onay, 1 saat kala hatırlatma, çözüm geldi…) e-postanın yanında WhatsApp ile de gider. Gönderim LetsBot üzerinden, dakikada en fazla 20 mesaj." />
      {!letsbotConfigured() ? (
        <Alert tone="warning" className="mb-6">LetsBot API anahtarı sunucuya girilmemiş; mesajlar kuyrukta bekler.</Alert>
      ) : session.ok ? (
        <Alert tone="success" className="mb-6">LetsBot bağlantısı çalışıyor.</Alert>
      ) : (
        <Alert tone="error" className="mb-6" title="LetsBot bağlantısı çalışmıyor">
          LetsBot “{session.message}” diyor. API anahtarını ve kanalın “Bağlı” olduğunu LetsBot panelinden kontrol edin. Sorun giderilene kadar mesajlar kuyrukta bekler (1 saatten eskiler gönderilmez).
        </Alert>
      )}
      {settings.notificationChannel === "email" ? (
        <Alert tone="info" className="mb-6">Bildirim kanalı “Yalnızca e-posta”: bildirimler e-postayla gidiyor, WhatsApp kuyruğuna yeni mesaj girmez. Şablonlar onaylanınca Site ayarları → Bildirim kanalı’ndan WhatsApp’a geçin.</Alert>
      ) : null}
      {settings.whatsappTemplateName ? (
        <Alert tone="info" className="mb-6">Bildirimler “{settings.whatsappTemplateName}” şablonuyla gidiyor.</Alert>
      ) : (
        <Alert tone="warning" className="mb-6" title="Bildirim şablonu tanımlı değil">
          Resmî WhatsApp kanalında işletmenin başlattığı mesaj onaylı şablonla gider; şu an düz metin gidiyor ve yalnızca son 24 saatte size yazmış kişilere ulaşıyor. LetsBot panelinde “Yardımcı (Utility)” türünde, Türkçe, 3 değişkenli bir şablon oluşturup onaylatın ve adını Site ayarları → WhatsApp bildirim şablonu alanına yazın.
        </Alert>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Son 24 saat gönderilen" value={count("SENT")} />
        <StatCard label="Sırada" value={count("PENDING")} />
        <StatCard label="Gönderilemeyen" value={count("FAILED")} />
      </div>
      <Card className="mb-6">
        <CardBody>
          <WhatsAppTestForm />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Son mesajlar" />
        {recent.length === 0 ? (
          <EmptyState title="Henüz mesaj yok" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((m) => (
              <li key={m.id} className="space-y-1 px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-700">
                    {m.user ? `${m.user.firstName} ${m.user.lastName.charAt(0)}.` : m.to} <span className="text-xs text-slate-400">· {m.type ?? "—"} · {formatCompact(m.createdAt)}</span>
                  </span>
                  <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>
                </div>
                <p className="line-clamp-2 whitespace-pre-line text-xs text-slate-500">{m.body}</p>
                {m.error ? <p className="text-xs text-rose-600">{m.error}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
