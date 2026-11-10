import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock } from "lucide-react";
import Link from "next/link";
import { EXAM_PRESETS } from "@/lib/center/exams";
import { cn } from "@/lib/cn";
import { minutesToTime, WEEKDAY_SHORT } from "@/lib/dates";
import type { KocStudentCard } from "@/server/koc";
import { Sparkline } from "./charts";

// Öğrenci baş harfleri için sabit renkler (öğrenciye göre değişmez; anlam taşımaz)
const AVATAR = ["from-brand-500 to-brand-700", "from-ink-500 to-ink-700", "from-amber-500 to-amber-700", "from-teal-500 to-teal-700", "from-sky-500 to-sky-700", "from-rose-500 to-rose-700"];
const avatarFor = (id: string) => AVATAR[[...id].reduce((t, c) => t + c.charCodeAt(0), 0) % AVATAR.length];

export function StudentAvatar({ id, firstName, lastName, size = "md" }: { id: string; firstName: string; lastName: string; size?: "md" | "lg" }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-bold text-white", avatarFor(id), size === "lg" ? "size-16 text-xl" : "size-11 text-sm")}>
      {`${firstName.charAt(0)}${lastName.charAt(0)}`.toLocaleUpperCase("tr-TR")}
    </span>
  );
}

export function meetingLabel(meeting: { weekday: number; minute: number | null } | null) {
  if (!meeting) return null;
  return `${WEEKDAY_SHORT[meeting.weekday - 1]}${meeting.minute !== null ? ` ${minutesToTime(meeting.minute)}` : ""}`;
}

export function StudentCard({ s }: { s: KocStudentCard }) {
  const lastNet = s.nets.length ? s.nets[s.nets.length - 1] : null;
  const plan = s.planTotal ? Math.round((s.planDone / s.planTotal) * 100) : null;
  return (
    <Link href={`/koc/ogrenciler/${s.id}`} className="group flex flex-col rounded-3xl border border-ink-100 bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <StudentAvatar id={s.id} firstName={s.firstName} lastName={s.lastName} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink-900 group-hover:text-brand-700">{s.name}</p>
          <p className="truncate text-xs text-slate-500">{[s.gradeName, s.targetExam].filter(Boolean).join(" · ") || "Sınıf ve hedef girilmedi"}</p>
        </div>
        {s.meeting ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink-50 px-2 py-1 text-[11px] font-semibold text-ink-700">
            <CalendarClock className="size-3" aria-hidden /> {meetingLabel(s.meeting)}
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{s.netKind ? `${EXAM_PRESETS[s.netKind].label} neti` : "Deneme"}</p>
          <p className="flex items-center gap-1.5 font-display text-2xl font-extrabold text-ink-900">
            {lastNet !== null ? lastNet.toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : "—"}
            {s.netChange !== null && s.netChange !== 0 ? (
              <span className={cn("inline-flex items-center text-xs font-bold", s.netChange > 0 ? "text-emerald-600" : "text-rose-600")}>
                {s.netChange > 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
                {Math.abs(s.netChange).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
              </span>
            ) : null}
          </p>
        </div>
        <Sparkline values={s.nets} className="max-w-[120px]" />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 py-2">
          <dt className="text-[11px] text-slate-500">Bu hafta soru</dt>
          <dd className="font-bold tabular-nums text-ink-900">{s.solvedThisWeek.toLocaleString("tr-TR")}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 py-2">
          <dt className="text-[11px] text-slate-500">Program</dt>
          <dd className="font-bold tabular-nums text-ink-900">{plan !== null ? `%${plan}` : "—"}</dd>
        </div>
      </dl>
      {s.alerts.length ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden /> {s.alerts[0]}
          {s.alerts.length > 1 ? ` (+${s.alerts.length - 1})` : ""}
        </p>
      ) : null}
    </Link>
  );
}
