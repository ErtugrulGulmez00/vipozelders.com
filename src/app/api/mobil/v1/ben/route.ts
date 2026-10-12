import { z } from "zod";
import { normalizePhone } from "@/lib/text";
import { db } from "@/server/db";
import { ApiError, json, readBody } from "@/server/mobile/http";
import { meJson } from "@/server/mobile/me";
import { withUser } from "@/server/mobile/route";

export const GET = withUser(async ({ user }) => json(await meJson(user.id)), { allowPasswordChange: true });

const updateSchema = z.object({
  firstName: z.string().trim().min(2, "Adınızı yazın.").max(50).optional(),
  lastName: z.string().trim().min(2, "Soyadınızı yazın.").max(50).optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  accountType: z.enum(["PARENT", "STUDENT"]).optional(),
  cityId: z.number().int().min(1).max(81).nullable().optional(),
  marketingConsent: z.boolean().optional(),
});

/** Profil güncelleme. Öğretmenler yalnızca telefonunu değiştirebilir (profil web panelinden düzenlenir). */
export const PATCH = withUser(async ({ request, user }) => {
  const input = await readBody(request, updateSchema);
  let phone: string | null | undefined;
  if (input.phone !== undefined) {
    phone = input.phone ? normalizePhone(input.phone) : null;
    if (input.phone && !phone) throw new ApiError(422, "VALIDATION", "Telefon numarası 05XX XXX XX XX biçiminde olmalı.", { phone: "Geçersiz numara." });
  }

  if (user.role === "TEACHER") {
    if (phone !== undefined) await db.user.update({ where: { id: user.id }, data: { phone } });
    return json(await meJson(user.id));
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      ...(input.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName ? { lastName: input.lastName } : {}),
      ...(phone !== undefined ? { phone } : {}),
      studentProfile: {
        update: {
          ...(input.accountType ? { accountType: input.accountType } : {}),
          ...(input.cityId !== undefined ? { cityId: input.cityId } : {}),
          ...(input.marketingConsent !== undefined ? { marketingConsent: input.marketingConsent } : {}),
        },
      },
    },
  });
  return json(await meJson(user.id));
});
