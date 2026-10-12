import { BarChart3, ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import { DateNav } from "@/components/center/center-ui";
import { buttonClasses, LinkButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { isDateString, minutesToTime, toLocalDateString } from "@/lib/dates";
import { lessonsForDate } from "@/server/center/attendance";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Yoklama" };

export default async function AttendancePage({ searchParams }: PageProps<"/kurum/yoklama">) {
  const ctx = await requireCenter("attendance.take");
  const sp = await searchParams;
  const today = toLocalDateString(new Date());
  const date = isDateString(String(sp.tarih ?? "")) ? String(sp.tarih) : today;
  const groupId = String(sp.grup ?? "");
  const mine = sp.benim === "1";
  const [allLessons, groups] = await Promise.all([
    lessonsForDate(ctx.center.id, date, mine ? { teacherId: ctx.member.id } : {}),
    db.centerGroup.findMany({ where: { centerId: ctx.center.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const lessons = groupId ? allLessons.filter((l) => l.groupId === groupId) : allLessons;
  const href = (d: string) => `/kurum/yoklama?tarih=${d}${groupId ? `&grup=${groupId}` : ""}${mine ? "&benim=1" : ""}`;
  return (
    <>
      <PageHeader
        title="Yoklama"
        description="Programdaki her ders için tek dokunuşla yoklama; gelmeyenlerin velisine otomatik bildirim."
        actions={
          <LinkButton href="/kurum/yoklama/rapor" size="sm" variant="outline">
            <BarChart3 className="size-4" aria-hidden /> Devamsızlık raporu
          </LinkButton>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DateNav date={date} today={today} hrefFor={href} />
        <Form action="/kurum/yoklama" className="flex flex-wrap gap-2">
          <input type="hidden" name="tarih" value={date} />
          <Select name="grup" defaultValue={groupId} className="h-9 w-44" aria-label="Sınıf">
            <option value="">Tüm sınıflar</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
          {ctx.member.role === "TEACHER" ? (
            <Select name="benim" defaultValue={mine ? "1" : ""} className="h-9 w-40" aria-label="Dersler">
              <option value="">Tüm dersler</option>
              <option value="1">Yalnız benim derslerim</option>
            </Select>
          ) : null}
          <button type="submit" className={buttonClasses("secondary", "sm", "h-9")}>
            Göster
          </button>
        </Form>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div>
          {lessons.length === 0 ? (
            <EmptyState icon={<ClipboardCheck className="size-8" />} title="Bu gün için programda ders yok" description="Haftalık programa ders ekleyebilir ya da sağdaki formla ek yoklama açabilirsiniz." />
          ) : (
            <Card className="divide-y divide-slate-100">
              {lessons.map((lesson) => {
                const link = `/kurum/yoklama/al?grup=${lesson.groupId}&tarih=${date}&baslangic=${lesson.startMinute}${lesson.slotId ? `&ders=${lesson.slotId}` : ""}`;
                return (
                  <div key={lesson.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {minutesToTime(lesson.startMinute)}–{minutesToTime(lesson.endMinute)} · {lesson.subject}
                      </p>
                      <p className="text-sm text-slate-500">
                        {lesson.groupName} · {lesson.studentCount} öğrenci
                        {lesson.teacherName ? ` · ${lesson.teacherName}` : ""}
                        {lesson.room ? ` · ${lesson.room}` : ""}
                      </p>
                      {lesson.session?.takenAt ? (
                        <p className="mt-1 flex flex-wrap gap-1.5">
                          <Badge tone="green">{lesson.session.present} geldi</Badge>
                          {lesson.session.absent ? <Badge tone="rose">{lesson.session.absent} gelmedi</Badge> : null}
                          {lesson.session.late ? <Badge tone="amber">{lesson.session.late} geç</Badge> : null}
                          {lesson.session.excused ? <Badge tone="sky">{lesson.session.excused} izinli</Badge> : null}
                        </p>
                      ) : null}
                    </div>
                    <LinkButton href={link} size="sm" variant={lesson.session?.takenAt ? "outline" : "primary"}>
                      {lesson.session?.takenAt ? "Düzenle" : "Yoklama al"}
                    </LinkButton>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
        <Card>
          <CardHeader title="Ek yoklama" description="Programda olmayan bir ders, deneme ya da etkinlik için" />
          <CardBody>
            <Form action="/kurum/yoklama/al" className="space-y-3">
              <input type="hidden" name="tarih" value={date} />
              <Field label="Sınıf">
                <Select name="grup" required defaultValue={groupId}>
                  <option value="">Seçin</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Başlangıç">
                  <Input name="saat" type="time" defaultValue="10:00" required />
                </Field>
                <Field label="Bitiş">
                  <Input name="bitis" type="time" defaultValue="12:00" required />
                </Field>
              </div>
              <Field label="Ders / etkinlik">
                <Input name="konu" placeholder="Örn: Deneme sınavı" required />
              </Field>
              <button type="submit" className={buttonClasses("secondary", "sm")}>
                Yoklama listesini aç
              </button>
            </Form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
