import { CalendarClock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui/button";
import { Alert, Avatar, Card, DescriptionList } from "@/components/ui/primitives";
import { formatLessonRange } from "@/lib/dates";
import { durationLabel, MODE_LABEL } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { fullName, initials } from "@/lib/text";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { INTRO_MINUTES, lessonPrice } from "@/server/pricing";
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
  // Fotoğrafla soru artık soru kredisiyle (soru havuzu) gönderilir.
  if (query.sekil === "QUESTION") redirect("/soru-sor");
  // Ücretsiz 15 dk tanışma görüşmesi (her zaman online, ödemesiz)
  const intro = query.tanisma === "1";
  const mode = !intro && query.sekil === "IN_PERSON" ? "IN_PERSON" : "ONLINE";

  if (user.role !== "STUDENT") {
    return (
      <Shell>
        <Alert tone="warning" title="Randevu yalnızca veli/öğrenci hesabıyla alınabilir">
          Şu an {user.role === "TEACHER" ? "öğretmen" : user.role === "CENTER" ? "kurum" : "yönetici"} hesabıyla giriş yaptınız. Randevu almak için çıkış yapıp veli/öğrenci hesabıyla giriş yapın.
        </Alert>
      </Shell>
    );
  }

  const offering = offeringId ? await loadOffering(offeringId) : null;

  const durationOk = offering ? (intro ? duration === INTRO_MINUTES && offering.teacher.offersIntro : offering.durations.includes(duration)) : false;
  if (!offering || !offering.isActive || Number.isNaN(start.getTime()) || !durationOk) {
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
  const price = intro ? 0 : lessonPrice(offering.hourlyPrice, duration);
  const end = new Date(start.getTime() + duration * 60_000);
  const name = fullName(teacher.user);

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
            notePlaceholder={notePlaceholder(offering.level.name, offering.subject.name)}
            intro={intro}
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
                { label: "Hizmet", value: intro ? "Ücretsiz tanışma görüşmesi" : offering.serviceType.name },
                { label: "Zaman", value: formatLessonRange(start, end) },
                { label: "Süre", value: durationLabel(duration) },
                { label: "Şekil", value: MODE_LABEL[mode] },
              ]}
            />
            <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-600">Toplam (KDV dahil)</span>
              <span className="text-2xl font-bold text-slate-900">{intro ? "Ücretsiz" : formatMoney(price)}</span>
            </div>
          </Card>
          {intro ? (
            <Card className="space-y-3 p-5 text-sm text-slate-600">
              <p className="flex gap-2">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                15 dakikalık online tanışma: öğretmenle hedeflerinizi konuşur, seviyeyi görürsünüz. Ödeme yok; öğretmen {settings.approvalWindowHours} saat içinde onaylar.
              </p>
              <p className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                Görüşme sitemizdeki sanal sınıfta yapılır; telefon numarası paylaşmanız gerekmez.
              </p>
            </Card>
          ) : (
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
          )}
        </aside>
      </div>
    </Shell>
  );
}

function loadOffering(id: string) {
  return db.teacherOffering.findUnique({
    where: { id },
    include: {
      level: { include: { grades: { orderBy: { sortOrder: "asc" } } } },
      subject: true,
      serviceType: true,
      teacher: { include: { user: true, serviceDistricts: { include: { district: true } }, city: true } },
    },
  });
}

/** Not alanındaki örnek, seçilen kademeye uygun olsun (lise öğrencisine LGS örneği çıkmasın). */
function notePlaceholder(level: string, subject: string): string {
  const l = level.toLocaleLowerCase("tr-TR");
  if (l.includes("okul öncesi")) return "Örn: Okula başlamadan önce dikkat ve el becerisi çalışmak istiyoruz.";
  if (l.includes("ilkokul")) return `Örn: ${subject} dersinde okulda öğrendiklerini pekiştirmek istiyoruz.`;
  if (l.includes("lgs")) return "Örn: LGS'ye hazırlanıyoruz; denemelerde süre yetmiyor.";
  if (l.includes("ortaokul")) return `Örn: ${subject} dersinde konu eksikleri var, LGS'ye de hazırlanmak istiyoruz.`;
  if (l.includes("yks") || l.includes("tyt") || l.includes("ayt")) return "Örn: TYT/AYT'ye hazırlanıyorum; denemelerde netlerim düşük, eksik konularım var.";
  if (l.includes("lise")) return `Örn: ${subject} dersinde konu eksiklerim var, yazılılara hazırlanmak istiyorum.`;
  return "Örn: Hangi konularda zorlandığınızı ve hedefinizi yazın.";
}

function Shell({ children, title = "Randevuyu tamamla" }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{title}</h1>
      {children}
    </div>
  );
}
