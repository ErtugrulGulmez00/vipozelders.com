import { CalendarClock, CheckCircle2, Flame, Target, Timer, Video } from "lucide-react";
import Link from "next/link";
import { Tabs } from "@/components/center/center-ui";
import { CoachingView } from "@/components/center/coaching-view";
import { PlanItemControls } from "@/components/center/study-forms";
import { StudyView } from "@/components/center/study-view";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { EXAM_PRESETS, formatNet } from "@/lib/center/exams";
import { cn } from "@/lib/cn";
import { addDaysToDateString, dateStringToDbDate, dbDateToString, formatDate, minutesToTime, toLocalDateString, WEEKDAY_NAMES } from "@/lib/dates";
import { db } from "@/server/db";
import { questionStats, studentExams, studentGoals } from "@/server/koc";
import { meetingLive } from "@/server/koc-meeting";
import { GoalCard } from "./goal-card";
import { MeetingJoinButton } from "./meeting-join-button";
import { BarChart, HBarList, LineChart } from "./charts";
import { DeleteExamButton, DeleteLogButton, ExamForm, QuestionLogForm } from "./koc-forms";
import { DeleteStudyButton, StudyEntryForm, StudyTimer } from "./koc-tools";
import { formatMinutes, studyStats } from "@/server/koc-extra";

const dmy = (d: string) => d.split("-").reverse().join(".");
const SUBJECTS = ["Matematik", "Geometri", "Türkçe", "Paragraf", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "Edebiyat", "Fen Bilimleri", "İnkılap Tarihi", "Din Kültürü", "İngilizce"];

type Student = { id: string; centerId: string; firstName: string; lastName: string; gradeName: string | null; targetExam: string | null; coachWeekday: number | null; coachMinute: number | null; center: { name: string } };

/**
 * Pi Koç öğrencisinin (ya da velisinin) portal ekranı. Öğrenci kendi hesabıyla bugünkü görevlerini işaretler ve
 * çözdüğü soruyu girer; veli aynı bilgileri görür, soru girmez.
 */
export async function KocStudentPortal({ student, base, tab: requested, isStudent, week }: { student: Student; base: string; tab: string; isStudent: boolean; week?: string }) {
  const today = toLocalDateString(new Date());
  const tabs = [
    { key: "bugun", label: "Bugün", href: base },
    { key: "program", label: "Haftalık program", href: `${base}?sekme=program` },
    { key: "sorular", label: "Soru takibi", href: `${base}?sekme=sorular` },
    { key: "calisma", label: "Çalışma", href: `${base}?sekme=calisma` },
    { key: "denemeler", label: "Denemeler", href: `${base}?sekme=denemeler` },
    { key: "notlar", label: "Koç notları", href: `${base}?sekme=notlar` },
  ];
  const tab = tabs.some((t) => t.key === requested) ? requested : "bugun";
  const [stats, todayItems, streakDays, study] = await Promise.all([
    questionStats(student.centerId, today, student.id),
    db.centerStudyPlanItem.findMany({ where: { studentId: student.id, date: dateStringToDbDate(today) }, include: { resource: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    db.centerQuestionLog.findMany({ where: { studentId: student.id, date: { gte: dateStringToDbDate(addDaysToDateString(today, -60)) } }, select: { date: true }, distinct: ["date"] }),
    studyStats(student.id, today),
  ]);
  // Seri: bugünden (bugün girilmediyse dünden) geriye kesintisiz soru girilen gün sayısı
  const logged = new Set(streakDays.map((d) => dbDateToString(d.date)));
  let streak = 0;
  for (let d = logged.has(today) ? today : addDaysToDateString(today, -1); logged.has(d); d = addDaysToDateString(d, -1)) streak++;
  const doneToday = todayItems.filter((i) => i.doneAt).length;
  const meeting = student.coachWeekday ? `${WEEKDAY_NAMES[student.coachWeekday - 1]}${student.coachMinute !== null ? ` ${minutesToTime(student.coachMinute)}` : ""}` : null;

  return (
    <>
      <section className="relative mb-6 overflow-hidden rounded-[2rem] bg-ink-900 px-6 py-6 text-white sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-brand-600/40 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-200">
            {student.center.name} · {formatDate(new Date())}
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
            {isStudent ? `Merhaba ${student.firstName}` : `${student.firstName} ${student.lastName}`}
          </h1>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-200">
            {[student.gradeName, student.targetExam].filter(Boolean).length ? <span>{[student.gradeName, student.targetExam].filter(Boolean).join(" · ")}</span> : null}
            {meeting ? (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-4" aria-hidden /> Koç görüşmesi: her {meeting}
              </span>
            ) : null}
          </p>
        </div>
        {/* Koç görüşmeyi başlatınca açılır */}
        <MeetingJoinButton studentId={student.id} initialLive={await meetingLive(student.id)} />
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini icon={<CheckCircle2 className="size-4" />} label="Bugünkü görev" value={todayItems.length ? `${doneToday}/${todayItems.length}` : "—"} />
        <Mini icon={<Target className="size-4" />} label="Bu hafta soru" value={stats.thisWeek.toLocaleString("tr-TR")} />
        <Mini icon={<Timer className="size-4" />} label="Bu hafta çalışma" value={study.thisWeek ? formatMinutes(study.thisWeek) : "—"} />
        <Mini icon={<Flame className="size-4" />} label="Seri" value={streak ? `${streak} gün` : "—"} hint={streak ? "Soru girdiğin ardışık gün" : undefined} />
      </div>

      <Tabs tabs={tabs} active={tab} />

      {tab === "program" ? (
        <StudyView centerId={student.centerId} studentId={student.id} week={week} baseHref={`${base}?sekme=program`} mode="portal" canEdit={false} />
      ) : tab === "sorular" ? (
        <QuestionsTab student={student} today={today} isStudent={isStudent} stats={stats} />
      ) : tab === "calisma" ? (
        <StudyTab student={student} today={today} isStudent={isStudent} stats={study} />
      ) : tab === "denemeler" ? (
        <ExamsTab student={student} isStudent={isStudent} />
      ) : tab === "notlar" ? (
        <CoachingView centerId={student.centerId} studentId={student.id} mode="portal" canWrite={false} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <Card>
            <CardHeader title="Bugünkü görevlerin" description={todayItems.length ? `${doneToday}/${todayItems.length} tamamlandı` : undefined} action={<Link href={`${base}?sekme=program`} className="text-sm font-semibold text-brand-700 hover:underline">Haftanın tamamı</Link>} />
            {todayItems.length ? (
              <ul className="divide-y divide-slate-100">
                {todayItems.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className={cn("min-w-0", i.doneAt && "text-slate-400 line-through")}>
                      <p className="text-sm font-semibold text-ink-900">
                        {i.subject}
                        {i.topic ? <span className="font-normal text-slate-600"> · {i.topic}</span> : null}
                      </p>
                      <p className="text-xs text-slate-500">{[i.resource?.name, i.targetQuestions ? `Hedef ${i.targetQuestions} soru` : null, i.note].filter(Boolean).join(" · ")}</p>
                    </div>
                    <PlanItemControls itemId={i.id} done={Boolean(i.doneAt)} portal />
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="text-sm text-slate-500">Bugün için görev yok. Koçun programı yazınca burada görünür.</p>
              </CardBody>
            )}
          </Card>
          {isStudent ? (
            <div className="space-y-6">
              <Card>
                <CardHeader title="Çalışma sayacı" description="Çalışmaya başlarken başlat; bitince kaydet, koçun görür." />
                <CardBody>
                  <StudyTimer studentId={student.id} today={today} subjects={SUBJECTS} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Çözdüğün soruyu gir" description="Her ders için ayrı gir; koçun haftalık grafiğinde görür." />
                <CardBody>
                  <QuestionLogForm studentId={student.id} today={today} subjects={SUBJECTS} portal />
                </CardBody>
              </Card>
            </div>
          ) : (
            <Card>
              <CardHeader title="Son 14 gün çözülen soru" />
              <CardBody>
                <BarChart label="Son 14 gün çözülen soru" height={170} bars={stats.days.map((d) => ({ label: d.date.slice(8), value: d.solved, hint: dmy(d.date) }))} />
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function Mini({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-ink-100 bg-white p-3 shadow-xs sm:p-4" title={hint}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <span className="text-brand-600">{icon}</span> {label}
      </p>
      <p className="mt-1.5 font-display text-xl font-extrabold text-ink-900 sm:text-2xl">{value}</p>
    </div>
  );
}

async function QuestionsTab({ student, today, isStudent, stats }: { student: Student; today: string; isStudent: boolean; stats: Awaited<ReturnType<typeof questionStats>> }) {
  const logs = await db.centerQuestionLog.findMany({ where: { studentId: student.id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 30 });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
      <div className="space-y-6">
        {isStudent ? (
          <Card>
            <CardHeader title="Soru gir" />
            <CardBody>
              <QuestionLogForm studentId={student.id} today={today} subjects={SUBJECTS} portal />
            </CardBody>
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Haftalık çözülen soru" description="Son 8 hafta" />
          <CardBody>
            <BarChart label="Haftalık çözülen soru" height={180} bars={stats.weeks.map((w) => ({ label: `${w.start.slice(8)}.${w.start.slice(5, 7)}`, value: w.solved, hint: `${dmy(w.start)} haftası` }))} />
          </CardBody>
        </Card>
        {stats.subjects.length ? (
          <Card>
            <CardHeader title="Derslere göre (30 gün)" />
            <CardBody>
              <HBarList rows={stats.subjects.slice(0, 6).map((s) => ({ label: s.subject, value: s.solved, max: stats.subjects[0].solved, display: `${s.solved.toLocaleString("tr-TR")}${s.accuracy !== null ? ` · %${Math.round(s.accuracy * 100)}` : ""}` }))} />
            </CardBody>
          </Card>
        ) : null}
      </div>
      <Card>
        <CardHeader title="Son kayıtlar" />
        {logs.length ? (
          <ul className="divide-y divide-slate-100">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="w-12 shrink-0 text-xs font-semibold text-slate-500">{dmy(dbDateToString(l.date)).slice(0, 5)}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink-900">{l.subject}</span>
                <span className="tabular-nums text-slate-700">{l.solved} soru</span>
                <span className="hidden w-20 text-right text-xs tabular-nums text-slate-500 sm:inline">{l.correct || l.wrong ? `${l.correct} D · ${l.wrong} Y` : ""}</span>
                {isStudent && l.byStudent && dbDateToString(l.date) >= addDaysToDateString(today, -7) ? <DeleteLogButton logId={l.id} portal /> : <span className="w-7" />}
              </li>
            ))}
          </ul>
        ) : (
          <CardBody>
            <p className="text-sm text-slate-500">Henüz soru kaydı yok.</p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}

async function ExamsTab({ student, isStudent }: { student: Student; isStudent: boolean }) {
  const [exams, goals] = await Promise.all([studentExams(student.centerId, student.id), studentGoals(student.centerId, student.id)]);
  const goalCard = <GoalCard studentId={student.id} goals={goals} editable={isStudent} portal />;
  const entry = isStudent ? (
    <Card>
      <CardHeader title="Deneme sonucumu gir" description="Sonuç kâğıdındaki doğru ve yanlışları yaz; net kendiliğinden hesaplanır, koçun görür." />
      <CardBody>
        <ExamForm studentId={student.id} today={toLocalDateString(new Date())} defaultKind={exams[0]?.kind ?? (student.targetExam?.startsWith("LGS") ? "LGS" : "TYT")} portal />
      </CardBody>
    </Card>
  ) : null;
  if (!exams.length) {
    return (
      <div className="space-y-6">
        {goalCard}
        {entry}
        <EmptyState title="Henüz deneme yok" description="Koçun deneme sonuçlarını girince net gelişimin burada görünür." />
      </div>
    );
  }
  const kind = exams[0].kind;
  const series = exams.filter((e) => e.kind === kind).slice(0, 10).reverse();
  return (
    <div className="space-y-6">
      {goalCard}
      {entry}
      <Card>
        <CardHeader title="Net gelişimi" description={`${EXAM_PRESETS[kind].label} denemeleri`} />
        <CardBody>
          <LineChart label="Net gelişimi" target={goals.find((g) => g.kind === kind)?.targetNet ?? null} points={series.map((e) => ({ label: e.name, sub: dmy(e.date).slice(0, 5), value: e.net }))} />
        </CardBody>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {exams.map((e) => (
          <Card key={e.examId}>
            <div className="flex items-start justify-between gap-3 px-5 pt-4">
              <div>
                <p className="font-semibold text-ink-900">{e.name}</p>
                <p className="text-xs text-slate-500">
                  {EXAM_PRESETS[e.kind].label} · {dmy(e.date)}
                </p>
              </div>
              <span className="flex items-center gap-1">
                {e.byStudent ? <Badge tone="sky">Sen girdin</Badge> : null}
                <Badge tone="brand">{formatNet(e.net)} net</Badge>
                {isStudent && e.byStudent ? <DeleteExamButton examId={e.examId} portal /> : null}
              </span>
            </div>
            <CardBody className="flex flex-wrap gap-1.5 pt-3">
              {e.sections.map((s) => (
                <span key={s.name} className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">
                  {s.name} <b className="text-ink-900">{formatNet(s.net)}</b>
                </span>
              ))}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

async function StudyTab({ student, today, isStudent, stats }: { student: Student; today: string; isStudent: boolean; stats: Awaited<ReturnType<typeof studyStats>> }) {
  const sessions = await db.centerStudySession.findMany({ where: { studentId: student.id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 30 });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
      <div className="space-y-6">
        {isStudent ? (
          <Card>
            <CardHeader title="Çalışma sayacı" />
            <CardBody className="space-y-5">
              <StudyTimer studentId={student.id} today={today} subjects={SUBJECTS} />
              <details className="rounded-2xl bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-brand-700">Süreyi elle gir</summary>
                <div className="mt-3">
                  <StudyEntryForm studentId={student.id} today={today} subjects={SUBJECTS} portal />
                </div>
              </details>
            </CardBody>
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Son 14 gün" description={`Bu hafta ${formatMinutes(stats.thisWeek)} · geçen hafta ${formatMinutes(stats.lastWeek)}`} />
          <CardBody>
            <BarChart label="Günlük çalışma (dakika)" unit="dk" height={180} bars={stats.days.map((d) => ({ label: d.date.slice(8), value: d.minutes, hint: dmy(d.date) }))} />
          </CardBody>
        </Card>
        {stats.subjects.length ? (
          <Card>
            <CardHeader title="Derslere göre (30 gün)" />
            <CardBody>
              <HBarList rows={stats.subjects.slice(0, 6).map((s) => ({ label: s.subject, value: s.minutes, max: stats.subjects[0].minutes, display: formatMinutes(s.minutes) }))} />
            </CardBody>
          </Card>
        ) : null}
      </div>
      <Card>
        <CardHeader title="Son çalışmalar" />
        {sessions.length ? (
          <ul className="divide-y divide-slate-100">
            {sessions.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="w-12 shrink-0 text-xs font-semibold text-slate-500">{dmy(dbDateToString(x.date)).slice(0, 5)}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink-900">{x.subject ?? "Genel"}</span>
                <span className="tabular-nums text-slate-700">{formatMinutes(x.minutes)}</span>
                {isStudent && x.byStudent && dbDateToString(x.date) >= addDaysToDateString(today, -7) ? <DeleteStudyButton sessionId={x.id} portal /> : <span className="w-7" />}
              </li>
            ))}
          </ul>
        ) : (
          <CardBody>
            <p className="text-sm text-slate-500">Henüz çalışma kaydı yok.</p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
