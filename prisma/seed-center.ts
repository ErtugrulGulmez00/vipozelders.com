/**
 * Kurum paneli demo verisi (yalnızca geliştirme): "Başarı Etüt Merkezi".
 * Tekrar çalıştırılabilir: kurum zaten varsa hiçbir şey yapmaz.
 */
import { buildInstallments, allocatePayment } from "../src/lib/center/finance";
import { competitionRanks, computeNet, EXAM_PRESETS, gradeAnswers, parseTopics, round2 } from "../src/lib/center/exams";
import { addDaysToDateString, dateStringToDbDate, isoWeekday, toLocalDateString, toLocalMinutes, zonedDateTime } from "../src/lib/dates";
import { DEMO_EMAIL_DOMAIN } from "../src/lib/demo";
import { generateTemporaryPassword, hashPassword } from "../src/server/auth/password";
import { db } from "../src/server/db";

export const DEMO_CENTER_SLUG = "basari-etut-merkezi";

/** Tekrarlanabilir rastgele sayı üreteci (her çalıştırmada aynı demo veri). */
function random(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Ali", "Zeynep", "Elif", "Mehmet", "Ayşe", "Mustafa", "Defne", "Emir", "Asya", "Yusuf", "Ecrin", "Kerem", "Nehir", "Ömer", "Duru", "Eymen", "Miray", "Alp", "Ela", "Aras", "Beren", "Can", "Lina", "Efe", "Sude", "Baran", "İpek", "Deniz", "Yağmur", "Kuzey", "Azra", "Arda"];
const LAST = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Aydın", "Öztürk", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özdemir", "Polat", "Erdoğan", "Güneş"];
const MOTHERS = ["Fatma", "Emine", "Hatice", "Zehra", "Elif", "Merve", "Seda", "Gül", "Derya", "Canan"];
const FATHERS = ["Ahmet", "Hasan", "Murat", "Serkan", "Emre", "Kemal", "Burak", "Okan", "Volkan", "Tolga"];

export async function seedDemoCenter(): Promise<boolean> {
  if (await db.center.findUnique({ where: { slug: DEMO_CENTER_SLUG } })) return false;
  const rand = random(20261012);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const now = new Date();
  const today = toLocalDateString(now);
  const istanbul = await db.city.findFirst({ where: { name: "İstanbul" } });
  const kadikoy = istanbul ? await db.district.findFirst({ where: { cityId: istanbul.id, name: "Kadıköy" } }) : null;

  const center = await db.center.create({
    data: {
      name: "Başarı Etüt Merkezi",
      slug: DEMO_CENTER_SLUG,
      kind: "ETUT",
      status: "ACTIVE",
      plan: "PRO",
      studentLimit: 300,
      paidUntil: new Date(now.getTime() + 25 * 86_400_000),
      phone: "0216 555 12 34",
      email: `iletisim@${DEMO_EMAIL_DOMAIN}`,
      address: "Caferağa Mah. Moda Cad. No: 12",
      cityId: istanbul?.id ?? null,
      districtId: kadikoy?.id ?? null,
      taxOffice: "Kadıköy VD",
      taxNumber: "1234567890",
      isPublic: true,
      description:
        "2015'ten beri Kadıköy'de LGS ve YKS hazırlık. Küçük sınıflar (en fazla 14 öğrenci), haftalık birebir etüt, her ay Türkiye geneli deneme ve rehberlik görüşmesi.\n\nVeliler devamsızlık, deneme sonuçları ve eksik konuları Pi Kampüs veli portalından anlık takip eder.",
      nextReceiptNo: 1,
    },
  });

  // Personel
  const owner = await db.user.create({
    data: {
      role: "CENTER",
      email: `kurum@${DEMO_EMAIL_DOMAIN}`,
      username: "kurum.demo",
      firstName: "Selin",
      lastName: "Aydın",
      phone: "05321234567",
      passwordHash: await hashPassword("Kurum12345"),
      emailVerifiedAt: now,
      centerMemberships: { create: { centerId: center.id, role: "OWNER", title: "Kurucu müdür" } },
    },
    include: { centerMemberships: true },
  });
  const teacher = await db.user.create({
    data: {
      role: "CENTER",
      email: `etut.ogretmen@${DEMO_EMAIL_DOMAIN}`,
      username: "burak.sahin.kurum",
      firstName: "Burak",
      lastName: "Şahin",
      phone: "05339876543",
      passwordHash: await hashPassword("Ogretmen123"),
      emailVerifiedAt: now,
      centerMemberships: { create: { centerId: center.id, role: "TEACHER", title: "Rehber öğretmen", branch: "Matematik" } },
    },
    include: { centerMemberships: true },
  });
  const accountant = await db.user.create({
    data: {
      role: "CENTER",
      email: `muhasebe@${DEMO_EMAIL_DOMAIN}`,
      username: "derya.koc",
      firstName: "Derya",
      lastName: "Koç",
      passwordHash: await hashPassword("Muhasebe123"),
      emailVerifiedAt: now,
      centerMemberships: { create: { centerId: center.id, role: "ACCOUNTANT", title: "Sekreter / muhasebe" } },
    },
    include: { centerMemberships: true },
  });
  const ownerMember = owner.centerMemberships[0];
  const burak = teacher.centerMemberships[0];
  // Pazaryerindeki demo öğretmen Ayşe Yılmaz da bu kurumda fen dersine giriyor.
  const ayse = await db.user.findUnique({ where: { email: `ayse.yilmaz@${DEMO_EMAIL_DOMAIN}` } });
  const ayseMember = ayse ? await db.centerMember.create({ data: { centerId: center.id, userId: ayse.id, role: "TEACHER", branch: "Fen Bilimleri" } }) : burak;
  const zeynepHoca = await db.user.create({
    data: {
      role: "CENTER",
      username: "zeynep.ercan",
      firstName: "Zeynep",
      lastName: "Ercan",
      passwordHash: await hashPassword(generateTemporaryPassword()),
      centerMemberships: { create: { centerId: center.id, role: "TEACHER", branch: "Türkçe" } },
    },
    include: { centerMemberships: true },
  });
  const zeynep = zeynepHoca.centerMemberships[0];
  await db.centerSubscriptionPayment.create({
    data: { centerId: center.id, amount: 299_000, months: 1, periodStart: new Date(now.getTime() - 5 * 86_400_000), periodEnd: center.paidUntil!, method: "Havale/EFT", reference: "Demo dekont" },
  });

  // Sınıflar ve program
  const groups = {
    a: await db.centerGroup.create({ data: { centerId: center.id, name: "8-A LGS", gradeName: "8. Sınıf", targetExam: "LGS", teacherId: burak.id, room: "A dersliği", capacity: 14 } }),
    b: await db.centerGroup.create({ data: { centerId: center.id, name: "8-B LGS", gradeName: "8. Sınıf", targetExam: "LGS", teacherId: ayseMember.id, room: "B dersliği", capacity: 14 } }),
    c: await db.centerGroup.create({ data: { centerId: center.id, name: "12 Sayısal", gradeName: "12. Sınıf", targetExam: "YKS (TYT-AYT)", teacherId: burak.id, room: "C dersliği", capacity: 12 } }),
  };
  const slotPlan: [keyof typeof groups, number[], string, string, string, string][] = [
    ["a", [1, 3, 5], "16:00", "16:40", "Matematik", burak.id],
    ["a", [1, 3, 5], "16:50", "17:30", "Fen Bilimleri", ayseMember.id],
    ["a", [2, 4], "16:00", "16:40", "Türkçe", zeynep.id],
    ["a", [2, 4], "16:50", "17:30", "İnkılap Tarihi", zeynep.id],
    ["b", [1, 3, 5], "16:00", "16:40", "Fen Bilimleri", ayseMember.id],
    ["b", [1, 3, 5], "16:50", "17:30", "Matematik", burak.id],
    ["b", [2, 4], "16:00", "16:40", "İngilizce", zeynep.id],
    ["b", [2, 4], "16:50", "17:30", "Türkçe", zeynep.id],
    ["c", [1, 2, 3, 4], "17:40", "18:20", "Matematik", burak.id],
    ["c", [1, 3], "18:30", "19:10", "Fizik", ayseMember.id],
    ["c", [2, 4], "18:30", "19:10", "Kimya", ayseMember.id],
    ["c", [6], "10:00", "12:00", "TYT kampı", burak.id],
  ];
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const slots: { id: string; groupKey: keyof typeof groups; weekday: number; start: number; end: number; subject: string; teacherId: string }[] = [];
  for (const [key, days, start, end, subject, teacherId] of slotPlan) {
    for (const weekday of days) {
      const room = key === "a" ? "A dersliği" : key === "b" ? "B dersliği" : "C dersliği";
      const slot = await db.centerScheduleSlot.create({ data: { centerId: center.id, groupId: groups[key].id, weekday, startMinute: minutes(start), endMinute: minutes(end), subject, teacherId, room } });
      slots.push({ id: slot.id, groupKey: key, weekday, start: slot.startMinute, end: slot.endMinute, subject, teacherId });
    }
  }

  // Öğrenciler ve veliler
  const parent = await db.user.findUnique({ where: { email: `veli@${DEMO_EMAIL_DOMAIN}` } });
  const students: { id: string; name: string; groupKey: keyof typeof groups; ability: number; phone: string }[] = [];
  let number = 1001;
  const usedNames = new Set<string>();
  const roster: [keyof typeof groups, number][] = [
    ["a", 12],
    ["b", 10],
    ["c", 10],
  ];
  for (const [key, count] of roster) {
    for (let i = 0; i < count; i++) {
      let first = "";
      let last = "";
      if (key === "a" && i === 0 && parent) {
        first = "Ali";
        last = "Demirtaş";
      } else {
        do {
          first = pick(FIRST);
          last = pick(LAST);
        } while (usedNames.has(`${first} ${last}`));
      }
      usedNames.add(`${first} ${last}`);
      const female = ["Zeynep", "Elif", "Ayşe", "Defne", "Asya", "Ecrin", "Nehir", "Duru", "Miray", "Ela", "Beren", "Lina", "Sude", "İpek", "Yağmur", "Azra"].includes(first);
      const motherPhone = `053${String(Math.floor(rand() * 1e8)).padStart(8, "0")}`;
      const fatherPhone = `054${String(Math.floor(rand() * 1e8)).padStart(8, "0")}`;
      const student = await db.centerStudent.create({
        data: {
          centerId: center.id,
          studentNumber: String(number++),
          firstName: first,
          lastName: last,
          gender: female ? "FEMALE" : "MALE",
          birthDate: dateStringToDbDate(key === "c" ? `2008-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}` : `2012-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}`),
          schoolName: key === "c" ? pick(["Kadıköy Anadolu Lisesi", "Fenerbahçe Anadolu Lisesi", "Erenköy Kız Lisesi"]) : pick(["Moda Ortaokulu", "Caferağa Ortaokulu", "Fikirtepe Ortaokulu"]),
          gradeName: groups[key].gradeName,
          targetExam: groups[key].targetExam,
          enrolledAt: new Date(now.getTime() - (40 + Math.floor(rand() * 20)) * 86_400_000),
          guardians: {
            create:
              key === "a" && i === 0 && parent
                ? [{ centerId: center.id, fullName: `${parent.firstName} ${parent.lastName}`, relation: "Anne", phone: parent.phone, email: parent.email, isPrimary: true, userId: parent.id, linkedAt: now }]
                : [
                    { centerId: center.id, fullName: `${pick(MOTHERS)} ${last}`, relation: "Anne", phone: motherPhone, email: rand() > 0.5 ? `veli${number}@${DEMO_EMAIL_DOMAIN}` : null, isPrimary: true },
                    ...(rand() > 0.4 ? [{ centerId: center.id, fullName: `${pick(FATHERS)} ${last}`, relation: "Baba", phone: fatherPhone, notifySms: rand() > 0.3 }] : []),
                  ],
          },
          groups: { create: { groupId: groups[key].id } },
        },
      });
      students.push({ id: student.id, name: `${first} ${last}`, groupKey: key, ability: 0.45 + rand() * 0.5, phone: key === "a" && i === 0 && parent?.phone ? parent.phone : motherPhone });
    }
  }

  // Son 14 günün yoklamaları (bugünün öğleden sonra dersleri henüz alınmadı)
  const nowMinutes = toLocalMinutes(now);
  for (let back = 14; back >= 0; back--) {
    const date = addDaysToDateString(today, -back);
    const weekday = isoWeekday(date);
    for (const slot of slots.filter((s) => s.weekday === weekday)) {
      if (back === 0 && slot.end > nowMinutes) continue;
      const members = students.filter((s) => s.groupKey === slot.groupKey);
      const session = await db.centerAttendanceSession.create({
        data: {
          centerId: center.id,
          groupId: groups[slot.groupKey].id,
          slotId: slot.id,
          date: dateStringToDbDate(date),
          startMinute: slot.start,
          endMinute: slot.end,
          subject: slot.subject,
          teacherId: slot.teacherId,
          takenById: slot.teacherId,
          takenAt: zonedDateTime(date, slot.start + 5),
        },
      });
      const records = members.map((m) => {
        const r = rand();
        const status = r < 0.05 ? "ABSENT" : r < 0.08 ? "LATE" : r < 0.1 ? "EXCUSED" : "PRESENT";
        return { sessionId: session.id, studentId: m.id, status: status as "ABSENT" | "LATE" | "EXCUSED" | "PRESENT", notifiedAt: status === "ABSENT" ? zonedDateTime(date, slot.start + 6) : null };
      });
      await db.centerAttendance.createMany({ data: records });
      for (const r of records.filter((x) => x.status === "ABSENT")) {
        const s = students.find((x) => x.id === r.studentId)!;
        const [y, mo, d] = date.split("-");
        await db.centerMessage.create({
          data: {
            centerId: center.id,
            channel: "SMS",
            to: s.phone,
            body: `Başarı Etüt Merkezi: Sayın veli, öğrenciniz ${s.name} ${d}.${mo}.${y} ${Math.floor(slot.start / 60)}:${String(slot.start % 60).padStart(2, "0")} ${slot.subject} dersine katılmamıştır.`,
            kind: "absence",
            studentId: s.id,
            status: "SKIPPED",
            error: "SMS sağlayıcısı tanımlı değil; mesaj yalnızca kayıt altına alındı.",
            createdAt: zonedDateTime(date, slot.start + 6),
          },
        });
      }
    }
  }

  // Etütler: geçmiş (yapıldı) ve gelecek (planlı)
  const etudPlan: [number, string, string, string, string | null, string][] = [
    [-3, "17:40", "18:20", "Matematik", "Üslü ifadeler", burak.id],
    [-2, "17:40", "18:20", "Fen Bilimleri", "Basınç", ayseMember.id],
    [1, "17:40", "18:20", "Matematik", "Kareköklü ifadeler", burak.id],
    [2, "18:30", "19:10", "Türkçe", "Fiilimsiler", zeynep.id],
    [3, "15:00", "15:40", "Fizik", "Elektrik", ayseMember.id],
  ];
  for (const [offset, start, end, subject, topic, teacherId] of etudPlan) {
    const date = addDaysToDateString(today, offset);
    const pool = subject === "Fizik" ? students.filter((s) => s.groupKey === "c") : students.filter((s) => s.groupKey !== "c");
    const chosen = [...pool].sort((a, b) => a.ability - b.ability).slice(0, 3);
    await db.centerEtud.create({
      data: {
        centerId: center.id,
        teacherId,
        date: dateStringToDbDate(date),
        startMinute: minutes(start),
        endMinute: minutes(end),
        subject,
        topic,
        room: "Etüt odası",
        status: offset < 0 ? "DONE" : "PLANNED",
        notes: offset < 0 ? "Konu tekrarı yapıldı, 20 soruluk ödev verildi." : null,
        students: { create: chosen.map((s, i) => ({ studentId: s.id, attendance: offset < 0 ? (i === 2 && offset === -2 ? "ABSENT" : "PRESENT") : null })) },
      },
    });
  }

  // Denemeler
  const lgsTopics: Record<string, string> = {
    Matematik: "1-4: Çarpanlar ve katlar\n5-8: Üslü ifadeler\n9-12: Kareköklü ifadeler\n13-16: Veri analizi\n17-20: Olasılık",
    "Fen Bilimleri": "1-4: Mevsimler ve iklim\n5-8: DNA ve genetik kod\n9-12: Basınç\n13-16: Madde ve endüstri\n17-20: Basit makineler",
    Türkçe: "1-5: Sözcükte anlam\n6-10: Cümlede anlam\n11-15: Paragraf\n16-20: Fiilimsiler",
  };
  const topicDifficulty: Record<string, number> = { "Üslü ifadeler": -0.25, Olasılık: -0.2, Basınç: -0.22, Fiilimsiler: -0.18, "Kareköklü ifadeler": -0.1, "DNA ve genetik kod": -0.08 };
  async function createExam(name: string, kind: "LGS" | "TYT", daysAgo: number, publisher: string, withAnswers: boolean, groupKeys: (keyof typeof groups)[], bias: number) {
    const preset = EXAM_PRESETS[kind];
    const exam = await db.centerExam.create({
      data: {
        centerId: center.id,
        name,
        kind,
        date: dateStringToDbDate(addDaysToDateString(today, -daysAgo)),
        publisher,
        wrongPenalty: preset.wrongPenalty,
        isPublished: true,
        sections: { create: preset.sections.map((s, order) => ({ name: s.name, questionCount: s.questionCount, subjectSlug: s.subjectSlug, order, topics: [] })) },
      },
      include: { sections: { orderBy: { order: "asc" } } },
    });
    const keys = new Map<string, { key: string; topics: string[] }>();
    if (withAnswers) {
      for (const section of exam.sections) {
        const topicText = lgsTopics[section.name];
        if (!topicText) continue;
        const key = Array.from({ length: section.questionCount }, () => "ABCD"[Math.floor(rand() * 4)]).join("");
        const { topics } = parseTopics(topicText, section.questionCount);
        await db.centerExamSection.update({ where: { id: section.id }, data: { answerKey: key, topics } });
        keys.set(section.id, { key, topics });
      }
    }
    const participants = students.filter((s) => groupKeys.includes(s.groupKey));
    const rows: { studentId: string; sections: { sectionId: string; correct: number; wrong: number; blank: number; net: number; answers: string | null }[] }[] = [];
    for (const s of participants) {
      if (rand() < 0.06) continue; // sınava girmeyenler
      const sections = exam.sections.map((section) => {
        const keyInfo = keys.get(section.id);
        if (keyInfo) {
          const answers = keyInfo.key
            .split("")
            .map((k, i) => {
              const p = Math.min(0.97, Math.max(0.05, s.ability + bias + (topicDifficulty[keyInfo.topics[i]] ?? 0)));
              const r = rand();
              if (r < p) return k;
              if (r < p + (1 - p) * 0.35) return "-";
              return "ABCD".replace(k, "")[Math.floor(rand() * 3)];
            })
            .join("");
          const graded = gradeAnswers(keyInfo.key, answers);
          return { sectionId: section.id, correct: graded.correct, wrong: graded.wrong, blank: graded.blank, net: computeNet(graded.correct, graded.wrong, exam.wrongPenalty), answers };
        }
        const p = Math.min(0.97, Math.max(0.05, s.ability + bias + (rand() - 0.5) * 0.15));
        const correct = Math.round(section.questionCount * p);
        const wrong = Math.min(section.questionCount - correct, Math.round((section.questionCount - correct) * (0.5 + rand() * 0.3)));
        return { sectionId: section.id, correct, wrong, blank: section.questionCount - correct - wrong, net: computeNet(correct, wrong, exam.wrongPenalty), answers: null };
      });
      rows.push({ studentId: s.id, sections });
    }
    const nets = rows.map((r) => round2(r.sections.reduce((t, x) => t + x.net, 0)));
    const ranks = competitionRanks(nets);
    for (const [i, row] of rows.entries()) {
      await db.centerExamResult.create({
        data: {
          examId: exam.id,
          studentId: row.studentId,
          correct: row.sections.reduce((t, x) => t + x.correct, 0),
          wrong: row.sections.reduce((t, x) => t + x.wrong, 0),
          blank: row.sections.reduce((t, x) => t + x.blank, 0),
          net: nets[i],
          rank: ranks[i],
          sections: { create: row.sections },
        },
      });
    }
  }
  await createExam("LGS Türkiye Geneli 1", "LGS", 28, "Hız Yayınları", false, ["a", "b"], -0.08);
  await createExam("LGS Türkiye Geneli 2", "LGS", 14, "Nartest", false, ["a", "b"], -0.03);
  await createExam("LGS Kurum Denemesi 3", "LGS", 4, "Kurum içi", true, ["a", "b"], 0.02);
  await createExam("TYT Deneme 1", "TYT", 10, "3D Yayınları", false, ["c"], -0.05);

  // Ödeme planları ve tahsilatlar
  let receipt = 1;
  const academicStart = "2026-09-15";
  for (const s of students) {
    const total = s.groupKey === "c" ? 6_000_000 : 4_500_000;
    const discount = rand() < 0.3 ? Math.round(total * 0.1) : 0;
    const net = total - discount;
    const plan = await db.centerFeePlan.create({
      data: {
        centerId: center.id,
        studentId: s.id,
        title: "2026-2027 eğitim ücreti",
        totalAmount: total,
        discountAmount: discount,
        netAmount: net,
        note: discount ? "Kardeş indirimi (%10)" : null,
        installments: {
          create: buildInstallments({ netAmount: net, count: 9, firstDueDate: academicStart, downPayment: 500_000, downPaymentDate: "2026-09-01" }).map((i) => ({
            centerId: center.id,
            studentId: s.id,
            order: i.order,
            dueDate: dateStringToDbDate(i.dueDate),
            amount: i.amount,
          })),
        },
      },
      include: { installments: true },
    });
    // Herkes peşinatı ödedi; çoğu eylül taksitini de ödedi, bazıları gecikti.
    const pays: { amount: number; date: string; method: "CASH" | "CARD" | "TRANSFER" }[] = [{ amount: 500_000, date: "2026-09-01", method: "CASH" }];
    if (rand() > 0.2) {
      pays.push({ amount: plan.installments.find((i) => i.order === 2)!.amount, date: "2026-09-14", method: rand() > 0.5 ? "TRANSFER" : "CARD" });
      // Bir kısmı ekim taksitini vadesinden önce ödedi (bu ayın tahsilatı).
      const october = plan.installments.find((i) => i.order === 3)!;
      const earlyDate = addDaysToDateString(today, -1 - Math.floor(rand() * 7));
      if (rand() > 0.5 && earlyDate < october.dueDate.toISOString().slice(0, 10)) pays.push({ amount: october.amount, date: earlyDate, method: rand() > 0.5 ? "TRANSFER" : "CASH" });
    }
    const open = plan.installments.map((i) => ({ id: i.id, order: i.order, dueDate: i.dueDate.toISOString().slice(0, 10), amount: i.amount, paidAmount: 0 }));
    for (const pay of pays) {
      const { allocations } = allocatePayment(open, pay.amount);
      await db.centerPayment.create({
        data: {
          centerId: center.id,
          studentId: s.id,
          receiptNo: receipt++,
          amount: pay.amount,
          method: pay.method,
          paidAt: zonedDateTime(pay.date, 12 * 60),
          payerName: null,
          createdById: accountant.id,
          allocations: { create: allocations },
        },
      });
      for (const a of allocations) {
        const inst = open.find((o) => o.id === a.installmentId)!;
        inst.paidAmount += a.amount;
        await db.centerInstallment.update({ where: { id: a.installmentId }, data: { paidAmount: inst.paidAmount } });
      }
    }
  }
  await db.center.update({ where: { id: center.id }, data: { nextReceiptNo: receipt } });

  // Giderler
  const expenses: ["RENT" | "SALARY" | "UTILITY" | "SUPPLIES" | "MARKETING" | "TAX", number, string, string, string | null][] = [
    ["RENT", 4_500_000, "2026-09-01", "Eylül kirası", null],
    ["RENT", 4_500_000, "2026-10-01", "Ekim kirası", null],
    ["SALARY", 3_800_000, "2026-09-30", "Eylül maaşı", burak.id],
    ["SALARY", 3_600_000, "2026-09-30", "Eylül maaşı", zeynep.id],
    ["UTILITY", 620_000, "2026-09-20", "Elektrik + internet", null],
    ["SUPPLIES", 1_150_000, "2026-09-05", "LGS soru bankaları", null],
    ["MARKETING", 400_000, "2026-09-03", "Sosyal medya reklamı", null],
    ["TAX", 980_000, "2026-09-26", "SGK primleri", null],
  ];
  for (const [category, amount, date, description, memberId] of expenses) {
    await db.centerExpense.create({ data: { centerId: center.id, category, amount, date: dateStringToDbDate(date), description, memberId, createdById: accountant.id, paidTo: memberId ? null : category === "RENT" ? "Mal sahibi" : null } });
  }

  // Ön kayıtlar ve duyurular
  await db.centerLead.createMany({
    data: [
      { centerId: center.id, studentName: "Mira Toprak", parentName: "Esra Toprak", phone: "05301112233", gradeName: "7. Sınıf", message: "Hafta sonu LGS programınız var mı?", source: "web" },
      { centerId: center.id, studentName: "Kaan Uçar", parentName: "Levent Uçar", phone: "05302223344", gradeName: "11. Sınıf", source: "telefon", status: "CONTACTED", note: "Cumartesi tanışma görüşmesine gelecek" },
      { centerId: center.id, studentName: "Ece Bulut", phone: "05303334455", gradeName: "8. Sınıf", source: "tavsiye" },
    ],
  });
  await db.centerAnnouncement.createMany({
    data: [
      { centerId: center.id, title: "Veli toplantısı", body: "18 Ekim Cumartesi 11:00'de 8. sınıf velilerimizle LGS yol haritası toplantısı yapacağız. Katılımınızı rica ederiz.", sendEmail: true, createdById: owner.id, createdAt: new Date(now.getTime() - 2 * 86_400_000) },
      { centerId: center.id, title: "TYT kampı", body: "12 Sayısal öğrencilerimiz için cumartesi 10:00-12:00 TYT kampı başlıyor.", groupId: groups.c.id, sendEmail: true, createdById: owner.id, createdAt: new Date(now.getTime() - 5 * 86_400_000) },
    ],
  });
  await db.centerNote.create({
    data: { centerId: center.id, studentId: students[0].id, authorId: burak.id, kind: "GUIDANCE", text: "Matematikte üslü ifadeler ve olasılık konularında eksik var; haftalık etüde alındı. Evde günde 20 soru çözmesi önerildi.", visibleToParent: true },
  });
  if (parent) {
    await db.notification.create({ data: { userId: parent.id, type: "center.exam_result", title: "Deneme sonucu: LGS Kurum Denemesi 3", body: "Ali · sonuç veli portalında", link: "/hesabim/kurum" } });
  }
  await db.notification.create({ data: { userId: ownerMember.userId, type: "center.lead", title: "Yeni ön kayıt", body: "Mira Toprak (7. Sınıf) · 05301112233", link: "/kurum/on-kayit" } });
  return true;
}
