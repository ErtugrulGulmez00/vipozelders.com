import { FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { BookingStatusBadge } from "@/components/panel/booking-ui";
import { Input, Select } from "@/components/ui/form";
import { Card, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { BOOKING_STATUS, MODE_LABEL } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { adminBookingWhere } from "@/server/admin-bookings";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { TestLessonForm } from "./test-lesson-form";

export const metadata: Metadata = { title: "Randevular" };

const PAGE_SIZE = 50;

export default async function AdminBookingsPage({ searchParams }: PageProps<"/yonetim/randevular">) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const status = String(params.durum ?? "");
  const q = String(params.q ?? "").trim();
  const page = Math.max(1, Number(params.sayfa) || 1);
  const where = adminBookingWhere(q, status);
  const exportQuery = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { durum: status } : {}) });
  const [total, bookings, teacherOptions, studentOptions] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { teacher: { select: { user: { select: { firstName: true, lastName: true } } } }, student: { select: { firstName: true, lastName: true } } },
    }),
    db.user.findMany({ where: { role: "TEACHER", status: "ACTIVE" }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
    db.user.findMany({ where: { role: "STUDENT", status: "ACTIVE", email: { not: null } }, orderBy: { createdAt: "desc" }, take: 200, select: { email: true, firstName: true, lastName: true } }),
  ]);

  return (
    <>
      <PageHeader title="Randevular" description={`${total} kayıt`} />
      <TestLessonForm
        teachers={teacherOptions.map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}` }))}
        students={studentOptions.map((s) => ({ email: s.email!, name: `${s.firstName} ${s.lastName}` }))}
      />
      <Form action="/yonetim/randevular" className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Kod, öğrenci, veli e-postası, öğretmen" className="w-80" />
        <Select name="durum" defaultValue={status} className="w-56">
          <option value="">Tüm durumlar</option>
          {Object.entries(BOOKING_STATUS).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </Select>
        <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white">
          Filtrele
        </button>
        <a href={`/api/yonetim/disa-aktar/randevular?${exportQuery}`} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50" download>
          <FileSpreadsheet className="size-4" aria-hidden /> Excel’e aktar
        </a>
      </Form>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Kod</Th>
              <Th>Ders</Th>
              <Th>Öğretmen</Th>
              <Th>Veli / öğrenci</Th>
              <Th>Ders zamanı</Th>
              <Th>Tutar</Th>
              <Th>Durum</Th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <Td>
                  <Link href={`/yonetim/randevular/${b.id}`} className="font-semibold text-brand-700 hover:underline">
                    {b.code}
                  </Link>
                  <p className="text-xs text-slate-400">{formatCompact(b.createdAt)}</p>
                </Td>
                <Td>
                  {b.levelName} {b.subjectName}
                  <p className="text-xs text-slate-400">
                    {b.serviceName} · {MODE_LABEL[b.mode]}
                  </p>
                </Td>
                <Td>
                  {b.teacher.user.firstName} {b.teacher.user.lastName}
                </Td>
                <Td>
                  {b.student.firstName} {b.student.lastName}
                  <p className="text-xs text-slate-400">{b.learnerName}</p>
                </Td>
                <Td className="whitespace-nowrap">{formatCompact(b.startAt)}</Td>
                <Td>
                  {formatMoney(b.price)}
                  {b.refundedAmount ? <p className="text-xs text-sky-700">İade {formatMoney(b.refundedAmount)}</p> : null}
                </Td>
                <Td>
                  <BookingStatusBadge status={b.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Pagination
        page={page}
        pageCount={Math.ceil(total / PAGE_SIZE)}
        hrefFor={(p) => `/yonetim/randevular?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { durum: status } : {}), sayfa: String(p) })}`}
      />
    </>
  );
}
