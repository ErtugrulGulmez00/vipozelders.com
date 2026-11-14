import { Inbox, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { AddToCoachButton, InquiryActions } from "@/components/panel/inquiry-actions";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { INQUIRY_MODE_LABEL, teacherInquiries } from "@/server/teacher-inquiries";
import { toWhatsAppNumber } from "@/server/whatsapp";

export const metadata: Metadata = { title: "Ders talepleri" };

const STATUS = {
  PENDING: { label: "Yanıt bekliyor", tone: "amber" },
  ACCEPTED: { label: "Kabul ettiniz", tone: "green" },
  DECLINED: { label: "Geri çevrildi", tone: "slate" },
} as const;

/** Vitrinden gelen ders talepleri: kabul edince velinin telefonu görünür; ücret ve saat veliyle konuşulur. */
export default async function TeacherInquiriesPage() {
  const user = await requireRole("TEACHER");
  await connection();
  const items = await teacherInquiries(user.id);
  return (
    <>
      <PageHeader
        title="Ders talepleri"
        description="Veliler profilinizden ders talebi gönderir. Kabul ederseniz velinin telefonunu görürsünüz ve öğrenci Pi Koç'unuza eklenir (hesabınız yoksa ücretsiz açılır). Ders saatini ve ücreti veliyle siz konuşursunuz, ödemeyi doğrudan size yapar."
      />
      {items.length ? (
        <div className="space-y-3">
          {items.map((q) => {
            const wa = q.status === "ACCEPTED" ? toWhatsAppNumber(q.phone) : null;
            return (
              <Card key={q.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {q.lessonName ?? "Ders belirtilmedi"}
                      {q.studentName ? <span className="font-normal text-slate-500"> · {q.studentName}{q.gradeName ? `, ${q.gradeName}` : ""}</span> : q.gradeName ? <span className="font-normal text-slate-500"> · {q.gradeName}</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatCompact(q.createdAt)} · {INQUIRY_MODE_LABEL[q.mode] ?? q.mode}
                    </p>
                  </div>
                  <Badge tone={STATUS[q.status].tone}>{STATUS[q.status].label}</Badge>
                </div>
                {q.preferredTimes ? <p className="mt-3 text-sm text-slate-700"><b>Uygun saatler:</b> {q.preferredTimes}</p> : null}
                {q.note ? <p className="mt-2 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{q.note}</p> : null}
                {q.status === "ACCEPTED" ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                    <span className="mr-auto font-semibold">{q.name}</span>
                    <a href={`tel:${q.phone}`} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold ring-1 ring-emerald-200 hover:bg-emerald-100">
                      <Phone className="size-4" aria-hidden /> {q.phone.replace(/^(\d{4})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4")}
                    </a>
                    {wa ? (
                      <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 font-semibold text-white hover:brightness-95">
                        <MessageCircle className="size-4" aria-hidden /> WhatsApp
                      </a>
                    ) : null}
                  </div>
                ) : null}
                {q.status === "ACCEPTED" ? (
                  q.centerStudentId ? (
                    <p className="mt-3 text-sm text-slate-600">
                      Öğrenci Pi Koç&apos;unuzda: program, ödev, deneme ve veli raporu oradan.{" "}
                      <a href={`/panel-sec?taraf=koc&next=${encodeURIComponent(`/koc/ogrenciler/${q.centerStudentId}`)}`} className="font-semibold text-brand-700 hover:underline">
                        Pi Koç&apos;ta aç
                      </a>
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                      <span>Öğrenci Pi Koç&apos;a eklenemedi; paketinizin öğrenci sınırı dolu olabilir.</span>
                      <AddToCoachButton inquiryId={q.id} />
                    </div>
                  )
                ) : q.status === "PENDING" ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-500">Kabul edince velinin adı ve telefonu görünür, öğrenci Pi Koç&apos;unuza eklenir.</p>
                    <InquiryActions inquiryId={q.id} />
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<Inbox className="size-8" />} title="Henüz ders talebi yok" description="Veliler profilinizden “Ders talebi gönder” dediğinde burada görünür; size e-postayla da haber veririz." />
      )}
    </>
  );
}
