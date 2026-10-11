import { randomUUID } from "node:crypto";
import { zonedDateTime } from "@/lib/dates";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";

/** Testler sabit bir "şimdi" kullanır: 7 Ocak 2030 Pazartesi 09:00 (İstanbul). */
export const NOW = zonedDateTime("2030-01-07", 9 * 60);
export const LESSON_DAY = "2030-01-08";
export const at = (day: string, hhmm: string) => zonedDateTime(day, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)));
export const hoursAfter = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000);

let passwordHash: string | null = null;

export async function createFixture(options: { bufferMinutes?: number; hourlyPrice?: number } = {}) {
  passwordHash ??= await hashPassword("Test12345");
  const id = randomUUID().slice(0, 8);

  const level = await db.level.create({ data: { name: `Lise ${id}`, slug: `lise-${id}` } });
  const subject = await db.subject.create({ data: { name: `Matematik ${id}`, slug: `matematik-${id}` } });
  const service = await db.serviceType.create({ data: { name: "Özel Ders", slug: `ozel-ders-${id}` } });

  const teacher = await db.user.create({
    data: {
      role: "TEACHER",
      username: `ogretmen.${id}`,
      email: `ogretmen.${id}@test.local`,
      firstName: "Test",
      lastName: "Öğretmen",
      passwordHash,
      teacherProfile: {
        create: {
          slug: `test-ogretmen-${id}`,
          status: "PUBLISHED",
          bufferMinutes: options.bufferMinutes ?? 0,
          availabilityRules: {
            create: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, startMinute: 8 * 60, endMinute: 22 * 60 })),
          },
        },
      },
    },
  });
  const offering = await db.teacherOffering.create({
    data: {
      teacherId: teacher.id,
      serviceTypeId: service.id,
      levelId: level.id,
      subjectId: subject.id,
      hourlyPrice: options.hourlyPrice ?? 100000,
      durations: [45, 60, 90],
    },
  });
  return { teacher, offering, createStudent: () => createStudent(id) };
}

let studentCounter = 0;

export async function createStudent(prefix = randomUUID().slice(0, 8)) {
  passwordHash ??= await hashPassword("Test12345");
  studentCounter++;
  return db.user.create({
    data: {
      role: "STUDENT",
      email: `veli.${prefix}.${studentCounter}@test.local`,
      firstName: "Test",
      lastName: `Veli${studentCounter}`,
      passwordHash,
      studentProfile: { create: { kvkkConsentAt: new Date() } },
    },
  });
}
