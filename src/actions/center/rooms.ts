"use server";

import { refresh } from "next/cache";
import { success, type ActionState } from "@/lib/action-state";
import { centerAction, centerAudit } from "@/server/center/context";
import { guard, int, opt, requiredText, str } from "@/server/center/form";
import { deleteRoom, saveRoom } from "@/server/center/rooms";

// Derslikler (Dershane paketi).

export async function saveRoomAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("groups.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const roomId = opt(formData, "roomId");
    const capacity = int(formData, "capacity", 0, 0, 1000);
    const room = await saveRoom(auth.ctx, roomId, {
      name: requiredText(formData, "name", "Derslik adı", 1, 40),
      capacity: capacity || null,
      note: opt(formData, "note", 200),
    });
    await centerAudit(auth.ctx, roomId ? "room.update" : "room.create", "CenterRoom", room.id);
    refresh();
    return success(roomId ? "Derslik güncellendi." : "Derslik eklendi.");
  });
}

export async function deleteRoomAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("groups.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const roomId = str(formData, "roomId");
    await deleteRoom(auth.ctx, roomId);
    await centerAudit(auth.ctx, "room.delete", "CenterRoom", roomId);
    refresh();
    return success("Derslik silindi (programdaki ders saatleri değişmez).");
  });
}
