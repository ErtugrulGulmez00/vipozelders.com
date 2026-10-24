"use server";

import { refresh } from "next/cache";
import { failure, success, type ActionState } from "@/lib/action-state";
import { isDateString, zonedDateTime } from "@/lib/dates";
import { actionUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { normalizeCode } from "@/server/discounts";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const tl = (value: string) => (value ? Math.round(Number(value.replace(",", ".")) * 100) : null);

export async function createCouponAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Bu işlem için yönetici yetkisi gerekli.");
  const code = normalizeCode(text(formData, "code"));
  if (!/^[A-Z0-9ÇĞİÖŞÜ_-]{3,24}$/.test(code)) return failure("Kod 3–24 karakter olmalı; harf, rakam, - ve _ kullanılabilir.", { code: "Geçersiz kod." });
  if (await db.coupon.findUnique({ where: { code } })) return failure("Bu kod zaten var.", { code: "Kullanılıyor." });
  const kind = text(formData, "kind") === "AMOUNT" ? "AMOUNT" : "PERCENT";
  const value = kind === "PERCENT" ? Number(text(formData, "value")) : tl(text(formData, "value"));
  if (!value || !Number.isFinite(value) || value <= 0 || (kind === "PERCENT" && (value > 100 || !Number.isInteger(value)))) {
    return failure(kind === "PERCENT" ? "Yüzde 1 ile 100 arasında tam sayı olmalı." : "İndirim tutarını yazın.", { value: "Geçersiz." });
  }
  const startsAt = isDateString(text(formData, "startsAt")) ? zonedDateTime(text(formData, "startsAt"), 0) : null;
  const endsAt = isDateString(text(formData, "endsAt")) ? zonedDateTime(text(formData, "endsAt"), 24 * 60) : null;
  const maxUses = text(formData, "maxUses") ? Number(text(formData, "maxUses")) : null;
  const perUserLimit = Number(text(formData, "perUserLimit") || "1");
  if ((maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) || !Number.isInteger(perUserLimit) || perUserLimit < 1) return failure("Kullanım sınırlarını kontrol edin.");
  const targets = formData
    .getAll("targets")
    .map(String)
    .filter((t) => ["booking", "credits", "subscription", "group"].includes(t));
  if (!targets.length) return failure("En az bir satış türü seçin.");
  const coupon = await db.coupon.create({
    data: {
      code,
      description: text(formData, "description").slice(0, 200) || null,
      kind,
      value,
      maxDiscount: kind === "PERCENT" ? tl(text(formData, "maxDiscount")) : null,
      minAmount: tl(text(formData, "minAmount")),
      // Hepsi seçiliyse boş liste: sonradan eklenecek satış türlerinde de geçerli
      targets: targets.length === 4 ? [] : targets,
      maxUses,
      perUserLimit,
      firstOrderOnly: formData.get("firstOrderOnly") === "on",
      startsAt,
      endsAt,
    },
  });
  await db.auditLog.create({ data: { actorId: user.id, action: "coupon.create", entityType: "Coupon", entityId: coupon.id, details: { code } } });
  refresh();
  return success(`${code} kodu oluşturuldu.`);
}

export async function toggleCouponAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Bu işlem için yönetici yetkisi gerekli.");
  const coupon = await db.coupon.findUnique({ where: { id: text(formData, "id") } });
  if (!coupon) return failure("Kod bulunamadı.");
  await db.coupon.update({ where: { id: coupon.id }, data: { isActive: !coupon.isActive } });
  await db.auditLog.create({ data: { actorId: user.id, action: coupon.isActive ? "coupon.deactivate" : "coupon.activate", entityType: "Coupon", entityId: coupon.id } });
  refresh();
  return success(coupon.isActive ? "Kod durduruldu." : "Kod yeniden açıldı.");
}
