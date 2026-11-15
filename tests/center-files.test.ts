import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { fileForDownload, filesForStudent } from "@/server/center/files";
import { db } from "@/server/db";
import { createStudent } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

describe("Kurum dosyaları: kim görür, kim indirir", () => {
  it("herkese açık, sınıfa ve tek öğrenciye paylaşılan dosyalar doğru kişilere görünür", async () => {
    const id = randomUUID().slice(0, 8);
    const center = await db.center.create({ data: { name: `Dosya Etüt ${id}`, slug: `dosya-etut-${id}`, status: "ACTIVE" } });
    const other = await db.center.create({ data: { name: `Başka Etüt ${id}`, slug: `baska-etut-${id}`, status: "ACTIVE" } });
    const group = await db.centerGroup.create({ data: { centerId: center.id, name: "8-A" } });
    const ali = await db.centerStudent.create({ data: { centerId: center.id, firstName: "Ali", lastName: "Koç" } });
    const ece = await db.centerStudent.create({ data: { centerId: center.id, firstName: "Ece", lastName: "Kaya" } });
    await db.centerGroupStudent.create({ data: { groupId: group.id, studentId: ali.id } });
    const aliUser = await createStudent(`ali${id}`);
    const eceUser = await createStudent(`ece${id}`);
    const stranger = await createStudent(`yab${id}`);
    await db.centerGuardian.create({ data: { centerId: center.id, studentId: ali.id, fullName: "Ali Koç", relation: "Öğrenci", isStudentAccount: true, userId: aliUser.id, linkedAt: new Date() } });
    await db.centerGuardian.create({ data: { centerId: center.id, studentId: ece.id, fullName: "Ece Kaya", relation: "Öğrenci", isStudentAccount: true, userId: eceUser.id, linkedAt: new Date() } });
    const make = (title: string, extra: { groupId?: string; studentId?: string; centerId?: string } = {}) =>
      db.centerFile.create({ data: { centerId: extra.centerId ?? center.id, groupId: extra.groupId, studentId: extra.studentId, title, fileKey: `private/kurum-dosya/${randomUUID()}.pdf`, fileName: `${title}.pdf`, size: 1000 } });
    const all = await make("Herkese");
    const forGroup = await make("Sınıfa", { groupId: group.id });
    const forEce = await make("Eceye", { studentId: ece.id });
    const elsewhere = await make("Başka kurum", { centerId: other.id });

    expect((await filesForStudent(ali.id)).map((f) => f.title).sort()).toEqual(["Herkese", "Sınıfa"]);
    expect((await filesForStudent(ece.id)).map((f) => f.title).sort()).toEqual(["Eceye", "Herkese"]);

    expect(await fileForDownload(aliUser.id, "STUDENT", all.id)).not.toBeNull();
    expect(await fileForDownload(aliUser.id, "STUDENT", forGroup.id)).not.toBeNull();
    expect(await fileForDownload(aliUser.id, "STUDENT", forEce.id)).toBeNull();
    expect(await fileForDownload(eceUser.id, "STUDENT", forGroup.id)).toBeNull();
    expect(await fileForDownload(eceUser.id, "STUDENT", forEce.id)).not.toBeNull();
    expect(await fileForDownload(aliUser.id, "STUDENT", elsewhere.id)).toBeNull();
    expect(await fileForDownload(stranger.id, "STUDENT", all.id)).toBeNull();

    // Kurumdan ayrılan öğrenci artık indiremez
    await db.centerStudent.update({ where: { id: ali.id }, data: { status: "PASSIVE" } });
    expect(await fileForDownload(aliUser.id, "STUDENT", all.id)).toBeNull();
  });
});
