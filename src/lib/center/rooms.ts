// Derslik doluluğu: haftalık programdaki dersler derslik adına göre gruplanır, aynı derslikte aynı gün çakışan
// saatler işaretlenir. Ad karşılaştırması büyük/küçük harf ve boşluk farkını yok sayar (Türkçe kurallarıyla).

export type RoomSlot = { id: string; room: string; weekday: number; startMinute: number; endMinute: number; label: string; students: number };

export function roomKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

/** Aynı derslikte aynı gün saatleri kesişen ders çiftleri (bitişik dersler çakışma sayılmaz). */
export function findRoomConflicts(slots: RoomSlot[]): [RoomSlot, RoomSlot][] {
  const conflicts: [RoomSlot, RoomSlot][] = [];
  const byDay = new Map<string, RoomSlot[]>();
  for (const slot of slots) {
    const key = `${roomKey(slot.room)}|${slot.weekday}`;
    byDay.set(key, [...(byDay.get(key) ?? []), slot]);
  }
  for (const list of byDay.values()) {
    const sorted = [...list].sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length && sorted[j].startMinute < sorted[i].endMinute; j++) {
        conflicts.push([sorted[i], sorted[j]]);
      }
    }
  }
  return conflicts;
}

/** Haftalık kullanılan dakika (çakışan saatler bir kez sayılır). */
export function bookedMinutes(slots: Pick<RoomSlot, "weekday" | "startMinute" | "endMinute">[]): number {
  let total = 0;
  const byDay = new Map<number, [number, number][]>();
  for (const s of slots) byDay.set(s.weekday, [...(byDay.get(s.weekday) ?? []), [s.startMinute, s.endMinute]]);
  for (const ranges of byDay.values()) {
    ranges.sort((a, b) => a[0] - b[0]);
    let [start, end] = ranges[0];
    for (const [s, e] of ranges.slice(1)) {
      if (s <= end) end = Math.max(end, e);
      else {
        total += end - start;
        [start, end] = [s, e];
      }
    }
    total += end - start;
  }
  return total;
}
