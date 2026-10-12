import { isValidTckn, normalizePhone, normalizeSearch } from "@/lib/text";

// Excel/CSV'den öğrenci aktarımı: başlık satırı esnek eşleşir ("Öğrenci No", "Adı Soyadı", "Veli Tel" ...).

/** ";" veya "," ayraçlı CSV (Excel'in Türkçe çıktısı dahil); tırnaklı alanları destekler. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

type StudentField =
  | "studentNumber"
  | "firstName"
  | "lastName"
  | "fullName"
  | "gradeName"
  | "schoolName"
  | "targetExam"
  | "phone"
  | "email"
  | "gender"
  | "birthDate"
  | "identityNumber"
  | "address"
  | "notes"
  | "group"
  | "guardianName"
  | "guardianRelation"
  | "guardianPhone"
  | "guardianEmail";

const HEADER_ALIASES: Record<StudentField, string[]> = {
  studentNumber: ["ogrenci no", "no", "numara", "ogrenci numarasi", "okul no"],
  firstName: ["ad", "adi", "isim", "ogrenci adi"],
  lastName: ["soyad", "soyadi", "ogrenci soyadi"],
  fullName: ["ad soyad", "adi soyadi", "ogrenci", "ogrenci ad soyad", "ogrenci adi soyadi", "isim soyisim"],
  gradeName: ["sinif", "sinifi", "sinif seviyesi"],
  schoolName: ["okul", "okulu", "okul adi"],
  targetExam: ["hedef", "hedef sinav", "sinav"],
  phone: ["telefon", "ogrenci telefon", "ogrenci telefonu", "cep", "cep telefonu", "tel"],
  email: ["e posta", "eposta", "email", "mail", "ogrenci e posta"],
  gender: ["cinsiyet", "cinsiyeti"],
  birthDate: ["dogum tarihi", "d tarihi", "dogum"],
  identityNumber: ["tc", "tc no", "tc kimlik", "tc kimlik no", "t c", "t c no", "t c kimlik no", "kimlik no", "tckn"],
  address: ["adres", "ev adresi"],
  notes: ["not", "notlar", "aciklama"],
  group: ["grup", "sube", "sinif grubu", "grubu"],
  guardianName: ["veli", "veli adi", "veli ad soyad", "veli adi soyadi", "veli ismi"],
  guardianRelation: ["yakinlik", "veli yakinlik", "veli yakinligi", "yakinlik derecesi"],
  guardianPhone: ["veli telefon", "veli telefonu", "veli tel", "veli cep", "veli cep telefonu"],
  guardianEmail: ["veli e posta", "veli eposta", "veli email", "veli mail"],
};

const ALIAS_TO_FIELD = new Map<string, StudentField>(
  (Object.entries(HEADER_ALIASES) as [StudentField, string[]][]).flatMap(([field, aliases]) => aliases.map((alias) => [alias, field] as const)),
);

export type ImportedStudent = {
  row: number;
  studentNumber: string | null;
  firstName: string;
  lastName: string;
  gradeName: string | null;
  schoolName: string | null;
  targetExam: string | null;
  phone: string | null;
  email: string | null;
  gender: "FEMALE" | "MALE" | "UNSPECIFIED";
  birthDate: string | null;
  identityNumber: string | null;
  address: string | null;
  notes: string | null;
  group: string | null;
  guardian: { fullName: string; relation: string; phone: string | null; email: string | null } | null;
};

export type ImportProblem = { row: number; message: string };

/** "15.03.2012", "15/03/2012", "2012-03-15" → "2012-03-15" */
export function parseTurkishDate(value: string): string | null {
  const v = value.trim();
  let match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(v);
  if (match) {
    const [, d, m, y] = match;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return Number.isNaN(new Date(`${iso}T00:00:00Z`).getTime()) || new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso ? null : iso;
  }
  match = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function parseGender(value: string): ImportedStudent["gender"] {
  const v = normalizeSearch(value);
  if (["k", "kiz", "kadin", "female", "f"].includes(v)) return "FEMALE";
  if (["e", "erkek", "male", "m"].includes(v)) return "MALE";
  return "UNSPECIFIED";
}

/** İlk satır başlık olmak üzere tabloyu öğrenci kayıtlarına çevirir. */
export function mapStudentRows(rows: string[][]): { students: ImportedStudent[]; problems: ImportProblem[]; unknownHeaders: string[] } {
  const problems: ImportProblem[] = [];
  if (rows.length < 2) return { students: [], problems: [{ row: 1, message: "Dosyada başlık satırından sonra öğrenci bulunamadı." }], unknownHeaders: [] };
  const header = rows[0].map((h) => ALIAS_TO_FIELD.get(normalizeSearch(h)) ?? null);
  const unknownHeaders = rows[0].filter((h, i) => h && !header[i]);
  if (!header.includes("firstName") && !header.includes("fullName")) {
    return { students: [], problems: [{ row: 1, message: "Başlık satırında “Ad” ve “Soyad” (ya da “Ad Soyad”) sütunu bulunamadı." }], unknownHeaders };
  }
  const students: ImportedStudent[] = [];
  rows.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const get = (field: StudentField) => {
      const i = header.indexOf(field);
      return i >= 0 ? (cells[i] ?? "").trim() : "";
    };
    let firstName = get("firstName");
    let lastName = get("lastName");
    if (!firstName && get("fullName")) {
      const parts = get("fullName").split(/\s+/);
      lastName = parts.length > 1 ? parts.pop()! : "";
      firstName = parts.join(" ");
    }
    if (!firstName && !lastName) return;
    if (!firstName || !lastName) {
      problems.push({ row: rowNumber, message: "Ad ve soyad birlikte olmalı." });
      return;
    }
    const rawPhone = get("phone");
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) problems.push({ row: rowNumber, message: `Öğrenci telefonu “${rawPhone}” geçersiz; boş bırakıldı.` });
    const rawGuardianPhone = get("guardianPhone");
    const guardianPhone = rawGuardianPhone ? normalizePhone(rawGuardianPhone) : null;
    if (rawGuardianPhone && !guardianPhone) problems.push({ row: rowNumber, message: `Veli telefonu “${rawGuardianPhone}” geçersiz; boş bırakıldı.` });
    const rawTc = get("identityNumber").replace(/\s/g, "");
    const identityNumber = rawTc && isValidTckn(rawTc) ? rawTc : null;
    if (rawTc && !identityNumber) problems.push({ row: rowNumber, message: "T.C. kimlik numarası geçersiz; boş bırakıldı." });
    const rawBirth = get("birthDate");
    const birthDate = rawBirth ? parseTurkishDate(rawBirth) : null;
    if (rawBirth && !birthDate) problems.push({ row: rowNumber, message: `Doğum tarihi “${rawBirth}” anlaşılamadı (GG.AA.YYYY).` });
    const email = get("email").toLowerCase();
    const guardianEmail = get("guardianEmail").toLowerCase();
    const guardianName = get("guardianName");
    students.push({
      row: rowNumber,
      studentNumber: get("studentNumber") || null,
      firstName,
      lastName,
      gradeName: get("gradeName") || null,
      schoolName: get("schoolName") || null,
      targetExam: get("targetExam") || null,
      phone,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
      gender: parseGender(get("gender")),
      birthDate,
      identityNumber,
      address: get("address") || null,
      notes: get("notes") || null,
      group: get("group") || null,
      guardian:
        guardianName || guardianPhone || guardianEmail
          ? {
              fullName: guardianName || "Veli",
              relation: get("guardianRelation") || "Veli",
              phone: guardianPhone,
              email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail) ? guardianEmail : null,
            }
          : null,
    });
  });
  return { students, problems, unknownHeaders };
}

export const STUDENT_TEMPLATE_HEADERS = [
  "Öğrenci No",
  "Ad",
  "Soyad",
  "Sınıf",
  "Okul",
  "Hedef Sınav",
  "Grup",
  "Cinsiyet",
  "Doğum Tarihi",
  "Telefon",
  "E-posta",
  "Veli Ad Soyad",
  "Yakınlık",
  "Veli Telefon",
  "Veli E-posta",
  "Adres",
  "Not",
];
