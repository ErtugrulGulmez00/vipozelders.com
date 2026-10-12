import {
  BadgeCheck,
  BookOpenCheck,
  CalendarCheck,
  CircleHelp,
  CreditCard,
  GraduationCap,
  MessageSquareQuote,
  MonitorPlay,
  ShieldCheck,
  Target,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClassroomPreview } from "@/components/site/classroom-preview";
import { SearchBox } from "@/components/site/search-box";
import { TeacherCard } from "@/components/site/teacher-card";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { LEVEL_GROUP_LABELS } from "@/server/catalog";
import { getCatalog, getSiteSettings } from "@/server/site";
import { featuredTeachers } from "@/server/teachers";

const SERVICE_ICONS: Record<string, typeof GraduationCap> = {
  "ozel-ders": GraduationCap,
  "soru-cozum": CircleHelp,
  kocluk: Target,
};

export default async function HomePage() {
  const [catalog, settings] = await Promise.all([getCatalog(), getSiteSettings()]);
  const groups = ["SCHOOL", "EXAM", "OTHER"].map((group) => ({ group, levels: catalog.levels.filter((l) => l.group === group) })).filter((g) => g.levels.length);

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:pt-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_380px]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-100 ring-1 ring-white/20">
                <BadgeCheck className="size-3.5" aria-hidden /> Onaylı öğretmenler · Güvenli ödeme · Ders olmazsa iade
              </p>
              <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
                Doğru öğretmen, <span className="text-gold-300">doğru saatte.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-brand-100">{settings.siteTagline}</p>
            </div>
            <ClassroomPreview className="hidden lg:block" />
          </div>
          <div className="mt-10 max-w-4xl">
            <SearchBox catalog={catalog} />
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            {catalog.levels.slice(0, 6).map((level) => (
              <Link key={level.id} href={`/ozel-ders/${level.slug}`} className="rounded-full bg-white/10 px-3 py-1 text-brand-50 ring-1 ring-white/15 hover:bg-white/20">
                {level.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold text-slate-900">Hizmetlerimiz</h2>
        <p className="mt-1 text-slate-500">Sanal dershanemizde ihtiyacınıza uygun çalışma şeklini seçin.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {catalog.services.map((service) => {
            const Icon = SERVICE_ICONS[service.slug] ?? BookOpenCheck;
            return (
              <Link key={service.id} href={`/ogretmenler?service=${service.slug}`} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-brand-200 hover:shadow-md">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-brand-700">{service.name}</h3>
                {service.description ? <p className="mt-1 text-sm text-slate-600">{service.description}</p> : null}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-slate-900">Kademeye göre öğretmen bul</h2>
          <div className="mt-6 space-y-8">
            {groups.map(({ group, levels }) => (
              <div key={group}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{LEVEL_GROUP_LABELS[group]}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {levels.map((level) => (
                    <Link key={level.id} href={`/ozel-ders/${level.slug}`} className="rounded-xl border border-slate-200 p-4 hover:border-brand-300 hover:bg-brand-50/50">
                      <p className="font-semibold text-slate-900">{level.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {catalog.subjects.filter((s) => level.subjectIds.includes(s.id)).map((s) => s.name).join(" · ")}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Öne çıkan öğretmenler</h2>
            <p className="mt-1 text-slate-500">Velilerin en çok tercih ettiği, yüksek puanlı öğretmenler.</p>
          </div>
          <LinkButton href="/ogretmenler" variant="outline">
            Tüm öğretmenler
          </LinkButton>
        </div>
        <Suspense fallback={<TeacherGridSkeleton />}>
          <FeaturedTeachers />
        </Suspense>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-slate-900">Nasıl çalışır?</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-4">
            {[
              { icon: BookOpenCheck, title: "Öğretmenini seç", text: "Kademe, ders, fiyat ve yorumlara göre karşılaştır." },
              { icon: CalendarCheck, title: "Saati seç, öde", text: "Takvimdeki boş saatlerden birini seç; ödeme güvenle alınır." },
              { icon: BadgeCheck, title: "Öğretmen onaylar", text: `${settings.approvalWindowHours} saat içinde onaylanmazsa ücretin tamamı iade edilir.` },
              { icon: MonitorPlay, title: "Derse katıl", text: "Online dersler sitemizdeki sanal sınıfta; kurulum gerekmez." },
            ].map((step, index) => (
              <li key={step.title} className="relative rounded-2xl bg-slate-50 p-6">
                <span className="absolute right-5 top-5 text-3xl font-black text-slate-200">{index + 1}</span>
                <step.icon className="size-6 text-brand-600" aria-hidden />
                <h3 className="mt-3 font-bold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Onaylı öğretmenler", text: "Kimlik ve diploma kontrolünden geçen öğretmenler “Onaylı” rozetiyle gösterilir." },
            { icon: CreditCard, title: "Paranız güvende", text: `Ödeme ders gerçekleşip ${settings.disputeWindowHours} saatlik itiraz süresi dolana kadar öğretmene aktarılmaz.` },
            { icon: MessageSquareQuote, title: "Gerçek yorumlar", text: "Yalnızca dersini tamamlamış öğrenciler ve veliler değerlendirme yapabilir." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
              <item.icon className="size-6 text-emerald-600" aria-hidden />
              <h3 className="mt-3 font-bold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-r from-brand-700 to-brand-900 p-8 text-white sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-2xl font-bold">Öğretmen misiniz?</h2>
            <p className="mt-1 text-brand-100">Kendi fiyatınızı ve takviminizi belirleyin, öğrencilere online veya yüz yüze ulaşın.</p>
          </div>
          <LinkButton href="/ogretmen-ol" variant="gold" size="lg">
            Bize katılın
          </LinkButton>
        </div>
      </section>
    </>
  );
}

async function FeaturedTeachers() {
  await connection();
  const teachers = await featuredTeachers(6);
  if (!teachers.length) return <p className="mt-6 text-sm text-slate-500">Yakında burada öğretmenlerimizi göreceksiniz.</p>;
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {teachers.map((teacher) => (
        <TeacherCard key={teacher.userId} teacher={teacher} />
      ))}
    </div>
  );
}

function TeacherGridSkeleton() {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-64 rounded-2xl" />
      ))}
    </div>
  );
}
