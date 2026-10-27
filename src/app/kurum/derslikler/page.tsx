import { DoorOpen } from "lucide-react";
import type { Metadata } from "next";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { WEEKDAY_NAMES, minutesToTime } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { roomOverview } from "@/server/center/rooms";
import { DeleteRoomButton, RoomForm } from "./room-forms";

export const metadata: Metadata = { title: "Derslikler" };

const hours = (minutes: number) => `${Math.floor(minutes / 60)} sa${minutes % 60 ? ` ${minutes % 60} dk` : ""}`;

export default async function RoomsPage() {
  const ctx = await requireCenter("students.view");
  const { rooms, conflicts, withoutRoom } = await roomOverview(ctx.center.id);
  const canManage = ctx.can("groups.manage");
  return (
    <>
      <PageHeader title="Derslikler" description="Dersliklerin haftalık doluluğu, çakışan dersler ve kapasite uyarıları. Derslik, sınıfın ya da ders saatinin “derslik” alanına yazılan adla eşleşir." />
      {conflicts.length ? (
        <Alert tone="warning" className="mb-6" title={`${conflicts.length} derslik çakışması`}>
          <ul className="mt-1 space-y-0.5">
            {conflicts.map(([a, b]) => (
              <li key={`${a.id}-${b.id}`}>
                {a.room} · {WEEKDAY_NAMES[a.weekday - 1]}: {minutesToTime(a.startMinute)}–{minutesToTime(a.endMinute)} {a.label} ↔ {minutesToTime(b.startMinute)}–{minutesToTime(b.endMinute)} {b.label}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {withoutRoom ? <p className="mb-4 text-sm text-slate-500">{withoutRoom} ders saatinde derslik yazılı değil; sınıf ya da ders saati düzenlenerek eklenebilir.</p> : null}
      {canManage ? (
        <Card className="mb-6">
          <CardHeader title="Yeni derslik" />
          <CardBody>
            <RoomForm />
          </CardBody>
        </Card>
      ) : null}
      {rooms.length === 0 ? (
        <EmptyState icon={<DoorOpen className="size-8" />} title="Henüz derslik yok" description="Derslikleri ekleyin; programdaki dersler derslik adına göre burada toplanır." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rooms.map((room) => (
            <Card key={room.id ?? room.name}>
              <CardHeader
                title={room.name}
                description={[room.capacity ? `${room.capacity} kişilik` : null, `Haftada ${hours(room.weeklyMinutes)} dolu`, room.note].filter(Boolean).join(" · ")}
                action={
                  <div className="flex items-center gap-1.5">
                    {!room.id ? <Badge tone="amber">Kayıtlı değil</Badge> : null}
                    {room.overCapacity.length ? <Badge tone="rose">Kapasite aşımı</Badge> : null}
                    {canManage && room.id ? <DeleteRoomButton roomId={room.id} name={room.name} /> : null}
                  </div>
                }
              />
              {room.slots.length ? (
                <ul className="divide-y divide-slate-100">
                  {room.slots.map((s) => (
                    <li key={s.id} className="flex justify-between gap-3 px-5 py-2 text-sm">
                      <span className="text-slate-700">
                        <span className="font-semibold text-slate-900">
                          {WEEKDAY_NAMES[s.weekday - 1]} {minutesToTime(s.startMinute)}–{minutesToTime(s.endMinute)}
                        </span>{" "}
                        · {s.label}
                      </span>
                      <span className={room.capacity && s.students > room.capacity ? "font-semibold text-rose-600" : "text-slate-500"}>{s.students} öğrenci</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <CardBody>
                  <p className="text-sm text-slate-500">Programda bu derslikte ders yok.</p>
                </CardBody>
              )}
              {canManage && room.id ? (
                <CardBody className="border-t border-slate-100">
                  <RoomForm room={{ id: room.id, name: room.name, capacity: room.capacity, note: room.note }} />
                </CardBody>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
