import { ExternalLink, Pencil, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CenterFlash, NetTrendChart, percent, RateBar, rateTone, shortDate, Tabs } from "@/components/center/center-ui";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, DescriptionList, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { ATTENDANCE_STATUS, ETUD_STATUS, INSTALLMENT_STATE, NOTE_KIND_LABEL, PAYMENT_METHOD_LABEL, STUDENT_STATUS } from "@/lib/center/labels";
import { formatNet, type ExamKindName, EXAM_PRESETS } from "@/lib/center/exams";
import { installmentState } from "@/lib/center/finance";
import { dbDateToString, formatCompact, formatDate, minutesToTime, toLocalDateString } from "@/lib/dates";
import { GENDER_LABEL } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { requireCenter } from "@/server/center/context";
import { marketplaceLink, studentNetTrend, studentWeakTopics } from "@/server/center/exams";
import { studentBalance } from "@/server/center/finance";
import { decryptText, maskIdentityNumber } from "@/server/crypto";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  AddGuardianForm,
  CancelPlanForm,
  DeleteNoteButton,
  DeleteStudentForm,
  FeePlanForm,
  GuardianCard,
  GuardianMessageForm,
  InstallmentEditForm,
  NoteForm,
  StatusForm,
} from "./student-forms";

export const metadata: Metadata = { title: "Öğrenci kartı" };

export default async function StudentCardPage({ params, searchParams }: PageProps<"/kurum/ogrenciler/[id]">) {
  const ctx = await requireCenter("students.view");
  const { id } = await params;
  const sp = await searchParams;
  const tab = String(sp.sekme ?? "genel");
  const centerId = ctx.center.id;
  const student = await db.centerStudent.findFirst({
    where: { id, centerId },
    include: {
      guardians: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      groups: { include: { group: { select: { id: true, name: true } } } },
    },
  });
  if (!student) notFound();
  const today = toLocalDateString(new Date());
  const canFinance = ctx.can("finance.view");
  const tabs = [
    { key: "genel", label: "Genel", href: `/kurum/ogrenciler/${id}` },
    { key: "devam", label: "Devam", href: `/kurum/ogrenciler/${id}?sekme=devam` },
    { key: "denemeler", label: "Denemeler ve eksikler", href: `/kurum/ogrenciler/${id}?sekme=denemeler` },
    ...(canFinance ? [{ key: "odemeler", label: "Ödemeler", href: `/kurum/ogrenciler/${id}?sekme=odemeler` }] : []),
  ];
  const [attendanceStats, balance] = await Promise.all([
    db.centerAttendance.groupBy({ by: ["status"], where: { studentId: id }, _count: true }),
    canFinance ? studentBalance(centerId, id, today) : Promise.resolve(null),
  ]);
  const totalRecords = attendanceStats.reduce((t, s) => t + s._count, 0);
  const countOf = (status: string) => attendanceStats.find((s) => s.status === status)?._count ?? 0;
  const attendanceRate = totalRecords ? (countOf("PRESENT") + countOf("LATE")) / totalRecords : 1;
  const name = `${student.firstName} ${student.lastName}`;

  return (
    <>
      <PageHeader
        title={name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {student.studentNumber ? <span className="font-mono">No {student.studentNumber}</span> : null}
            {student.gradeName ? <span>· {student.gradeName}</span> : null}
            {student.groups.map((g) => (
              <Link key={g.group.id} href={`/kurum/siniflar/${g.group.id}`} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                {g.group.name}
              </Link>
            ))}
            <Badge tone={STUDENT_STATUS[student.status].tone}>{STUDENT_STATUS[student.status].label}</Badge>
          </span>
        }
        actions={
          ctx.can("students.edit") ? (
            <LinkButton href={`/kurum/ogrenciler/${id}/duzenle`} size="sm" variant="outline">
              <Pencil className="size-4" aria-hidden /> Düzenle
            </LinkButton>
          ) : null
        }
      />
      <CenterFlash code={sp.durum} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Devam oranı" value={percent(attendanceRate)} hint={`${countOf("ABSENT")} devamsızlık · ${countOf("LATE")} geç`} />
        <StatCard label="Yoklama kaydı" value={totalRecords} hint={`${countOf("EXCUSED")} izinli`} />
        {balance ? (
          <>
            <StatCard label="Kalan borç" value={formatMoney(balance.remaining)} hint={`Ödenen ${formatMoney(balance.paid)}`} />
            <StatCard label="Geciken" value={<span className={balance.overdue ? "text-rose-600" : undefined}>{formatMoney(balance.overdue)}</span>} />
          </>
        ) : null}
      </div>
      <Tabs tabs={tabs} active={tab} />
      {tab === "devam" ? (
        <AttendanceTab studentId={id} />
      ) : tab === "denemeler" ? (
        <ExamsTab centerId={centerId} studentId={id} />
      ) : tab === "odemeler" && canFinance ? (
        <PaymentsTab centerId={centerId} studentId={id} today={today} canEdit={ctx.can("finance.edit")} academicYear={ctx.center.academicYear} />
      ) : (
        <GeneralTab student={student} canEdit={ctx.can("students.edit")} canDelete={ctx.can("students.delete")} canNote={ctx.can("notes.write")} canMessage={ctx.can("messages.send")} memberId={ctx.member.id} isManager={ctx.member.role === "OWNER" || ctx.member.role === "MANAGER"} />
      )}
    </>
  );
}

type StudentWithRelations = Prisma.CenterStudentGetPayload<{ include: { guardians: true; groups: { include: { group: { select: { id: true; name: true } } } } } }>;

async function GeneralTab({
  student,
  canEdit,
  canDelete,
  canNote,
  canMessage,
  memberId,
  isManager,
}: {
  student: StudentWithRelations;
  canEdit: boolean;
  canDelete: boolean;
  canNote: boolean;
  canMessage: boolean;
  memberId: string;
  isManager: boolean;
}) {
  const notes = await db.centerNote.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });
  let identity = "—";
  if (student.identityNumberEnc) {
    try {
      identity = maskIdentityNumber(decryptText(student.identityNumberEnc));
    } catch {
      identity = "***";
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Bilgiler" action={canEdit ? <StatusForm studentId={student.id} status={student.status} /> : null} />
          <CardBody>
            <DescriptionList
              items={[
                { label: "Okulu", value: student.schoolName ?? "—" },
                { label: "Hedef", value: student.targetExam ?? "—" },
                { label: "Cinsiyet", value: GENDER_LABEL[student.gender] ?? "—" },
                { label: "Doğum tarihi", value: student.birthDate ? shortDate(student.birthDate) : "—" },
                { label: "T.C. kimlik no", value: identity },
                { label: "Telefon", value: student.phone ?? "—" },
                { label: "E-posta", value: student.email ?? "—" },
                { label: "Adres", value: student.address ?? "—" },
                { label: "Kayıt tarihi", value: formatDate(student.enrolledAt) },
                ...(student.leftAt ? [{ label: "Ayrılış", value: formatDate(student.leftAt) }] : []),
                ...(student.notes ? [{ label: "Notlar", value: <span className="whitespace-pre-line">{student.notes}</span> }] : []),
              ]}
            />
            {canDelete ? (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <DeleteStudentForm studentId={student.id} name={`${student.firstName} ${student.lastName}`} />
              </div>
            ) : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Veliler" description="Veli portalına bağlanan veli devamsızlık, deneme ve ödemeleri siteden görür." />
          <CardBody className="space-y-3">
            {student.guardians.length === 0 ? <p className="text-sm text-slate-500">Veli bilgisi yok.</p> : null}
            {student.guardians.map((g) => (
              <GuardianCard
                key={g.id}
                studentId={student.id}
                canEdit={canEdit}
                guardian={{
                  id: g.id,
                  fullName: g.fullName,
                  relation: g.relation,
                  phone: g.phone,
                  email: g.email,
                  isPrimary: g.isPrimary,
                  notifySms: g.notifySms,
                  notifyEmail: g.notifyEmail,
                  linked: Boolean(g.userId),
                  inviteExpiresAt: g.inviteExpiresAt?.toISOString() ?? null,
                }}
              />
            ))}
            {canEdit && student.guardians.length < 4 ? <AddGuardianForm studentId={student.id} /> : null}
          </CardBody>
        </Card>
        {canMessage && student.guardians.length ? (
          <Card>
            <CardHeader title="Veliye mesaj gönder" />
            <CardBody>
              <GuardianMessageForm studentId={student.id} />
            </CardBody>
          </Card>
        ) : null}
      </div>
      <Card>
        <CardHeader title="Rehberlik ve görüşme notları" />
        <CardBody className="space-y-4">
          {canNote ? <NoteForm studentId={student.id} /> : null}
          {notes.length === 0 ? (
            <p className="text-sm text-slate-500">Henüz not yok.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => (
                <li key={note.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500">
                      {NOTE_KIND_LABEL[note.kind]} · {note.author ? `${note.author.user.firstName} ${note.author.user.lastName}` : "—"} · {formatCompact(note.createdAt)}
                      {note.visibleToParent ? <Badge tone="brand" className="ml-2">Veli görüyor</Badge> : null}
                    </p>
                    {canNote && (isManager || note.authorId === memberId) ? <DeleteNoteButton noteId={note.id} /> : null}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{note.text}</p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

async function AttendanceTab({ studentId }: { studentId: string }) {
  const [records, etuds] = await Promise.all([
    db.centerAttendance.findMany({
      where: { studentId },
      include: { session: { select: { date: true, startMinute: true, subject: true, group: { select: { name: true } } } } },
      orderBy: [{ session: { date: "desc" } }, { session: { startMinute: "desc" } }],
      take: 150,
    }),
    db.centerEtudStudent.findMany({
      where: { studentId },
      include: { etud: { include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
      orderBy: { etud: { date: "desc" } },
      take: 50,
    }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Card>
        <CardHeader title="Ders yoklamaları" description="Son 150 kayıt" />
        {records.length === 0 ? (
          <CardBody>
            <p className="text-sm text-slate-500">Henüz yoklama kaydı yok.</p>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Tarih</Th>
                <Th>Ders</Th>
                <Th>Durum</Th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap text-xs">
                    {shortDate(r.session.date)} {minutesToTime(r.session.startMinute)}
                  </Td>
                  <Td className="text-xs">
                    {r.session.subject} <span className="text-slate-500">· {r.session.group.name}</span>
                    {r.note ? <p className="text-slate-500">{r.note}</p> : null}
                  </Td>
                  <Td>
                    <Badge tone={ATTENDANCE_STATUS[r.status].tone}>{ATTENDANCE_STATUS[r.status].label}</Badge>
                    {r.notifiedAt ? <p className="mt-1 text-[11px] text-slate-500">Veliye bildirildi</p> : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card>
        <CardHeader title="Etütler" />
        {etuds.length === 0 ? (
          <CardBody>
            <p className="text-sm text-slate-500">Bu öğrenci için etüt planlanmamış.</p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-slate-100">
            {etuds.map(({ etud, attendance }) => (
              <li key={etud.id}>
                <Link href={`/kurum/etutler/${etud.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {etud.subject}
                      {etud.topic ? ` — ${etud.topic}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {shortDate(etud.date)} {minutesToTime(etud.startMinute)}
                      {etud.teacher ? ` · ${etud.teacher.user.firstName} ${etud.teacher.user.lastName}` : ""}
                    </p>
                  </div>
                  {attendance ? <Badge tone={ATTENDANCE_STATUS[attendance].tone}>{ATTENDANCE_STATUS[attendance].label}</Badge> : <Badge tone={ETUD_STATUS[etud.status].tone}>{ETUD_STATUS[etud.status].label}</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

async function ExamsTab({ centerId, studentId }: { centerId: string; studentId: string }) {
  const results = await db.centerExamResult.findMany({
    where: { studentId },
    include: { exam: { include: { sections: { orderBy: { order: "asc" } }, _count: { select: { results: true } } } }, sections: true },
    orderBy: { exam: { date: "desc" } },
    take: 40,
  });
  if (!results.length) {
    return <EmptyState title="Henüz deneme sonucu yok" description="Deneme sonuçları girildikçe net gelişimi ve eksik konular burada görünür." action={<LinkButton href="/kurum/denemeler">Denemeler</LinkButton>} />;
  }
  const kinds = [...new Set(results.map((r) => r.exam.kind))] as ExamKindName[];
  const [trends, weak] = await Promise.all([Promise.all(kinds.map((kind) => studentNetTrend(centerId, studentId, kind))), studentWeakTopics(centerId, studentId)]);
  return (
    <div className="space-y-6">
      {kinds.map((kind, i) =>
        trends[i].length >= 2 ? (
          <Card key={kind}>
            <CardHeader title={`${EXAM_PRESETS[kind].label} net gelişimi`} />
            <CardBody>
              <NetTrendChart points={trends[i]} maxNet={EXAM_PRESETS[kind].sections.reduce((t, s) => t + s.questionCount, 0) || Math.max(...trends[i].map((t) => t.net))} />
            </CardBody>
          </Card>
        ) : null,
      )}
      <Card>
        <CardHeader title="Eksik konular" description="Cevapları girilmiş denemelerde en fazla yarısını doğru yapabildiği konular" />
        <CardBody>
          {weak.length === 0 ? (
            <p className="text-sm text-slate-500">Konu analizi için denemeye cevap anahtarı ve konu dağılımı girip öğrencinin cevaplarını okutun.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {weak.map((t) => (
                <li key={`${t.sectionName}-${t.topic}`} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{t.topic}</p>
                      <p className="text-xs text-slate-500">
                        {t.sectionName} · {t.questions} sorudan {t.correct} doğru
                      </p>
                    </div>
                    <span className="text-sm font-bold text-rose-600">{percent(t.rate)}</span>
                  </div>
                  <RateBar value={t.rate} tone={rateTone(t.rate)} className="mt-2" />
                  <Link href={marketplaceLink(t.kind, t.subjectSlug)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline" target="_blank">
                    Bu konuda özel ders öğretmenleri <ExternalLink className="size-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Deneme sonuçları" />
        <Table>
          <thead>
            <tr>
              <Th>Deneme</Th>
              <Th>Tarih</Th>
              <Th className="text-right">D / Y / B</Th>
              <Th className="text-right">Net</Th>
              <Th className="text-right">Sıra</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id}>
                <Td>
                  <p className="font-semibold text-slate-900">{r.exam.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.exam.sections.map((s) => {
                      const sr = r.sections.find((x) => x.sectionId === s.id);
                      return sr ? `${s.name} ${formatNet(sr.net)}` : null;
                    }).filter(Boolean).join(" · ")}
                  </p>
                </Td>
                <Td className="whitespace-nowrap text-xs">{shortDate(r.exam.date)}</Td>
                <Td className="whitespace-nowrap text-right text-xs">
                  {r.correct} / {r.wrong} / {r.blank}
                </Td>
                <Td className="text-right font-bold text-slate-900">{formatNet(r.net)}</Td>
                <Td className="whitespace-nowrap text-right text-xs">{r.rank ? `${r.rank}/${r.exam._count.results}` : "—"}</Td>
                <Td>
                  <Link href={`/kurum/denemeler/${r.examId}/karne/${studentId}`} className="text-xs font-semibold text-brand-700 hover:underline">
                    Karne
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

async function PaymentsTab({ centerId, studentId, today, canEdit, academicYear }: { centerId: string; studentId: string; today: string; canEdit: boolean; academicYear: string }) {
  const [plans, payments] = await Promise.all([
    db.centerFeePlan.findMany({ where: { centerId, studentId }, include: { installments: { orderBy: [{ dueDate: "asc" }, { order: "asc" }] } }, orderBy: { createdAt: "desc" } }),
    db.centerPayment.findMany({ where: { centerId, studentId }, orderBy: { paidAt: "desc" }, take: 50 }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
      <div className="space-y-6">
        {plans.length === 0 ? <EmptyState title="Ödeme planı yok" description="Sözleşme tutarını ve taksitleri girerek ödeme planı oluşturun; gecikmeler ve hatırlatmalar otomatik takip edilir." /> : null}
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.isCancelled ? "opacity-60" : undefined}>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  {plan.title} {plan.isCancelled ? <Badge tone="slate">İptal</Badge> : null}
                </span>
              }
              description={`Toplam ${formatMoney(plan.totalAmount)}${plan.discountAmount ? ` − indirim ${formatMoney(plan.discountAmount)}` : ""} = ${formatMoney(plan.netAmount)}${plan.note ? ` · ${plan.note}` : ""}`}
              action={canEdit && !plan.isCancelled ? <CancelPlanForm planId={plan.id} /> : null}
            />
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Vade</Th>
                  <Th className="text-right">Tutar</Th>
                  <Th className="text-right">Ödenen</Th>
                  <Th>Durum</Th>
                </tr>
              </thead>
              <tbody>
                {plan.installments.map((inst) => {
                  const state = installmentState({ dueDate: dbDateToString(inst.dueDate), amount: inst.amount, paidAmount: inst.paidAmount }, today);
                  return (
                    <tr key={inst.id}>
                      <Td className="text-xs text-slate-500">{inst.order}</Td>
                      <Td className="whitespace-nowrap text-xs">
                        <span className="inline-flex items-center gap-2">
                          {shortDate(inst.dueDate)}
                          {canEdit && !plan.isCancelled && state !== "paid" ? <InstallmentEditForm installmentId={inst.id} dueDate={dbDateToString(inst.dueDate)} amount={inst.amount} /> : null}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-right">{formatMoney(inst.amount)}</Td>
                      <Td className="whitespace-nowrap text-right text-slate-600">{inst.paidAmount ? formatMoney(inst.paidAmount) : "—"}</Td>
                      <Td>
                        <Badge tone={INSTALLMENT_STATE[state].tone}>{INSTALLMENT_STATE[state].label}</Badge>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        ))}
        <Card>
          <CardHeader title="Tahsilatlar" action={canEdit ? <LinkButton href={`/kurum/muhasebe/tahsilat?ogrenci=${studentId}`} size="sm"><Receipt className="size-4" aria-hidden /> Tahsilat ekle</LinkButton> : null} />
          {payments.length === 0 ? (
            <CardBody>
              <p className="text-sm text-slate-500">Tahsilat yok.</p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Makbuz</Th>
                  <Th>Tarih</Th>
                  <Th>Şekil</Th>
                  <Th className="text-right">Tutar</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className={p.cancelledAt ? "text-slate-400 line-through" : undefined}>
                    <Td>
                      <Link href={`/kurum/muhasebe/makbuz/${p.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                        #{p.receiptNo}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-xs">{formatDate(p.paidAt)}</Td>
                    <Td className="text-xs">{PAYMENT_METHOD_LABEL[p.method]}</Td>
                    <Td className="whitespace-nowrap text-right font-semibold">{formatMoney(p.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
      {canEdit ? (
        <Card>
          <CardHeader title="Yeni ödeme planı" description="Taksitler tam liraya yuvarlanır; artan kuruş ilk taksite eklenir." />
          <CardBody>
            <FeePlanForm studentId={studentId} academicYear={academicYear} today={today} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
