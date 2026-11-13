import { ArrowRight, ClipboardCheck, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  alternates: { canonical: "/nasil-calisir" },
  title: "Nasıl çalışır?",
  description: "Özel ders ve etüt merkezi için Pi Kampüs'ün nasıl çalıştığını ekran görüntüleri ve videolarla anlatan rehberler.",
};

// İki rehbere giriş: özel ders (veli, öğrenci, öğretmen) ve etüt merkezi (kurum paneli)
const CARDS = [
  {
    href: "/nasil-calisir/ozel-ders",
    Icon: GraduationCap,
    title: "Özel ders",
    audience: "Veliler, öğrenciler ve öğretmenler için",
    text: "Öğretmen bulma, ücretsiz ders talebi, öğretmenin sizi araması ve Pi Koç ile program, ödev ve deneme takibi.",
    image: { src: "/tanitim/ozel-ders/01-ana-sayfa.jpg", width: 1440, height: 900 },
    tone: "bg-brand-50 text-brand-700",
  },
  {
    href: "/nasil-calisir/etut-merkezi",
    Icon: ClipboardCheck,
    title: "Etüt merkezi",
    audience: "Etüt merkezi sahipleri ve yöneticileri için",
    text: "Öğrenci kaydından etüt yoklamasına, ödevden deneme karnesine, tahsilattan veli portalına panelin tamamı.",
    image: { src: "/tanitim/etut-merkezi/02-ozet.jpg", width: 1440, height: 900 },
    tone: "bg-gold-50 text-gold-700",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="bg-ink-900 text-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <p className="text-xs font-bold tracking-[0.12em] text-gold-400 uppercase">Nasıl çalışır?</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">Size uygun rehberi seçin</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-200">Her rehber gerçek ekranları ve kısa videolarla adım adım anlatır.</p>
        </div>
      </section>
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-12 md:grid-cols-3">
        {CARDS.map(({ href, Icon, title, audience, text, image, tone }) => (
          <Link key={href} href={href} className="group flex flex-col overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-xs transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
            <div className="aspect-[16/10] overflow-hidden border-b border-ink-100 bg-ink-50">
              <Image src={image.src} alt="" width={image.width} height={image.height} sizes="(min-width: 768px) 360px, 100vw" className="h-full w-full object-cover object-top transition group-hover:scale-[1.02]" />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <span className={cn("inline-flex size-11 items-center justify-center rounded-2xl", tone)}>
                <Icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-2xl font-extrabold text-ink-900">{title}</h2>
              <p className="mt-1 text-sm font-semibold text-ink-500">{audience}</p>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink-600">{text}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 font-bold text-brand-700 group-hover:gap-2.5">
                Rehberi aç <ArrowRight className="size-4" aria-hidden />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
