import { Mail, MapPin, Monitor, Phone, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { ApplicationDecision } from "./application-actions";

export const metadata: Metadata = { title: "Öğretmen başvuruları" };

export default async function ApplicationsPage() {
  await requireRole("ADMIN");
  const [open, closed] = await Promise.all([
    db.teacherApplication.findMany({ where: { status: "NEW" }, orderBy: { createdAt: "asc" }, include: { city: true } }),
    db.teacherApplication.findMany({ where: { status: { not: "NEW" } }, orderBy: { reviewedAt: "desc" }, take: 50 }),
  ]);
  // Kurum personeli aynı e-postayla başvurduysa onayda yeni hesap açılmaz, o hesaba öğretmen paneli eklenir
  const centerAccounts = new Set(
    (await db.user.findMany({ where: { role: "CENTER", email: { in: open.map((a) => a.email) } }, select: { email: true } })).map((u) => u.email),
  );

  return (
    <>
      <PageHeader title="Öğretmen başvuruları" description="Sitedeki “Öğretmen olarak katılın” formundan gelenler. Görüşmeden sonra tek tıkla hesap açabilirsiniz." />
      <div className="space-y-6">
        {open.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState icon={<UserPlus className="size-8" />} title="Bekleyen başvuru yok" description="Yeni başvuru geldiğinde burada ve bildirimlerde görünür." />
            </CardBody>
          </Card>
        ) : (
          open.map((a) => (
            <Card key={a.id}>
              <CardHeader title={`${a.firstName} ${a.lastName}`} description={`Başvuru: ${formatCompact(a.createdAt)}`} action={<Badge tone="amber">Yeni</Badge>} />
              <CardBody className="space-y-4">
                <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <a href={`mailto:${a.email}`} className="inline-flex items-center gap-2 hover:text-brand-700">
                    <Mail className="size-4 text-slate-400" aria-hidden /> {a.email}
                  </a>
                  <a href={`tel:${a.phone}`} className="inline-flex items-center gap-2 hover:text-brand-700">
                    <Phone className="size-4 text-slate-400" aria-hidden /> {a.phone}
                  </a>
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="size-4 text-slate-400" aria-hidden /> {a.city?.name ?? "İl belirtilmedi"}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Monitor className="size-4 text-slate-400" aria-hidden /> {[a.offersOnline && "Online", a.offersInPerson && "Yüz yüze"].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-[160px_1fr]">
                  <dt className="font-medium text-slate-500">Dersler</dt>
                  <dd className="text-slate-900">{a.subjects}</dd>
                  <dt className="font-medium text-slate-500">Deneyim</dt>
                  <dd className="text-slate-900">{a.experienceYears} yıl</dd>
                  {a.education ? (
                    <>
                      <dt className="font-medium text-slate-500">Eğitim</dt>
                      <dd className="text-slate-900">{a.education}</dd>
                    </>
                  ) : null}
                  {a.message ? (
                    <>
                      <dt className="font-medium text-slate-500">Tanıtım</dt>
                      <dd className="whitespace-pre-line text-slate-900">{a.message}</dd>
                    </>
                  ) : null}
                </dl>
                {centerAccounts.has(a.email) ? (
                  <Alert tone="info" title="Bu e-posta bir kurum personeli hesabına ait">
                    Onaylarsanız yeni hesap açılmaz; kişinin kurum hesabına öğretmen paneli eklenir. Mevcut kullanıcı adı ve şifresiyle girer, kurum özel ders bilgilerini görmez.
                  </Alert>
                ) : null}
                <ApplicationDecision applicationId={a.id} />
              </CardBody>
            </Card>
          ))
        )}

        {closed.length ? (
          <Card>
            <CardHeader title="Sonuçlanan başvurular" />
            <Table>
              <thead>
                <tr>
                  <Th>Aday</Th>
                  <Th>Dersler</Th>
                  <Th>Sonuç</Th>
                  <Th>Tarih</Th>
                </tr>
              </thead>
              <tbody>
                {closed.map((a) => (
                  <tr key={a.id}>
                    <Td>
                      {a.teacherId ? (
                        <Link href={`/yonetim/ogretmenler/${a.teacherId}`} className="font-semibold text-brand-700 hover:underline">
                          {a.firstName} {a.lastName}
                        </Link>
                      ) : (
                        `${a.firstName} ${a.lastName}`
                      )}
                      <p className="text-xs text-slate-400">{a.email}</p>
                    </Td>
                    <Td className="max-w-xs truncate">{a.subjects}</Td>
                    <Td>
                      <Badge tone={a.status === "APPROVED" ? "green" : "slate"}>{a.status === "APPROVED" ? "Hesap açıldı" : "Reddedildi"}</Badge>
                      {a.note ? <p className="mt-1 text-xs text-slate-400">{a.note}</p> : null}
                    </Td>
                    <Td className="whitespace-nowrap">{a.reviewedAt ? formatCompact(a.reviewedAt) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ) : null}
      </div>
    </>
  );
}
