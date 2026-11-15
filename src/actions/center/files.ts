"use server";

import { refresh } from "next/cache";
import { success, type ActionState } from "@/lib/action-state";
import { centerAction, centerAudit } from "@/server/center/context";
import { guard, opt, requiredText, str } from "@/server/center/form";
import { createCenterFile, deleteCenterFile } from "@/server/center/files";

export async function uploadCenterFileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const file = formData.get("file");
    // "kime": "" herkes, "g:<id>" sınıf, "s:<id>" öğrenci
    const target = str(formData, "target", 60);
    const created = await createCenterFile(auth.ctx, {
      file: file instanceof File ? file : null,
      title: requiredText(formData, "title", "Başlık", 2, 120),
      subject: opt(formData, "subject", 60),
      note: opt(formData, "note", 300),
      groupId: target.startsWith("g:") ? target.slice(2) : null,
      studentId: target.startsWith("s:") ? target.slice(2) : null,
    });
    await centerAudit(auth.ctx, "file.upload", "CenterFile", created.id);
    refresh();
    return success("Dosya eklendi; öğrenciler kendi hesaplarından indirebilir.");
  });
}

export async function deleteCenterFileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const id = str(formData, "fileId");
    await deleteCenterFile(auth.ctx, id);
    await centerAudit(auth.ctx, "file.delete", "CenterFile", id);
    refresh();
    return success("Dosya silindi.");
  });
}
