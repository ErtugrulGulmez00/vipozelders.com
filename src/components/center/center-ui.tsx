import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { addDaysToDateString, formatDate, formatDayLabel, zonedDateTime } from "@/lib/dates";
import type { CenterAccess } from "@/lib/center/subscription";

// Kurum paneli sayfalarının ortak sunucu bileşenleri.

const FLASH: Record<string, { tone: "success" | "warning"; text: string }> = {
  kaydedildi: { tone: "success", text: "Öğrenci kaydedildi." },
  guncellendi: { tone: "success", text: "Öğrenci bilgileri güncellendi." },
  silindi: { tone: "success", text: "Öğrenci silindi." },
  yetki: { tone: "warning", text: "Bu bölüm için yetkiniz yok. Kurum yöneticinizden yetki isteyebilirsiniz." },
  modul: { tone: "warning", text: "Bu modül kurum ayarlarından kapatılmış. Kurum ayarları → Modüller bölümünden açabilirsiniz." },
  paket: { tone: "warning", text: "Bu bölüm Dershane paketinde: sınıf programı, sınıf yoklaması, sınıf defteri, derslikler ve raporlar. Paket yükseltmek için Abonelik sayfasına bakın." },
  "sinif-silindi": { tone: "success", text: "Sınıf silindi." },
  "sinif-arsiv": { tone: "success", text: "Sınıfın yoklama geçmişi olduğu için silinmedi, arşive alındı." },
  "etut-planlandi": { tone: "success", text: "Etüt planlandı." },
  "etut-silindi": { tone: "success", text: "Etüt silindi." },
  "odev-verildi": { tone: "success", text: "Ödev verildi; veli portalına bağlı velilere bildirim gitti. Teslim günü bu sayfadan kontrol edin." },
  "odev-silindi": { tone: "success", text: "Ödev silindi." },
  "kaynak-eklendi": { tone: "success", text: "Kaynak eklendi. Şimdi sınıfa ya da öğrencilere atayabilirsiniz." },
  "kaynak-silindi": { tone: "success", text: "Kaynak silindi." },
  "salon-eklendi": { tone: "success", text: "Salon eklendi. “Öğrenciler ve ayarlar” sekmesinden öğrencileri ekleyin." },
  "salon-silindi": { tone: "success", text: "Salon silindi." },
  "deneme-olustu": { tone: "success", text: "Deneme oluşturuldu. Şimdi sonuçları girebilir ya da Excel'den aktarabilirsiniz." },
  "deneme-silindi": { tone: "success", text: "Deneme silindi." },
  tahsilat: { tone: "success", text: "Tahsilat kaydedildi. Makbuzu yazdırabilir ya da veliye iletebilirsiniz." },
  baglandi: { tone: "success", text: "Hesabınız öğrenciye bağlandı. Artık devamsızlık, deneme sonuçları ve ödemeleri buradan takip edebilirsiniz." },
  ayrildi: { tone: "success", text: "Öğrenci bağlantısı kaldırıldı." },
};

export function CenterFlash({ code }: { code: string | string[] | undefined }) {
  const key = Array.isArray(code) ? code[0] : code;
  const flash = key ? FLASH[key] : undefined;
  return flash ? (
    <Alert tone={flash.tone} className="mb-6">
      {flash.text}
    </Alert>
  ) : null;
}

export function SubscriptionBanner({ access, canManage }: { access: CenterAccess; canManage: boolean }) {
  const link = canManage ? (
    <Link href="/kurum/abonelik" className="font-semibold underline">
      Aboneliği görüntüle
    </Link>
  ) : null;
  if (access.state === "expired") {
    return (
      <Alert tone="error" title="Abonelik süreniz doldu: panel salt okunur" className="mb-6">
        Kayıtlarınızın hepsi duruyor; yeni kayıt ve değişiklik için aboneliğinizi yenileyin. {link}
      </Alert>
    );
  }
  if (access.state === "grace") {
    return (
      <Alert tone="warning" title="Abonelik ödemeniz gecikti" className="mb-6">
        Birkaç gün içinde ödeme yapılmazsa panel salt okunur olacak. {link}
      </Alert>
    );
  }
  if (access.state === "trial" && access.daysLeft !== null && access.daysLeft <= 7) {
    return (
      <Alert tone="info" title={`Ücretsiz deneme sürenizin bitmesine ${access.daysLeft} gün kaldı`} className="mb-6">
        Deneme bitince kayıtlarınız silinmez; abonelikle kaldığınız yerden devam edersiniz. {link}
      </Alert>
    );
  }
  return null;
}

/** Yatay oran çubuğu (0-1). */
export function RateBar({ value, tone = "brand", className }: { value: number; tone?: "brand" | "green" | "amber" | "rose"; className?: string }) {
  const colors = { brand: "bg-brand-500", green: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500" };
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cn("h-full rounded-full", colors[tone])} style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

export function rateTone(rate: number): "green" | "amber" | "rose" {
  return rate >= 0.7 ? "green" : rate >= 0.5 ? "amber" : "rose";
}

export function percent(rate: number): string {
  return `%${Math.round(rate * 100)}`;
}

/** Gün seçici: önceki / sonraki gün ve bugün bağlantıları. */
export function DateNav({ date, today, hrefFor }: { date: string; today: string; hrefFor: (date: string) => string }) {
  const label = formatDayLabel(date);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={hrefFor(addDaysToDateString(date, -1))} className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" aria-label="Önceki gün">
        <ChevronLeft className="size-4" aria-hidden />
      </Link>
      <span className="min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-800">
        {label.weekday} · {formatDate(zonedDateTime(date, 12 * 60))}
      </span>
      <Link href={hrefFor(addDaysToDateString(date, 1))} className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" aria-label="Sonraki gün">
        <ChevronRight className="size-4" aria-hidden />
      </Link>
      {date !== today ? (
        <Link href={hrefFor(today)} className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
          Bugün
        </Link>
      ) : null}
    </div>
  );
}

/** Sekmeler (?sekme=...) */
export function Tabs({ tabs, active }: { tabs: { key: string; label: ReactNode; href: string }[]; active: string }) {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Sekmeler">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold",
            tab.key === active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** Net gelişim grafiği: öğrencinin neti ve kurum ortalaması (SVG, JavaScript gerekmez). */
export function NetTrendChart({ points, maxNet }: { points: { name: string; net: number; average: number; date?: Date }[]; maxNet: number }) {
  if (points.length < 2) {
    return <p className="text-sm text-slate-500">Grafik için aynı türden en az iki deneme gerekir.</p>;
  }
  const width = 640;
  const height = 230;
  const pad = { left: 44, right: 24, top: 20, bottom: 52 };
  const anchor = (i: number) => (i === 0 ? "start" : i === points.length - 1 ? "end" : "middle");
  const top = Math.max(maxNet, ...points.map((p) => Math.max(p.net, p.average)), 1);
  const x = (i: number) => pad.left + (i * (width - pad.left - pad.right)) / (points.length - 1);
  const y = (v: number) => pad.top + (1 - Math.max(0, v) / top) * (height - pad.top - pad.bottom);
  const line = (key: "net" | "average") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(top * t));
  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Net gelişim grafiği">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#64748b">
              {t}
            </text>
          </g>
        ))}
        <path d={line("average")} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 4" />
        <path d={line("net")} fill="none" stroke="#d63f1c" strokeWidth="3" />
        {points.map((p, i) => (
          <g key={`${p.name}-${i}`}>
            <title>{`${p.name}: ${p.net.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} net (kurum ort. ${p.average.toLocaleString("tr-TR", { maximumFractionDigits: 2 })})`}</title>
            <circle cx={x(i)} cy={y(p.net)} r="4" fill="#d63f1c" />
            <text x={x(i)} y={y(p.net) - 9} textAnchor={anchor(i)} fontSize="11" fontWeight="600" fill="#1b1f3b">
              {p.net.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
            </text>
            <text x={x(i)} y={height - pad.bottom + 16} textAnchor={anchor(i)} fontSize="10" fill="#475569">
              {p.name.length > 16 ? `${p.name.slice(0, 15)}…` : p.name}
            </text>
            {p.date ? (
              <text x={x(i)} y={height - pad.bottom + 30} textAnchor={anchor(i)} fontSize="10" fill="#94a3b8">
                {shortDate(p.date)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-5 bg-brand-600" /> Öğrencinin neti
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-5 border-t-2 border-dashed border-slate-400" /> Kurum ortalaması
        </span>
      </figcaption>
    </figure>
  );
}

/** Aylık gelir-gider sütun grafiği. */
export function IncomeExpenseChart({ rows }: { rows: { month: string; income: number; expense: number }[] }) {
  const width = 720;
  const height = 220;
  const pad = { left: 8, right: 8, top: 12, bottom: 32 };
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
  const slot = (width - pad.left - pad.right) / rows.length;
  const barWidth = Math.min(18, slot / 3);
  const h = (v: number) => (v / max) * (height - pad.top - pad.bottom);
  const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Aylık gelir ve gider">
        <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="#cbd5e1" />
        {rows.map((r, i) => {
          const cx = pad.left + slot * i + slot / 2;
          const base = height - pad.bottom;
          return (
            <g key={r.month}>
              <rect x={cx - barWidth - 1} y={base - h(r.income)} width={barWidth} height={h(r.income)} rx="3" fill="#10b981">
                <title>{`Gelir ${(r.income / 100).toLocaleString("tr-TR")} TL`}</title>
              </rect>
              <rect x={cx + 1} y={base - h(r.expense)} width={barWidth} height={h(r.expense)} rx="3" fill="#f43f5e">
                <title>{`Gider ${(r.expense / 100).toLocaleString("tr-TR")} TL`}</title>
              </rect>
              <text x={cx} y={height - 12} textAnchor="middle" fontSize="11" fill="#475569">
                {MONTHS[Number(r.month.slice(5, 7)) - 1]}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-emerald-500" /> Tahsilat
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-rose-500" /> Gider
        </span>
      </figcaption>
    </figure>
  );
}

/** Kısa tarih: "12.10.2026" */
export function shortDate(value: string | Date): string {
  const s = typeof value === "string" ? value : value.toISOString().slice(0, 10);
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}
