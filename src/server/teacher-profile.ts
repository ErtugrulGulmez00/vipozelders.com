import { z } from "zod";
import type { Gender } from "@/generated/prisma/client";
import { dateStringToDbDate, isDateString, timeToMinutes } from "@/lib/dates";
import { isValidTckn, normalizeIban, normalizePhone } from "@/lib/text";
import { encryptText } from "./crypto";
import { db } from "./db";
import { getPaymentProvider } from "./payments/service";
import { ALLOWED_DURATIONS } from "./pricing";
import { deleteUpload, saveUpload } from "./storage";
import { refreshTeacherSearchText } from "./teachers";

export class ProfileError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) {
    super(message);
  }
}

const profileSchema = z.object({
  headline: z.string().trim().max(120, "Başlık en fazla 120 karakter olabilir.").optional(),
  bio: z.string().trim().max(3000, "En fazla 3000 karakter.").optional(),
  education: z.string().trim().max(200).optional(),
  experienceYears: z.coerce.number().int().min(0).max(60).default(0),
  gender: z.enum(["FEMALE", "MALE", "UNSPECIFIED"]).default("UNSPECIFIED"),
  videoUrl: z.string().trim().max(200).optional(),
  cityId: z.coerce.number().int().optional(),
  districtId: z.coerce.number().int().optional(),
  offersOnline: z.string().optional(),
  offersInPerson: z.string().optional(),
  inPersonAtStudentHome: z.string().optional(),
  inPersonAtTeacherPlace: z.string().optional(),
  declaration: z.string().optional(),
});

export async function updateTeacherProfile(teacherId: string, formData: FormData) {
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string" && v !== ""));
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProfileError("Lütfen alanları kontrol edin.", Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
  }
  const input = parsed.data;
  const offersOnline = input.offersOnline === "on";
  const offersInPerson = input.offersInPerson === "on";
  if (!offersOnline && !offersInPerson) throw new ProfileError("En az bir ders şekli seçin (online veya yüz yüze).");
  if (input.videoUrl && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(input.videoUrl)) {
    throw new ProfileError("Tanıtım videosu için YouTube bağlantısı girin.", { videoUrl: "Yalnızca YouTube bağlantısı." });
  }
  if (offersInPerson && !input.cityId) throw new ProfileError("Yüz yüze ders için il seçin.", { cityId: "İl seçin." });
  if (offersInPerson && input.inPersonAtStudentHome !== "on" && input.inPersonAtTeacherPlace !== "on") {
    throw new ProfileError("Yüz yüze dersin nerede yapılacağını seçin.");
  }

  let districtId = input.districtId ?? null;
  if (districtId && input.cityId) {
    const district = await db.district.findUnique({ where: { id: districtId } });
    if (!district || district.cityId !== input.cityId) districtId = null;
  }
  const serviceDistrictIds = formData
    .getAll("serviceDistricts")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  const validServiceDistricts = input.cityId && serviceDistrictIds.length
    ? (await db.district.findMany({ where: { id: { in: serviceDistrictIds }, cityId: input.cityId }, select: { id: true } })).map((d) => d.id)
    : [];

  const current = await db.teacherProfile.findUniqueOrThrow({ where: { userId: teacherId }, select: { statusDeclarationAt: true } });
  await db.$transaction([
    db.teacherProfile.update({
      where: { userId: teacherId },
      data: {
        headline: input.headline || null,
        bio: input.bio || null,
        education: input.education || null,
        experienceYears: input.experienceYears,
        gender: input.gender as Gender,
        videoUrl: input.videoUrl || null,
        cityId: input.cityId ?? null,
        districtId,
        offersOnline,
        offersInPerson,
        inPersonAtStudentHome: input.inPersonAtStudentHome === "on",
        inPersonAtTeacherPlace: input.inPersonAtTeacherPlace === "on",
        statusDeclarationAt: input.declaration === "on" ? (current.statusDeclarationAt ?? new Date()) : null,
      },
    }),
    db.teacherServiceDistrict.deleteMany({ where: { teacherId } }),
    db.teacherServiceDistrict.createMany({ data: validServiceDistricts.map((id) => ({ teacherId, districtId: id })) }),
  ]);
  await refreshTeacherSearchText(teacherId);
}

export async function updateTeacherPhoto(teacherId: string, file: File) {
  const key = await saveUpload(file, { visibility: "public", folder: "ogretmen", maxBytes: 5 * 1024 * 1024, kinds: ["image"] });
  const previous = await db.teacherProfile.findUniqueOrThrow({ where: { userId: teacherId }, select: { photoKey: true } });
  await db.teacherProfile.update({ where: { userId: teacherId }, data: { photoKey: key } });
  await deleteUpload(previous.photoKey);
}

export async function removeTeacherPhoto(teacherId: string) {
  const previous = await db.teacherProfile.findUniqueOrThrow({ where: { userId: teacherId }, select: { photoKey: true } });
  await db.teacherProfile.update({ where: { userId: teacherId }, data: { photoKey: null } });
  await deleteUpload(previous.photoKey);
}

// ---------------------------------------------------------------------------
// Dersler ve fiyatlar
// ---------------------------------------------------------------------------

const offeringSchema = z.object({
  offeringId: z.string().optional(),
  serviceTypeId: z.coerce.number().int(),
  levelId: z.coerce.number().int(),
  subjectId: z.coerce.number().int(),
  hourlyPrice: z.coerce.number().min(100, "Saatlik ücret en az 100 ₺ olmalı.").max(20000, "Saatlik ücret en fazla 20.000 ₺ olabilir."),
  questionPrice: z.coerce.number().min(20, "Soru ücreti en az 20 ₺ olmalı.").max(5000, "Soru ücreti en fazla 5.000 ₺ olabilir.").optional(),
});

export async function saveOffering(teacherId: string, formData: FormData) {
  const parsed = offeringSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== "")));
  if (!parsed.success) throw new ProfileError(parsed.error.issues[0]?.message ?? "Geçersiz bilgi.");
  const input = parsed.data;
  const durations = formData
    .getAll("durations")
    .map(Number)
    .filter((d): d is (typeof ALLOWED_DURATIONS)[number] => (ALLOWED_DURATIONS as readonly number[]).includes(d))
    .sort((a, b) => a - b);
  if (!durations.length) throw new ProfileError("En az bir ders süresi seçin.");

  const pair = await db.levelSubject.findUnique({ where: { levelId_subjectId: { levelId: input.levelId, subjectId: input.subjectId } } });
  if (!pair) throw new ProfileError("Seçtiğiniz ders bu kademede yok.");

  const service = await db.serviceType.findUnique({ where: { id: input.serviceTypeId }, select: { slug: true } });
  const data = {
    // Fotoğrafla soru yalnızca soru çözüm hizmetinde
    questionPrice: service?.slug === "soru-cozum" && input.questionPrice ? Math.round(input.questionPrice) * 100 : null,
    serviceTypeId: input.serviceTypeId,
    levelId: input.levelId,
    subjectId: input.subjectId,
    hourlyPrice: Math.round(input.hourlyPrice) * 100,
    durations,
    isActive: true,
  };
  const duplicate = await db.teacherOffering.findUnique({
    where: { teacherId_serviceTypeId_levelId_subjectId: { teacherId, serviceTypeId: data.serviceTypeId, levelId: data.levelId, subjectId: data.subjectId } },
  });
  if (input.offeringId) {
    const existing = await db.teacherOffering.findUnique({ where: { id: input.offeringId } });
    if (!existing || existing.teacherId !== teacherId) throw new ProfileError("Ders bulunamadı.");
    if (duplicate && duplicate.id !== existing.id) throw new ProfileError("Bu hizmet, kademe ve ders için zaten bir fiyatınız var.");
    await db.teacherOffering.update({ where: { id: existing.id }, data });
  } else if (duplicate) {
    await db.teacherOffering.update({ where: { id: duplicate.id }, data });
  } else {
    await db.teacherOffering.create({ data: { ...data, teacherId } });
  }
  await refreshTeacherSearchText(teacherId);
}

export async function removeOffering(teacherId: string, offeringId: string) {
  const offering = await db.teacherOffering.findUnique({ where: { id: offeringId }, include: { _count: { select: { bookings: true } } } });
  if (!offering || offering.teacherId !== teacherId) throw new ProfileError("Ders bulunamadı.");
  // Geçmiş randevular bozulmasın diye randevusu olan ders silinmez, pasife alınır.
  if (offering._count.bookings) await db.teacherOffering.update({ where: { id: offeringId }, data: { isActive: false } });
  else await db.teacherOffering.delete({ where: { id: offeringId } });
  await refreshTeacherSearchText(teacherId);
}

// ---------------------------------------------------------------------------
// Müsaitlik
// ---------------------------------------------------------------------------

const rulesSchema = z.array(
  z.object({ weekday: z.number().int().min(1).max(7), start: z.string(), end: z.string() }),
).max(50);

export async function saveAvailability(teacherId: string, rulesJson: string, bufferMinutes: number) {
  let parsedRules: z.infer<typeof rulesSchema>;
  try {
    parsedRules = rulesSchema.parse(JSON.parse(rulesJson));
  } catch {
    throw new ProfileError("Takvim bilgisi okunamadı.");
  }
  const rules = parsedRules.map((r) => ({ weekday: r.weekday, startMinute: timeToMinutes(r.start), endMinute: timeToMinutes(r.end) }));
  for (const rule of rules) {
    if (rule.startMinute === null || rule.endMinute === null || rule.endMinute - rule.startMinute < 30) {
      throw new ProfileError("Her aralık en az 30 dakika olmalı ve bitiş başlangıçtan sonra olmalı.");
    }
  }
  const byDay = new Map<number, [number, number][]>();
  for (const r of rules) byDay.set(r.weekday, [...(byDay.get(r.weekday) ?? []), [r.startMinute!, r.endMinute!]]);
  for (const intervals of byDay.values()) {
    intervals.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < intervals.length; i++) {
      if (intervals[i][0] < intervals[i - 1][1]) throw new ProfileError("Aynı gün içindeki aralıklar çakışmamalı.");
    }
  }
  if (![0, 5, 10, 15, 30].includes(bufferMinutes)) throw new ProfileError("Geçersiz tampon süre.");

  await db.$transaction([
    db.availabilityRule.deleteMany({ where: { teacherId } }),
    db.availabilityRule.createMany({ data: rules.map((r) => ({ teacherId, weekday: r.weekday, startMinute: r.startMinute!, endMinute: r.endMinute! })) }),
    db.teacherProfile.update({ where: { userId: teacherId }, data: { bufferMinutes } }),
  ]);
}

export async function addAvailabilityException(teacherId: string, formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (!isDateString(date)) throw new ProfileError("Geçerli bir tarih seçin.");
  let startMinute: number | null = null;
  let endMinute: number | null = null;
  if (kind !== "BLOCKED_DAY") {
    startMinute = timeToMinutes(String(formData.get("start") ?? ""));
    endMinute = timeToMinutes(String(formData.get("end") ?? ""));
    if (startMinute === null || endMinute === null || endMinute - startMinute < 30) throw new ProfileError("Saat aralığı en az 30 dakika olmalı.");
  }
  await db.availabilityException.create({
    data: {
      teacherId,
      date: dateStringToDbDate(date),
      type: kind === "EXTRA" ? "EXTRA" : "BLOCKED",
      startMinute,
      endMinute,
      note: String(formData.get("note") ?? "").trim().slice(0, 200) || null,
    },
  });
}

export async function removeAvailabilityException(teacherId: string, exceptionId: string) {
  await db.availabilityException.deleteMany({ where: { id: exceptionId, teacherId } });
}

// ---------------------------------------------------------------------------
// Hakediş (ödeme) bilgileri
// ---------------------------------------------------------------------------

export async function savePayoutInfo(teacherId: string, formData: FormData) {
  const legalName = String(formData.get("legalName") ?? "").trim();
  const iban = normalizeIban(String(formData.get("iban") ?? ""));
  const identityNumber = String(formData.get("identityNumber") ?? "").replace(/\D/g, "");
  if (legalName.length < 5) throw new ProfileError("Hesap sahibinin adını soyadını yazın.", { legalName: "Ad soyad yazın." });
  if (!iban) throw new ProfileError("Geçerli bir TR IBAN girin.", { iban: "IBAN geçersiz." });
  if (identityNumber && !isValidTckn(identityNumber)) throw new ProfileError("T.C. kimlik numarası geçersiz.", { identityNumber: "Geçersiz numara." });

  const teacher = await db.teacherProfile.findUniqueOrThrow({ where: { userId: teacherId }, include: { user: true, city: true } });
  const data: { payoutLegalName: string; payoutIban: string; payoutIdentityNumberEnc?: string; subMerchantKey?: string } = {
    payoutLegalName: legalName,
    payoutIban: iban,
  };
  if (identityNumber) data.payoutIdentityNumberEnc = encryptText(identityNumber);

  const provider = getPaymentProvider();
  if (provider.requiresSubMerchant && !teacher.subMerchantKey) {
    if (!identityNumber) throw new ProfileError("Ödeme hesabınızın açılması için T.C. kimlik numarası gerekli.", { identityNumber: "Gerekli." });
    if (!teacher.user.email) throw new ProfileError("Ödeme hesabı için profilinizde e-posta adresi olmalı.");
    const result = await provider.registerSubMerchant({
      externalId: teacherId,
      firstName: teacher.user.firstName,
      lastName: teacher.user.lastName,
      legalName,
      email: teacher.user.email,
      phone: teacher.user.phone ? normalizePhone(teacher.user.phone) : null,
      iban,
      identityNumber,
      address: teacher.city?.name ?? "Türkiye",
    });
    if (!result.ok) throw new ProfileError(`Ödeme hesabı açılamadı: ${result.error}`);
    data.subMerchantKey = result.subMerchantKey;
  }
  await db.teacherProfile.update({ where: { userId: teacherId }, data });
}
