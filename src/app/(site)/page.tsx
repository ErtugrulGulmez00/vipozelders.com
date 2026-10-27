import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  BookOpenCheck,
  Building2,
  Camera,
  Repeat,
  CalendarCheck,
  ClipboardCheck,
  CircleHelp,
  CreditCard,
  GraduationCap,
  MessageSquareQuote,
  MonitorPlay,
  ShieldCheck,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClassroomPreview } from "@/components/site/classroom-preview";
import { SearchBox } from "@/components/site/search-box";
import { TeacherCard } from "@/components/site/teacher-card";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { LEVEL_GROUP_LABELS, type Catalog } from "@/server/catalog";
import { parsePackages } from "@/server/credits";
import { getCatalog, getSiteSettings } from "@/server/site";
import { featuredTeachers } from "@/server/teachers";

const SERVICE_STYLE: Record<string, { icon: typeof GraduationCap; tile: string; ink: string }> = {
  "ozel-ders": { icon: GraduationCap, tile: "bg-brand-100", ink: "text-brand-700" },
  "soru-cozum": { icon: CircleHelp, tile: "bg-gold-100", ink: "text-gold-700" },
  kocluk: { icon: Target, tile: "bg-mint-100", ink: "text-mint-800" },
};
const FALLBACK_SERVICE = { icon: BookOpenCheck, tile: "bg-iris-100", ink: "text-iris-700" };

/** Hero'daki renkli ders kutuları: katalogda varsa o dersin öğretmenlerine, yoksa öğretmen listesine gider. */
function heroTiles(catalog: Catalog) {
  const subject = (slug: string) => catalog.subjects.find((s) => s.slug === slug);
  const href = (slug: string) => (subject(slug) ? `/ogretmenler?subject=${slug}` : "/ogretmenler");
  return [
    { title: subject("matematik")?.name ?? "Matematik", label: "LGS · YKS", href: href("matematik"), className: "bg-brand-600 text-white -rotate-2", sub: "text-white/85" },
    { title: subject("fen-bilimleri")?.name ?? "Fen Bilimleri", label: "Ortaokul · Lise", href: href("fen-bilimleri"), className: "bg-gold-400 text-ink-900 sm:mt-7", sub: "text-ink-800" },
    { title: subject("ingilizce")?.name ?? "İngilizce", label: "Her kademe", href: href("ingilizce"), className: "bg-iris-500 text-white", sub: "text-white/85" },
    { title: "Soru çöz", label: "Fotoğrafla", href: "/soru-sor", className: "bg-mint-400 text-ink-950 rotate-2 sm:mt-7", sub: "text-ink-800" },
  ];
}

export default async function HomePage() {
  const [catalog, settings] = await Promise.all([getCatalog(), getSiteSettings()]);
  const cheapestQuestion = Math.min(...parsePackages(settings.questionPackages).map((p) => Math.round(p.price / p.credits)));
  const groups = ["SCHOOL", "EXAM", "OTHER"].map((group) => ({ group, levels: catalog.levels.filter((l) => l.group === group) })).filter((g) => g.levels.length);

  return (
    <>
      {/* Karşılama: arama, kademeler ve renkli ders kutuları */}
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-x-12 gap-y-8 px-4 pb-16 pt-10 sm:pt-14 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0">
            <p className="inline-flex items-start gap-2 rounded-2xl bg-gold-100 px-3.5 py-1.5 text-xs font-bold text-gold-700 sm:items-center sm:rounded-full sm:text-sm">
              <BadgeCheck className="mt-px size-4 shrink-0 sm:mt-0" aria-hidden />
              <span>Onaylı öğretmenler · Güvenli ödeme · Ders olmazsa iade</span>
            </p>
            <h1 className="mt-6 text-5xl font-extrabold leading-[0.98] tracking-tight text-ink-900 sm:text-6xl lg:text-7xl">
              Doğru öğretmen,
              <br />
              <span className="mt-2 inline-block -rotate-1 rounded-2xl bg-brand-600 px-3 text-white sm:px-4">doğru saatte.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-600">{settings.siteTagline}</p>
          </div>
          <div className="order-3 grid grid-cols-2 gap-3 sm:gap-4 lg:order-none" aria-label="Popüler dersler">
            {heroTiles(catalog).map((tile) => (
              <Link key={tile.title} href={tile.href} className={cn("flex min-h-32 flex-col justify-between rounded-[1.75rem] p-5 transition hover:-translate-y-0.5 hover:shadow-lg sm:min-h-40", tile.className)}>
                <span className={cn("text-xs font-bold sm:text-sm", tile.sub)}>{tile.label}</span>
                <span className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{tile.title}</span>
              </Link>
            ))}
          </div>
          <div className="order-2 min-w-0 lg:order-none lg:col-span-2">
            <SearchBox catalog={catalog} />
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              {catalog.levels.slice(0, 6).map((level) => (
                <Link key={level.id} href={`/ozel-ders/${level.slug}`} className="rounded-full bg-ink-50 px-3.5 py-1.5 font-semibold text-ink-700 hover:bg-ink-100">
                  {level.name}
                </Link>
              ))}
            </div>
            <Link href="/kurumlar-icin" className="group mt-6 flex items-start gap-2 text-sm font-semibold text-ink-700 hover:text-brand-700 sm:items-center">
              <Building2 className="mt-0.5 size-4 shrink-0 text-brand-600 sm:mt-0" aria-hidden />
              <span>
                Etüt merkezi ya da dershane mi yönetiyorsunuz? <span className="whitespace-nowrap text-brand-700 underline-offset-2 group-hover:underline">Kurum paneline göz atın →</span>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Hizmetler */}
      <section className="bg-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">Size nasıl yardımcı olalım?</h2>
          <p className="mt-2 text-ink-600">Sanal dershanemizde ihtiyacınıza uygun çalışma şeklini seçin.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {catalog.services.map((service) => {
              const style = SERVICE_STYLE[service.slug] ?? FALLBACK_SERVICE;
              return (
                <Link key={service.id} href={`/ogretmenler?service=${service.slug}`} className="group rounded-[1.75rem] bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <span className={cn("inline-flex size-14 items-center justify-center rounded-2xl", style.tile, style.ink)}>
                    <style.icon className="size-6" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-2xl font-extrabold text-ink-900">{service.name}</h3>
                  {service.description ? <p className="mt-1.5 text-ink-600">{service.description}</p> : null}
                  <p className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-brand-700">
                    Öğretmenleri ve fiyatları gör <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </p>
                </Link>
              );
            })}
          </div>
          {Number.isFinite(cheapestQuestion) ? (
            <Link href="/soru-sor" className="group mt-4 flex flex-col gap-4 rounded-[1.75rem] bg-gold-400 p-6 text-ink-900 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-start gap-4">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                  <Camera className="size-6" aria-hidden />
                </span>
                <span>
                  <span className="block font-display text-xl font-extrabold">Takıldığınız sorunun fotoğrafını gönderin</span>
                  <span className="mt-1 block text-sm text-ink-800">
                    Branş öğretmeni {settings.questionAnswerHours} saat içinde çözsün; çözülmezse krediniz iade. Soru başına {formatMoney(cheapestQuestion)}’den başlayan fiyatlarla.
                  </span>
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-bold text-white">
                Soru sor <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ) : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {settings.groupsEnabled ? (
              <Link href="/grup-dersleri" className="group flex flex-col justify-between gap-4 rounded-[1.75rem] bg-ink-900 p-6 text-white sm:flex-row sm:items-center">
                <span className="flex gap-4">
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-gold-400">
                    <Users className="size-6" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-display text-xl font-extrabold">Grup dersleri: sanal dershane</span>
                    <span className="mt-1 block text-sm text-ink-200">
                      {settings.groupMinParticipants}–{settings.groupMaxCapacity} kişilik online sınıflar, birebir dersten çok daha uygun. En az kişi dolmazsa ücretin tamamı iade.
                    </span>
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 self-start rounded-full bg-gold-400 px-4 py-2 text-sm font-bold text-ink-900 sm:self-center">
                  Programlar <ArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            ) : null}
            {settings.subscriptionsEnabled ? (
              <Link href="/ogretmenler?abonelik=1" className="group flex flex-col justify-between gap-4 rounded-[1.75rem] bg-iris-500 p-6 text-white sm:flex-row sm:items-center">
                <span className="flex gap-4">
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                    <Repeat className="size-6" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-display text-xl font-extrabold">Aylık soru aboneliği</span>
                    <span className="mt-1 block text-sm text-white/90">
                      Kendi öğretmeninize {settings.subscriptionDays} gün boyunca her gün soru gönderin; otomatik çekim yok, kendiliğinden yenilenmez.
                    </span>
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 self-start rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-900 sm:self-center">
                  Öğretmenler <ArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Kademeler */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">Kademeye göre öğretmen bul</h2>
          <div className="mt-8 space-y-8">
            {groups.map(({ group, levels }) => (
              <div key={group}>
                <h3 className="mb-3 font-sans text-sm font-bold uppercase tracking-wide text-ink-500">{LEVEL_GROUP_LABELS[group]}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {levels.map((level) => (
                    <Link key={level.id} href={`/ozel-ders/${level.slug}`} className="rounded-2xl border-2 border-ink-50 p-4 transition hover:border-brand-200 hover:bg-brand-50/50">
                      <p className="font-display text-lg font-extrabold text-ink-900">{level.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-500">
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

      {/* Öne çıkan öğretmenler */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">Öne çıkan öğretmenler</h2>
            <p className="mt-2 text-ink-600">Profilini, fiyatını ve boş saatlerini inceleyip hemen randevu alabileceğiniz öğretmenler.</p>
          </div>
          <LinkButton href="/ogretmenler" variant="outline">
            Tüm öğretmenler
          </LinkButton>
        </div>
        <Suspense fallback={<TeacherGridSkeleton />}>
          <FeaturedTeachers />
        </Suspense>
      </section>

      {/* Nasıl çalışır + güvenceler */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="grid items-center gap-10 rounded-[2.25rem] bg-cream-50 p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">4 adımda derstesiniz</h2>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { icon: BookOpenCheck, tone: "bg-brand-600 text-white", title: "Öğretmenini seç", text: "Kademe, ders, fiyat ve yorumlara göre karşılaştır." },
                { icon: CalendarCheck, tone: "bg-gold-400 text-ink-900", title: "Saati seç, öde", text: "Takvimdeki boş saatlerden birini seç; ödeme güvenle alınır." },
                { icon: BadgeCheck, tone: "bg-iris-500 text-white", title: "Öğretmen onaylar", text: `${settings.approvalWindowHours} saat içinde onaylanmazsa ücretin tamamı iade edilir.` },
                { icon: MonitorPlay, tone: "bg-mint-400 text-ink-950", title: "Derse katıl", text: "Online dersler sitemizdeki sanal sınıfta; kurulum gerekmez." },
              ].map((step, index) => (
                <li key={step.title} className="rounded-3xl bg-white p-5">
                  <span className={cn("inline-flex size-10 items-center justify-center rounded-full font-display text-base font-extrabold", step.tone)} aria-hidden>
                    {index + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-extrabold text-ink-900">{step.title}</h3>
                  <p className="mt-1 text-sm text-ink-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
          <ClassroomPreview className="hidden px-6 lg:block" />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Onaylı öğretmenler", text: "Kimlik ve diploma kontrolünden geçen öğretmenler “Onaylı” rozetiyle gösterilir." },
            { icon: CreditCard, title: "Paranız güvende", text: `Ödeme ders gerçekleşip ${settings.disputeWindowHours} saatlik itiraz süresi dolana kadar öğretmene aktarılmaz.` },
            { icon: MessageSquareQuote, title: "Gerçek yorumlar", text: "Yalnızca dersini tamamlamış öğrenciler ve veliler değerlendirme yapabilir." },
          ].map((item) => (
            <div key={item.title} className="flex gap-4 rounded-3xl border-2 border-ink-50 bg-white p-5">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-mint-100 text-mint-800">
                <item.icon className="size-5" aria-hidden />
              </span>
              <span>
                <h3 className="font-extrabold text-ink-900">{item.title}</h3>
                <p className="mt-1 text-sm text-ink-600">{item.text}</p>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Kurumlar ve öğretmenler */}
      <section className="mx-auto mt-16 grid max-w-6xl gap-4 px-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-[2rem] bg-ink-900 p-8 text-white sm:p-10">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-gold-400">
            <Building2 className="size-3.5" aria-hidden /> Kurumlar için
          </p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Etüt merkezi ya da dershane mi yönetiyorsunuz?</h2>
          <p className="mt-3 text-ink-200">Öğrenci ve veli takibi, yoklama ve devamsızlık bildirimi, deneme analizi ve eksik konular, ödeme planı ve makbuz: hepsi tek panelde.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              { icon: ClipboardCheck, title: "Yoklama", text: "Gelmeyen öğrencinin velisine anında bildirim" },
              { icon: BookOpenCheck, title: "Deneme analizi", text: "Net, sıralama ve konu bazında eksikler" },
              { icon: Wallet, title: "Muhasebe", text: "Taksit, tahsilat, makbuz ve giderler" },
              { icon: BellRing, title: "Veli portalı", text: "Veli her şeyi telefonundan takip eder" },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <item.icon className="size-5 text-gold-400" aria-hidden />
                <p className="mt-2 font-bold">{item.title}</p>
                <p className="text-sm text-ink-200">{item.text}</p>
              </div>
            ))}
          </div>
          <LinkButton href="/kurumlar-icin" variant="gold" size="lg" className="mt-7">
            Kurum panelini inceleyin
          </LinkButton>
        </div>
        <div className="flex flex-col justify-between rounded-[2rem] bg-brand-600 p-8 text-white sm:p-10">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
              <GraduationCap className="size-3.5" aria-hidden /> Öğretmenler için
            </p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Öğretmen misiniz?</h2>
            <p className="mt-3 text-white/90">Kendi fiyatınızı ve takviminizi belirleyin, öğrencilere online veya yüz yüze ulaşın.</p>
          </div>
          <LinkButton href="/ogretmen-ol" variant="ink" size="lg" className="mt-7 self-start">
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
  if (!teachers.length) return <p className="mt-6 text-sm text-ink-500">Yakında burada öğretmenlerimizi göreceksiniz.</p>;
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {teachers.map((teacher) => (
        <TeacherCard key={teacher.userId} teacher={teacher} />
      ))}
    </div>
  );
}

function TeacherGridSkeleton() {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-64 rounded-3xl" />
      ))}
    </div>
  );
}
