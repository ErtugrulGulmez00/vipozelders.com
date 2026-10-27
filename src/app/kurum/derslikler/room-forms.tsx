"use client";

import { deleteRoomAction, saveRoomAction } from "@/actions/center/rooms";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";

export function RoomForm({ room }: { room?: { id: string; name: string; capacity: number | null; note: string | null } }) {
  return (
    <ActionForm action={saveRoomAction} resetOnSuccess={!room} className="grid gap-3 sm:grid-cols-[1fr_120px_1fr_auto] sm:items-end">
      {room ? <input type="hidden" name="roomId" value={room.id} /> : null}
      <Field label="Derslik adı">
        <Input name="name" defaultValue={room?.name} placeholder="Örn: 101, Kütüphane, Lab" required maxLength={40} />
        <FieldError name="name" />
      </Field>
      <Field label="Kapasite">
        <Input name="capacity" type="number" min={0} max={1000} defaultValue={room?.capacity ?? ""} placeholder="kişi" />
      </Field>
      <Field label="Not">
        <Input name="note" defaultValue={room?.note ?? ""} placeholder="Örn: projeksiyon var" maxLength={200} />
      </Field>
      <SubmitButton size="sm">{room ? "Kaydet" : "Ekle"}</SubmitButton>
    </ActionForm>
  );
}

export function DeleteRoomButton({ roomId, name }: { roomId: string; name: string }) {
  return (
    <ActionForm action={deleteRoomAction} hideMessages>
      <input type="hidden" name="roomId" value={roomId} />
      <SubmitButton variant="ghost" size="sm" className="text-rose-600" confirmMessage={`${name} dersliği silinsin mi? Programdaki ders saatleri değişmez.`}>
        Sil
      </SubmitButton>
    </ActionForm>
  );
}
