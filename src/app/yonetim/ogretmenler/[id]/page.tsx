import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingRow } from "@/components/panel/booking-ui";
import { ExceptionsEditor, WeeklyAvailabilityEditor } from "@/components/teacher/availability-editor";
import { OfferingsEditor } from "@/components/teacher/offerings-editor";
import { ProfileForm } from "@/components/teacher/profile-form";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, EmptyState, StatCard } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatCompact, formatDate, toLocalDateString } from "@/lib/dates";
import { DOCUMENT_STATUS, DOCUMENT_TYPE_LABEL, TEACHER_STATUS, VERIFICATION_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { decryptText, maskIdentityNumber } from "@/server/crypto";
import { db } from "@/server/db";
import { teacherBalances } from "@/server/ledger";
import { loadSettings } from "@/server/settings";
import { getCatalog, getCities } from "@/server/site";
import { uploadUrl } from "@/server/storage";
import { loadTeacherEditorData } from "@/server/teacher-editor-data";
import { profileChecklist } from "@/server/teachers";
import { AccountForm, DocumentReviewForm, FlagsForm, PayoutRecordForm, ResetPasswordForm, StatusButtons, UserStatusForm } from "./admin-forms";

export const metadata: Metadata = { title: "Öğretmen" };

const SECTIONS = [
  { key: "genel", label: "Genel" },
  { key: "profil", label: "Profil" },
  { key: "dersler", label: "Dersler ve fiyatlar" },
  { key: "takvim", label: "Takvim" },
  { key: "finans", label: "Finans" },
  { key: "belgeler", label: "Belgeler" },
] as const;

export default async function AdminTeacherPage({ params, searchParams }: PageProps<"/yonetim/ogretmenler/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;
  const section = String((await searchParams).bolum ?? "genel");
  const user = await db.user.findUnique({ where: { id }, include: { teacherProfile: true } });
  if (!user?.teacherProfile) notFound();
  const teacher = user.teacherProfile;
  const [checklist, settings, pendingDocuments] = await Promise.all([
    profileChecklist(id),
    loadSettings(),
    db.teacherDocument.count({ where: { teacherId: id, status: "PENDING" } }),
  ]);

  return (
    <>
      <Link href="/yonetim/ogretmenler" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Öğretmenler
      </Link>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">
          {user.firstName} {user.lastName}
        </h1>
        <Badge tone={TEACHER_STATUS[teacher.status].tone}>{TEACHER_STATUS[teacher.status].label}</Badge>
        <Badge tone={VERIFICATION_STATUS[teacher.verificationStatus].tone}>{VERIFICATION_STATUS[teacher.verificationStatus].label}</Badge>
        {teacher.status === "PUBLISHED" ? (
          <Link href={`/ogretmen/${teacher.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            Profil sayfası <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-sm font-semibold sm:w-fit">
        {SECTIONS.map((s) => (
          <Link key={s.key} href={`/yonetim/ogretmenler/${id}?bolum=${s.key}`} className={cn("shrink-0 rounded-lg px-4 py-1.5", section === s.key ? "bg-white text-brand-700 shadow-xs" : "text-slate-600")}>
            {s.label}
            {s.key === "belgeler" && pendingDocuments ? <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-xs text-amber-950">{pendingDocuments}</span> : null}
          </Link>
        ))}
      </nav>

      {section === "profil" ? <ProfileSection teacherId={id} /> : null}
      {section === "dersler" ? <OfferingsSection teacherId={id} /> : null}
      {section === "takvim" ? <AvailabilitySection teacherId={id} /> : null}
      {section === "finans" ? <FinanceSection teacherId={id} /> : null}
      {section === "belgeler" ? <DocumentsSection teacherId={id} /> : null}
      {section === "genel" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Yayın durumu" />
              <CardBody className="space-y-4">
                {!checklist.complete ? (
                  <Alert tone="warning" title="Profilde eksikler var">
                    {checklist.items.filter((i) => !i.done).map((i) => i.label).join(", ")}
                  </Alert>
                ) : null}
                <StatusButtons teacherId={id} status={teacher.status} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Doğrulama, vitrin ve komisyon" />
              <CardBody>
                <FlagsForm
                  teacherId={id}
                  verificationStatus={teacher.verificationStatus}
                  isFeatured={teacher.isFeatured}
                  commissionPercent={teacher.commissionRateBps === null ? "" : String(teacher.commissionRateBps / 100)}
                  defaultPercent={String(settings.commissionRateBps / 100)}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="İstatistikler" />
              <CardBody>
                <DescriptionList
                  items={[
                    { label: "Puan", value: teacher.ratingCount ? `${teacher.ratingAvg} (${teacher.ratingCount})` : "—" },
                    { label: "Tamamlanan ders", value: teacher.completedLessons },
                    { label: "Ortalama yanıt", value: teacher.avgResponseMinutes === null ? "—" : `${teacher.avgResponseMinutes} dk` },
                    { label: "İptal / gelmeme", value: teacher.cancellationCount },
                    { label: "Beyan", value: teacher.statusDeclarationAt ? formatCompact(teacher.statusDeclarationAt) : "Verilmedi" },
                    { label: "Kayıt", value: formatCompact(user.createdAt) },
                    { label: "Son giriş", value: user.lastLoginAt ? formatCompact(user.lastLoginAt) : "Hiç giriş yapmadı" },
                  ]}
                />
              </CardBody>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Hesap" action={<UserStatusForm userId={id} status={user.status} />} />
              <CardBody className="space-y-5">
                {user.status === "SUSPENDED" ? <Alert tone="error">Hesap kapalı: öğretmen giriş yapamaz.</Alert> : null}
                <AccountForm user={user} />
                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-2 text-sm text-slate-600">Şifresini unutan öğretmen için yeni geçici şifre üretin.{user.mustChangePassword ? " (Öğretmen henüz kendi şifresini belirlemedi.)" : ""}</p>
                  <ResetPasswordForm userId={id} />
                </div>
              </CardBody>
            </Card>
            <RecentBookings teacherId={id} />
          </div>
        </div>
      ) : null}
    </>
  );
}

async function ProfileSection({ teacherId }: { teacherId: string }) {
  const [data, cities] = await Promise.all([loadTeacherEditorData(teacherId), getCities()]);
  return (
    <Card>
      <CardBody className="p-6">
        <ProfileForm values={data.profile} cities={cities.map((c) => ({ id: c.id, name: c.name }))} initialDistricts={data.districts} isAdmin />
      </CardBody>
    </Card>
  );
}

async function OfferingsSection({ teacherId }: { teacherId: string }) {
  const [data, catalog] = await Promise.all([loadTeacherEditorData(teacherId), getCatalog()]);
  return (
    <Card>
      <CardBody className="p-6">
        <OfferingsEditor teacherId={teacherId} catalog={catalog} offerings={data.offerings} commissionBps={data.commissionBps} />
      </CardBody>
    </Card>
  );
}

async function AvailabilitySection({ teacherId }: { teacherId: string }) {
  const data = await loadTeacherEditorData(teacherId);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <Card>
        <CardHeader title="Haftalık şablon" />
        <CardBody>
          <WeeklyAvailabilityEditor teacherId={teacherId} initialRules={data.rules} bufferMinutes={data.teacher.bufferMinutes} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="İzin ve ek saatler" />
        <CardBody>
          <ExceptionsEditor teacherId={teacherId} exceptions={data.exceptions} minDate={toLocalDateString(new Date())} />
        </CardBody>
      </Card>
    </div>
  );
}

async function FinanceSection({ teacherId }: { teacherId: string }) {
  const [teacher, balances, entries] = await Promise.all([
    db.teacherProfile.findUniqueOrThrow({ where: { userId: teacherId } }),
    teacherBalances(teacherId),
    db.ledgerEntry.findMany({ where: { teacherId }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  let identity = "—";
  if (teacher.payoutIdentityNumberEnc) {
    try {
      identity = maskIdentityNumber(decryptText(teacher.payoutIdentityNumberEnc));
    } catch {
      identity = "çözülemedi";
    }
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Bekleyen" value={formatMoney(balances.pending)} />
        <StatCard label="Ödenebilir" value={formatMoney(balances.available)} />
        <StatCard label="Ödenen" value={formatMoney(balances.paid)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Ödeme bilgileri" />
          <CardBody className="space-y-4">
            <DescriptionList
              items={[
                { label: "Hesap sahibi", value: teacher.payoutLegalName ?? "—" },
                { label: "IBAN", value: teacher.payoutIban ?? "Girilmedi" },
                { label: "T.C. kimlik", value: identity },
                ...(teacher.subMerchantKey ? [{ label: "iyzico alt üye", value: teacher.subMerchantKey }] : []),
              ]}
            />
            {balances.available > 0 ? <PayoutRecordForm teacherId={teacherId} available={String(balances.available / 100)} /> : <p className="text-sm text-slate-500">Ödenebilir bakiye yok.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Son hareketler" />
          <CardBody className="space-y-1 text-sm">
            {entries.length === 0 ? <p className="text-slate-500">Hareket yok.</p> : null}
            {entries.map((e) => (
              <div key={e.id} className="flex justify-between gap-3 border-b border-slate-50 py-1">
                <span className="text-slate-600">
                  <span className="text-xs text-slate-400">{formatCompact(e.createdAt)}</span> {e.description}
                </span>
                <span className={e.amount < 0 ? "text-slate-400" : "font-semibold text-emerald-700"}>{formatMoney(e.amount)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

async function DocumentsSection({ teacherId }: { teacherId: string }) {
  const documents = await db.teacherDocument.findMany({ where: { teacherId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  return (
    <Card>
      <CardHeader title="Belgeler" description="Kimlik, diploma ve adli sicil kaydını kontrol ettikten sonra Genel sekmesinden “Onaylı öğretmen” yapın." />
      <CardBody>
        {documents.length === 0 ? (
          <EmptyState icon={<FileText className="size-8" />} title="Öğretmen henüz belge yüklemedi" description="Öğretmen panelindeki “Belgelerim” sayfasından yükleyebilir." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <li key={doc.id} className="space-y-3 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                    {DOCUMENT_TYPE_LABEL[doc.type]} <Badge tone={DOCUMENT_STATUS[doc.status].tone}>{DOCUMENT_STATUS[doc.status].label}</Badge>
                  </p>
                  <a href={uploadUrl(doc.fileKey) ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                    {doc.fileName} <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </div>
                <p className="text-xs text-slate-400">
                  Yüklendi: {formatCompact(doc.createdAt)}
                  {doc.reviewedAt ? ` · İncelendi: ${formatCompact(doc.reviewedAt)}` : ""}
                  {doc.note ? ` · Not: ${doc.note}` : ""}
                </p>
                {doc.type === "CRIMINAL_RECORD" ? (
                  <p className="text-sm text-slate-700">
                    Belge tarihi: <strong>{doc.issuedAt ? formatDate(doc.issuedAt) : "girilmemiş"}</strong>
                    {doc.issuedAt && doc.createdAt.getTime() - doc.issuedAt.getTime() > 30 * 86_400_000 ? <span className="ml-1 font-semibold text-rose-600">(30 günden eski)</span> : null} · Barkod:{" "}
                    <span className="font-mono">{doc.barcode ?? "girilmemiş"}</span>
                  </p>
                ) : null}
                {doc.status === "PENDING" ? <DocumentReviewForm documentId={doc.id} needsBarcode={doc.type === "CRIMINAL_RECORD"} /> : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

async function RecentBookings({ teacherId }: { teacherId: string }) {
  const bookings = await db.booking.findMany({
    where: { teacherId, status: { not: "PENDING_PAYMENT" } },
    orderBy: { startAt: "desc" },
    take: 8,
    include: { student: { select: { firstName: true, lastName: true } } },
  });
  return (
    <Card>
      <CardHeader title="Son randevular" />
      <CardBody className="space-y-2">
        {bookings.length === 0 ? <EmptyState title="Randevu yok" /> : null}
        {bookings.map((b) => (
          <BookingRow key={b.id} booking={{ ...b, counterpart: `${b.student.firstName} ${b.student.lastName}` }} href={`/yonetim/randevular/${b.id}`} />
        ))}
      </CardBody>
    </Card>
  );
}
