import { CalendarRange, Repeat, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BuyPackageForm } from "@/components/packages/forms";
import { LinkButton } from "@/components/ui/button";
import { Alert, Avatar, Card, DescriptionList } from "@/components/ui/primitives";
import { formatDate, formatLessonRange } from "@/lib/dates";
import { durationLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { fullName, initials } from "@/lib/text";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { packageQuote, parsePackageDiscounts } from "@/server/packages";
import { salesOpen } from "@/server/payments/service";
import { loadSettings } from "@/server/settings";
import { uploadUrl } from "@/server/storage";

export const metadata: Metadata = { title: "Ders paketi" };
export const instant = false;

const DAY = 24 * 3_600_000;

export default async function PackagePage({ searchParams }: PageProps<"/paket">) {
  const user = await requireUser();
  const query = await searchParams;
  const offeringId = String(query.ders ?? "");
  const duration = Number(query.sure);
  const repeatAt = query.tekrar ? new Date(String(query.tekrar)) : null;
  const settings = await loadSettings();
  const offering = offeringId
    ? await db.teacherOffering.findUnique({ where: { id: offeringId }, include: { level: true, subject: true, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } } })
    : null;
  const offers = offering ? parsePackageDiscounts(offering.teacher.packageDiscounts, settings.packageMaxLessons, settings.packageMaxDiscountPercent) : [];
  const weeks = repeatAt ? Math.min(12, Math.max(2, Number(query.hafta) || 4)) : 0;
  const lessons = repeatAt ? weeks : Number(query.adet);
  const valid =
    settings.packagesEnabled &&
    offering?.isActive &&
    offering.teacher.status === "PUBLISHED" &&
    offering.durations.includes(duration) &&
    Number.isInteger(lessons) &&
    lessons >= 2 &&
    lessons <= settings.packageMaxLessons &&
    (repeatAt ? !Number.isNaN(repeatAt.getTime()) : offers.some((o) => o.lessons === lessons));
  if (!offering || !valid) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Alert tone="warning" title="Paket bilgisi eksik">
          Lütfen öğretmenin profilinden ders, süre ve paket seçerek tekrar deneyin.
        </Alert>
        <LinkButton href="/ogretmenler" className="mt-4">
          Öğretmenlere dön
        </LinkButton>
      </div>
    );
  }
  const quote = packageQuote(offering.hourlyPrice, duration, lessons, offers);
  const teacherName = fullName(offering.teacher.user);
  const dates = repeatAt ? Array.from({ length: weeks }, (_, i) => new Date(repeatAt.getTime() + i * 7 * DAY)) : [];

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-5">
        <div>
          <Link href={`/ogretmen/${offering.teacher.slug}#randevu`} className="text-sm text-brand-700 hover:underline">
            ← {teacherName}
          </Link>
          <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-900">
            {repeatAt ? <Repeat className="size-6 text-brand-600" aria-hidden /> : null}
            {repeatAt ? `${weeks} haftalık düzenli ders` : `${lessons} derslik paket`}
          </h1>
          <p className="mt-1 text-slate-600">
            {offering.level.name} {offering.subject.name} · {durationLabel(duration)} · {teacherName}
          </p>
        </div>
        <Card className="flex items-center gap-3 p-4">
          <Avatar src={uploadUrl(offering.teacher.photoKey)} name={teacherName} initials={initials(offering.teacher.user)} size={44} />
          <p className="text-sm text-slate-600">
            {repeatAt
              ? "Dersler peşin ödenir; her hafta için öğretmeninize ayrı talep gider ve onaylandıkça kesinleşir."
              : "Dersler peşin ödenir; öğretmeninizin takviminden dilediğiniz saati seçip “Paketimden kullan” ile ders alırsınız."}
          </p>
        </Card>
        {repeatAt ? (
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-900">
              <CalendarRange className="size-5 text-brand-600" aria-hidden /> Ders günleri
            </h2>
            <ol className="mt-3 space-y-1 text-sm text-slate-700">
              {dates.map((d, i) => (
                <li key={d.toISOString()}>
                  {i + 1}. {formatLessonRange(d, new Date(d.getTime() + duration * 60_000))}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-slate-500">Öğretmenin o saati dolu olan bir hafta olursa o ders paketinizde kalır; dilediğiniz başka bir saati seçebilirsiniz.</p>
          </Card>
        ) : null}
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> Öğretmen bir dersi onaylamaz ya da iptal ederse ders paketinize geri eklenir.</li>
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> Dersten {settings.fullRefundHours} saat öncesine kadar iptal ederseniz ders paketinize geri döner.</li>
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> Paket {settings.packageValidityMonths} ay geçerlidir; süresi dolduğunda kullanılmayan derslerin ücreti iade edilir.</li>
        </ul>
      </div>
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Card className="p-5">
          <DescriptionList
            items={[
              { label: "Tek ders", value: formatMoney(quote.listUnitPrice) },
              { label: "Paketle ders başı", value: `${formatMoney(quote.unitPrice)}${quote.discountPercent ? ` (%${quote.discountPercent} indirim)` : ""}` },
              { label: "Ders sayısı", value: String(lessons) },
              ...(repeatAt ? [{ label: "İlk ders", value: formatDate(repeatAt) }] : []),
            ]}
          />
          <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-4">
            <span className="text-sm text-slate-600">Toplam (KDV dahil)</span>
            <span className="text-2xl font-bold text-slate-900">{formatMoney(quote.price)}</span>
          </div>
          <div className="mt-5">
            {user.role !== "STUDENT" ? (
              <Alert tone="warning">Paket yalnızca veli/öğrenci hesabıyla alınabilir.</Alert>
            ) : !salesOpen() ? (
              <Alert tone="info" title="Online ödeme çok yakında">Ödeme altyapımız açılınca buradan paket alabileceksiniz.</Alert>
            ) : (
              <BuyPackageForm offeringId={offering.id} duration={duration} lessons={lessons} repeatAt={repeatAt?.toISOString()} weeks={weeks || undefined} defaultName={user.firstName} label={`${formatMoney(quote.price)} öde`} />
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}
