import { CalendarClock, ChevronLeft, FileText, Phone, School, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CenterFlash, Tabs } from "@/components/center/center-ui";
import { CoachingView } from "@/components/center/coaching-view";
import { StudyView } from "@/components/center/study-view";
import { BarChart, HBarList, LineChart, Ring } from "@/components/koc/charts";
import { ApplyTemplateForm, ArchiveStudentButton, AssignBookForm, DeleteTemplateButton, SaveTemplateForm, DeleteExamButton, DeleteLogButton, ExamForm, KocStudentForm, QuestionLogForm } from "@/components/koc/koc-forms";
import { meetingLabel, StudentAvatar } from "@/components/koc/student-card";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { EXAM_PRESETS, formatNet, type ExamKindName } from "@/lib/center/exams";
import { cn } from "@/lib/cn";
import { addDaysToDateString, dateStringToDbDate, dbDateToString, formatCompact, isDateString, minutesToTime, toLocalDateString } from "@/lib/dates";
import { StudentAccountCard } from "@/app/kurum/ogrenciler/[id]/student-forms";
import { requireCenter } from "@/server/center/context";
import { resourceSummary, weekStartOf } from "@/server/center/resources";
import { db } from "@/server/db";
import { questionStats, studentExams, studentGoals } from "@/server/koc";
import { GoalCard } from "@/components/koc/goal-card";
import { DeleteStudyButton, StudyEntryForm } from "@/components/koc/koc-tools";
import { formatMinutes, studyStats } from "@/server/koc-extra";
import { TopicMapCard } from "@/components/koc/topic-map";
import { LockedFeature } from "@/components/koc/locked-feature";
import { coachFeatureOpen } from "@/lib/pi-koc";
import { planTemplates, resourceForecast } from "@/server/koc-plan";

export const metadata: Metadata = { title: "Öğrenci" };

const dmy = (d: string) => d.split("-").reverse().join(".");
const SUBJECTS = ["Matematik", "Geometri", "Türkçe", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "Edebiyat", "Fen Bilimleri", "İnkılap Tarihi", "Din Kültürü", "İngilizce", "Paragraf", "Problemler"];

export default async function KocStudentPage({ params, searchParams }: PageProps<"/koc/ogrenciler/[id]">) {
  await connection();
  const ctx = await requireCenter();
  const { id } = await params;
  const sp = await searchParams;
  const centerId = ctx.center.id;
  const student = await db.centerStudent.findFirst({
    where: { id, centerId },
    include: { guardians: { orderBy: { isPrimary: "desc" }, include: { user: { select: { username: true, email: true, lastLoginAt: true } } } } },
  });
  if (!student) notFound();
  const tab = typeof sp.sekme === "string" ? sp.sekme : "genel";
  const today = toLocalDateString(new Date());
  const base = `/koc/ogrenciler/${id}`;
  const tabs = [
    { key: "genel", label: "Genel bakış", href: base },
    { key: "program", label: "Program ve kaynaklar", href: `${base}?sekme=program` },
    { key: "gorusmeler", label: "Görüşmeler", href: `${base}?sekme=gorusmeler` },
    { key: "sorular", label: "Soru ve çalışma", href: `${base}?sekme=sorular` },
    { key: "denemeler", label: "Denemeler", href: `${base}?sekme=denemeler` },
    { key: "bilgiler", label: "Bilgiler", href: `${base}?sekme=bilgiler` },
  ];
  const name = `${student.firstName} ${student.lastName}`;
  const meeting = student.coachWeekday ? { weekday: student.coachWeekday, minute: student.coachMinute } : null;
  // Veliler ve öğrencinin kendi giriş hesabı aynı tabloda tutulur
  const parents = student.guardians.filter((g) => !g.isStudentAccount);
  const account = student.guardians.find((g) => g.isStudentAccount);
  const guardian = parents[0];

  return (
    <>
      <Link href="/koc/ogrenciler" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink-900">
        <ChevronLeft className="size-4" aria-hidden /> Öğrencilerim
      </Link>
      <section className="mb-6 flex flex-wrap items-center gap-4 rounded-[2rem] border border-ink-100 bg-white p-5 shadow-xs sm:p-6">
        <StudentAvatar id={student.id} firstName={student.firstName} lastName={student.lastName} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            {name} {student.status !== "ACTIVE" ? <Badge tone="slate">Arşivde</Badge> : null}
          </h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            {[student.gradeName, student.targetExam].filter(Boolean).length ? <span>{[student.gradeName, student.targetExam].filter(Boolean).join(" · ")}</span> : null}
            {student.schoolName ? (
              <span className="inline-flex items-center gap-1">
                <School className="size-3.5" aria-hidden /> {student.schoolName}
              </span>
            ) : null}
            {meeting ? (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" aria-hidden /> Görüşme: {meetingLabel(meeting)}
              </span>
            ) : null}
            {guardian?.phone ? (
              <a href={`tel:${guardian.phone}`} className="inline-flex items-center gap-1 hover:text-brand-700">
                <Phone className="size-3.5" aria-hidden /> {guardian.fullName}
              </a>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/gorusme/${student.id}`} size="sm" variant="outline">
            <Video className="size-4" aria-hidden /> Online görüşme
          </LinkButton>
          <LinkButton href={`/koc/ogrenciler/${student.id}/rapor`} size="sm">
            <FileText className="size-4" aria-hidden /> Haftalık rapor
          </LinkButton>
        </div>
      </section>
      <CenterFlash code={sp.durum} />
      <Tabs tabs={tabs} active={tab} />
      {tab === "program" ? (
        <ProgramTab centerId={centerId} studentId={id} week={typeof sp.hafta === "string" ? sp.hafta : undefined} topicLocked={!coachFeatureOpen(ctx.coach, "topicAnalysis")} />
      ) : tab === "gorusmeler" ? (
        <CoachingView centerId={centerId} studentId={id} mode="staff" canWrite={ctx.access.writable} memberId={ctx.member.id} isManager />
      ) : tab === "sorular" ? (
        <QuestionsTab centerId={centerId} studentId={id} today={today} />
      ) : tab === "denemeler" ? (
        <ExamsTab centerId={centerId} studentId={id} today={today} />
      ) : tab === "bilgiler" ? (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <Card>
            <CardHeader title="Öğrenci bilgileri" />
            <CardBody>
              <KocStudentForm
                values={{
                  id: student.id,
                  firstName: student.firstName,
                  lastName: student.lastName,
                  gradeName: student.gradeName,
                  targetExam: student.targetExam,
                  schoolName: student.schoolName,
                  phone: student.phone,
                  notes: student.notes,
                  coachWeekday: student.coachWeekday,
                  coachTime: student.coachMinute !== null ? minutesToTime(student.coachMinute) : "",
                  monthlyFee: student.monthlyFee ? String(student.monthlyFee / 100) : "",
                }}
              />
            </CardBody>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Öğrenci girişi" description="Öğrenci kendi hesabıyla görevlerini işaretler, çözdüğü soruyu girer." />
              <CardBody>
                <StudentAccountCard
                  studentId={student.id}
                  defaultEmail={student.email}
                  gateLabel="Pi Koç girişi"
                  intro="Hesap açınca öğrenci “Pi Koç girişi”nden (pikampus.com/koc-giris) girer: bugünkü görevlerini işaretler, çözdüğü soruyu ders ders girer, haftalık programını, deneme netlerini ve sizin paylaştığınız görüşme notlarını görür. Giriş bilgileri bu e-postaya da gider."
                  account={account?.user ? { username: account.user.username, email: account.user.email, lastLoginAt: account.user.lastLoginAt ? formatCompact(account.user.lastLoginAt) : null } : account?.email ? { pendingEmail: account.email } : null}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Veli" />
              <CardBody>
                {parents.length ? (
                  <ul className="space-y-2 text-sm">
                    {parents.map((g) => (
                      <li key={g.id}>
                        <p className="font-semibold text-ink-900">{g.fullName}</p>
                        <p className="text-slate-500">{[g.phone, g.email].filter(Boolean).join(" · ") || "İletişim bilgisi yok"}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Veli bilgisi girilmedi.</p>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={student.status === "ACTIVE" ? "Arşive al" : "Arşivde"} description="Arşivdeki öğrenci öğrenci sınırına sayılmaz; kayıtları silinmez." />
              <CardBody>
                <ArchiveStudentButton studentId={student.id} active={student.status === "ACTIVE"} />
              </CardBody>
            </Card>
          </div>
        </div>
      ) : (
        <OverviewTab centerId={centerId} studentId={id} today={today} kindParam={typeof sp.tur === "string" ? sp.tur : undefined} base={base} />
      )}
    </>
  );
}

async function OverviewTab({ centerId, studentId, today, kindParam, base }: { centerId: string; studentId: string; today: string; kindParam?: string; base: string }) {
  const weekStart = weekStartOf(today);
  const [exams, stats, plan, resources, lastSession, goals, study] = await Promise.all([
    studentExams(centerId, studentId),
    questionStats(centerId, today, studentId),
    db.centerStudyPlanItem.findMany({ where: { centerId, studentId, date: { gte: dateStringToDbDate(weekStart), lt: dateStringToDbDate(addDaysToDateString(weekStart, 7)) } }, select: { doneAt: true } }),
    db.centerStudentResource.findMany({ where: { studentId }, include: { resource: true, progress: true }, orderBy: { assignedAt: "asc" } }),
    db.centerCoachingSession.findFirst({ where: { centerId, studentId, held: true }, orderBy: { date: "desc" } }),
    studentGoals(centerId, studentId),
    studyStats(studentId, today),
  ]);
  const kinds = [...new Set(exams.map((e) => e.kind))];
  const kind: ExamKindName | null = (kinds.find((k) => k === kindParam) as ExamKindName | undefined) ?? exams[0]?.kind ?? null;
  const series = exams.filter((e) => e.kind === kind).slice(0, 10).reverse();
  const latest = series[series.length - 1];
  const prev = series[series.length - 2];
  const planDone = plan.filter((p) => p.doneAt).length;
  const solvedTotal30 = stats.subjects.reduce((t, s) => t + s.solved, 0);
  const correct30 = stats.subjects.reduce((t, s) => t + s.correct, 0);
  const wrong30 = stats.subjects.reduce((t, s) => t + s.wrong, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile label={kind ? `Son ${EXAM_PRESETS[kind].label} neti` : "Son deneme"} value={latest ? formatNet(latest.net) : "—"} hint={latest && prev ? `${latest.net - prev.net >= 0 ? "+" : ""}${formatNet(latest.net - prev.net)} önceki denemeye göre` : latest ? dmy(latest.date) : "Deneme girilmedi"} up={latest && prev ? latest.net >= prev.net : undefined} />
        <Tile label="Bu hafta çözülen soru" value={stats.thisWeek.toLocaleString("tr-TR")} hint={`Geçen hafta ${stats.lastWeek.toLocaleString("tr-TR")}`} up={stats.thisWeek || stats.lastWeek ? stats.thisWeek >= stats.lastWeek : undefined} />
        <Tile label="Doğruluk (30 gün)" value={correct30 + wrong30 ? `%${Math.round((correct30 / (correct30 + wrong30)) * 100)}` : "—"} hint={`${solvedTotal30.toLocaleString("tr-TR")} soru`} />
        <Tile label="Son görüşme" value={lastSession ? dmy(dbDateToString(lastSession.date)).slice(0, 5) : "—"} hint={lastSession?.nextGoal ? `Hedef: ${lastSession.nextGoal}` : lastSession ? "Hedef yazılmadı" : "Görüşme kaydı yok"} />
      </div>

      <GoalCard studentId={studentId} goals={goals} editable />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Net gelişimi"
            description={kind ? `${EXAM_PRESETS[kind].label} denemeleri` : "Deneme sonuçları girildikçe oluşur"}
            action={
              kinds.length > 1 ? (
                <div className="flex flex-wrap gap-1">
                  {kinds.map((k) => (
                    <Link key={k} href={`${base}?tur=${k}`} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", k === kind ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                      {EXAM_PRESETS[k].label}
                    </Link>
                  ))}
                </div>
              ) : undefined
            }
          />
          <CardBody>
            {series.length ? (
              <LineChart label="Net gelişimi" target={goals.find((g) => g.kind === kind)?.targetNet ?? null} points={series.map((e) => ({ label: e.name, sub: dmy(e.date).slice(0, 5), value: e.net }))} />
            ) : (
              <EmptyLine text="Denemeler sekmesinden sonuç girin; net grafiği burada çıkar." href={`${base}?sekme=denemeler`} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Son denemede dersler" description={latest ? `${latest.name} · ${dmy(latest.date)}` : undefined} />
          <CardBody>
            {latest ? (
              <HBarList rows={latest.sections.map((s) => ({ label: s.name, value: s.net, max: s.questionCount, display: `${formatNet(s.net)} / ${s.questionCount}`, hint: `${s.correct} doğru, ${s.wrong} yanlış` }))} />
            ) : (
              <p className="text-sm text-slate-500">Deneme girilmedi.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Haftalık çözülen soru" description="Son 8 hafta" />
          <CardBody>
            {stats.weeks.some((w) => w.solved) ? (
              <BarChart label="Haftalık çözülen soru" bars={stats.weeks.map((w) => ({ label: `${w.start.slice(8)}.${w.start.slice(5, 7)}`, value: w.solved, hint: `${dmy(w.start)} haftası` }))} />
            ) : (
              <EmptyLine text="Soru takibi sekmesinden günlük soru girin." href={`${base}?sekme=sorular`} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Bu hafta" />
          <CardBody className="space-y-5">
            <Ring value={plan.length ? planDone / plan.length : 0} label="Program tamamlama" caption={plan.length ? `${planDone}/${plan.length} madde` : "Bu hafta program yok"} />
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Çalışma süresi: <b className="text-ink-900">{formatMinutes(study.thisWeek)}</b> <span className="text-slate-500">· geçen hafta {formatMinutes(study.lastWeek)}</span>
            </p>
            {stats.subjects.length ? (
              <div>
                <p className="mb-3 text-sm font-semibold text-slate-800">Derslere göre soru (30 gün)</p>
                <HBarList rows={stats.subjects.slice(0, 5).map((s) => ({ label: s.subject, value: s.solved, max: stats.subjects[0].solved, display: `${s.solved.toLocaleString("tr-TR")}${s.accuracy !== null ? ` · %${Math.round(s.accuracy * 100)}` : ""}`, hint: `${s.correct} doğru, ${s.wrong} yanlış` }))} />
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Kaynak ilerlemesi" action={<Link href={`${base}?sekme=program`} className="text-sm font-semibold text-brand-700 hover:underline">Kaynak ekle</Link>} />
        <CardBody>
          {resources.length ? (
            <HBarList
              rows={resources.map((r) => {
                const sum = resourceSummary(r.resource.topics, r.progress);
                // Kitap bitiş tahmini: son 4 haftada biten konu hızıyla
                const f = resourceForecast(r.resource.topics, r.progress, today);
                const eta = f.finished ? "bitti" : f.finishDate ? `tahmini bitiş ${dmy(f.finishDate)}` : "son 4 haftada konu bitmedi";
                return { label: `${r.resource.name} · ${r.resource.subject}`, value: sum.completion, max: 1, display: `%${Math.round(sum.completion * 100)} · ${sum.doneCount}/${r.resource.topics.length} konu · ${eta}`, hint: `${sum.solved} soru çözüldü${f.perWeek ? ` · haftada ${f.perWeek.toLocaleString("tr-TR")} konu` : ""}` };
              })}
            />
          ) : (
            <p className="text-sm text-slate-500">Öğrenciye kaynak eklenmedi.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Tile({ label, value, hint, up }: { label: string; value: string; hint?: string; up?: boolean }) {
  return (
    <div className="rounded-3xl border border-ink-100 bg-white p-4 shadow-xs sm:p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{value}</p>
      {hint ? <p className={cn("mt-1 text-xs", up === true ? "text-emerald-700" : up === false ? "text-rose-700" : "text-slate-500")}>{hint}</p> : null}
    </div>
  );
}

function EmptyLine({ text, href }: { text: string; href: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <p className="text-sm text-slate-500">{text}</p>
      <Link href={href} className="text-sm font-semibold text-brand-700 hover:underline">
        Şimdi gir
      </Link>
    </div>
  );
}

async function ProgramTab({ centerId, studentId, week, topicLocked }: { centerId: string; studentId: string; week?: string; topicLocked: boolean }) {
  const today = toLocalDateString(new Date());
  const weekStart = weekStartOf(week && isDateString(week) ? week : today);
  const [library, assigned, templates] = await Promise.all([
    db.centerResource.findMany({ where: { centerId, isActive: true }, orderBy: [{ subject: "asc" }, { name: "asc" }], select: { id: true, name: true, subject: true } }),
    db.centerStudentResource.findMany({ where: { studentId }, select: { resourceId: true } }),
    planTemplates(centerId),
  ]);
  const taken = new Set(assigned.map((a) => a.resourceId));
  const options = library.filter((r) => !taken.has(r.id)).map((r) => ({ id: r.id, label: `${r.subject} · ${r.name}` }));
  return (
    <div className="space-y-6">
      <StudyView centerId={centerId} studentId={studentId} week={week} baseHref={`/koc/ogrenciler/${studentId}?sekme=program`} mode="staff" canEdit />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Card>
        <CardHeader title="Hazır program" description={`${weekStart.slice(8)}.${weekStart.slice(5, 7)} haftasına şablon uygulayın ya da bu haftayı şablon yapın.`} />
        <CardBody className="space-y-5">
          <ApplyTemplateForm studentId={studentId} weekStart={weekStart} templates={templates.map((t) => ({ id: t.id, name: t.name, description: t.description }))} />
          <SaveTemplateForm studentId={studentId} weekStart={weekStart} />
          {templates.some((t) => t.own) ? (
            <ul className="space-y-1 border-t border-slate-100 pt-3 text-sm">
              {templates.filter((t) => t.own).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span className="text-slate-700">{t.name} <span className="text-xs text-slate-400">· {t.items.length} görev</span></span>
                  <DeleteTemplateButton templateId={t.id} />
                </li>
              ))}
            </ul>
          ) : null}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Kaynak ekle" description={library.length ? "Kütüphanenizdeki kitap ve soru bankalarından öğrenciye ekleyin; konu konu ilerlemesini yukarıda girersiniz." : undefined} />
        <CardBody>
          {options.length ? (
            <AssignBookForm studentId={studentId} resources={options} />
          ) : (
            <p className="text-sm text-slate-500">
              {library.length ? "Kütüphanedeki bütün kaynaklar eklendi." : "Kütüphanenizde kaynak yok."}{" "}
              <Link href="/koc/kaynaklar" className="font-semibold text-brand-700 hover:underline">
                Kaynak kütüphanesi
              </Link>
            </p>
          )}
        </CardBody>
      </Card>
      </div>
      {topicLocked ? <LockedFeature feature="topicAnalysis" /> : <TopicMapCard centerId={centerId} studentId={studentId} today={today} />}
    </div>
  );
}

async function QuestionsTab({ centerId, studentId, today }: { centerId: string; studentId: string; today: string }) {
  const [logs, stats, study, sessions] = await Promise.all([
    db.centerQuestionLog.findMany({ where: { centerId, studentId, date: { gte: dateStringToDbDate(addDaysToDateString(today, -60)) } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 30 }),
    questionStats(centerId, today, studentId),
    studyStats(studentId, today),
    db.centerStudySession.findMany({ where: { studentId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 20 }),
  ]);
  const used = [...new Set(logs.map((l) => l.subject))];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr] lg:items-start">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Soru gir" description="Öğrencinin gün gün, ders ders çözdüğü sorular" />
          <CardBody>
            <QuestionLogForm studentId={studentId} today={today} subjects={[...new Set([...used, ...SUBJECTS])]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Son 14 gün" />
          <CardBody>
            <BarChart label="Son 14 gün çözülen soru" height={170} bars={stats.days.map((d) => ({ label: d.date.slice(8), value: d.solved, hint: `${d.date.slice(8)}.${d.date.slice(5, 7)}` }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Çalışma süresi" description={`Bu hafta ${formatMinutes(study.thisWeek)} · geçen hafta ${formatMinutes(study.lastWeek)}`} />
          <CardBody className="space-y-5">
            <BarChart label="Günlük çalışma (dakika)" unit="dk" height={170} bars={study.days.map((d) => ({ label: d.date.slice(8), value: d.minutes, hint: `${d.date.slice(8)}.${d.date.slice(5, 7)}` }))} />
            <details className="rounded-2xl bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-brand-700">Çalışma süresi ekle</summary>
              <div className="mt-3">
                <StudyEntryForm studentId={studentId} today={today} subjects={SUBJECTS} />
              </div>
            </details>
            {sessions.length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {sessions.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 py-2">
                    <span className="w-12 shrink-0 text-xs font-semibold text-slate-500">{dmy(dbDateToString(x.date)).slice(0, 5)}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-900">
                      {x.subject ?? "Genel"} {x.byStudent ? <Badge tone="sky" className="ml-1">Öğrenci girdi</Badge> : null}
                    </span>
                    <span className="tabular-nums text-slate-700">{formatMinutes(x.minutes)}</span>
                    <DeleteStudyButton sessionId={x.id} />
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Son kayıtlar" description="En yeni 30 kayıt; toplamlar genel bakıştaki grafiklerde" />
        {logs.length ? (
          <ul className="divide-y divide-slate-100">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="w-12 shrink-0 text-xs font-semibold text-slate-500">{dmy(dbDateToString(l.date)).slice(0, 5)}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink-900">
                  {l.subject} {l.byStudent ? <Badge tone="sky" className="ml-1">Öğrenci girdi</Badge> : null}
                </span>
                <span className="tabular-nums text-slate-700">{l.solved} soru</span>
                <span className="hidden w-24 text-right text-xs tabular-nums text-slate-500 sm:inline">{l.correct || l.wrong ? `${l.correct} D · ${l.wrong} Y` : ""}</span>
                <DeleteLogButton logId={l.id} />
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

async function ExamsTab({ centerId, studentId, today }: { centerId: string; studentId: string; today: string }) {
  const exams = await studentExams(centerId, studentId);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
      <Card>
        <CardHeader title="Deneme sonucu gir" description="Yayınevinin sonuç kâğıdındaki doğru ve yanlış sayıları" />
        <CardBody>
          <ExamForm studentId={studentId} today={today} defaultKind={exams[0]?.kind ?? "TYT"} />
        </CardBody>
      </Card>
      {exams.length ? (
        <div className="space-y-3">
          {exams.map((e) => (
            <Card key={e.examId}>
              <div className="flex items-start justify-between gap-3 px-5 pt-4">
                <div>
                  <p className="font-semibold text-ink-900">{e.name}</p>
                  <p className="text-xs text-slate-500">
                    {EXAM_PRESETS[e.kind].label} · {dmy(e.date)} · {e.correct} D, {e.wrong} Y, {e.blank} B
                    {e.byStudent ? <Badge tone="sky" className="ml-2">Öğrenci girdi</Badge> : null}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="rounded-xl bg-brand-50 px-3 py-1 font-display text-lg font-extrabold text-brand-700">{formatNet(e.net)}</span>
                  <DeleteExamButton examId={e.examId} />
                </div>
              </div>
              <CardBody className="pt-3">
                <div className="flex flex-wrap gap-1.5">
                  {e.sections.map((s) => (
                    <span key={s.name} className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600" title={`${s.correct} doğru, ${s.wrong} yanlış`}>
                      {s.name} <b className="text-ink-900">{formatNet(s.net)}</b>
                    </span>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Henüz deneme yok" description="İlk deneme sonucunu girin; net gelişim grafiği ve ders analizi genel bakışta çıkar." />
      )}
    </div>
  );
}
