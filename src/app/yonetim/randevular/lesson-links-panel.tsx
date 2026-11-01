import { Link2 } from "lucide-react";
import Link from "next/link";
import { Badge, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact, formatLessonRange } from "@/lib/dates";
import { db } from "@/server/db";

/** Öğretmenlerin açtığı ödemesiz ders bağlantıları: serbest (yetkili öğretmen) ya da ücretli dersin telafisi, gerekçesiyle. */
export async function LessonLinksPanel() {
  const now = new Date();
  const links = await db.lessonLink.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      teacher: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
      booking: { select: { id: true, code: true, student: { select: { firstName: true, lastName: true } } } },
      sourceBooking: { select: { id: true, code: true, status: true, refundedAmount: true } },
    },
  });
  if (links.length === 0) return null;
  return (
    <details className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
        <Link2 className="size-4" aria-hidden /> Ders bağlantıları ({links.length}) — öğretmenlerin açtığı ödemesiz dersler
      </summary>
      <p className="mt-2 text-sm text-slate-600">Telafi bağlantısı yalnızca ücreti ödenmiş ve öğretmenle öğrencinin birlikte katılmadığı online derse açılabilir, açılınca kaynak dersin sınıfı kapanır; serbest bağlantıyı yalnızca Öğretmenler → Genel’den yetki verilen öğretmen açar.</p>
      <Table className="mt-3">
        <thead>
          <tr>
            <Th>Oluşturma</Th>
            <Th>Öğretmen</Th>
            <Th>Ders saati</Th>
            <Th>Tür</Th>
            <Th>Gerekçe / not</Th>
            <Th>Durum</Th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => (
            <tr key={link.id}>
              <Td className="whitespace-nowrap">{formatCompact(link.createdAt)}</Td>
              <Td>
                <Link href={`/yonetim/ogretmenler/${link.teacher.userId}`} className="hover:underline">
                  {link.teacher.user.firstName} {link.teacher.user.lastName}
                </Link>
              </Td>
              <Td className="whitespace-nowrap">{formatLessonRange(link.startAt, link.endAt)}</Td>
              <Td>
                {link.sourceBooking ? (
                  <>
                    Telafi:{" "}
                    <Link href={`/yonetim/randevular/${link.sourceBooking.id}`} className="font-semibold text-brand-700 hover:underline">
                      {link.sourceBooking.code}
                    </Link>
                    {link.sourceBooking.refundedAmount > 0 || link.sourceBooking.status === "NO_SHOW_TEACHER" ? <p className="text-xs font-medium text-rose-600">Kaynak ders sonradan iade edildi</p> : null}
                  </>
                ) : (
                  "Serbest"
                )}
              </Td>
              <Td className="max-w-xs text-xs">{link.note ?? "—"}</Td>
              <Td>
                {link.booking ? (
                  <>
                    <Link href={`/yonetim/randevular/${link.booking.id}`} className="font-semibold text-brand-700 hover:underline">
                      {link.booking.code}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {link.booking.student.firstName} {link.booking.student.lastName}
                    </p>
                  </>
                ) : link.cancelledAt ? (
                  <Badge tone="slate">İptal</Badge>
                ) : link.endAt <= now ? (
                  <Badge tone="slate">Kullanılmadı</Badge>
                ) : (
                  <Badge tone="amber">Bekliyor</Badge>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </details>
  );
}
