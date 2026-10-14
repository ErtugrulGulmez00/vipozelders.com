/**
 * Başlangıç verileri: il/ilçeler, kademeler, dersler, hizmet türleri, yasal sayfalar, yönetici.
 * Geliştirme ortamında ayrıca demo öğretmen, veli ve geçmiş dersler eklenir (SEED_DEMO=false ile kapatılır).
 * Tekrar çalıştırılabilir: mevcut kayıtları çoğaltmaz.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { Gender, LevelGroup } from "../src/generated/prisma/client";
import { addDaysToDateString, isoWeekday, toLocalDateString, zonedDateTime } from "../src/lib/dates";
import { normalizeSearch, slugify } from "../src/lib/text";
import { generateTemporaryPassword, hashPassword } from "../src/server/auth/password";
import { db } from "../src/server/db";
import { lessonPrice, splitCommission } from "../src/server/pricing";
import { DEMO_EMAIL_DOMAIN } from "../src/lib/demo";
import { LEGAL_PAGES } from "./legal-pages";
import { seedDemoCenter } from "./seed-center";

const isProduction = process.env.NODE_ENV === "production";
const shouldSeedDemo = process.env.SEED_DEMO ? process.env.SEED_DEMO === "true" : !isProduction;

// ---------------------------------------------------------------------------
// Katalog
// ---------------------------------------------------------------------------

const SUBJECTS: [slug: string, name: string][] = [
  ["okula-hazirlik", "Okula Hazırlık ve Gelişim"],
  ["tum-dersler", "Tüm Dersler (Sınıf Öğretmeni)"],
  ["okuma-yazma", "Okuma-Yazma"],
  ["turkce", "Türkçe"],
  ["matematik", "Matematik"],
  ["hayat-bilgisi", "Hayat Bilgisi"],
  ["fen-bilimleri", "Fen Bilimleri"],
  ["sosyal-bilgiler", "Sosyal Bilgiler"],
  ["inkilap-tarihi", "T.C. İnkılap Tarihi ve Atatürkçülük"],
  ["din-kulturu", "Din Kültürü ve Ahlak Bilgisi"],
  ["edebiyat", "Türk Dili ve Edebiyatı"],
  ["geometri", "Geometri"],
  ["fizik", "Fizik"],
  ["kimya", "Kimya"],
  ["biyoloji", "Biyoloji"],
  ["tarih", "Tarih"],
  ["cografya", "Coğrafya"],
  ["felsefe", "Felsefe"],
  ["ingilizce", "İngilizce"],
  ["almanca", "Almanca"],
];

const LEVELS: { slug: string; name: string; group: LevelGroup; grades: string[]; subjects: string[] }[] = [
  { slug: "okul-oncesi", name: "Okul Öncesi", group: "SCHOOL", grades: ["3-4 yaş", "5-6 yaş"], subjects: ["okula-hazirlik"] },
  {
    slug: "ilkokul",
    name: "İlkokul",
    group: "SCHOOL",
    grades: ["1. Sınıf", "2. Sınıf", "3. Sınıf", "4. Sınıf"],
    subjects: ["tum-dersler", "okuma-yazma", "turkce", "matematik", "hayat-bilgisi", "fen-bilimleri", "sosyal-bilgiler", "ingilizce"],
  },
  {
    slug: "ortaokul",
    name: "Ortaokul",
    group: "SCHOOL",
    grades: ["5. Sınıf", "6. Sınıf", "7. Sınıf", "8. Sınıf"],
    subjects: ["turkce", "matematik", "fen-bilimleri", "sosyal-bilgiler", "inkilap-tarihi", "ingilizce", "din-kulturu", "almanca"],
  },
  {
    slug: "lise",
    name: "Lise",
    group: "SCHOOL",
    grades: ["9. Sınıf", "10. Sınıf", "11. Sınıf", "12. Sınıf"],
    subjects: ["edebiyat", "matematik", "geometri", "fizik", "kimya", "biyoloji", "tarih", "cografya", "felsefe", "ingilizce", "almanca", "din-kulturu"],
  },
  {
    slug: "lgs",
    name: "LGS Hazırlık",
    group: "EXAM",
    grades: ["7. Sınıf", "8. Sınıf"],
    subjects: ["matematik", "fen-bilimleri", "turkce", "inkilap-tarihi", "ingilizce", "din-kulturu"],
  },
  {
    slug: "yks",
    name: "YKS Hazırlık (TYT-AYT)",
    group: "EXAM",
    grades: ["11. Sınıf", "12. Sınıf", "Mezun"],
    subjects: ["turkce", "matematik", "geometri", "fizik", "kimya", "biyoloji", "edebiyat", "tarih", "cografya", "felsefe", "ingilizce"],
  },
];

const SERVICES = [
  { slug: "ozel-ders", name: "Özel Ders", description: "Konu anlatımı ve birebir çalışma" },
  { slug: "soru-cozum", name: "Soru Çözüm", description: "Takıldığınız soruları birlikte çözme" },
  { slug: "kocluk", name: "Koçluk", description: "Çalışma programı, deneme takibi ve motivasyon" },
];

async function seedCatalog() {
  for (const [index, [slug, name]] of SUBJECTS.entries()) {
    await db.subject.upsert({ where: { slug }, create: { slug, name, sortOrder: index }, update: {} });
  }
  const subjectIds = new Map((await db.subject.findMany()).map((s) => [s.slug, s.id]));

  for (const [index, level] of LEVELS.entries()) {
    const row = await db.level.upsert({
      where: { slug: level.slug },
      create: { slug: level.slug, name: level.name, group: level.group, sortOrder: index },
      update: {},
    });
    for (const [gradeIndex, gradeName] of level.grades.entries()) {
      await db.grade.upsert({
        where: { levelId_name: { levelId: row.id, name: gradeName } },
        create: { levelId: row.id, name: gradeName, sortOrder: gradeIndex },
        update: {},
      });
    }
    for (const subjectSlug of level.subjects) {
      const subjectId = subjectIds.get(subjectSlug)!;
      await db.levelSubject.upsert({
        where: { levelId_subjectId: { levelId: row.id, subjectId } },
        create: { levelId: row.id, subjectId },
        update: {},
      });
    }
  }

  for (const [index, service] of SERVICES.entries()) {
    await db.serviceType.upsert({
      where: { slug: service.slug },
      create: { ...service, sortOrder: index },
      update: {},
    });
  }
}

async function seedLocations() {
  const file = fileURLToPath(new URL("./data/turkiye-il-ilce.json", import.meta.url));
  const cities = JSON.parse(fs.readFileSync(file, "utf8")) as { id: number; name: string; districts: string[] }[];
  for (const city of cities) {
    await db.city.upsert({ where: { id: city.id }, create: { id: city.id, name: city.name, slug: slugify(city.name) }, update: {} });
    const existing = new Set((await db.district.findMany({ where: { cityId: city.id }, select: { slug: true } })).map((d) => d.slug));
    const missing = city.districts.filter((name) => !existing.has(slugify(name)));
    if (missing.length) {
      await db.district.createMany({
        data: missing.map((name) => ({ cityId: city.id, name, slug: slugify(name) })),
        skipDuplicates: true,
      });
    }
  }
}

async function seedPages() {
  for (const page of LEGAL_PAGES) {
    await db.page.upsert({ where: { slug: page.slug }, create: page, update: {} });
  }
}

async function seedAdmin() {
  // .env'de boş bırakılan ("") değerler verilmemiş sayılır.
  const username = process.env.ADMIN_USERNAME || "admin";
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) return null;
  const password = process.env.ADMIN_PASSWORD || (isProduction ? generateTemporaryPassword(14) : "Yonetici123");
  await db.user.create({
    data: {
      role: "ADMIN",
      username,
      email: process.env.ADMIN_EMAIL?.toLowerCase() || null,
      firstName: "Site",
      lastName: "Yöneticisi",
      passwordHash: await hashPassword(password),
      mustChangePassword: isProduction,
    },
  });
  return { username, password };
}

// ---------------------------------------------------------------------------
// Demo veriler (yalnızca geliştirme)
// ---------------------------------------------------------------------------

type DemoTeacher = {
  first: string;
  last: string;
  gender: Gender;
  headline: string;
  bio: string;
  education: string;
  years: number;
  city?: string;
  district?: string;
  online: boolean;
  inPerson: boolean;
  atHome?: boolean;
  atPlace?: boolean;
  serviceDistricts?: string[];
  verified?: boolean;
  featured?: boolean;
  offerings: [service: string, level: string, subject: string, hourlyTl: number][];
  rules: [weekdays: number[], from: string, to: string][];
  status?: "PUBLISHED" | "DRAFT";
};

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [6, 7];

const DEMO_TEACHERS: DemoTeacher[] = [
  {
    first: "Ayşe", last: "Yılmaz", gender: "FEMALE",
    headline: "12 yıllık deneyimli matematik öğretmeni · LGS ve YKS uzmanı",
    bio: "Boğaziçi Üniversitesi Matematik Öğretmenliği mezunuyum. 12 yıldır ortaokul ve lise öğrencileriyle çalışıyorum. Derslerime öğrencinin eksiklerini belirleyen kısa bir değerlendirmeyle başlar, kişiye özel bir çalışma planı hazırlarım. Her dersten sonra veliye kısa bir özet ve ödev listesi gönderirim. Amacım ezber yerine mantığı kavratmak.",
    education: "Boğaziçi Üniversitesi · Matematik Öğretmenliği", years: 12,
    city: "İstanbul", district: "Kadıköy", online: true, inPerson: true, atHome: true,
    serviceDistricts: ["Kadıköy", "Ataşehir", "Üsküdar"], verified: true, featured: true,
    offerings: [["ozel-ders", "ortaokul", "matematik", 800], ["ozel-ders", "lise", "matematik", 900], ["ozel-ders", "lgs", "matematik", 900], ["ozel-ders", "yks", "matematik", 1000], ["soru-cozum", "lgs", "matematik", 600]],
    rules: [[WEEKDAYS, "16:00", "22:00"], [WEEKEND, "10:00", "18:00"]],
  },
  {
    first: "Mehmet", last: "Demir", gender: "MALE",
    headline: "Fizik öğretmeni ve YKS koçu · ODTÜ mezunu",
    bio: "ODTÜ Fizik bölümünden mezun oldum, 8 yıldır dershane ve özel ders tecrübem var. YKS'ye hazırlanan öğrencilerle haftalık program, deneme analizi ve konu eksiklerine göre çalışıyorum. Koçluk öğrencilerimle her hafta görüşüp netlerini birlikte takip ediyoruz. Fiziği günlük hayattan örneklerle anlatmayı seviyorum.",
    education: "ODTÜ · Fizik", years: 8,
    city: "Ankara", district: "Çankaya", online: true, inPerson: false, verified: true,
    offerings: [["ozel-ders", "lise", "fizik", 950], ["ozel-ders", "yks", "fizik", 1100], ["kocluk", "yks", "fizik", 1200]],
    rules: [[WEEKDAYS, "17:00", "22:00"], [[6], "10:00", "16:00"]],
  },
  {
    first: "Zeynep", last: "Kaya", gender: "FEMALE",
    headline: "Konuşma odaklı İngilizce dersleri · Cambridge CELTA",
    bio: "Dokuz Eylül Üniversitesi İngiliz Dili Eğitimi mezunuyum ve Cambridge CELTA sertifikam var. İlkokuldan liseye her yaştan öğrenciyle oyun, şarkı ve günlük konuşma pratikleriyle çalışıyorum. Okul derslerine destek olurken öğrencinin İngilizce konuşmaktan çekinmemesini hedefliyorum.",
    education: "Dokuz Eylül Üniversitesi · İngiliz Dili Eğitimi", years: 6,
    city: "İzmir", district: "Bornova", online: true, inPerson: true, atPlace: true,
    offerings: [["ozel-ders", "ilkokul", "ingilizce", 650], ["ozel-ders", "ortaokul", "ingilizce", 700], ["ozel-ders", "lise", "ingilizce", 750]],
    rules: [[WEEKDAYS, "15:00", "21:00"], [WEEKEND, "11:00", "17:00"]],
  },
  {
    first: "Elif", last: "Şahin", gender: "FEMALE",
    headline: "Sınıf öğretmeni · Okula hazırlık ve ilkokul destek",
    bio: "Marmara Üniversitesi Sınıf Öğretmenliği mezunuyum. 10 yıldır okul öncesi ve ilkokul çocuklarıyla çalışıyorum. Okuma-yazmaya geçiş, ödev alışkanlığı ve dikkat süresini artırmaya yönelik oyunlaştırılmış etkinlikler hazırlıyorum. Çocuğunuzun kendini güvende hissettiği, keyifli dersler planlıyorum.",
    education: "Marmara Üniversitesi · Sınıf Öğretmenliği", years: 10,
    city: "İstanbul", district: "Beşiktaş", online: true, inPerson: true, atHome: true,
    serviceDistricts: ["Beşiktaş", "Şişli", "Sarıyer"], verified: true,
    offerings: [["ozel-ders", "okul-oncesi", "okula-hazirlik", 600], ["ozel-ders", "ilkokul", "tum-dersler", 650], ["ozel-ders", "ilkokul", "okuma-yazma", 650]],
    rules: [[WEEKDAYS, "13:00", "19:00"], [[6], "10:00", "14:00"]],
  },
  {
    first: "Burak", last: "Çelik", gender: "MALE",
    headline: "Kimyayı sevdiren öğretmen · TYT-AYT kimya",
    bio: "Hacettepe Üniversitesi Kimya Öğretmenliği mezunuyum. Lise ve YKS öğrencileriyle konu anlatımı ve bol soru çözümüyle ilerliyorum. Her konunun sonunda kısa bir mini sınavla öğrenmeyi pekiştiriyoruz. Derslerimi online yapıyorum; dijital tahta kullanıyorum.",
    education: "Hacettepe Üniversitesi · Kimya Öğretmenliği", years: 5,
    online: true, inPerson: false,
    offerings: [["ozel-ders", "lise", "kimya", 800], ["ozel-ders", "yks", "kimya", 900], ["soru-cozum", "yks", "kimya", 550]],
    rules: [[WEEKDAYS, "18:00", "23:00"], [WEEKEND, "12:00", "20:00"]],
  },
  {
    first: "Selin", last: "Arslan", gender: "FEMALE",
    headline: "Türkçe ve edebiyat · LGS paragraf ve YKS edebiyat",
    bio: "Uludağ Üniversitesi Türk Dili ve Edebiyatı Öğretmenliği mezunuyum. Paragraf, dil bilgisi ve edebiyat konularında okuma alışkanlığını geliştiren, yorumlama becerisini güçlendiren dersler yapıyorum. LGS ve YKS öğrencilerimle haftalık okuma listeleri oluşturuyoruz.",
    education: "Uludağ Üniversitesi · Türk Dili ve Edebiyatı Öğretmenliği", years: 7,
    city: "Bursa", district: "Nilüfer", online: true, inPerson: false,
    offerings: [["ozel-ders", "ortaokul", "turkce", 650], ["ozel-ders", "lgs", "turkce", 750], ["ozel-ders", "lise", "edebiyat", 700], ["ozel-ders", "yks", "edebiyat", 800]],
    rules: [[WEEKDAYS, "16:00", "21:00"]],
  },
  {
    first: "Emre", last: "Koç", gender: "MALE",
    headline: "LGS koçu ve fen bilimleri öğretmeni",
    bio: "İstanbul Üniversitesi Fen Bilgisi Öğretmenliği mezunuyum. 9 yıldır LGS'ye hazırlanan öğrencilere fen dersi ve koçluk veriyorum. Koçlukta haftalık program, deneme takibi ve veli bilgilendirmesi yapıyorum. Öğrencilerimin düzenli çalışma alışkanlığı kazanmasını önemsiyorum.",
    education: "İstanbul Üniversitesi · Fen Bilgisi Öğretmenliği", years: 9,
    city: "İstanbul", district: "Beylikdüzü", online: true, inPerson: true, atHome: true,
    serviceDistricts: ["Beylikdüzü", "Esenyurt", "Büyükçekmece", "Avcılar"], featured: true,
    offerings: [["ozel-ders", "ortaokul", "fen-bilimleri", 750], ["ozel-ders", "lgs", "fen-bilimleri", 850], ["kocluk", "lgs", "fen-bilimleri", 950]],
    rules: [[WEEKDAYS, "17:00", "22:00"], [WEEKEND, "10:00", "15:00"]],
  },
  {
    first: "Deniz", last: "Aydın", gender: "UNSPECIFIED",
    headline: "Biyoloji · görsellerle kalıcı öğrenme",
    bio: "Ege Üniversitesi Biyoloji bölümü mezunuyum ve pedagojik formasyon eğitimimi tamamladım. Biyolojiyi şemalar, animasyonlar ve günlük hayattan örneklerle anlatıyorum. YKS öğrencilerimle çıkmış soruları birlikte analiz ediyoruz.",
    education: "Ege Üniversitesi · Biyoloji", years: 4,
    online: true, inPerson: false,
    offerings: [["ozel-ders", "lise", "biyoloji", 650], ["ozel-ders", "yks", "biyoloji", 750], ["soru-cozum", "yks", "biyoloji", 500]],
    rules: [[WEEKDAYS, "19:00", "23:00"], [WEEKEND, "10:00", "22:00"]],
  },
  {
    first: "Can", last: "Öztürk", gender: "MALE",
    headline: "Tarih ve coğrafya",
    bio: "",
    education: "", years: 2, online: true, inPerson: false,
    offerings: [], rules: [], status: "DRAFT",
  },
];

const REVIEWS: [teacherIndex: number, rating: number, comment: string][] = [
  [0, 5, "Kızım LGS matematikte çok zorlanıyordu, Ayşe Hoca ile iki ayda netleri belirgin şekilde arttı. Çok sabırlı ve düzenli."],
  [0, 5, "Her dersten sonra gönderdiği özetler sayesinde neye çalışılacağını biliyoruz. Kesinlikle tavsiye ederim."],
  [0, 4, "Konuları sade anlatıyor, ödevleri takip ediyor. Saatlerde esneklik biraz daha olsa çok iyi olur."],
  [1, 5, "Fizikteki eksiklerimi kısa sürede kapattık, deneme analizleri çok faydalı oldu."],
  [1, 5, "Koçluk görüşmeleri sayesinde düzenli çalışmaya başladım."],
  [2, 4, "Oğlum İngilizce derslerini dört gözle bekliyor, konuşmaya daha cesur."],
  [3, 5, "Okula başlamadan önce kızımızın okuma-yazmaya ısınmasında çok yardımcı oldu."],
  [4, 5, "Kimya artık korkulu rüyam değil, konu sonrası mini sınavlar çok iyi."],
  [6, 5, "Haftalık program ve veli bilgilendirmeleri çok düzenli. LGS sürecinde çok rahatladık."],
];

function nextDateWithWeekday(fromDate: string, minDaysAhead: number, weekdays: number[]): string {
  let date = addDaysToDateString(fromDate, minDaysAhead);
  for (let i = 0; i < 14 && !weekdays.includes(isoWeekday(date)); i++) date = addDaysToDateString(date, 1);
  return date;
}

async function seedDemo() {
  const marker = `ayse.yilmaz@${DEMO_EMAIL_DOMAIN}`;
  if (await db.user.findUnique({ where: { email: marker } })) return false;

  const catalog = {
    levels: new Map((await db.level.findMany()).map((l) => [l.slug, l])),
    subjects: new Map((await db.subject.findMany()).map((s) => [s.slug, s])),
    services: new Map((await db.serviceType.findMany()).map((s) => [s.slug, s])),
  };
  const cities = new Map((await db.city.findMany()).map((c) => [c.name, c]));
  const now = new Date();
  const today = toLocalDateString(now);
  const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

  const teacherIds: string[] = [];
  for (const [index, t] of DEMO_TEACHERS.entries()) {
    const city = t.city ? cities.get(t.city) : undefined;
    const district = city && t.district
      ? await db.district.findUnique({ where: { cityId_slug: { cityId: city.id, slug: slugify(t.district) } } })
      : null;
    const username = slugify(`${t.first} ${t.last}`).replace(/-/g, ".");
    const user = await db.user.create({
      data: {
        role: "TEACHER",
        username,
        email: `${username}@${DEMO_EMAIL_DOMAIN}`,
        firstName: t.first,
        lastName: t.last,
        phone: `0532${String(1000000 + index * 1111).slice(0, 7)}`,
        passwordHash: await hashPassword(index === 0 ? "Ogretmen123" : generateTemporaryPassword()),
        mustChangePassword: index !== 0,
        teacherProfile: {
          create: {
            slug: slugify(`${t.first} ${t.last}`),
            headline: t.headline,
            bio: t.bio || null,
            education: t.education || null,
            experienceYears: t.years,
            gender: t.gender,
            cityId: city?.id ?? null,
            districtId: district?.id ?? null,
            offersOnline: t.online,
            offersInPerson: t.inPerson,
            inPersonAtStudentHome: Boolean(t.atHome),
            inPersonAtTeacherPlace: Boolean(t.atPlace),
            status: t.status ?? "PUBLISHED",
            publishedAt: t.status === "DRAFT" ? null : new Date(now.getTime() - (DEMO_TEACHERS.length - index) * 86_400_000),
            verificationStatus: t.verified ? "VERIFIED" : "UNVERIFIED",
            isFeatured: Boolean(t.featured),
            bufferMinutes: index % 3 === 0 ? 15 : 0,
            statusDeclarationAt: t.status === "DRAFT" ? null : now,
          },
        },
      },
    });
    teacherIds.push(user.id);

    if (city && t.serviceDistricts) {
      for (const name of t.serviceDistricts) {
        const d = await db.district.findUnique({ where: { cityId_slug: { cityId: city.id, slug: slugify(name) } } });
        if (d) await db.teacherServiceDistrict.create({ data: { teacherId: user.id, districtId: d.id } });
      }
    }
    for (const [service, level, subject, hourlyTl] of t.offerings) {
      await db.teacherOffering.create({
        data: {
          teacherId: user.id,
          serviceTypeId: catalog.services.get(service)!.id,
          levelId: catalog.levels.get(level)!.id,
          subjectId: catalog.subjects.get(subject)!.id,
          hourlyPrice: hourlyTl * 100,
          durations: service === "soru-cozum" ? [30, 45, 60] : service === "kocluk" ? [45, 60] : [45, 60, 90],
        },
      });
    }
    for (const [weekdays, from, to] of t.rules) {
      for (const weekday of weekdays) {
        await db.availabilityRule.create({ data: { teacherId: user.id, weekday, startMinute: toMinutes(from), endMinute: toMinutes(to) } });
      }
    }
    const searchParts = [t.first, t.last, t.headline, t.education, ...t.offerings.flatMap(([s, l, sub]) => [catalog.services.get(s)!.name, catalog.levels.get(l)!.name, catalog.subjects.get(sub)!.name])];
    await db.teacherProfile.update({ where: { userId: user.id }, data: { searchText: normalizeSearch([...new Set(searchParts)].join(" ")) } });
  }

  // Veli ve öğrenci hesapları
  const parent = await db.user.create({
    data: {
      role: "STUDENT",
      email: `veli@${DEMO_EMAIL_DOMAIN}`,
      firstName: "Fatma",
      lastName: "Demirtaş",
      phone: "05321112233",
      passwordHash: await hashPassword("Veli12345"),
      emailVerifiedAt: now,
      studentProfile: { create: { accountType: "PARENT", kvkkConsentAt: now, cityId: cities.get("İstanbul")?.id } },
    },
  });
  await db.learner.createMany({
    data: [
      { studentId: parent.id, name: "Ali", gradeName: "7. Sınıf" },
      { studentId: parent.id, name: "Elif", gradeName: "11. Sınıf" },
    ],
  });
  await db.user.create({
    data: {
      role: "STUDENT",
      email: `ogrenci@${DEMO_EMAIL_DOMAIN}`,
      firstName: "Kerem",
      lastName: "Aksoy",
      passwordHash: await hashPassword("Ogrenci123"),
      emailVerifiedAt: now,
      studentProfile: { create: { accountType: "STUDENT", kvkkConsentAt: now } },
    },
  });

  // Yorum yazan diğer veliler (her yorum geçmişte tamamlanmış bir derse bağlıdır)
  const reviewers: string[] = [];
  for (const [first, last] of [["Hülya", "Karaca"], ["Murat", "Tunç"], ["Seda", "Yıldız"]]) {
    const u = await db.user.create({
      data: {
        role: "STUDENT",
        email: `${slugify(first)}.${slugify(last)}@${DEMO_EMAIL_DOMAIN}`,
        firstName: first,
        lastName: last,
        passwordHash: await hashPassword(generateTemporaryPassword()),
        studentProfile: { create: { accountType: "PARENT", kvkkConsentAt: now } },
      },
    });
    reviewers.push(u.id);
  }

  let code = 1000;
  const bookingCode = () => `VD-DEMO${code++}`;

  async function pastLesson(teacherId: string, studentId: string, daysAgo: number) {
    const offering = await db.teacherOffering.findFirstOrThrow({ where: { teacherId }, include: { level: true, subject: true, serviceType: true } });
    const date = addDaysToDateString(today, -daysAgo);
    const startAt = zonedDateTime(date, 18 * 60);
    const endAt = new Date(startAt.getTime() + 3_600_000);
    const price = lessonPrice(offering.hourlyPrice, 60);
    const { commissionAmount, teacherAmount } = splitCommission(price, 1500);
    const booking = await db.booking.create({
      data: {
        code: bookingCode(), studentId, teacherId, offeringId: offering.id,
        serviceTypeId: offering.serviceTypeId, levelId: offering.levelId, subjectId: offering.subjectId,
        serviceName: offering.serviceType.name, levelName: offering.level.name, subjectName: offering.subject.name,
        learnerName: "Öğrenci", mode: "ONLINE", startAt, endAt, blockEndAt: endAt, durationMinutes: 60,
        price, commissionRateBps: 1500, commissionAmount, teacherAmount, status: "COMPLETED",
        paidAt: new Date(startAt.getTime() - 2 * 86_400_000), confirmedAt: new Date(startAt.getTime() - 2 * 86_400_000 + 3_600_000),
        respondedAt: new Date(startAt.getTime() - 2 * 86_400_000 + 3_600_000), completedAt: endAt,
        earningsReleaseAt: new Date(endAt.getTime() + 48 * 3_600_000), earningsReleasedAt: new Date(endAt.getTime() + 48 * 3_600_000),
        videoRoomName: `demo-${code}`,
      },
    });
    await db.payment.create({ data: { bookingId: booking.id, provider: "mock", providerToken: `demo_${booking.id}`, providerPaymentId: `demo_${booking.id}`, amount: price, status: "SUCCEEDED" } });
    await db.ledgerEntry.createMany({
      data: [
        { teacherId, bookingId: booking.id, bucket: "PENDING", amount: teacherAmount, description: `${booking.code} ders ücreti` },
        { teacherId, bookingId: booking.id, bucket: "PENDING", amount: -teacherAmount, description: `${booking.code} hakediş serbest bırakıldı` },
        { teacherId, bookingId: booking.id, bucket: "AVAILABLE", amount: teacherAmount, description: `${booking.code} hakediş` },
      ],
    });
    await db.teacherProfile.update({ where: { userId: teacherId }, data: { completedLessons: { increment: 1 }, avgResponseMinutes: 60, responseCount: { increment: 1 } } });
    return booking;
  }

  for (const [i, [teacherIndex, rating, comment]] of REVIEWS.entries()) {
    const teacherId = teacherIds[teacherIndex];
    const studentId = reviewers[i % reviewers.length];
    const booking = await pastLesson(teacherId, studentId, 5 + i * 3);
    await db.review.create({ data: { bookingId: booking.id, teacherId, studentId, rating, comment, createdAt: booking.endAt } });
  }
  // Değerlendirme bekleyen bir ders (veli hesabında "değerlendir" butonu görünsün)
  await pastLesson(teacherIds[2], parent.id, 2);

  for (const teacherId of teacherIds) {
    const stats = await db.review.aggregate({ where: { teacherId }, _avg: { rating: true }, _count: { _all: true } });
    await db.teacherProfile.update({
      where: { userId: teacherId },
      data: { ratingAvg: Math.round((stats._avg.rating ?? 0) * 100) / 100, ratingCount: stats._count._all },
    });
  }

  // Gelecek dersler: veli için onaylı bir ders ve öğretmen onayı bekleyen bir talep
  const ayse = teacherIds[0];
  const ayseOffering = await db.teacherOffering.findFirstOrThrow({ where: { teacherId: ayse, level: { slug: "lgs" } }, include: { level: true, subject: true, serviceType: true } });
  const confirmedDate = nextDateWithWeekday(today, 2, WEEKDAYS);
  const confirmedStart = zonedDateTime(confirmedDate, 18 * 60);
  const confirmedPrice = lessonPrice(ayseOffering.hourlyPrice, 60);
  const confirmedSplit = splitCommission(confirmedPrice, 1500);
  const confirmed = await db.booking.create({
    data: {
      code: bookingCode(), studentId: parent.id, teacherId: ayse, offeringId: ayseOffering.id,
      serviceTypeId: ayseOffering.serviceTypeId, levelId: ayseOffering.levelId, subjectId: ayseOffering.subjectId,
      serviceName: ayseOffering.serviceType.name, levelName: ayseOffering.level.name, subjectName: ayseOffering.subject.name,
      learnerName: "Ali", learnerGrade: "7. Sınıf", mode: "ONLINE",
      startAt: confirmedStart, endAt: new Date(confirmedStart.getTime() + 3_600_000), blockEndAt: new Date(confirmedStart.getTime() + 75 * 60_000),
      durationMinutes: 60, price: confirmedPrice, commissionRateBps: 1500, ...confirmedSplit,
      status: "CONFIRMED", paidAt: now, confirmedAt: now, respondedAt: now, videoRoomName: `demo-ali-${confirmedDate}`,
      studentNote: "Ali kesirler ve oran-orantıda zorlanıyor.",
    },
  });
  await db.payment.create({ data: { bookingId: confirmed.id, provider: "mock", providerToken: `demo_${confirmed.id}`, providerPaymentId: `demo_${confirmed.id}`, amount: confirmedPrice, status: "SUCCEEDED" } });
  await db.ledgerEntry.create({ data: { teacherId: ayse, bookingId: confirmed.id, bucket: "PENDING", amount: confirmedSplit.teacherAmount, description: `${confirmed.code} ders ücreti (ders sonrası serbest kalır)` } });

  const mehmet = teacherIds[1];
  const mehmetOffering = await db.teacherOffering.findFirstOrThrow({ where: { teacherId: mehmet, level: { slug: "yks" }, serviceType: { slug: "ozel-ders" } }, include: { level: true, subject: true, serviceType: true } });
  const pendingDate = nextDateWithWeekday(today, 3, WEEKDAYS);
  const pendingStart = zonedDateTime(pendingDate, 19 * 60);
  const pendingPrice = lessonPrice(mehmetOffering.hourlyPrice, 60);
  const pendingSplit = splitCommission(pendingPrice, 1500);
  const pending = await db.booking.create({
    data: {
      code: bookingCode(), studentId: parent.id, teacherId: mehmet, offeringId: mehmetOffering.id,
      serviceTypeId: mehmetOffering.serviceTypeId, levelId: mehmetOffering.levelId, subjectId: mehmetOffering.subjectId,
      serviceName: mehmetOffering.serviceType.name, levelName: mehmetOffering.level.name, subjectName: mehmetOffering.subject.name,
      learnerName: "Elif", learnerGrade: "11. Sınıf", mode: "ONLINE",
      startAt: pendingStart, endAt: new Date(pendingStart.getTime() + 3_600_000), blockEndAt: new Date(pendingStart.getTime() + 3_600_000),
      durationMinutes: 60, price: pendingPrice, commissionRateBps: 1500, ...pendingSplit,
      status: "PENDING_APPROVAL", paidAt: new Date(now.getTime() - 3_600_000), approvalDeadline: new Date(now.getTime() + 11 * 3_600_000),
      studentNote: "AYT elektrik ve manyetizma konularında destek istiyoruz.",
    },
  });
  await db.payment.create({ data: { bookingId: pending.id, provider: "mock", providerToken: `demo_${pending.id}`, providerPaymentId: `demo_${pending.id}`, amount: pendingPrice, status: "SUCCEEDED" } });
  await db.notification.create({ data: { userId: mehmet, type: "booking.request", title: "Yeni ders talebi", body: `Elif için YKS Fizik — ${pendingDate} 19:00. Lütfen onaylayın.`, link: "/ogretmen-paneli/talepler" } });

  return true;
}

async function main() {
  await seedLocations();
  await seedCatalog();
  await seedPages();
  const admin = await seedAdmin();
  const demo = shouldSeedDemo ? await seedDemo() : false;
  const demoCenter = shouldSeedDemo ? await seedDemoCenter() : false;

  console.log("✓ İl/ilçe, kademe, ders, hizmet türü ve yasal sayfalar hazır.");
  if (admin) console.log(`✓ Yönetici oluşturuldu → kullanıcı adı: ${admin.username}  şifre: ${admin.password}`);
  if (demo) {
    console.log("✓ Demo veriler eklendi (yalnızca geliştirme içindir):");
    console.log("    Öğretmen  → kullanıcı adı: ayse.yilmaz   şifre: Ogretmen123");
    console.log(`    Veli      → e-posta: veli@${DEMO_EMAIL_DOMAIN}   şifre: Veli12345`);
    console.log(`    Öğrenci   → e-posta: ogrenci@${DEMO_EMAIL_DOMAIN}   şifre: Ogrenci123`);
  }
  if (demoCenter) {
    console.log("✓ Demo kurum eklendi: Başarı Etüt Merkezi (/kurum):");
    console.log(`    Kurum sahibi → e-posta: kurum@${DEMO_EMAIL_DOMAIN}   şifre: Kurum12345`);
    console.log(`    Öğretmen     → e-posta: etut.ogretmen@${DEMO_EMAIL_DOMAIN}   şifre: Ogretmen123`);
    console.log(`    Muhasebe     → e-posta: muhasebe@${DEMO_EMAIL_DOMAIN}   şifre: Muhasebe123`);
    console.log(`    Veli portalı → veli@${DEMO_EMAIL_DOMAIN} hesabı “Ali Demirtaş”a bağlı`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
