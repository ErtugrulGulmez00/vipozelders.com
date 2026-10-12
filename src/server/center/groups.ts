import { minutesToTime, WEEKDAY_NAMES } from "@/lib/dates";
import { db } from "../db";
import type { CenterContext } from "./context";
import { CenterError, isUniqueViolation } from "./errors";

// Sınıflar (gruplar) ve haftalık ders programı.

export type GroupInput = {
  name: string;
  gradeName: string | null;
  targetExam: string | null;
  teacherId: string | null;
  room: string | null;
  capacity: number | null;
};

async function assertMember(ctx: CenterContext, memberId: string | null) {
  if (!memberId) return;
  const member = await db.centerMember.findFirst({ where: { id: memberId, centerId: ctx.center.id } });
  if (!member) throw new CenterError("Seçilen öğretmen bu kurumda kayıtlı değil.");
}

export async function getGroupOrThrow(ctx: CenterContext, groupId: string) {
  const group = await db.centerGroup.findFirst({ where: { id: groupId, centerId: ctx.center.id } });
  if (!group) throw new CenterError("Sınıf bulunamadı.");
  return group;
}

export async function saveGroup(ctx: CenterContext, groupId: string | null, input: GroupInput) {
  await assertMember(ctx, input.teacherId);
  try {
    if (groupId) {
      await getGroupOrThrow(ctx, groupId);
      return await db.centerGroup.update({ where: { id: groupId }, data: input });
    }
    return await db.centerGroup.create({ data: { ...input, centerId: ctx.center.id } });
  } catch (error) {
    if (isUniqueViolation(error)) throw new CenterError("Bu adla bir sınıf zaten var.", { name: "Ad kullanımda." });
    throw error;
  }
}

/** Yoklama geçmişi olan sınıf silinmez, arşivlenir. */
export async function deleteOrArchiveGroup(ctx: CenterContext, groupId: string): Promise<"deleted" | "archived"> {
  await getGroupOrThrow(ctx, groupId);
  const sessions = await db.centerAttendanceSession.count({ where: { groupId } });
  if (sessions) {
    await db.centerGroup.update({ where: { id: groupId }, data: { isActive: false } });
    return "archived";
  }
  await db.centerGroup.delete({ where: { id: groupId } });
  return "deleted";
}

export async function setGroupActive(ctx: CenterContext, groupId: string, isActive: boolean) {
  await getGroupOrThrow(ctx, groupId);
  await db.centerGroup.update({ where: { id: groupId }, data: { isActive } });
}

export async function setGroupStudents(ctx: CenterContext, groupId: string, studentIds: string[]) {
  const group = await getGroupOrThrow(ctx, groupId);
  const valid = (await db.centerStudent.findMany({ where: { centerId: ctx.center.id, id: { in: studentIds } }, select: { id: true } })).map((s) => s.id);
  if (group.capacity && valid.length > group.capacity) throw new CenterError(`Sınıf kontenjanı ${group.capacity} öğrenci.`);
  await db.$transaction([
    db.centerGroupStudent.deleteMany({ where: { groupId, studentId: { notIn: valid } } }),
    db.centerGroupStudent.createMany({ data: valid.map((studentId) => ({ groupId, studentId })), skipDuplicates: true }),
  ]);
  return valid.length;
}

export type SlotInput = { weekday: number; startMinute: number; endMinute: number; subject: string; teacherId: string | null; room: string | null };

/** Aynı sınıfın, öğretmenin ya da dersliğin aynı saatte iki dersi olamaz. */
export async function saveSlot(ctx: CenterContext, groupId: string, slotId: string | null, input: SlotInput) {
  await getGroupOrThrow(ctx, groupId);
  await assertMember(ctx, input.teacherId);
  if (input.endMinute <= input.startMinute) throw new CenterError("Bitiş saati başlangıçtan sonra olmalı.");
  const overlapping = await db.centerScheduleSlot.findMany({
    where: {
      centerId: ctx.center.id,
      weekday: input.weekday,
      startMinute: { lt: input.endMinute },
      endMinute: { gt: input.startMinute },
      ...(slotId ? { id: { not: slotId } } : {}),
      group: { isActive: true },
    },
    include: { group: { select: { name: true } }, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });
  const when = `${WEEKDAY_NAMES[input.weekday - 1]} ${minutesToTime(input.startMinute)}`;
  for (const slot of overlapping) {
    if (slot.groupId === groupId) throw new CenterError(`${when} saatinde bu sınıfın ${slot.subject} dersi var.`);
    if (input.teacherId && slot.teacherId === input.teacherId) {
      throw new CenterError(`${slot.teacher?.user.firstName ?? "Öğretmen"} ${when} saatinde ${slot.group.name} sınıfında derste.`);
    }
    if (input.room && slot.room && slot.room.toLocaleLowerCase("tr-TR") === input.room.toLocaleLowerCase("tr-TR")) {
      throw new CenterError(`${input.room} dersliği ${when} saatinde ${slot.group.name} sınıfına ayrılmış.`);
    }
  }
  if (slotId) {
    const slot = await db.centerScheduleSlot.findFirst({ where: { id: slotId, groupId } });
    if (!slot) throw new CenterError("Ders bulunamadı.");
    return db.centerScheduleSlot.update({ where: { id: slotId }, data: input });
  }
  return db.centerScheduleSlot.create({ data: { ...input, groupId, centerId: ctx.center.id } });
}

export async function deleteSlot(ctx: CenterContext, slotId: string) {
  const slot = await db.centerScheduleSlot.findFirst({ where: { id: slotId, centerId: ctx.center.id } });
  if (!slot) throw new CenterError("Ders bulunamadı.");
  await db.centerScheduleSlot.delete({ where: { id: slotId } });
}

export async function centerTeachers(centerId: string) {
  const members = await db.centerMember.findMany({
    where: { centerId, isActive: true },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: [{ user: { firstName: "asc" } }],
  });
  return members.map((m) => ({ id: m.id, name: `${m.user.firstName} ${m.user.lastName}`, role: m.role, branch: m.branch }));
}
