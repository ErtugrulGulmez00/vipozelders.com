import { z } from "zod";
import { db } from "@/server/db";
import { enrollInGroup, startGroupCheckout } from "@/server/groups";
import { clientIp, optionalUser, paymentLink, paymentReturnPrefix, requireRole } from "@/server/mobile/auth";
import { groupCourseJson } from "@/server/mobile/commerce";
import { json, notFound, readBody } from "@/server/mobile/http";
import { publicRoute, withUser } from "@/server/mobile/route";

/** Grup dersi ayrıntısı: program, kontenjan; oturum açmış öğrenci için kaydı ve yapabilecekleri. */
export const GET = publicRoute<{ code: string }>(async ({ request, params }) => {
  const viewer = await optionalUser(request);
  return json(await groupCourseJson(params.code, viewer));
});

const schema = z.object({
  learnerName: z.string().trim().max(80).optional(),
  couponCode: z.string().trim().max(30).optional(),
  consent: z.literal(true, { error: "Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın." }),
});

/** Kayıt ve ödeme: yer ayrılır, ödeme WebView'da → 201 { enrollment, payment }; dönüşte GET /grup-kayitlari/{id}. */
export const POST = withUser<{ code: string }>(async ({ request, user, params }) => {
  requireRole(user, "STUDENT");
  const input = await readBody(request, schema);
  const course = await db.groupCourse.findUnique({ where: { code: params.code }, select: { id: true } });
  if (!course) throw notFound("Grup dersi bulunamadı.");
  const enrollment = await enrollInGroup(user.id, course.id, input.learnerName ?? null, new Date(), input.couponCode ?? null);
  const redirectUrl = await startGroupCheckout(enrollment.id, user.id, clientIp(request) ?? "127.0.0.1");
  return json({ enrollment: { id: enrollment.id, code: enrollment.code, price: enrollment.price }, payment: { url: await paymentLink(user.id, redirectUrl), returnUrlPrefix: paymentReturnPrefix() } }, 201);
});
