import type { NextRequest } from "next/server";
import { csvMoney, csvResponse, toCsv } from "@/lib/csv";
import { formatCompact, toLocalDateString } from "@/lib/dates";
import { BOOKING_STATUS, MODE_LABEL, PAYMENT_STATUS } from "@/lib/labels";
import { adminBookingWhere } from "@/server/admin-bookings";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";

const MAX_ROWS = 20_000;
const fullName = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName}`;

/** Yönetim paneli Excel/CSV çıktıları: randevular, ödemeler, hakediş ödemeleri. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/yonetim/disa-aktar/[tur]">) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Yetkisiz.", { status: 403 });
  const { tur } = await params;
  const today = toLocalDateString(new Date());

  if (tur === "randevular") {
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    const status = request.nextUrl.searchParams.get("durum") ?? "";
    const bookings = await db.booking.findMany({
      where: adminBookingWhere(q, status),
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      include: { teacher: { select: { user: { select: { firstName: true, lastName: true } } } }, student: { select: { firstName: true, lastName: true, email: true, phone: true } } },
    });
    const csv = toCsv(
      ["Randevu no", "Oluşturma", "Ders zamanı", "Süre (dk)", "Kademe", "Ders", "Hizmet", "Şekil", "Öğretmen", "Veli/öğrenci", "E-posta", "Telefon", "Öğrenci adı", "Durum", "Tutar (TL)", "Komisyon (TL)", "Öğretmen payı (TL)", "İade (TL)", "Test dersi"],
      bookings.map((b) => [
        b.code,
        formatCompact(b.createdAt),
        formatCompact(b.startAt),
        b.durationMinutes,
        b.levelName,
        b.subjectName,
        b.serviceName,
        MODE_LABEL[b.mode],
        fullName(b.teacher.user),
        fullName(b.student),
        b.student.email,
        b.student.phone,
        b.learnerName,
        BOOKING_STATUS[b.status]?.label ?? b.status,
        csvMoney(b.price),
        csvMoney(b.commissionAmount),
        csvMoney(b.teacherAmount),
        csvMoney(b.refundedAmount),
        b.isTest ? "Evet" : "",
      ]),
    );
    return csvResponse(`randevular-${today}.csv`, csv);
  }

  if (tur === "odemeler") {
    const payments = await db.payment.findMany({
      where: { status: { not: "INITIATED" } },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      include: {
        booking: { select: { code: true, student: { select: { firstName: true, lastName: true } } } },
        creditPurchase: { select: { code: true, student: { select: { firstName: true, lastName: true } } } },
        subscription: { select: { code: true, student: { select: { firstName: true, lastName: true } } } },
        groupEnrollment: { select: { code: true, student: { select: { firstName: true, lastName: true } } } },
        refunds: { where: { status: "SUCCEEDED" } },
      },
    });
    const csv = toCsv(
      ["Tarih", "Randevu / paket no", "Veli/öğrenci", "Sağlayıcı", "Sağlayıcı işlem no", "Tutar (TL)", "İade edilen (TL)", "Durum", "Hata"],
      payments.map((p) => [
        formatCompact(p.createdAt),
        p.booking?.code ?? p.creditPurchase?.code ?? p.subscription?.code ?? p.groupEnrollment?.code ?? "",
        fullName((p.booking ?? p.creditPurchase ?? p.subscription ?? p.groupEnrollment)?.student ?? { firstName: "", lastName: "" }),
        p.provider,
        p.providerPaymentId,
        csvMoney(p.amount),
        csvMoney(p.refunds.reduce((sum, r) => sum + r.amount, 0)),
        PAYMENT_STATUS[p.status]?.label ?? p.status,
        p.failureReason,
      ]),
    );
    return csvResponse(`odemeler-${today}.csv`, csv);
  }

  if (tur === "hakedisler") {
    const payouts = await db.payout.findMany({
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      include: { teacher: { select: { payoutLegalName: true, payoutIban: true, user: { select: { firstName: true, lastName: true } } } }, createdBy: { select: { firstName: true, lastName: true } } },
    });
    const csv = toCsv(
      ["Tarih", "Öğretmen", "Hesap sahibi", "IBAN", "Tutar (TL)", "Yöntem", "Açıklama", "Kaydeden"],
      payouts.map((p) => [
        formatCompact(p.createdAt),
        fullName(p.teacher.user),
        p.teacher.payoutLegalName,
        p.teacher.payoutIban,
        csvMoney(p.amount),
        p.method === "MANUAL_TRANSFER" ? "Havale/EFT" : "Ödeme kuruluşu",
        p.reference,
        p.createdBy ? fullName(p.createdBy) : "Sistem",
      ]),
    );
    return csvResponse(`hakedis-odemeleri-${today}.csv`, csv);
  }

  return new Response("Bulunamadı.", { status: 404 });
}
