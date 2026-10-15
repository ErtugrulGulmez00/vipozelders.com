// Kelebek sınav düzeni: farklı sınıflardaki öğrenciler salonlara karışık dağıtılır; aynı sınıftan iki öğrenci mümkün
// olduğunca yan yana (ardışık sıra) oturmaz. Sonuç her çalıştırmada aynıdır (seed ile karıştırma).

export type SeatStudent = { id: string; name: string; group: string; number: string | null };
export type Room = { name: string; capacity: number };
export type Seat = { room: string; seat: number; student: SeatStudent };

function shuffle<T>(list: T[], seed: number): T[] {
  let a = seed || 1;
  const rand = () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** "A salonu: 30" satırlarını okur. */
export function parseRooms(text: string): Room[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)[\s:=-]+(\d+)$/);
      if (!match) throw new Error(`Salon satırı hatalı: “${line}”. Örnek: A salonu: 30`);
      return { name: match[1].trim(), capacity: Number(match[2]) };
    })
    .filter((r) => r.capacity > 0);
}

/** Öğrencileri sınıflara göre sırayla (round-robin) dizer, sonra salonlara doldurur. */
export function buildSeating(students: SeatStudent[], rooms: Room[], seed = 7): { seats: Seat[]; unplaced: SeatStudent[] } {
  const byGroup = new Map<string, SeatStudent[]>();
  for (const s of shuffle(students, seed)) byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), s]);
  // En kalabalık sınıf önce: dağılım dengeli olsun
  const queues = [...byGroup.values()].sort((a, b) => b.length - a.length);
  const ordered: SeatStudent[] = [];
  while (queues.some((q) => q.length)) {
    for (const q of queues) {
      const next = q.shift();
      if (next) ordered.push(next);
    }
  }
  const seats: Seat[] = [];
  let index = 0;
  for (const room of rooms) {
    for (let seat = 1; seat <= room.capacity && index < ordered.length; seat++) seats.push({ room: room.name, seat, student: ordered[index++] });
  }
  return { seats, unplaced: ordered.slice(index) };
}
