import type { z } from "zod";
import { zodFieldErrors } from "@/lib/action-state";
import { AccountError } from "../accounts";
import { BookingError } from "../bookings";
import { ReviewError } from "../reviews";
import { ProfileError } from "../teacher-profile";

// Mobil API'nin ortak yanıt biçimi. Hatalar her zaman { error: { code, message, fields? } } döner;
// message kullanıcıya gösterilecek Türkçe metindir.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const notFound = (message = "Kayıt bulunamadı.") => new ApiError(404, "NOT_FOUND", message);
export const forbidden = (message = "Bu işlem için yetkiniz yok.") => new ApiError(403, "FORBIDDEN", message);

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorJson(error: unknown): Response {
  if (error instanceof ApiError) {
    return json({ error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}), ...error.extra } }, error.status);
  }
  // İş kuralı hataları (dolu saat, iptal süresi geçti vb.) kullanıcıya olduğu gibi gösterilir.
  if (error instanceof BookingError || error instanceof ReviewError || error instanceof AccountError) {
    return json({ error: { code: "RULE_VIOLATION", message: error.message } }, 422);
  }
  if (error instanceof ProfileError) {
    return json({ error: { code: "RULE_VIOLATION", message: error.message, ...(error.fieldErrors ? { fields: error.fieldErrors } : {}) } }, 422);
  }
  console.error("[mobil api]", error);
  return json({ error: { code: "INTERNAL", message: "Beklenmeyen bir hata oluştu. Lütfen biraz sonra tekrar deneyin." } }, 500);
}

/** JSON gövdesini şemayla doğrular; hatalı alanlar fields içinde döner. */
export async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "İstek gövdesi geçerli bir JSON olmalı.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(422, "VALIDATION", "Lütfen işaretli alanları kontrol edin.", zodFieldErrors(parsed.error.issues));
  return parsed.data;
}

/** Sayfa numarası (?sayfa=2); geçersizse 1. */
export function pageParam(url: URL, name = "sayfa"): number {
  const page = Number(url.searchParams.get(name));
  return Number.isInteger(page) && page > 0 ? Math.min(page, 1000) : 1;
}
