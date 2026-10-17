import { BookOpenCheck, CalendarClock, ClipboardCheck, PlusCircle, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CenterFlash, shortDate } from "@/components/center/center-ui";
import { LinkButton } from "@/components/ui/button";
import { moduleEnabled, type CenterModuleKey } from "@/lib/center/modules";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import { CENTER_ACCESS_LABEL } from "@/lib/center/labels";
import { formatNet } from "@/lib/center/exams";
import { dateStringToDbDate, formatDate, minutesToTime, toLocalDateString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { lessonsForDate } from "@/server/center/attendance";
import { coachingOverview } from "@/server/center/coaching";
import { requireCenter } from "@/server/center/context";
import { financeOverview, overdueByStudent } from "@/server/center/finance";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Kurum paneli" };

export default async function CenterDashboard({ searchParams }: PageProps<"/kurum">) {
  const ctx = await requireCenter();
  const { durum } = await searchParams;
  const centerId = ctx.center.id;
  const today = toLocalDateString(new Date());
  const teacherOnly = ctx.member.role === "TEACHER";
  const on = (key: CenterModuleKey) => moduleEnabled(ctx.center, key);
  const [activeStudents, lessons, absentToday, etudsToday, finance, overdue, exams, newLeads, groupCount, weeklySlots] = await Promise.all([
    db.centerStudent.count({ where: { centerId, status: "ACTIVE" } }),
    ctx.can("attendance.take") ? lessonsForDate(centerId, today, teacherOnly ? { teacherId: ctx.member.id } : {}) : Promise.resolve([]),
    db.centerAttendance.count({ where: { status: "ABSENT", session: { centerId, date: dateStringToDbDate(today) } } }),
    (ctx.can("etud.manage") && on("etutler"))
      ? db.centerEtud.findMany({
          where: { centerId, date: dateStringToDbDate(today), status: { not: "CANCELLED" }, ...(teacherOnly ? { teacherId: ctx.member.id } : {}) },
          include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } }, _count: { select: { students: true } } },
          orderBy: { startMinute: "asc" },
        })
      : Promise.resolve([]),
    (ctx.can("finance.view") && on("muhasebe")) ? financeOverview(centerId) : Promise.resolve(null),
    (ctx.can("finance.view") && on("muhasebe")) ? overdueByStudent(centerId, today) : Promise.resolve([]),
    (ctx.can("exams.manage") && on("denemeler"))
      ? db.centerExam.findMany({ where: { centerId }, orderBy: { date: "desc" }, take: 4, include: { results: { select: { net: true } }, sections: { select: { questionCount: true } } } })
      : Promise.resolve([]),
    (ctx.can("leads.manage") && on("on-kayit")) ? db.centerLead.count({ where: { centerId, status: "NEW" } }) : Promise.resolve(0),
    db.centerGroup.count({ where: { centerId, isActive: true } }),
    db.centerScheduleSlot.count({ where: { centerId, group: { isActive: true }, ...(teacherOnly ? { teacherId: ctx.member.id } : {}) } }),
  ]);
  const [absentList, homeworkDue, coaching, gradeCounts, hallToday] = await Promise.all([
    db.centerAttendance.findMany({
      where: { status: "ABSENT", session: { centerId, date: dateStringToDbDate(today) } },
      select: { student: { select: { id: true, firstName: true, lastName: true } }, session: { select: { subject: true, startMinute: true, group: { select: { name: true } } } } },
      orderBy: { session: { startMinute: "asc" } },
      take: 12,
    }),
    ctx.can("homework.manage")
      ? db.centerHomework.findMany({ where: { centerId, dueDate: dateStringToDbDate(today), ...(teacherOnly ? { teacherId: ctx.member.id } : {}) }, include: { group: { select: { name: true } }, _count: { select: { students: true } } }, take: 8 })
      : Promise.resolve([]),
    (ctx.can("coaching.manage") && on("kocluk")) ? coachingOverview(ctx, today) : Promise.resolve(null),
    db.centerStudent.groupBy({ by: ["gradeName"], where: { centerId, status: "ACTIVE" }, _count: true }),
    ctx.can("attendance.take") ? db.centerHallDay.findMany({ where: { date: dateStringToDbDate(today), hall: { centerId } }, select: { marks: true } }) : Promise.resolve([]),
  ]);
  const coachToday = coaching?.rows.filter((r) => r.status === "TODAY" || r.status === "OVERDUE") ?? [];
  const grades = gradeCounts.map((g) => ({ name: g.gradeName ?? "Sınıf belirtilmemiş", count: g._count })).sort((a, b) => a.name.localeCompare(b.name, "tr", { numeric: true }));
  const pendingAttendance = lessons.filter((l) => !l.session?.takenAt).length;
  const access = CENTER_ACCESS_LABEL[ctx.access.state];

  return (
    <>
      <PageHeader
        title={`Merhaba ${ctx.user.firstName}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {ctx.center.name} · {ctx.center.academicYear} eğitim yılı
            <Badge tone={access.tone}>{access.label}</Badge>
          </span>
        }
        actions={
          <>
            {ctx.can("students.edit") ? (
              <LinkButton href="/kurum/ogrenciler/yeni" size="sm">
                <PlusCircle className="size-4" aria-hidden /> Öğrenci ekle
              </LinkButton>
            ) : null}
            {ctx.can("attendance.take") ? (
              <LinkButton href="/kurum/yoklama" size="sm" variant="outline">
                <ClipboardCheck className="size-4" aria-hidden /> Yoklama al
              </LinkButton>
            ) : null}
            {(ctx.can("finance.edit") && on("muhasebe")) ? (
              <LinkButton href="/kurum/muhasebe/tahsilat" size="sm" variant="outline">
                <Wallet className="size-4" aria-hidden /> Tahsilat
              </LinkButton>
            ) : null}
          </>
        }
      />
      <CenterFlash code={durum} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Aktif öğrenci" value={activeStudents} hint={`Plan sınırı ${ctx.center.studentLimit}`} icon={<Users className="size-5" />} />
        <StatCard
          label="Bugünkü dersler"
          value={lessons.length}
          hint={lessons.length ? (pendingAttendance ? `${pendingAttendance} dersin yoklaması bekliyor` : "Tüm yoklamalar alındı") : "Programda ders yok"}
          icon={<ClipboardCheck className="size-5" />}
        />
        <StatCard label="Bugün gelmeyen" value={absentToday} hint={`${etudsToday.length} etüt planlı`} icon={<CalendarClock className="size-5" />} />
        {finance ? (
          <StatCard label="Bu ay tahsilat" value={formatMoney(finance.collectedThisMonth)} hint={finance.overdue ? `Geciken: ${formatMoney(finance.overdue)}` : "Geciken ödeme yok"} icon={<Wallet className="size-5" />} />
        ) : (ctx.can("leads.manage") && on("on-kayit")) ? (
          <StatCard label="Yeni ön kayıt" value={newLeads} icon={<PlusCircle className="size-5" />} />
        ) : (
          <StatCard label="Sınıf" value={groupCount} hint={`${teacherOnly ? "Sizin " : ""}${weeklySlots} ders / hafta`} icon={<BookOpenCheck className="size-5" />} />
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Bugün gelmeyenler" action={<Link href="/kurum/yoklama/rapor" className="text-sm font-semibold text-brand-700 hover:underline">Rapor</Link>} />
          {absentList.length === 0 ? (
            <CardBody>
              <p className="text-sm text-slate-500">Bugün devamsızlık yok.</p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-slate-100">
              {absentList.map((a) => (
                <li key={`${a.student.id}-${a.session.startMinute}`}>
                  <Link href={`/kurum/ogrenciler/${a.student.id}?sekme=devam`} className="flex justify-between gap-2 px-5 py-2 text-sm hover:bg-slate-50">
                    <span className="font-medium text-slate-900">
                      {a.student.firstName} {a.student.lastName}
                    </span>
                    <span className="text-xs text-slate-500">
                      {minutesToTime(a.session.startMinute)} {a.session.subject} · {a.session.group.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {hallToday.length && on("calisma-salonu") ? <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">Çalışma salonunda bugün {hallToday.filter((d) => d.marks.includes("G")).length} öğrenci var.</p> : null}
        </Card>
        {coaching ? (
          <Card>
            <CardHeader title="Bugünkü koç görüşmeleri" action={<Link href="/kurum/kocluk" className="text-sm font-semibold text-brand-700 hover:underline">Koçluk</Link>} />
            <CardBody>
              {coachToday.length ? (
                <ul className="space-y-1.5 text-sm">
                  {coachToday.map((r) => (
                    <li key={r.id} className="flex justify-between gap-2">
                      <Link href={`/kurum/ogrenciler/${r.id}?sekme=kocluk`} className="font-medium text-brand-700 hover:underline">
                        {r.name}
                      </Link>
                      <span className="text-xs text-slate-500">{r.status === "OVERDUE" ? "gecikti" : r.minute !== null ? minutesToTime(r.minute) : ""}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Bugün bekleyen görüşme yok.</p>
              )}
              {homeworkDue.length && on("odevler") ? (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Bugün teslim ödevler</p>
                  <ul className="space-y-1 text-sm">
                    {homeworkDue.map((h) => (
                      <li key={h.id}>
                        <Link href={`/kurum/odevler/${h.id}`} className="text-slate-800 hover:underline">
                          {h.subject}: {h.title}
                        </Link>{" "}
                        <span className="text-xs text-slate-500">· {h.group?.name ?? `${h._count.students} öğrenci`}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Sınıf seviyesine göre öğrenci" />
          <CardBody className="space-y-2">
            {grades.length ? (
              grades.map((g) => (
                <div key={g.name}>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700">{g.name}</span>
                    <span className="font-semibold text-slate-900">{g.count}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${Math.round((g.count / Math.max(activeStudents, 1)) * 100)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Henüz öğrenci yok.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {ctx.can("attendance.take") ? (
          <Card>
            <CardHeader title="Bugünkü dersler" description={formatDate(new Date())} action={<Link href="/kurum/yoklama" className="text-sm font-semibold text-brand-700 hover:underline">Yoklama ekranı</Link>} />
            {lessons.length === 0 ? (
              <CardBody>
                <p className="text-sm text-slate-500">
                  Bugün programda ders yok.{" "}
                  {ctx.can("groups.manage") ? (
                    <Link href="/kurum/siniflar" className="font-semibold text-brand-700 hover:underline">
                      Sınıflara haftalık program ekleyin
                    </Link>
                  ) : null}
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {lessons.map((lesson) => (
                  <li key={lesson.key} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {minutesToTime(lesson.startMinute)}–{minutesToTime(lesson.endMinute)} · {lesson.subject}
                      </p>
                      <p className="text-xs text-slate-500">
                        {lesson.groupName}
                        {lesson.teacherName ? ` · ${lesson.teacherName}` : ""}
                        {lesson.room ? ` · ${lesson.room}` : ""}
                      </p>
                    </div>
                    {lesson.session?.takenAt ? (
                      <Badge tone={lesson.session.absent ? "amber" : "green"}>
                        {lesson.session.absent ? `${lesson.session.absent} gelmedi` : "Tam katılım"}
                      </Badge>
                    ) : (
                      <LinkButton
                        size="sm"
                        variant="secondary"
                        href={`/kurum/yoklama/al?grup=${lesson.groupId}&tarih=${today}&baslangic=${lesson.startMinute}${lesson.slotId ? `&ders=${lesson.slotId}` : ""}`}
                      >
                        Yoklama al
                      </LinkButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        {(ctx.can("etud.manage") && on("etutler")) ? (
          <Card>
            <CardHeader title="Bugünkü etütler" action={<Link href="/kurum/etutler" className="text-sm font-semibold text-brand-700 hover:underline">Etüt planı</Link>} />
            {etudsToday.length === 0 ? (
              <CardBody>
                <p className="text-sm text-slate-500">Bugün planlı etüt yok.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {etudsToday.map((etud) => (
                  <li key={etud.id}>
                    <Link href={`/kurum/etutler/${etud.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {minutesToTime(etud.startMinute)} · {etud.subject}
                          {etud.topic ? ` — ${etud.topic}` : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          {etud.teacher ? `${etud.teacher.user.firstName} ${etud.teacher.user.lastName} · ` : ""}
                          {etud._count.students} öğrenci
                        </p>
                      </div>
                      <Badge tone={etud.status === "DONE" ? "green" : "sky"}>{etud.status === "DONE" ? "Yapıldı" : "Planlı"}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        {finance ? (
          <Card>
            <CardHeader title="Geciken ödemeler" description={finance.overdue ? `Toplam ${formatMoney(finance.overdue)}` : undefined} action={<Link href="/kurum/muhasebe/gecikenler" className="text-sm font-semibold text-brand-700 hover:underline">Tümü</Link>} />
            {overdue.length === 0 ? (
              <CardBody>
                <p className="text-sm text-slate-500">Vadesi geçmiş ödeme yok. 🎉</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {overdue.slice(0, 5).map((row) => (
                  <li key={row.studentId}>
                    <Link href={`/kurum/ogrenciler/${row.studentId}?sekme=odemeler`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                        <p className="text-xs text-slate-500">
                          {row.installments} taksit · en eski vade {shortDate(row.oldestDue)}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-rose-600">{formatMoney(row.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        {(ctx.can("exams.manage") && on("denemeler")) ? (
          <Card>
            <CardHeader title="Son denemeler" action={<Link href="/kurum/denemeler" className="text-sm font-semibold text-brand-700 hover:underline">Denemeler</Link>} />
            {exams.length === 0 ? (
              <CardBody>
                <EmptyState icon={<BookOpenCheck className="size-8" />} title="Henüz deneme yok" description="İlk denemeyi oluşturup sonuçları girin; net, sıralama ve eksik konu analizi otomatik çıkar." action={<LinkButton href="/kurum/denemeler" size="sm">Deneme oluştur</LinkButton>} />
              </CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {exams.map((exam) => {
                  const avg = exam.results.length ? exam.results.reduce((t, r) => t + r.net, 0) / exam.results.length : 0;
                  const questions = exam.sections.reduce((t, s) => t + s.questionCount, 0);
                  return (
                    <li key={exam.id}>
                      <Link href={`/kurum/denemeler/${exam.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{exam.name}</p>
                          <p className="text-xs text-slate-500">
                            {shortDate(exam.date)} · {exam.results.length} öğrenci
                          </p>
                        </div>
                        <span className="text-right text-sm">
                          <span className="font-bold text-slate-900">{formatNet(Math.round(avg * 100) / 100)}</span>
                          <span className="text-slate-500"> / {questions} ort. net</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}
