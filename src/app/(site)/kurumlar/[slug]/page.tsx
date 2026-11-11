import {
  ArrowRight,
  BellRing,
  BookOpen,
  ChartColumn,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Library,
  Mail,
  MapPin,
  MessageCircleQuestion,
  Navigation,
  NotebookPen,
  Phone,
  Smartphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, Skeleton } from "@/components/ui/primitives";
import { CENTER_KIND_LABEL } from "@/lib/center/labels";
import { moduleEnabled, type CenterModuleKey } from "@/lib/center/modules";
import { appUrl } from "@/server/email";
import { getPublicCenter } from "@/server/center/public";
import { uploadUrl } from "@/server/storage";
import { LeadForm } from "./lead-form";

export async function generateMetadata({ params }: PageProps<"/kurumlar/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const center = await getPublicCenter(slug);
  if (!center) return { title: "Kurum", robots: { index: false } };
  const place = [center.district?.name, center.city?.name].filter(Boolean).join(", ");
  return {
    alternates: { canonical: `/kurumlar/${slug}` },
    title: `${center.name}${place ? ` · ${place}` : ""}`,
    description: center.description?.slice(0, 160) ?? `${center.name} ${CENTER_KIND_LABEL[center.kind].toLocaleLowerCase("tr-TR")}: programlar, iletişim ve ön kayıt.`,
  };
}

export default function CenterPublicPage({ params }: PageProps<"/kurumlar/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-10"><Skeleton className="h-64 rounded-2xl" /></div>}>
      <CenterProfile params={params} />
    </Suspense>
  );
}

type Feature = { icon: LucideIcon; title: string; text: string };

/** Kurumun panelinde açık olan modüllerden veliye anlatılan hizmetler (muhasebe ve ön kayıt iç işlerdir, gösterilmez). */
const MODULE_FEATURES: [CenterModuleKey, Feature][] = [
  ["denemeler", { icon: ChartColumn, title: "Deneme sınavları ve karne", text: "Deneme sonuçları ders ve konu bazında analiz edilir; öğrenci ve veli karneyi görür." }],
  ["etutler", { icon: Users, title: "Birebir ve küçük grup etüt", text: "Eksik konulara göre planlanan etütler; katılım kayıt altında." }],
  ["odevler", { icon: ClipboardCheck, title: "Ödev takibi", text: "Verilen ödevler ve teslim durumu düzenli kontrol edilir." }],
  ["kocluk", { icon: Compass, title: "Rehberlik ve koçluk", text: "Düzenli koç görüşmeleriyle hedef ve çalışma planı takibi." }],
  ["kaynaklar", { icon: BookOpen, title: "Kaynak ve çalışma programı", text: "Kitap ve konu ilerlemesi, haftalık çalışma programı." }],
  ["calisma-salonu", { icon: Library, title: "Çalışma salonu", text: "Kontrollü çalışma salonu; periyot periyot yoklama." }],
  ["sorular", { icon: MessageCircleQuestion, title: "Öğretmene soru sorma", text: "Öğrenci takıldığı sorunun fotoğrafını öğretmenine gönderir." }],
  ["sinif-defteri", { icon: NotebookPen, title: "Sınıf defteri", text: "Derste işlenen konular kayıt altında; veli de görebilir." }],
];

const STEPS = [
  { title: "Formu doldurun", text: "Öğrencinin adını, sınıfını ve telefonunuzu bırakın." },
  { title: "Kurum sizi arar", text: "Programlar, ücretler ve uygun saatler hakkında bilgi verir." },
  { title: "Tanışın ve kaydolun", text: "Kurumu ziyaret edin; kayıttan sonra veli portalından takip edin." },
];

async function CenterProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const center = await getPublicCenter(slug);
  if (!center) notFound();
  const logo = uploadUrl(center.logoKey);
  const kind = CENTER_KIND_LABEL[center.kind];
  const place = [center.district?.name, center.city?.name].filter(Boolean).join(", ");
  const address = [center.address, place].filter(Boolean).join(", ");
  const mapsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([center.name, address].join(" "))}` : null;
  const programs = center.groups.filter((g) => g.targetExam || g.gradeName);
  // Tanıtım yazısının ilk paragrafı üstte; "Hakkımızda" yalnızca geri kalanını (ilk paragraf kısaltıldıysa tamamını) gösterir
  const paragraphs = center.description?.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) ?? [];
  const intro = paragraphs[0];
  const about = intro && intro.length > 240 ? paragraphs.join("\n\n") : paragraphs.slice(1).join("\n\n");
  const features: Feature[] = [
    ...(center.notifyAbsence ? [{ icon: BellRing, title: "Anında devamsızlık bildirimi", text: "Öğrenci derse gelmediğinde veli aynı gün haberdar olur." }] : []),
    { icon: Smartphone, title: "Veli portalı", text: "Devamsızlık, duyurular, deneme sonuçları ve ödeme planı telefondan takip edilir." },
    ...MODULE_FEATURES.filter(([key]) => moduleEnabled(center, key)).map(([, feature]) => feature),
  ];
  const stats = [
    center._count.members ? { value: String(center._count.members), label: "eğitim kadrosu" } : null,
    programs.length ? { value: String(programs.length), label: programs.length === 1 ? "sınıf / program" : "sınıf ve program" } : null,
    { value: String(features.length), label: "hizmet" },
  ].filter((s): s is { value: string; label: string } => s !== null);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: center.name,
    url: appUrl(`/kurumlar/${center.slug}`),
    ...(logo ? { logo: appUrl(logo) } : {}),
    ...(center.phone ? { telephone: center.phone } : {}),
    ...(center.email ? { email: center.email } : {}),
    ...(address ? { address: { "@type": "PostalAddress", streetAddress: center.address ?? undefined, addressLocality: center.district?.name, addressRegion: center.city?.name, addressCountry: "TR" } } : {}),
  };

  return (
    <>
      {/* "<" kaçırılır: kurumun yazdığı metin script etiketini kapatamaz */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-brand-600/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-gold-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-16">
          <div className="flex flex-wrap items-center gap-5">
            {logo ? (
              <Image src={logo} alt="" width={96} height={96} unoptimized className="size-20 rounded-2xl bg-white object-contain p-1.5 shadow-lg sm:size-24" />
            ) : (
              <span className="inline-flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 font-display text-4xl font-black text-white shadow-lg sm:size-24">
                {center.name.charAt(0)}
              </span>
            )}
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-300">
                <GraduationCap className="size-3.5" aria-hidden /> {kind}
              </span>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-5xl">{center.name}</h1>
              {place ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-ink-100">
                  <MapPin className="size-4" aria-hidden /> {place}
                </p>
              ) : null}
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-100">
            {intro ? (intro.length > 240 ? `${intro.slice(0, 239).trimEnd()}…` : intro) : "Programları inceleyin, ön kayıt formunu doldurun; kurum sizi arayıp bilgi versin."}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#on-kayit" className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-600 px-6 font-bold text-white shadow-sm transition-colors hover:bg-brand-500">
              Ön kayıt bırak <ArrowRight className="size-4" aria-hidden />
            </a>
            {center.phone ? (
              <a
                href={`tel:${center.phone.replace(/[^\d+]/g, "")}`}
                className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-white/25 px-6 font-bold text-white transition-colors hover:border-white/50 hover:bg-white/5"
              >
                <Phone className="size-4" aria-hidden /> Hemen ara
              </a>
            ) : null}
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-white/25 px-6 font-bold text-white transition-colors hover:border-white/50 hover:bg-white/5"
              >
                <Navigation className="size-4" aria-hidden /> Yol tarifi
              </a>
            ) : null}
          </div>
          <dl className="mt-10 grid max-w-xl grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="block font-display text-2xl font-bold text-white sm:text-3xl">{s.value}</span>
                  <span className="text-xs text-ink-200 sm:text-sm">{s.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-10">
          <section>
            <h2 className="font-display text-2xl font-bold text-ink-900">Öğrenciye ve veliye neler sunuluyor?</h2>
            <p className="mt-1 text-slate-600">Kurumun Pi Kampüs panelinde açık olan hizmetler.</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {features.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-xs">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink-900">{title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {about ? (
            <section>
              <h2 className="font-display text-2xl font-bold text-ink-900">Hakkımızda</h2>
              <Card className="mt-4 p-6">
                <p className="whitespace-pre-line leading-relaxed text-slate-700">{about}</p>
              </Card>
            </section>
          ) : null}

          {programs.length ? (
            <section>
              <h2 className="font-display text-2xl font-bold text-ink-900">Sınıflar ve programlar</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {programs.map((g) => (
                  <li key={g.name} className="rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-xs">
                    <p className="font-semibold text-ink-900">{g.name}</p>
                    <p className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
                      {[g.gradeName, g.targetExam].filter(Boolean).map((tag) => (
                        <span key={tag} className="rounded-full bg-gold-50 px-2 py-0.5 font-semibold text-gold-700">
                          {tag}
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="font-display text-2xl font-bold text-ink-900">Ön kayıt nasıl işler?</h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-2xl bg-ink-50 p-4">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-ink-900 font-display text-sm font-bold text-white">{i + 1}</span>
                  <p className="mt-3 font-semibold text-ink-900">{step.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </section>

          {center.phone || center.email || address ? (
            <section>
              <h2 className="font-display text-2xl font-bold text-ink-900">İletişim</h2>
              <Card className="mt-4 divide-y divide-slate-100">
                {center.phone ? (
                  <a href={`tel:${center.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50">
                    <Phone className="size-5 text-brand-600" aria-hidden />
                    <span className="font-semibold text-ink-900">{center.phone}</span>
                  </a>
                ) : null}
                {center.email ? (
                  <a href={`mailto:${center.email}`} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50">
                    <Mail className="size-5 text-brand-600" aria-hidden />
                    <span className="min-w-0 break-all text-ink-900">{center.email}</span>
                  </a>
                ) : null}
                {address ? (
                  <div className="flex items-start gap-3 px-5 py-4">
                    <MapPin className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
                    <span className="min-w-0 text-ink-900">
                      {address}
                      {mapsUrl ? (
                        <a href={mapsUrl} target="_blank" rel="noreferrer" className="ml-2 text-sm font-semibold text-brand-700 hover:underline">
                          Haritada göster
                        </a>
                      ) : null}
                    </span>
                  </div>
                ) : null}
              </Card>
            </section>
          ) : null}
        </div>

        <aside id="on-kayit" className="h-fit scroll-mt-24 lg:sticky lg:top-20">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-5 text-white">
              <h2 className="font-display text-xl font-bold">Ön kayıt ve bilgi</h2>
              <p className="mt-1 text-sm text-brand-50">Bilgilerinizi bırakın, {center.name} sizi arasın. Ücretsizdir, bağlayıcı değildir.</p>
            </div>
            <div className="p-6">
              <LeadForm slug={center.slug} />
            </div>
          </Card>
          <p className="mt-4 px-1 text-xs text-slate-500">
            Bu kurum, veli takibi için Pi Kampüs kurum panelini kullanıyor.{" "}
            <Link href="/kurumlar-icin" className="font-semibold text-brand-700 hover:underline">
              Kurumlar için
            </Link>
          </p>
        </aside>
      </div>
    </>
  );
}
