import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// "Nasıl çalışır" rehberlerinin parçaları: tarayıcı / telefon çerçeveli gerçek ekran, numaralı açıklama, video.
// Görüntüler data-zoom ile büyütülür (GuideZoom).

export type Shot = { src: string; url: string; alt: string; width: number; height: number; tall?: boolean };
/** Numaralı açıklama satırı: [kalın başlangıç, devamı] */
export type LegendItem = [string, string];

export const GUIDES = [
  { key: "ozel-ders", href: "/nasil-calisir/ozel-ders", label: "Özel ders" },
  { key: "etut-merkezi", href: "/nasil-calisir/etut-merkezi", label: "Etüt merkezi" },
  { key: "dershane", href: "/nasil-calisir/dershane", label: "Dershane" },
] as const;

/** Rehberler arası geçiş çubuğu */
export function GuideSwitcher({ active }: { active: (typeof GUIDES)[number]["key"] }) {
  return (
    <div className="border-b border-ink-100 bg-white">
      <nav aria-label="Nasıl çalışır rehberleri" className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-2.5">
        <Link href="/nasil-calisir" className="mr-1 shrink-0 text-sm font-semibold text-ink-500 hover:text-ink-900">
          Nasıl çalışır?
        </Link>
        {GUIDES.map((g) => (
          <Link
            key={g.key}
            href={g.href}
            aria-current={g.key === active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
              g.key === active ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-700 hover:bg-ink-100",
            )}
          >
            {g.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Rehber içi bölüm bağlantıları; site başlığının altında yapışık durur */
export function GuideNav({ items }: { items: [id: string, label: string][] }) {
  return (
    <nav aria-label="Rehber bölümleri" className="sticky top-18 z-20 border-b border-white/10 bg-ink-900">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
        {items.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-200 hover:bg-white/10 hover:text-white">
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function GuideSection({ id, eyebrow, title, lead, children, className }: { id: string; eyebrow: string; title: ReactNode; lead?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-32 border-t border-ink-100 py-16 sm:py-20", className)}>
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-xs font-bold tracking-[0.12em] text-brand-600 uppercase">{eyebrow}</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-extrabold text-balance text-ink-900 sm:text-4xl">{title}</h2>
        {lead ? <p className="mt-3 max-w-3xl text-lg text-ink-500">{lead}</p> : null}
        {children}
      </div>
    </section>
  );
}

export function BrowserShot({ shot, className, sizes = "(min-width: 1024px) 700px, 100vw" }: { shot: Shot; className?: string; sizes?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgba(27,31,59,.06),0_10px_30px_rgba(27,31,59,.08)]", className)}>
      <div className="flex items-center gap-1.5 border-b border-ink-100 bg-ink-50 px-3 py-2">
        <i className="size-2.5 rounded-full bg-ink-200" />
        <i className="size-2.5 rounded-full bg-ink-200" />
        <i className="size-2.5 rounded-full bg-ink-200" />
        <span className="ml-2 min-w-0 truncate rounded-full border border-ink-100 bg-white px-3 py-0.5 text-xs font-medium text-ink-500">{shot.url}</span>
      </div>
      <Image
        src={shot.src}
        alt={shot.alt}
        width={shot.width}
        height={shot.height}
        sizes={sizes}
        data-zoom={shot.src}
        className={cn("block h-auto w-full cursor-zoom-in", shot.tall && "max-h-[760px] object-cover object-top")}
      />
    </div>
  );
}

/** Telefon çerçevesinde görüntü ya da video */
export function Phone({ caption, children }: { caption: ReactNode; children: ReactNode }) {
  return (
    <figure className="grid w-full max-w-[280px] justify-items-center gap-2.5">
      <div className="w-full rounded-[34px] bg-ink-950 p-2.5 shadow-lg">
        <div className="max-h-[600px] overflow-hidden rounded-[26px] bg-white">{children}</div>
      </div>
      <figcaption className="max-w-[30ch] text-center text-sm text-ink-500">{caption}</figcaption>
    </figure>
  );
}

export function PhoneImage({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  return <Image src={src} alt={alt} width={width} height={height} sizes="280px" data-zoom={src} className="block h-auto w-full cursor-zoom-in object-cover object-top" />;
}

export function Phones({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-8 flex flex-wrap items-start justify-center gap-6", className)}>{children}</div>;
}

export function GuideVideo({ src, poster, title, seconds, phone }: { src: string; poster: string; title: string; seconds: number; phone?: boolean }) {
  const video = <video controls preload="metadata" playsInline poster={poster} src={src} className={cn("block w-full bg-ink-950", phone ? "rounded-[26px]" : "aspect-video rounded-2xl shadow-lg")} />;
  if (phone) {
    return (
      <Phone caption={<><VideoTag /> {title} · {seconds} sn</>}>{video}</Phone>
    );
  }
  return (
    <figure className="grid gap-2.5">
      {video}
      <figcaption className="flex flex-wrap items-baseline gap-2 text-[15px]">
        <VideoTag />
        <b className="font-display text-[17px]">{title}</b>
        <span className="text-ink-500">· {seconds} sn</span>
      </figcaption>
    </figure>
  );
}

function VideoTag() {
  return <span className="rounded-full border-[1.5px] border-current px-2 py-px text-xs font-bold tracking-wide text-brand-600 uppercase">Video</span>;
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ol className="grid gap-2.5">
      {items.map(([bold, rest], i) => (
        <li key={bold} className="grid grid-cols-[28px_1fr] items-start gap-2.5 text-[15.5px] leading-relaxed">
          <span className="mt-0.5 grid size-[26px] place-items-center rounded-full bg-gold-400 text-[13px] font-extrabold text-ink-900 shadow-[0_0_0_2px_#fff,0_2px_6px_rgba(27,31,59,.25)]">{i + 1}</span>
          <span>
            <b>{bold}</b>
            {rest ? ` ${rest}` : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Solda (flip ise sağda) işaretli ekran, yanında başlık ve numaralı açıklama */
export function Feature({ shot, title, legend, flip, children, className }: { shot: Shot; title?: string; legend?: LegendItem[]; flip?: boolean; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-10 grid items-start gap-6 lg:grid-cols-[1.65fr_1fr]", className)}>
      <figure className={cn("m-0", flip && "lg:order-2")}>
        <BrowserShot shot={shot} />
      </figure>
      <div className="grid gap-3.5">
        {title ? <h3 className="text-[22px] font-bold text-ink-900">{title}</h3> : null}
        {legend ? <Legend items={legend} /> : null}
        {children}
      </div>
    </div>
  );
}

export function Gallery({ items }: { items: { shot: Shot; caption: ReactNode }[] }) {
  return (
    <div className="mt-8 grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr))]">
      {items.map(({ shot, caption }) => (
        <figure key={shot.src} className="m-0">
          <BrowserShot shot={shot} sizes="(min-width: 1024px) 380px, 100vw" />
          <figcaption className="mt-2 text-sm text-ink-500">{caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Ekran + altında açıklama (video yanındaki tekli görüntüler için) */
export function Figure({ shot, children }: { shot: Shot; children: ReactNode }) {
  return (
    <figure className="m-0">
      <BrowserShot shot={shot} />
      <figcaption className="mt-2.5 text-sm text-ink-500">{children}</figcaption>
    </figure>
  );
}

export function Pair({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-8 grid items-start gap-6 lg:grid-cols-2", className)}>{children}</div>;
}

export function Tip({ title, children, tone = "coral" }: { title: string; children: ReactNode; tone?: "coral" | "ok" }) {
  return (
    <p className={cn("rounded-xl px-3.5 py-3 text-[15px]", tone === "ok" ? "bg-emerald-50" : "bg-brand-50")}>
      <b className={tone === "ok" ? "text-emerald-700" : "text-brand-700"}>{title}</b> {children}
    </p>
  );
}

export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[15.5px] text-ink-500", className)}>{children}</p>;
}
