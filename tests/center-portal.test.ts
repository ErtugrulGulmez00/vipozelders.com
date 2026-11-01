import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { dateStringToDbDate } from "@/lib/dates";
import { messageGuardians } from "@/server/center/messages";
import { portalChildDetail, portalChildSummaries } from "@/server/center/portal";
import { db } from "@/server/db";
import { childDetailJson } from "@/server/mobile/center";
import { createStudent } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

/** Ödeme planı, yapılmış ödemesi ve veliye açık notu olan öğrenci; velisi ve kendi öğrenci hesabı portala bağlı. */
async function studentWithFamily() {
  const id = randomUUID().slice(0, 8);
  const center = await db.center.create({ data: { name: `Test Etüt ${id}`, slug: `test-etut-${id}`, status: "ACTIVE" } });
  const student = await db.centerStudent.create({ data: { centerId: center.id, firstName: "Ali", lastName: "Koç" } });
  const plan = await db.centerFeePlan.create({ data: { centerId: center.id, studentId: student.id, title: "Yıllık ücret", totalAmount: 3_000_000, netAmount: 3_000_000 } });
  await db.centerInstallment.create({ data: { planId: plan.id, centerId: center.id, studentId: student.id, order: 1, dueDate: dateStringToDbDate("2099-01-15"), amount: 3_000_000 } });
  await db.centerPayment.create({ data: { centerId: center.id, studentId: student.id, receiptNo: 1, amount: 500_000, method: "CASH", paidAt: new Date() } });
  await db.centerNote.create({ data: { centerId: center.id, studentId: student.id, kind: "PARENT_MEETING", text: "Veliyle görüşüldü: evde telefon kullanımı sınırlanacak.", visibleToParent: true } });
  const parentUser = await createStudent(`veli${id}`);
  const studentUser = await createStudent(`ogr${id}`);
  const parent = await db.centerGuardian.create({ data: { centerId: center.id, studentId: student.id, fullName: "Ayşe Koç", relation: "Anne", userId: parentUser.id, linkedAt: new Date() } });
  const own = await db.centerGuardian.create({
    data: { centerId: center.id, studentId: student.id, fullName: "Ali Koç", relation: "Öğrenci", isStudentAccount: true, userId: studentUser.id, linkedAt: new Date(), email: studentUser.email },
  });
  return { center, student, parentUser, studentUser, parent, own };
}

describe("Kurum portalı: öğrencinin kendi hesabı", () => {
  it("veli ödemeleri ve veliye açık notları görür; öğrenci hesabı görmez (web ve mobil)", async () => {
    const { parentUser, studentUser, parent, own } = await studentWithFamily();

    const forParent = (await portalChildDetail(parentUser.id, parent.id))!;
    expect(forParent.installments).toHaveLength(1);
    expect(forParent.payments).toHaveLength(1);
    expect(forParent.notes).toHaveLength(1);
    expect(forParent.balance?.remaining).toBe(3_000_000);

    const forStudent = (await portalChildDetail(studentUser.id, own.id))!;
    expect(forStudent.installments).toEqual([]);
    expect(forStudent.payments).toEqual([]);
    expect(forStudent.notes).toEqual([]);
    expect(forStudent.balance).toBeNull();

    const json = await childDetailJson(studentUser.id, own.id);
    expect(json.modules.payments).toBe(false);
    expect(json.balance).toEqual({ total: 0, paid: 0, remaining: 0, overdue: 0 });
    expect(json).toMatchObject({ installments: [], payments: [], notes: [] });
    expect((await childDetailJson(parentUser.id, parent.id)).modules.payments).toBe(true);

    const summaries = await portalChildSummaries([{ studentId: own.studentId, isStudentAccount: true }]);
    expect(summaries.get(own.studentId)?.nextDue).toBeNull();
    expect((await portalChildSummaries([{ studentId: parent.studentId, isStudentAccount: false }])).get(parent.studentId)?.nextDue?.amount).toBe(3_000_000);
  });

  it("ödeme ve kurumun veliye yazdığı mesaj öğrenci hesabına bildirim olarak gitmez; ödev bildirimi gider", async () => {
    const { center, student, parentUser, studentUser } = await studentWithFamily();
    const base = { centerId: center.id, centerName: center.name, studentId: student.id };
    await messageGuardians({ ...base, kind: "payment_reminder", message: "Taksit hatırlatması", notification: { title: "Yaklaşan taksit", body: "Ali Koç · 30.000 ₺" } });
    await messageGuardians({ ...base, kind: "custom", force: true, message: "Veliyle görüşmek istiyoruz.", notification: { title: "Kurum size mesaj gönderdi", body: "Veliyle görüşmek istiyoruz." } });
    await messageGuardians({ ...base, kind: "homework", message: "Yeni ödev", notification: { title: "Yeni ödev: Matematik", body: "Üslü sayılar" } });

    const titles = async (userId: string) => (await db.notification.findMany({ where: { userId }, select: { title: true } })).map((n) => n.title).sort();
    expect(await titles(parentUser.id)).toEqual(["Kurum size mesaj gönderdi", "Yaklaşan taksit", "Yeni ödev: Matematik"]);
    expect(await titles(studentUser.id)).toEqual(["Yeni ödev: Matematik"]);
  });
});
