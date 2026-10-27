import { bookedMinutes, findRoomConflicts, roomKey, type RoomSlot } from "@/lib/center/rooms";
import { db } from "../db";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";

// Derslik yönetimi (Dershane paketi): derslik listesi, haftalık doluluk, çakışma ve kapasite uyarıları.
// Program ve sınıflardaki "derslik" alanı serbest metindir; derslik kaydıyla adından eşleşir.

export type RoomInput = { name: string; capacity: number | null; note: string | null };

export async function saveRoom(ctx: CenterContext, roomId: string | null, input: RoomInput) {
  const name = input.name.trim().replace(/\s+/g, " ");
  const rooms = await db.centerRoom.findMany({ where: { centerId: ctx.center.id }, select: { id: true, name: true } });
  if (rooms.some((r) => r.id !== roomId && roomKey(r.name) === roomKey(name))) throw new CenterError("Bu adda bir derslik zaten var.", { name: "Başka bir ad yazın." });
  if (roomId) {
    if (!rooms.some((r) => r.id === roomId)) throw new CenterError("Derslik bulunamadı.");
    return db.centerRoom.update({ where: { id: roomId }, data: { name, capacity: input.capacity, note: input.note } });
  }
  return db.centerRoom.create({ data: { centerId: ctx.center.id, name, capacity: input.capacity, note: input.note } });
}

export async function deleteRoom(ctx: CenterContext, roomId: string) {
  const room = await db.centerRoom.findFirst({ where: { id: roomId, centerId: ctx.center.id } });
  if (!room) throw new CenterError("Derslik bulunamadı.");
  await db.centerRoom.delete({ where: { id: roomId } });
}

export type RoomUsage = {
  id: string | null;
  name: string;
  capacity: number | null;
  note: string | null;
  slots: RoomSlot[];
  weeklyMinutes: number;
  /** Öğrenci sayısı derslik kapasitesini aşan dersler */
  overCapacity: RoomSlot[];
};

/** Derslik başına haftalık program, çakışmalar; kayıtlı olmayan ama programda geçen derslikler de listelenir. */
export async function roomOverview(centerId: string) {
  const [rooms, slots] = await Promise.all([
    db.centerRoom.findMany({ where: { centerId }, orderBy: { name: "asc" } }),
    db.centerScheduleSlot.findMany({
      where: { centerId, group: { isActive: true } },
      include: { group: { select: { name: true, room: true, _count: { select: { students: { where: { student: { status: "ACTIVE" } } } } } } } },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    }),
  ]);
  const roomSlots: RoomSlot[] = slots
    .map((s) => ({ id: s.id, room: (s.room ?? s.group.room ?? "").trim(), weekday: s.weekday, startMinute: s.startMinute, endMinute: s.endMinute, label: `${s.group.name} · ${s.subject}`, students: s.group._count.students }))
    .filter((s) => s.room);

  const usage = new Map<string, RoomUsage>();
  for (const r of rooms) usage.set(roomKey(r.name), { id: r.id, name: r.name, capacity: r.capacity, note: r.note, slots: [], weeklyMinutes: 0, overCapacity: [] });
  for (const s of roomSlots) {
    const key = roomKey(s.room);
    const entry = usage.get(key) ?? { id: null, name: s.room, capacity: null, note: null, slots: [], weeklyMinutes: 0, overCapacity: [] };
    entry.slots.push(s);
    usage.set(key, entry);
  }
  for (const entry of usage.values()) {
    entry.weeklyMinutes = entry.slots.length ? bookedMinutes(entry.slots) : 0;
    entry.overCapacity = entry.capacity ? entry.slots.filter((s) => s.students > entry.capacity!) : [];
  }
  const list = [...usage.values()].sort((a, b) => (a.id ? 0 : 1) - (b.id ? 0 : 1) || a.name.localeCompare(b.name, "tr", { numeric: true }));
  return { rooms: list, conflicts: findRoomConflicts(roomSlots), withoutRoom: slots.length - roomSlots.length };
}
