import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/center/center-client";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { buildSeating, parseRooms, type Room } from "@/lib/center/seating";
import { requireCenter } from "@/server/center/context";
import { CenterError } from "@/server/center/errors";
import { getExamOrThrow } from "@/server/center/exams";
import { db } from "@/server/db";
import { ExamHeader } from "../exam-header";

export const metadata: Metadata = { title: "Kelebek sınav düzeni" };

/** Kelebek sistemi: seçilen sınıfların öğrencileri salonlara karışık yerleştirilir; liste yazdırılır. */
export default async function SeatingPage({ params, searchParams }: PageProps<"/kurum/denemeler/[id]/kelebek">) {
  const ctx = await requireCenter("exams.manage");
  const { id } = await params;
  const sp = await searchParams;
  const exam = await getExamOrThrow(ctx, id).catch((error) => {
    if (error instanceof CenterError) notFound();
    throw error;
  });
  const groups = await db.centerGroup.findMany({ where: { centerId: ctx.center.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, _count: { select: { students: true } } } });
  const selected = ([] as string[]).concat(sp.grup ?? []).filter((g) => groups.some((x) => x.id === g));
  const roomsText = String(sp.salonlar ?? "");
  let rooms: Room[] = [];
  let error: string | null = null;
  try {
    rooms = roomsText ? parseRooms(roomsText) : [];
  } catch (e) {
    error = (e as Error).message;
  }
  const students = selected.length
    ? await db.centerStudent.findMany({
        where: { centerId: ctx.center.id, status: "ACTIVE", groups: { some: { groupId: { in: selected } } } },
        select: { id: true, firstName: true, lastName: true, studentNumber: true, groups: { where: { groupId: { in: selected } }, select: { group: { select: { name: true } } } } },
      })
    : [];
  const result = rooms.length && students.length ? buildSeating(students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, number: s.studentNumber, group: s.groups[0]?.group.name ?? "" })), rooms, exam.id.length + exam.date.getUTCDate()) : null;
  const capacity = rooms.reduce((t, r) => t + r.capacity, 0);

  return (
    <>
      <ExamHeader exam={exam} active="kelebek" />
      <Card className="mb-6 print:hidden">
        <CardHeader title="Salonlar ve sınıflar" description="Farklı sınıflardan öğrenciler sırayla dağıtılır; aynı sınıftan iki öğrenci ardışık sıraya düşmez." />
        <CardBody>
          <form method="get" className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Salonlar ve kapasite</span>
              <textarea name="salonlar" rows={5} defaultValue={roomsText || "A salonu: 20\nB salonu: 20"} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
              <span className="mt-1 block text-xs text-slate-500">Her satıra “Salon adı: kişi sayısı”.</span>
            </label>
            <fieldset className="text-sm">
              <legend className="mb-1 font-medium text-slate-700">Sınava girecek sınıflar</legend>
              <div className="grid max-h-40 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2">
                    <input type="checkbox" name="grup" value={g.id} defaultChecked={selected.includes(g.id)} className="size-4 accent-brand-600" />
                    {g.name} <span className="text-xs text-slate-500">({g._count.students})</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="lg:col-span-2">
              <button type="submit" className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
                Düzeni oluştur
              </button>
            </div>
          </form>
        </CardBody>
      </Card>
      {error ? <Alert tone="warning" className="mb-4">{error}</Alert> : null}
      {result ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <p className="text-sm text-slate-600">
              {students.length} öğrenci · {rooms.length} salon · kapasite {capacity}
            </p>
            <PrintButton />
          </div>
          {result.unplaced.length ? <Alert tone="warning" className="mb-4">Kapasite yetmedi: {result.unplaced.length} öğrenci yerleşmedi ({result.unplaced.map((s) => s.name).join(", ")}). Salon ekleyin ya da kapasiteyi artırın.</Alert> : null}
          <div className="grid gap-6 md:grid-cols-2 print:block">
            {rooms.map((room) => {
              const seats = result.seats.filter((s) => s.room === room.name);
              if (!seats.length) return null;
              return (
                <Card key={room.name} className="print:mb-8 print:break-inside-avoid print:shadow-none">
                  <CardHeader title={`${room.name} · ${exam.name}`} description={`${seats.length} öğrenci`} />
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">Sıra</th>
                        <th className="px-2 py-2 font-medium">Öğrenci</th>
                        <th className="px-2 py-2 font-medium">No</th>
                        <th className="px-2 py-2 font-medium">Sınıf</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {seats.map((s) => (
                        <tr key={s.student.id}>
                          <td className="px-4 py-1.5 font-semibold">{s.seat}</td>
                          <td className="px-2 py-1.5">{s.student.name}</td>
                          <td className="px-2 py-1.5 text-slate-500">{s.student.number ?? "—"}</td>
                          <td className="px-2 py-1.5 text-slate-500">{s.student.group}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}
    </>
  );
}
