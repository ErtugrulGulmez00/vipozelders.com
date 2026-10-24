import { failure, type ActionState } from "@/lib/action-state";
import { isDateString, timeToMinutes } from "@/lib/dates";
import { parseMoneyInput } from "@/lib/money";
import { isValidTckn, normalizePhone } from "@/lib/text";
import { CenterError } from "./errors";
import type { GuardianInput, StudentInput } from "./students";

// Kurum paneli formlarının ortak okuma yardımcıları (Server Action dosyaları yalnızca async fonksiyon dışa aktarabilir).

export const str = (fd: FormData, key: string, max = 500) => String(fd.get(key) ?? "").trim().slice(0, max);
export const opt = (fd: FormData, key: string, max = 500) => str(fd, key, max) || null;
export const bool = (fd: FormData, key: string) => ["on", "true", "1"].includes(String(fd.get(key) ?? ""));
export const list = (fd: FormData, key: string) => fd.getAll(key).map((v) => String(v).trim()).filter(Boolean);

export function int(fd: FormData, key: string, fallback: number, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): number {
  const raw = str(fd, key);
  const value = raw === "" ? fallback : Math.round(Number(raw.replace(",", ".")));
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Zorunlu tutar alanı (kuruş); geçersizse CenterError */
export function money(fd: FormData, key: string, label = "Tutar", options: { allowZero?: boolean } = {}): number {
  const raw = str(fd, key);
  const value = raw ? parseMoneyInput(raw) : options.allowZero ? 0 : null;
  if (value === null || (!options.allowZero && value <= 0)) throw new CenterError(`${label} geçersiz.`, { [key]: "Örn: 2.500 ya da 2500,50" });
  return value;
}

export function date(fd: FormData, key: string, label = "Tarih"): string {
  const value = str(fd, key);
  if (!isDateString(value)) throw new CenterError(`${label} seçin.`, { [key]: "Tarih seçin." });
  return value;
}

export function time(fd: FormData, key: string, label = "Saat"): number {
  const value = timeToMinutes(str(fd, key));
  if (value === null) throw new CenterError(`${label} geçersiz.`, { [key]: "SS:DD" });
  return value;
}

export function phone(fd: FormData, key: string, label = "Telefon"): string | null {
  const raw = str(fd, key);
  if (!raw) return null;
  const value = normalizePhone(raw);
  if (!value) throw new CenterError(`${label} 05XX XXX XX XX biçiminde olmalı.`, { [key]: "Geçersiz numara." });
  return value;
}

export function email(fd: FormData, key: string): string | null {
  const raw = str(fd, key, 120).toLowerCase();
  if (!raw) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw new CenterError("E-posta adresi geçersiz.", { [key]: "Geçersiz e-posta." });
  return raw;
}

export function requiredText(fd: FormData, key: string, label: string, min = 2, max = 120): string {
  const value = str(fd, key, max);
  if (value.length < min) throw new CenterError(`${label} gerekli.`, { [key]: `${label} yazın.` });
  return value;
}

export function parseStudentForm(fd: FormData): StudentInput {
  const birthDate = str(fd, "birthDate");
  if (birthDate && !isDateString(birthDate)) throw new CenterError("Doğum tarihi geçersiz.", { birthDate: "Geçersiz tarih." });
  const identityNumber = str(fd, "identityNumber").replace(/\s/g, "");
  if (identityNumber && !isValidTckn(identityNumber)) throw new CenterError("T.C. kimlik numarası geçersiz.", { identityNumber: "Geçersiz numara." });
  const gender = str(fd, "gender");
  return {
    studentNumber: opt(fd, "studentNumber", 20),
    firstName: requiredText(fd, "firstName", "Ad", 2, 50),
    lastName: requiredText(fd, "lastName", "Soyad", 2, 50),
    gender: gender === "FEMALE" || gender === "MALE" ? gender : "UNSPECIFIED",
    birthDate: birthDate || null,
    identityNumber: identityNumber || null,
    schoolName: opt(fd, "schoolName", 120),
    gradeName: opt(fd, "gradeName", 40),
    targetExam: opt(fd, "targetExam", 40),
    phone: phone(fd, "phone", "Öğrenci telefonu"),
    email: email(fd, "email"),
    address: opt(fd, "address", 300),
    notes: opt(fd, "notes", 2000),
  };
}

/** prefix: "guardian1" gibi; ad boşsa null döner */
export function parseGuardianForm(fd: FormData, prefix = ""): GuardianInput | null {
  const key = (name: string) => (prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name);
  const fullName = str(fd, key("fullName"), 80);
  const guardianPhone = phone(fd, key("phone"), "Veli telefonu");
  const guardianEmail = email(fd, key("email"));
  if (!fullName && !guardianPhone && !guardianEmail) return null;
  if (fullName.length < 3) throw new CenterError("Velinin adını ve soyadını yazın.", { [key("fullName")]: "Ad soyad gerekli." });
  // İşaretsiz kutular forma hiç gelmez; formda tercih kutuları varsa gizli "prefs" alanı gönderilir.
  const hasPrefs = fd.has(key("prefs"));
  return {
    fullName,
    relation: str(fd, key("relation"), 30) || "Veli",
    phone: guardianPhone,
    email: guardianEmail,
    isPrimary: bool(fd, key("isPrimary")),
    notifyWhatsapp: hasPrefs ? bool(fd, key("notifyWhatsapp")) : true,
    notifyEmail: hasPrefs ? bool(fd, key("notifyEmail")) : true,
  };
}

/** Kurum iş kuralı hatalarını forma mesaj olarak döndürür. */
export async function guard(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof CenterError) return failure(error.message, error.fieldErrors);
    throw error;
  }
}
