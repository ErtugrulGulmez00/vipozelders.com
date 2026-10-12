"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Monitor, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { addDaysToDateString } from "@/lib/dates";
import { durationLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { lessonPrice } from "@/server/pricing";

export type WidgetOffering = {
  id: string;
  serviceName: string;
  levelName: string;
  subjectName: string;
  hourlyPrice: number;
  durations: number[];
};

type SlotDay = { date: string; weekday: string; day: string; slots: { start: string; time: string; available: boolean }[] };

export function BookingWidget({
  teacherId,
  offerings,
  online,
  inPerson,
  today,
}: {
  teacherId: string;
  offerings: WidgetOffering[];
  online: boolean;
  inPerson: boolean;
  today: string;
}) {
  const router = useRouter();
  const [offeringId, setOfferingId] = useState(offerings[0]?.id ?? "");
  const offering = offerings.find((o) => o.id === offeringId) ?? offerings[0];
  const [duration, setDuration] = useState(offering?.durations.includes(60) ? 60 : (offering?.durations[0] ?? 60));
  const [mode, setMode] = useState(online ? "ONLINE" : "IN_PERSON");
  const [weekStart, setWeekStart] = useState(today);
  const [days, setDays] = useState<SlotDay[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  useEffect(() => {
    if (!offering) return;
    const controller = new AbortController();
    // Yükleniyor durumu ve seçimin sıfırlanması kullanıcı girdisine bağlı ağ isteğinin parçasıdır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setSelected(null);
    fetch(`/api/saatler?ogretmen=${teacherId}&sure=${duration}&baslangic=${weekStart}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Saatler yüklenemedi.");
        setDays(data.days);
        setError(null);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [teacherId, duration, weekStart, offering]);

  const price = offering ? lessonPrice(offering.hourlyPrice, duration) : 0;
  const hasAnySlot = useMemo(() => days?.some((d) => d.slots.some((s) => s.available)) ?? false, [days]);
  // Seçili gün bu haftada yoksa (hafta değişti) boş saati olan ilk gün açılır.
  const activeDay = days?.find((d) => d.date === activeDate) ?? days?.find((d) => d.slots.some((s) => s.available)) ?? null;
  const selectedSlot = selected ? days?.flatMap((d) => d.slots.map((s) => ({ ...s, day: d }))).find((s) => s.start === selected) : undefined;

  if (!offering) {
    return <p className="text-sm text-slate-500">Bu öğretmen henüz ders eklememiş.</p>;
  }

  const proceed = () => {
    if (!selected) return;
    const query = new URLSearchParams({ ders: offering.id, saat: selected, sure: String(duration), sekil: mode });
    router.push(`/rezervasyon?${query}`);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="w-offering">Ders</Label>
        <Select
          id="w-offering"
          value={offering.id}
          onChange={(e) => {
            const next = offerings.find((o) => o.id === e.target.value);
            setOfferingId(e.target.value);
            if (next && !next.durations.includes(duration)) setDuration(next.durations.includes(60) ? 60 : next.durations[0]);
          }}
        >
          {offerings.map((o) => (
            <option key={o.id} value={o.id}>
              {o.levelName} · {o.subjectName} · {o.serviceName}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Süre</span>
        <div className="flex flex-wrap gap-1.5">
          {offering.durations.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold ring-1", d === duration ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50")}
            >
              {durationLabel(d)}
            </button>
          ))}
        </div>
      </div>

      {online && inPerson ? (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Ders şekli</span>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { value: "ONLINE", label: "Online", Icon: Monitor },
              { value: "IN_PERSON", label: "Yüz yüze", Icon: MapPin },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn("inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold ring-1", mode === value ? "bg-brand-50 text-brand-700 ring-brand-400" : "bg-white text-slate-700 ring-slate-300")}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <CalendarDays className="size-4" aria-hidden /> Saat seçin
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="Önceki hafta"
              disabled={weekStart <= today}
              onClick={() => setWeekStart(addDaysToDateString(weekStart, -7) < today ? today : addDaysToDateString(weekStart, -7))}
              className="inline-flex size-8 items-center justify-center rounded-lg ring-1 ring-slate-300 disabled:opacity-40"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button type="button" aria-label="Sonraki hafta" onClick={() => setWeekStart(addDaysToDateString(weekStart, 7))} className="inline-flex size-8 items-center justify-center rounded-lg ring-1 ring-slate-300">
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="relative min-h-40">
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
              <Loader2 className="size-5 animate-spin text-brand-600" aria-label="Yükleniyor" />
            </div>
          ) : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {days ? (
            <>
              {/* Önce gün, sonra o günün saatleri: dar kutuda da hiçbir sütun kesilmez. */}
              <div className="grid grid-cols-7 gap-1" aria-label="Gün seçin">
                {days.map((day) => {
                  const free = day.slots.filter((s) => s.available).length;
                  const active = day.date === activeDay?.date;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      disabled={free === 0}
                      aria-pressed={active}
                      aria-label={`${day.day} ${day.weekday}${free ? `, ${free} boş saat` : ", boş saat yok"}`}
                      onClick={() => setActiveDate(day.date)}
                      className={cn(
                        "flex flex-col items-center rounded-lg py-1.5 ring-1 transition",
                        active ? "bg-brand-600 text-white ring-brand-600" : free ? "bg-white text-slate-800 ring-slate-200 hover:ring-brand-300" : "cursor-not-allowed bg-slate-50 text-slate-400 ring-slate-100",
                      )}
                    >
                      <span className="text-[11px] font-medium">{day.weekday}</span>
                      <span className="text-base font-bold leading-tight">{Number(day.date.slice(8))}</span>
                      <span className={cn("mt-0.5 size-1.5 rounded-full", free ? (active ? "bg-white" : "bg-emerald-500") : "bg-transparent")} aria-hidden />
                    </button>
                  );
                })}
              </div>
              {activeDay ? (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium text-slate-500">
                    {activeDay.day}, {activeDay.weekday} · {activeDay.slots.filter((s) => s.available).length} boş saat
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {activeDay.slots.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setSelected(slot.start)}
                        title={slot.available ? undefined : "Dolu"}
                        className={cn(
                          "rounded-md py-1.5 text-xs font-semibold",
                          !slot.available && "cursor-not-allowed bg-slate-100 text-slate-400 line-through",
                          slot.available && selected !== slot.start && "bg-white text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50",
                          selected === slot.start && "bg-brand-600 text-white",
                        )}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {days && !hasAnySlot && !loading ? <p className="mt-2 text-xs text-slate-500">Bu hafta boş saat yok; sonraki haftalara bakın.</p> : null}
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-slate-600">{durationLabel(duration)} ders ücreti</span>
          <span className="text-xl font-bold text-slate-900">{formatMoney(price)}</span>
        </div>
        {selectedSlot ? (
          <p className="mt-1 text-sm font-semibold text-brand-700">
            {selectedSlot.day.day}, {selectedSlot.day.weekday} · {selectedSlot.time}
          </p>
        ) : null}
        <p className="mt-0.5 text-xs text-slate-500">KDV dahil · Öğretmen onaylamazsa tamamı iade edilir.</p>
      </div>
      <Button size="lg" className="w-full" disabled={!selected} onClick={proceed}>
        {selected ? "Devam et" : "Önce bir saat seçin"}
      </Button>
    </div>
  );
}
