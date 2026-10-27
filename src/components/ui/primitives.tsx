import { AlertTriangle, CheckCircle2, Info, Star, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-3xl border border-ink-100 bg-white shadow-xs", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4", className)}>
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

type Tone = "slate" | "brand" | "green" | "amber" | "rose" | "sky" | "violet";

const TONES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700",
  brand: "bg-brand-50 text-brand-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  rose: "bg-rose-50 text-rose-700",
  sky: "bg-sky-50 text-sky-700",
  violet: "bg-violet-50 text-violet-700",
};

export function Badge({ tone = "slate", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone], className)} {...props} />;
}

export type { Tone };

const ALERT_STYLES = {
  info: { box: "border-sky-200 bg-sky-50 text-sky-900", Icon: Info },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-900", Icon: CheckCircle2 },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", Icon: AlertTriangle },
  error: { box: "border-rose-200 bg-rose-50 text-rose-900", Icon: XCircle },
};

export function Alert({ tone = "info", title, children, className }: { tone?: keyof typeof ALERT_STYLES; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { box, Icon } = ALERT_STYLES[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-ink-100 bg-white px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-slate-400">{icon}</div> : null}
      <p className="font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2 sm:items-center sm:gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon ? <span className="hidden text-brand-500 sm:inline">{icon}</span> : null}
      </div>
      <p className="mt-2 font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}

export function Stars({ value, size = "sm", className }: { value: number; size?: "sm" | "md"; className?: string }) {
  const px = size === "sm" ? "size-3.5" : "size-5";
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`5 üzerinden ${value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} puan`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(px, i <= Math.round(value) ? "fill-gold-400 text-gold-400" : "fill-slate-200 text-slate-200")} aria-hidden />
      ))}
    </span>
  );
}

export function RatingSummary({ average, count }: { average: number; count: number }) {
  if (count === 0) return <span className="text-sm text-slate-500">Henüz değerlendirme yok</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Star className="size-4 fill-gold-400 text-gold-400" aria-hidden />
      <span className="font-semibold text-slate-900">{average.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
      <span className="text-slate-500">({count} değerlendirme)</span>
    </span>
  );
}

// Fotoğrafsız avatar: renk addan sabit seçilir (aynı kişi hep aynı renk)
const AVATAR_TONES = ["bg-brand-600 text-white", "bg-iris-500 text-white", "bg-mint-400 text-ink-950", "bg-gold-400 text-ink-900", "bg-ink-800 text-white"];

function avatarTone(name: string): string {
  let sum = 0;
  for (const ch of name) sum = (sum + ch.charCodeAt(0)) % 997;
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}

export function Avatar({ src, name, initials, size = 48, className }: { src: string | null; name: string; initials: string; size?: number; className?: string }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        unoptimized
        className={cn("shrink-0 rounded-full object-cover ring-2 ring-white", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-label={name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-display font-extrabold ring-2 ring-white", avatarTone(name), className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </span>
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return <th className={cn("whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500", className)} {...props} />;
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-slate-100 px-4 py-3 align-top text-slate-700", className)} {...props} />;
}

export function Pagination({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (page: number) => string }) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 2);
  return (
    <nav aria-label="Sayfalar" className="mt-8 flex flex-wrap items-center justify-center gap-1">
      {pages.map((p, index) => (
        <span key={p} className="flex items-center gap-1">
          {index > 0 && p - pages[index - 1] > 1 ? <span className="px-1 text-slate-400">…</span> : null}
          <Link
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-lg text-sm font-semibold",
              p === page ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {p}
          </Link>
        </span>
      ))}
    </nav>
  );
}

export function DescriptionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-3 gap-4 py-2.5 text-sm">
          <dt className="text-slate-500">{item.label}</dt>
          <dd className="col-span-2 text-slate-800">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200/70", className)} />;
}
