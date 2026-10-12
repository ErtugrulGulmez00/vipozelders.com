import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unlinkGuardianAction } from "@/actions/center-public";
import { CenterFlash, NetTrendChart, percent, RateBar, rateTone, shortDate, Tabs } from "@/components/center/center-ui";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { ATTENDANCE_STATUS, INSTALLMENT_STATE, NOTE_KIND_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/center/labels";
import { EXAM_PRESETS, formatNet } from "@/lib/center/exams";
import { installmentState } from "@/lib/center/finance";
import { WEEKDAY_NAMES, dbDateToString, formatCompact, formatDate, minutesToTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { marketplaceLink } from "@/server/center/exams";
import { portalChildDetail } from "@/server/center/portal";

export const metadata: Metadata = { title: "Öğrenci takibi" };

export default async function GuardianChildPage({ params, searchParams }: PageProps<"/hesabim/kurum/[id]">) {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const sp = await searchParams;
  const tab = String(sp.sekme ?? "ozet");
  const data = await portalChildDetail(user.id, id);
  if (!data) notFound();
  const { student, attendance, etuds, results, installments, payments, announcements, notes, weakTopics, balance, today, trend } = data;
  const counted = attendance.length;
  const absent = attendance.filter((a) => a.status === "ABSENT").length;
  const rate = counted ? attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length / counted : 1;
  const last = results[0];
  const base = `/hesabim/kurum/${id}`;
  const slots = student.groups.flatMap((g) => g.group.slots.map((s) => ({ ...s, groupName: g.group.name }))).sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
  const trendKind = last?.exam.kind;
  return (
    <>
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        description={[student.center.name, student.gradeName, student.groups.map((g) => g.group.name).join(", ")].filter(Boolean).join(" · ")}
      />
      <CenterFlash code={sp.durum} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Devam (60 gün)" value={percent(rate)} hint={`${absent} devamsızlık`} />
        <StatCard label="Son deneme" value={last ? `${formatNet(last.net)} net` : "—"} hint={last ? `${last.exam.name}${last.rank ? ` · ${last.rank}/${last.exam._count.results}` : ""}` : undefined} />
        <StatCard label="Kalan ödeme" value={formatMoney(balance.remaining)} hint={balance.overdue ? <span className="text-rose-600">Geciken {formatMoney(balance.overdue)}</span> : "Geciken yok"} />
        <StatCard label="Eksik konu" value={weakTopics.length} />
      </div>
      <Tabs
        active={tab}
        tabs={[
          { key: "ozet", label: "Özet", href: base },
          { key: "devam", label: "Devam ve etüt", href: `${base}?sekme=devam` },
          { key: "denemeler", label: "Denemeler", href: `${base}?sekme=denemeler` },
          { key: "odemeler", label: "Ödemeler", href: `${base}?sekme=odemeler` },
          { key: "program", label: "Ders programı", href: `${base}?sekme=program` },
        ]}
      />
      {tab === "devam" ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Card>
            <CardHeader title="Ders yoklamaları" description="Son 60 gün" />
            {attendance.length ? (
              <Table>
                <tbody>
                  {attendance.map((a) => (
                    <tr key={a.id}>
                      <Td className="whitespace-nowrap text-xs">
                        {shortDate(a.session.date)} {minutesToTime(a.session.startMinute)}
                      </Td>
                      <Td className="text-sm">
                        {a.session.subject} <span className="text-xs text-slate-500">· {a.session.group.name}</span>
                      </Td>
                      <Td>
                        <Badge tone={ATTENDANCE_STATUS[a.status].tone}>{ATTENDANCE_STATUS[a.status].label}</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <CardBody>
                <p className="text-sm text-slate-500">Yoklama kaydı yok.</p>
              </CardBody>
            )}
          </Card>
          <Card>
            <CardHeader title="Etütler" />
            {etuds.length ? (
              <ul className="divide-y divide-slate-100">
                {etuds.map(({ etud, attendance: status }) => (
                  <li key={etud.id} className="flex items-center justify-between gap-2 px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {etud.subject}
                        {etud.topic ? ` — ${etud.topic}` : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        {shortDate(etud.date)} {minutesToTime(etud.startMinute)}
                        {etud.teacher ? ` · ${etud.teacher.user.firstName} ${etud.teacher.user.lastName}` : ""}
                      </p>
                    </div>
                    {status ? <Badge tone={ATTENDANCE_STATUS[status].tone}>{ATTENDANCE_STATUS[status].label}</Badge> : <Badge tone="sky">Planlandı</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="text-sm text-slate-500">Etüt yok.</p>
              </CardBody>
            )}
          </Card>
        </div>
      ) : tab === "denemeler" ? (
        <div className="space-y-6">
          {trend.length >= 2 && trendKind ? (
            <Card>
              <CardHeader title={`${EXAM_PRESETS[trendKind].label} net gelişimi`} />
              <CardBody>
                <NetTrendChart points={trend} maxNet={EXAM_PRESETS[trendKind].sections.reduce((t, s) => t + s.questionCount, 0) || Math.max(...trend.map((t) => t.net))} />
              </CardBody>
            </Card>
          ) : null}
          {results.length === 0 ? (
            <EmptyState title="Yayınlanmış deneme sonucu yok" description="Kurum sonuçları yayınladıkça burada görünür." />
          ) : (
            <Card>
              <Table>
                <thead>
                  <tr>
                    <Th>Deneme</Th>
                    <Th>Tarih</Th>
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
                          {r.exam.sections
                            .map((s) => {
                              const sr = r.sections.find((x) => x.sectionId === s.id);
                              return sr ? `${s.name} ${formatNet(sr.net)}` : null;
                            })
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </Td>
                      <Td className="whitespace-nowrap text-xs">{shortDate(r.exam.date)}</Td>
                      <Td className="text-right font-bold">{formatNet(r.net)}</Td>
                      <Td className="text-right text-xs">{r.rank ? `${r.rank}/${r.exam._count.results}` : "—"}</Td>
                      <Td>
                        <Link href={`${base}/deneme/${r.examId}`} className="text-xs font-semibold text-brand-700 hover:underline">
                          Karne
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>
      ) : tab === "odemeler" ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Card>
            <CardHeader title="Taksitler" />
            {installments.length ? (
              <Table>
                <tbody>
                  {installments.map((i) => {
                    const state = installmentState({ dueDate: dbDateToString(i.dueDate), amount: i.amount, paidAmount: i.paidAmount }, today);
                    return (
                      <tr key={i.id}>
                        <Td className="whitespace-nowrap text-xs">{shortDate(i.dueDate)}</Td>
                        <Td className="text-xs text-slate-500">
                          {i.plan.title} · {i.order}. taksit
                        </Td>
                        <Td className="whitespace-nowrap text-right font-semibold">{formatMoney(i.amount)}</Td>
                        <Td>
                          <Badge tone={INSTALLMENT_STATE[state].tone}>{INSTALLMENT_STATE[state].label}</Badge>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <CardBody>
                <p className="text-sm text-slate-500">Ödeme planı yok.</p>
              </CardBody>
            )}
          </Card>
          <Card>
            <CardHeader title="Yapılan ödemeler" />
            {payments.length ? (
              <Table>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <Td className="text-xs">{formatDate(p.paidAt)}</Td>
                      <Td className="text-xs text-slate-500">
                        Makbuz {p.receiptNo} · {PAYMENT_METHOD_LABEL[p.method]}
                      </Td>
                      <Td className="whitespace-nowrap text-right font-semibold">{formatMoney(p.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <CardBody>
                <p className="text-sm text-slate-500">Ödeme kaydı yok.</p>
              </CardBody>
            )}
          </Card>
        </div>
      ) : tab === "program" ? (
        <Card>
          <CardHeader title="Haftalık ders programı" />
          {slots.length ? (
            <ul className="divide-y divide-slate-100">
              {slots.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span className="font-semibold text-slate-900">
                    {WEEKDAY_NAMES[s.weekday - 1]} {minutesToTime(s.startMinute)}–{minutesToTime(s.endMinute)}
                  </span>
                  <span className="text-slate-600">
                    {s.subject} · {s.groupName}
                    {s.teacher ? ` · ${s.teacher.user.firstName} ${s.teacher.user.lastName}` : ""}
                    {s.room ? ` · ${s.room}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody>
              <p className="text-sm text-slate-500">Program henüz girilmemiş.</p>
            </CardBody>
          )}
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Card>
            <CardHeader title="Eksik konular" description="Yayınlanan denemelerde en fazla yarısını doğru yapabildiği konular" />
            <CardBody>
              {weakTopics.length ? (
                <ul className="space-y-3">
                  {weakTopics.map((t) => (
                    <li key={`${t.sectionName}-${t.topic}`}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-semibold text-slate-900">{t.topic}</span>
                        <span className="text-xs font-bold text-rose-600">{percent(t.rate)}</span>
                      </div>
                      <RateBar value={t.rate} tone={rateTone(t.rate)} className="mt-1" />
                      <Link href={marketplaceLink(t.kind, t.subjectSlug)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                        {t.sectionName} için özel ders öğretmenleri <ExternalLink className="size-3" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Henüz eksik konu analizi yok. Kurum deneme cevaplarını girip sonuçları yayınladıkça burada görünür.</p>
              )}
            </CardBody>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Duyurular" />
              {announcements.length ? (
                <ul className="divide-y divide-slate-100">
                  {announcements.map((a) => (
                    <li key={a.id} className="px-5 py-3">
                      <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                      <p className="text-xs text-slate-500">
                        {formatCompact(a.createdAt)} · {a.group ? a.group.name : "Tüm kurum"}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{a.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <CardBody>
                  <p className="text-sm text-slate-500">Duyuru yok.</p>
                </CardBody>
              )}
            </Card>
            {notes.length ? (
              <Card>
                <CardHeader title="Öğretmen notları" />
                <ul className="divide-y divide-slate-100">
                  {notes.map((n) => (
                    <li key={n.id} className="px-5 py-3">
                      <p className="text-xs text-slate-500">
                        {NOTE_KIND_LABEL[n.kind]} · {n.author ? `${n.author.user.firstName} ${n.author.user.lastName}` : ""} · {formatCompact(n.createdAt)}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{n.text}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
            <Card>
              <CardBody className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                <span>
                  {student.center.name}
                  {student.center.phone ? ` · ${student.center.phone}` : ""}
                </span>
                <ActionForm action={unlinkGuardianAction}>
                  <input type="hidden" name="guardianId" value={id} />
                  <SubmitButton variant="ghost" size="sm" className="text-slate-500" pendingText="…" confirmMessage="Bu öğrencinin bağlantısı hesabınızdan kaldırılsın mı?">
                    Bağlantıyı kaldır
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
