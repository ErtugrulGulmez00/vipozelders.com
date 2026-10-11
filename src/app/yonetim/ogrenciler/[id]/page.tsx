import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingRow } from "@/components/panel/booking-ui";
import { Card, CardBody, CardHeader, DescriptionList, EmptyState } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { ACCOUNT_TYPE_LABEL } from "@/lib/labels";
import { shortName } from "@/lib/text";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { UserStatusForm } from "../../ogretmenler/[id]/admin-forms";

export const metadata: Metadata = { title: "Öğrenci" };

export default async function AdminStudentPage({ params }: PageProps<"/yonetim/ogrenciler/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    include: {
      studentProfile: { include: { city: true, learners: true } },
      bookingsAsStudent: {
        orderBy: { startAt: "desc" },
        take: 30,
        include: { teacher: { select: { user: { select: { firstName: true, lastName: true } } } } },
      },
    },
  });
  if (!user || user.role !== "STUDENT") notFound();

  return (
    <>
      <Link href="/yonetim/ogrenciler" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Öğrenciler
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">
        {user.firstName} {user.lastName}
      </h1>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader title="Hesap" action={<UserStatusForm userId={user.id} status={user.status} />} />
          <CardBody>
            <DescriptionList
              items={[
                { label: "E-posta", value: `${user.email ?? "—"}${user.emailVerifiedAt ? " ✓" : " (doğrulanmadı)"}` },
                { label: "Telefon", value: user.phone ?? "—" },
                { label: "Tip", value: user.studentProfile ? ACCOUNT_TYPE_LABEL[user.studentProfile.accountType] : "—" },
                { label: "İl", value: user.studentProfile?.city?.name ?? "—" },
                { label: "Öğrenciler", value: user.studentProfile?.learners.map((l) => `${l.name}${l.gradeName ? ` (${l.gradeName})` : ""}`).join(", ") || "—" },
                { label: "KVKK onayı", value: user.studentProfile ? formatCompact(user.studentProfile.kvkkConsentAt) : "—" },
                { label: "Pazarlama izni", value: user.studentProfile?.marketingConsent ? "Var" : "Yok" },
                { label: "Kayıt", value: formatCompact(user.createdAt) },
                { label: "Son giriş", value: user.lastLoginAt ? formatCompact(user.lastLoginAt) : "—" },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Randevular" />
          <CardBody className="space-y-2">
            {user.bookingsAsStudent.length === 0 ? <EmptyState title="Randevu yok" /> : null}
            {user.bookingsAsStudent.map((b) => (
              <BookingRow key={b.id} booking={{ ...b, counterpart: shortName(b.teacher.user) }} href={`/yonetim/randevular/${b.id}`} />
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
