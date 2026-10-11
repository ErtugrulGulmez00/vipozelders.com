import { CalendarClock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Alert, Avatar, Card, DescriptionList } from "@/components/ui/primitives";
import { formatLessonRange } from "@/lib/dates";
import { durationLabel, MODE_LABEL } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { initials, shortName } from "@/lib/text";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { lessonPrice } from "@/server/pricing";
import { loadSettings } from "@/server/settings";
import { uploadUrl } from "@/server/storage";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "Randevu bilgileri" };
export const instant = false;

export default async function BookingPage({ searchParams }: PageProps<"/rezervasyon">) {
  const user = await requireUser();
  const query = await searchParams;
  const offeringId = String(query.ders ?? "");
  const start = new Date(String(query.saat ?? ""));
  const duration = Number(query.sure);
  const mode = query.sekil === "IN_PERSON" ? "IN_PERSON" : "ONLINE";

  if (user.role !== "STUDENT") {
    return (
      <Shell>
        <Alert tone="warning" title="Randevu yalnızca veli/öğrenci hesabıyla alınabilir">
          Şu an {user.role === "TEACHER" ? "öğretmen" : "yönetici"} hesabıyla giriş yaptınız. Randevu almak için çıkış yapıp veli/öğrenci hesabıyla giriş yapın.
        </Alert>
      </Shell>
    );
  }

  const offering = offeringId
    ? await db.teacherOffering.findUnique({
        where: { id: offeringId },
        include: {
          level: { include: { grades: { orderBy: { sortOrder: "asc" } } } },
          subject: true,
          serviceType: true,
          teacher: { include: { user: true, serviceDistricts: { include: { district: true } }, city: true } },
        },
      })
    : null;

  if (!offering || !offering.isActive || Number.isNaN(start.getTime()) || !offering.durations.includes(duration)) {
    return (
      <Shell>
        <Alert tone="warning" title="Randevu bilgisi eksik">
          Lütfen öğretmenin profilinden ders, süre ve saat seçerek tekrar deneyin.
        </Alert>
        <LinkButton href="/ogretmenler" className="mt-4">
          Öğretmenlere dön
        </LinkButton>
      </Shell>
    );
  }

  const teacher = offering.teacher;
  const [settings, learners, districts] = await Promise.all([
    loadSettings(),
    db.learner.findMany({ where: { studentId: user.id }, orderBy: { createdAt: "asc" } }),
    mode === "IN_PERSON" && teacher.inPersonAtStudentHome
      ? teacher.serviceDistricts.length
        ? Promise.resolve(teacher.serviceDistricts.map((d) => ({ id: d.district.id, name: d.district.name })))
        : teacher.cityId
          ? db.district.findMany({ where: { cityId: teacher.cityId }, orderBy: { name: "asc" }, select: { id: true, name: true } })
          : Promise.resolve([])
      : Promise.resolve([]),
  ]);
  const price = lessonPrice(offering.hourlyPrice, duration);
  const end = new Date(start.getTime() + duration * 60_000);
  const name = shortName(teacher.user);

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-bold text-slate-900">Ders bilgileri</h2>
          <p className="mb-5 text-sm text-slate-500">Öğretmeninizin derse hazırlıklı gelebilmesi için birkaç bilgi verin.</p>
          <BookingForm
            offeringId={offering.id}
            startAt={start.toISOString()}
            duration={duration}
            mode={mode}
            learners={learners.map((l) => ({ name: l.name, gradeName: l.gradeName }))}
            defaultName={user.firstName}
            grades={offering.level.grades.map((g) => g.name)}
            places={{ home: teacher.inPersonAtStudentHome, teacher: teacher.inPersonAtTeacherPlace }}
            districts={districts}
          />
        </Card>
        <aside className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <Avatar src={uploadUrl(teacher.photoKey)} name={name} initials={initials(teacher.user)} size={48} />
              <div>
                <p className="font-semibold text-slate-900">{name}</p>
                <Link href={`/ogretmen/${teacher.slug}`} className="text-xs font-medium text-brand-700 hover:underline">
                  Saati değiştir
                </Link>
              </div>
            </div>
            <DescriptionList
              items={[
                { label: "Ders", value: `${offering.level.name} · ${offering.subject.name}` },
                { label: "Hizmet", value: offering.serviceType.name },
                { label: "Zaman", value: formatLessonRange(start, end) },
                { label: "Süre", value: durationLabel(duration) },
                { label: "Şekil", value: MODE_LABEL[mode] },
              ]}
            />
            <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-600">Toplam (KDV dahil)</span>
              <span className="text-2xl font-bold text-slate-900">{formatMoney(price)}</span>
            </div>
          </Card>
          <Card className="space-y-3 p-5 text-sm text-slate-600">
            <p className="flex gap-2">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
              Saat, ödeme için {settings.paymentHoldMinutes} dakika boyunca size ayrılır. Öğretmen {settings.approvalWindowHours} saat içinde onaylar; onaylamazsa ödemenin tamamı iade edilir.
            </p>
            <p className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              Dersten {settings.fullRefundHours} saat öncesine kadar ücretsiz iptal; {settings.partialRefundHours} saat öncesine kadar %{settings.partialRefundPercent} iade.{" "}
              <Link href="/sayfa/iptal-ve-iade-politikasi" target="_blank" className="font-medium text-brand-700 underline">
                Ayrıntılar
              </Link>
            </p>
          </Card>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Randevuyu tamamla</h1>
      {children}
    </div>
  );
}
