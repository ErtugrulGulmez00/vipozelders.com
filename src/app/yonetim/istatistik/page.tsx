import { BarChart3, CalendarCheck, Eye, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Card, CardBody, CardHeader, PageHeader, StatCard } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { addDaysToDateString, toLocalDateString, zonedDateTime } from "@/lib/dates";
import { db } from "@/server/db";
import { statsSummary } from "@/server/stats";

export const metadata: Metadata = { title: "İstatistik" };

const RANGES = [7, 30, 90] as const;
const DEVICE: Record<string, string> = { mobile: "Telefon", tablet: "Tablet", desktop: "Bilgisayar" };

export default async function StatsPage({ searchParams }: PageProps<"/yonetim/istatistik">) {
  const { gun } = await searchParams;
  const days = RANGES.find((r) => String(r) === gun) ?? 30;
  // Sayfa her istekte güncel hesaplanır (bugünün tarihi).
  await connection();
  const now = new Date();
  const since = zonedDateTime(addDaysToDateString(toLocalDateString(now), -(days - 1)), 0);
  const [stats, signups, bookings, intros, threads] = await Promise.all([
    statsSummary(days, now),
    db.user.count({ where: { role: "STUDENT", createdAt: { gte: since } } }),
    db.booking.count({ where: { createdAt: { gte: since }, isTest: false, isIntro: false, paidAt: { not: null } } }),
    db.booking.count({ where: { createdAt: { gte: since }, isIntro: true } }),
    db.messageThread.count({ where: { createdAt: { gte: since } } }),
  ]);
  const max = Math.max(1, ...stats.series.map((d) => d.views));
  const deviceTotal = stats.devices.reduce((t, d) => t + d.views, 0) || 1;

  return (
    <>
      <PageHeader
        title="İstatistik"
        description="Vitrin sayfalarının ziyaretleri. Çerez kullanılmaz, kişisel veri saklanmaz: ziyaretçiler her gün değişen anonim bir özetle sayılır (aynı kişi farklı günlerde ayrı sayılır)."
        actions={
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <Link key={r} href={`/yonetim/istatistik?gun=${r}`} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold ring-1", r === days ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300")}>
                {r} gün
              </Link>
            ))}
          </div>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Sayfa görüntüleme" value={stats.totalViews.toLocaleString("tr-TR")} icon={<Eye className="size-5" />} />
        <StatCard label="Günlük tekil ziyaretçi (toplam)" value={stats.totalVisitors.toLocaleString("tr-TR")} icon={<Users className="size-5" />} />
        <StatCard label="Yeni veli/öğrenci üyeliği" value={signups} icon={<UserPlus className="size-5" />} />
        <StatCard label="Ödenmiş randevu" value={bookings} hint={`${intros} tanışma talebi`} icon={<CalendarCheck className="size-5" />} />
        <StatCard label="Yeni mesajlaşma" value={threads} icon={<BarChart3 className="size-5" />} />
      </div>

      <Card className="mb-6">
        <CardHeader title="Günlük ziyaret" description="Çubuk: sayfa görüntüleme · sayı: tekil ziyaretçi" />
        <CardBody>
          <div className="flex h-48 items-end gap-0.5" role="img" aria-label="Günlük sayfa görüntüleme grafiği">
            {stats.series.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.day}: ${d.views} görüntüleme, ${d.visitors} ziyaretçi`}>
                <div className="w-full rounded-t bg-brand-500 group-hover:bg-brand-700" style={{ height: `${(d.views / max) * 100}%`, minHeight: d.views ? 2 : 0 }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
            <span>{stats.series[0]?.day}</span>
            <span>{stats.series.at(-1)?.day}</span>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="En çok görüntülenen sayfalar" />
          <CardBody>
            {stats.pages.length ? (
              <ul className="space-y-1.5 text-sm">
                {stats.pages.map((p) => (
                  <li key={p.path} className="flex justify-between gap-3">
                    <span className="truncate font-mono text-xs text-slate-700">{p.path}</span>
                    <span className="shrink-0 font-semibold">{p.views}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Henüz veri yok.</p>
            )}
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Nereden geldiler" />
            <CardBody>
              {stats.referrers.length ? (
                <ul className="space-y-1.5 text-sm">
                  {stats.referrers.map((r) => (
                    <li key={r.host} className="flex justify-between gap-3">
                      <span className="truncate">{r.host}</span>
                      <span className="font-semibold">{r.views}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Dış siteden gelen ziyaret yok (doğrudan giriş ya da uygulama içi).</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Cihaz" />
            <CardBody>
              <ul className="space-y-1.5 text-sm">
                {stats.devices.map((d) => (
                  <li key={d.device} className="flex justify-between gap-3">
                    <span>{DEVICE[d.device] ?? d.device}</span>
                    <span className="font-semibold">%{Math.round((d.views / deviceTotal) * 100)}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
