import { z } from "zod";
import { db } from "@/server/db";
import { clientIp, paymentLink, paymentReturnPrefix, requireRole } from "@/server/mobile/auth";
import { packagesJson, packageSummary } from "@/server/mobile/commerce";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { createLessonPackage, startPackageCheckout } from "@/server/packages";

/** Paketlerim: kalan ders, paketten alınan dersler, iade önizlemesi. */
export const GET = withUser(async ({ user }) => {
  requireRole(user, "STUDENT");
  return json(await packagesJson(user.id));
});

const schema = z.object({
  offeringId: z.string().min(1),
  durationMinutes: z.number().int(),
  lessons: z.number().int().optional(),
  // Düzenli ders: ilk ders saati ve hafta sayısı; ödeme sonrası her hafta aynı saatte talep oluşur
  recurring: z
    .object({
      startAt: z.iso.datetime({ offset: true, error: "Geçersiz saat." }),
      weeks: z.number().int(),
      learnerName: z.string().trim().min(2, "Dersin kimin için olduğunu yazın.").max(80),
      learnerGrade: z.string().trim().max(40).optional(),
      note: z.string().trim().max(1000).optional(),
    })
    .optional(),
  consent: z.literal(true, { error: "Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın." }),
});

/**
 * Paket ders satın alma: { offeringId, durationMinutes, lessons, consent } ya da düzenli ders için { …, recurring } →
 * 201 { package, payment }. Ödeme WebView'da; dönüşte GET /paketler/{id} sorgulanır.
 */
export const POST = withUser(async ({ request, user }) => {
  requireRole(user, "STUDENT");
  const input = await readBody(request, schema);
  const recurring = input.recurring
    ? { startAt: new Date(input.recurring.startAt), weeks: input.recurring.weeks, learnerName: input.recurring.learnerName, learnerGrade: input.recurring.learnerGrade ?? null, note: input.recurring.note ?? null }
    : null;
  const pkg = await createLessonPackage(user.id, { offeringId: input.offeringId, durationMinutes: input.durationMinutes, lessons: input.lessons ?? 0, recurring });
  const redirectUrl = await startPackageCheckout(pkg.id, user.id, clientIp(request) ?? "127.0.0.1");
  const full = await db.lessonPackage.findUniqueOrThrow({ where: { id: pkg.id }, include: { teacher: { select: { slug: true, photoKey: true, user: { select: { firstName: true, lastName: true } } } } } });
  return json({ package: packageSummary(full), payment: { url: await paymentLink(user.id, redirectUrl), returnUrlPrefix: paymentReturnPrefix() } }, 201);
});
