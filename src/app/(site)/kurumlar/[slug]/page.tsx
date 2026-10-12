import { Mail, MapPin, Phone, Users } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, Skeleton } from "@/components/ui/primitives";
import { CENTER_KIND_LABEL } from "@/lib/center/labels";
import { getPublicCenter } from "@/server/center/public";
import { uploadUrl } from "@/server/storage";
import { LeadForm } from "./lead-form";

export async function generateMetadata({ params }: PageProps<"/kurumlar/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const center = await getPublicCenter(slug);
  if (!center) return { title: "Kurum", robots: { index: false } };
  const place = [center.district?.name, center.city?.name].filter(Boolean).join(", ");
  return {
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

async function CenterProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const center = await getPublicCenter(slug);
  if (!center) notFound();
  const logo = uploadUrl(center.logoKey);
  const place = [center.district?.name, center.city?.name].filter(Boolean).join(", ");
  const mapQuery = encodeURIComponent([center.name, center.address, place].filter(Boolean).join(" "));
  const programs = center.groups.filter((g) => g.targetExam || g.gradeName);
  return (
    <>
      <section className="bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-4 py-10 sm:py-14">
          {logo ? (
            <Image src={logo} alt="" width={80} height={80} unoptimized className="size-20 rounded-2xl bg-white object-contain p-1" />
          ) : (
            <span className="inline-flex size-20 items-center justify-center rounded-2xl bg-white/10 text-3xl font-black text-gold-300">{center.name.charAt(0)}</span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gold-300">{CENTER_KIND_LABEL[center.kind]}</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{center.name}</h1>
            {place ? (
              <p className="mt-1 inline-flex items-center gap-1 text-brand-100">
                <MapPin className="size-4" aria-hidden /> {place}
              </p>
            ) : null}
          </div>
        </div>
      </section>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {center.description ? (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-slate-900">Hakkımızda</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{center.description}</p>
            </Card>
          ) : null}
          {programs.length ? (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-slate-900">Sınıflar ve programlar</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {programs.map((g) => (
                  <li key={g.name} className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="font-semibold text-slate-900">{g.name}</p>
                    <p className="text-sm text-slate-500">{[g.gradeName, g.targetExam].filter(Boolean).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-slate-900">İletişim</h2>
            <ul className="mt-3 space-y-2 text-slate-700">
              {center.phone ? (
                <li className="flex items-center gap-2">
                  <Phone className="size-4 text-slate-400" aria-hidden />
                  <a href={`tel:${center.phone.replace(/\s/g, "")}`} className="font-semibold text-brand-700 hover:underline">
                    {center.phone}
                  </a>
                </li>
              ) : null}
              {center.email ? (
                <li className="flex items-center gap-2">
                  <Mail className="size-4 text-slate-400" aria-hidden />
                  <a href={`mailto:${center.email}`} className="hover:underline">
                    {center.email}
                  </a>
                </li>
              ) : null}
              {center.address || place ? (
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 text-slate-400" aria-hidden />
                  <span>
                    {[center.address, place].filter(Boolean).join(", ")}{" "}
                    <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-700 hover:underline">
                      Haritada göster
                    </a>
                  </span>
                </li>
              ) : null}
              <li className="flex items-center gap-2 text-sm text-slate-500">
                <Users className="size-4 text-slate-400" aria-hidden /> {center._count.members} eğitim kadrosu · veli portalı ile devamsızlık ve deneme takibi
              </li>
            </ul>
          </Card>
        </div>
        <Card className="h-fit p-6 lg:sticky lg:top-20">
          <h2 className="text-xl font-bold text-slate-900">Ön kayıt ve bilgi</h2>
          <p className="mt-1 mb-5 text-sm text-slate-500">Bilgilerinizi bırakın, kurum sizi arasın.</p>
          <LeadForm slug={center.slug} />
        </Card>
      </div>
    </>
  );
}
