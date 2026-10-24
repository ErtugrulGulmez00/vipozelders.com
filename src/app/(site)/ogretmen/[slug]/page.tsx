import { BadgeCheck, BookOpen, Clock, GraduationCap, Heart, Home, MapPin, Monitor, Repeat, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { toggleFavoriteAction } from "@/actions/student";
import { MessageTeacherBox } from "@/components/panel/message-forms";
import { BookingWidget } from "@/components/site/booking-widget";
import { salesOpen } from "@/server/payments/service";
import { buttonClasses } from "@/components/ui/button";
import { PhotoZoom } from "@/components/site/photo-zoom";
import { Alert, Badge, Card, RatingSummary, Skeleton, Stars } from "@/components/ui/primitives";
import { formatDate, toLocalDateString } from "@/lib/dates";
import { durationLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { fullName, initials, shortName } from "@/lib/text";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { uploadUrl } from "@/server/storage";
import { loadSettings } from "@/server/settings";
import { publicPlans } from "@/server/subscriptions";
import { getTeacherMeta, getTeacherProfileBySlug, isTeacherPublic, type PublicTeacher } from "@/server/teachers";

export async function generateMetadata({ params }: PageProps<"/ogretmen/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const meta = await getTeacherMeta(slug);
  if (!meta) return { title: "Öğretmen profili", robots: { index: false } };
  const subjects = meta.subjects.join(", ");
  return {
    title: `${meta.name} · ${subjects} öğretmeni`,
    description: meta.headline ?? `${subjects} özel ders`,
  };
}

export default function TeacherPage({ params }: PageProps<"/ogretmen/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-24 lg:pb-8">
      <Suspense fallback={<ProfileSkeleton />}>
        <TeacherProfile params={params} />
      </Suspense>
    </div>
  );
}

function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const match = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return match?.[1] ?? null;
}

async function TeacherProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Profil her istekte güncel okunur (boş saatler, "bugün" tarihi).
  await connection();
  const teacher = await getTeacherProfileBySlug(slug);
  if (!teacher) notFound();
  // Yayında olmayan profili yalnızca öğretmenin kendisi ve yöneticiler önizleyebilir.
  const preview = !isTeacherPublic(teacher);
  if (preview) {
    const viewer = await getCurrentUser();
    if (!viewer || (viewer.role !== "ADMIN" && viewer.id !== teacher.userId)) notFound();
  }

  const name = fullName(teacher.user);
  const video = youtubeId(teacher.videoUrl);
  const serviceAreas = teacher.serviceDistricts.length
    ? teacher.serviceDistricts.map((d) => d.district.name).join(", ")
    : teacher.district
      ? `${teacher.district.name} / ${teacher.city?.name}`
      : teacher.city?.name;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {preview ? (
        <Alert tone="warning" title="Önizleme" className="lg:col-span-2">
          Bu profil henüz yayında değil; şu an yalnızca siz ve yöneticiler görebilirsiniz. Yönetici yayına aldığında veliler bu sayfayı görüp randevu alabilecek.
        </Alert>
      ) : null}
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <PhotoZoom src={uploadUrl(teacher.photoKey)} name={name} initials={initials(teacher.user)} size={112} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
                {teacher.verificationStatus === "VERIFIED" ? (
                  <Badge tone="green">
                    <BadgeCheck className="size-3.5" aria-hidden /> Onaylı öğretmen
                  </Badge>
                ) : null}
              </div>
              {teacher.headline ? <p className="mt-1 text-slate-600">{teacher.headline}</p> : null}
              <div className="mt-3">
                <RatingSummary average={teacher.ratingAvg} count={teacher.ratingCount} />
              </div>
              <ul className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <li className="flex items-center gap-2">
                  <Users className="size-4 text-slate-400" aria-hidden /> {teacher.experienceYears} yıl deneyim · {teacher.completedLessons} ders
                </li>
                {teacher.avgResponseMinutes !== null ? (
                  <li className="flex items-center gap-2">
                    <Clock className="size-4 text-slate-400" aria-hidden /> Ortalama yanıt: {teacher.avgResponseMinutes < 60 ? "1 saatten kısa" : `${Math.round(teacher.avgResponseMinutes / 60)} saat`}
                  </li>
                ) : null}
                {teacher.offersOnline ? (
                  <li className="flex items-center gap-2">
                    <Monitor className="size-4 text-slate-400" aria-hidden /> Online ders
                  </li>
                ) : null}
                {teacher.offersIntro && teacher.offersOnline ? (
                  <li className="flex items-center gap-2 font-medium text-emerald-700">
                    <Sparkles className="size-4" aria-hidden /> Ücretsiz 15 dk tanışma görüşmesi
                  </li>
                ) : null}
                {teacher.offersInPerson ? (
                  <li className="flex items-center gap-2">
                    <MapPin className="size-4 text-slate-400" aria-hidden /> Yüz yüze: {serviceAreas ?? "Belirtilmemiş"}
                  </li>
                ) : null}
                {teacher.education ? (
                  <li className="flex items-center gap-2 sm:col-span-2">
                    <GraduationCap className="size-4 text-slate-400" aria-hidden /> {teacher.education}
                  </li>
                ) : null}
              </ul>
            </div>
            <Suspense fallback={null}>
              <FavoriteButton teacherId={teacher.userId} slug={teacher.slug} />
            </Suspense>
          </div>
        </Card>

        {teacher.bio ? (
          <Card className="p-6">
            <h2 className="mb-3 text-lg font-bold text-slate-900">Hakkımda</h2>
            <p className="whitespace-pre-line leading-relaxed text-slate-700">{teacher.bio}</p>
          </Card>
        ) : null}

        {video ? (
          <Card className="overflow-hidden">
            <iframe
              className="aspect-video w-full"
              src={`https://www.youtube-nocookie.com/embed/${video}`}
              title={`${name} tanıtım videosu`}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </Card>
        ) : null}

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Dersler ve ücretler</h2>
          <div className="divide-y divide-slate-100">
            {teacher.offerings.map((offering) => (
              <div key={offering.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {offering.level.name} · {offering.subject.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {offering.serviceType.name} · {offering.durations.map(durationLabel).join(", ")}
                  </p>
                </div>
                <p className="text-right">
                  <span className="text-lg font-bold text-slate-900">{formatMoney(offering.hourlyPrice)}</span>
                  <span className="text-sm text-slate-500"> / saat</span>
                </p>
              </div>
            ))}
          </div>
          {teacher.offersInPerson ? (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              <Home className="mt-0.5 size-4 shrink-0" aria-hidden />
              Yüz yüze dersler {[teacher.inPersonAtStudentHome && "öğrencinin adresinde", teacher.inPersonAtTeacherPlace && "öğretmenin belirlediği yerde"].filter(Boolean).join(" veya ")} yapılır. Adres bilgisi yalnızca ders onaylandıktan sonra paylaşılır.
            </p>
          ) : null}
        </Card>

        <Suspense fallback={null}>
          <SubscriptionPlans teacherId={teacher.userId} firstName={teacher.user.firstName} />
        </Suspense>

        <Reviews teacher={teacher} />
      </div>

      <aside id="randevu" className="scroll-mt-20 lg:sticky lg:top-20 lg:self-start">
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
            <BookOpen className="size-5 text-brand-600" aria-hidden /> Randevu al
          </h2>
          {preview ? (
            <p className="text-sm text-slate-500">Profil yayına alınınca boş saatleriniz burada görünecek ve veliler randevu alabilecek.</p>
          ) : (
          <>
          {salesOpen() ? null : (
            <Alert tone="info" title="Online ödeme çok yakında" className="mb-4">
              Saatleri ve fiyatları inceleyebilirsiniz; ücretli dersler ödeme altyapımız açılınca başlayacak.{teacher.offersIntro && teacher.offersOnline ? " Ücretsiz tanışma görüşmesini ve mesajlaşmayı şimdiden kullanabilirsiniz." : " Öğretmene şimdiden mesaj gönderebilirsiniz."}
            </Alert>
          )}
          <BookingWidget
            teacherId={teacher.userId}
            online={teacher.offersOnline}
            offersIntro={teacher.offersIntro && teacher.offersOnline}
            inPerson={teacher.offersInPerson}
            today={toLocalDateString(new Date())}
            offerings={teacher.offerings.map((o) => ({
              id: o.id,
              serviceName: o.serviceType.name,
              levelName: o.level.name,
              subjectName: o.subject.name,
              hourlyPrice: o.hourlyPrice,
              durations: o.durations,
            }))}
          />
          <div className="mt-4 border-t border-slate-100 pt-4">
            <MessageTeacherBox teacherId={teacher.userId} teacherFirstName={teacher.user.firstName} />
          </div>
          </>
          )}
        </Card>
      </aside>
      {/* Telefonda randevu kutusu sayfanın sonunda kalır; alttaki sabit çubuk oraya götürür. */}
      {!preview && teacher.offerings.length ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <p className="text-xs leading-tight text-slate-500">
            Saatlik ücret
            <span className="block text-sm text-slate-600">
              <span className="text-lg font-bold text-slate-900">{formatMoney(Math.min(...teacher.offerings.map((o) => o.hourlyPrice)))}</span>’den başlıyor
            </span>
          </p>
          <a href="#randevu" className={buttonClasses("primary", "md")}>
            Randevu al
          </a>
        </div>
      ) : null}
    </div>
  );
}

/** Öğretmenin aylık soru aboneliği planları (varsa). */
async function SubscriptionPlans({ teacherId, firstName }: { teacherId: string; firstName: string }) {
  const [plans, settings] = await Promise.all([publicPlans(teacherId), loadSettings()]);
  if (!plans.length) return null;
  return (
    <Card className="border-violet-200 p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <Repeat className="size-5 text-violet-600" aria-hidden /> Aylık soru aboneliği
      </h2>
      <p className="mt-1 text-sm text-slate-600">Sorularınızın fotoğrafını doğrudan {firstName} öğretmene gönderin; belirlenen sürede adım adım çözülsün.</p>
      <div className="mt-4 divide-y divide-slate-100">
        {plans.map((plan) => (
          <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-semibold text-slate-900">
                {plan.level.name} · {plan.subject.name}
              </p>
              <p className="text-sm text-slate-500">
                Günde {plan.dailyLimit} soruya kadar · {plan.answerHours} saatte cevap
              </p>
              {plan.description ? <p className="mt-1 text-sm text-slate-600">{plan.description}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              <p className="text-right">
                <span className="text-lg font-bold text-slate-900">{formatMoney(plan.price)}</span>
                <span className="text-sm text-slate-500"> / {settings.subscriptionDays} gün</span>
              </p>
              <Link href={`/abonelik/${plan.id}`} className={buttonClasses("primary", "sm")}>
                Abone ol
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Reviews({ teacher }: { teacher: PublicTeacher }) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">Değerlendirmeler</h2>
        <RatingSummary average={teacher.ratingAvg} count={teacher.ratingCount} />
      </div>
      {teacher.reviews.length === 0 ? (
        <p className="text-sm text-slate-500">Bu öğretmen henüz değerlendirme almadı. Yorumları yalnızca dersini tamamlamış öğrenciler ve veliler yazabilir.</p>
      ) : (
        <ul className="space-y-5">
          {teacher.reviews.map((review) => (
            <li key={review.id} className="border-b border-slate-100 pb-5 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={review.rating} />
                <span className="text-sm font-semibold text-slate-800">{shortName(review.student)}</span>
                <span className="text-xs text-slate-400">· {formatDate(review.createdAt)} · {review.booking.levelName} {review.booking.subjectName}</span>
              </div>
              {review.comment ? <p className="mt-2 text-sm leading-relaxed text-slate-700">{review.comment}</p> : null}
              {review.teacherReply ? (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="text-xs font-semibold text-slate-500">Öğretmenin yanıtı</p>
                  <p className="mt-1 text-slate-700">{review.teacherReply}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function FavoriteButton({ teacherId, slug }: { teacherId: string; slug: string }) {
  const user = await getCurrentUser();
  if (user && user.role !== "STUDENT") return null;
  const isFavorite = user ? Boolean(await db.favorite.findUnique({ where: { studentId_teacherId: { studentId: user.id, teacherId } } })) : false;
  if (!user) {
    return (
      <Link href={`/giris?next=/ogretmen/${slug}`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
        <Heart className="size-4" aria-hidden /> Favorilere ekle
      </Link>
    );
  }
  return (
    <form action={toggleFavoriteAction}>
      <input type="hidden" name="teacherId" value={teacherId} />
      <input type="hidden" name="returnTo" value={`/ogretmen/${slug}`} />
      <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
        <Heart className={isFavorite ? "size-4 fill-rose-500 text-rose-500" : "size-4"} aria-hidden /> {isFavorite ? "Favorilerde" : "Favorilere ekle"}
      </button>
    </form>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <Skeleton className="h-[520px] rounded-2xl" />
    </div>
  );
}
