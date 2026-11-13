"use server";

import { centerAction } from "@/server/center/context";
import { CenterError } from "@/server/center/errors";
import { ASSISTANT_KINDS, studentAssistant, type AssistantKind, type AssistantResult } from "@/server/ai-assistant";

/** Öğretmene yapay zekâ asistanı: yorum / özet / yol haritası (kaydedilmez, yalnızca öğretmen görür). */
export async function studentAssistantAction(studentId: string, kind: string): Promise<({ ok: true } & AssistantResult) | { ok: false; error: string }> {
  if (typeof studentId !== "string" || !ASSISTANT_KINDS.includes(kind as AssistantKind)) return { ok: false, error: "Geçersiz istek." };
  const auth = await centerAction("students.view", { module: "asistan", write: false });
  if (!auth.ok) return { ok: false, error: auth.state.error ?? "Yetkiniz yok." };
  try {
    return { ok: true, ...(await studentAssistant(auth.ctx, studentId, kind as AssistantKind)) };
  } catch (error) {
    if (error instanceof CenterError) return { ok: false, error: error.message };
    throw error;
  }
}
