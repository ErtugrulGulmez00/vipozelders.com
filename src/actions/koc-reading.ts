"use server";

import { refresh } from "next/cache";
import { failure, success, type ActionState } from "@/lib/action-state";
import { isDateString } from "@/lib/dates";
import { actionUser } from "@/server/auth/current-user";
import { centerAction } from "@/server/center/context";
import { guard, int, str } from "@/server/center/form";
import { addPortalReadingBook, addReadingBook, deletePortalReadingBook, deleteReadingBook, updatePortalReadingBook, updateReadingBook, type ReadingInput } from "@/server/koc-reading";

function input(fd: FormData): ReadingInput {
  const pages = str(fd, "totalPages");
  const started = str(fd, "startedOn");
  return { title: str(fd, "title", 160), author: str(fd, "author", 120) || null, totalPages: pages ? int(fd, "totalPages", 0, 0, 100_000) || null : null, startedOn: isDateString(started) ? started : null };
}

const portal = (fd: FormData) => ({ studentId: str(fd, "studentId"), bookId: str(fd, "bookId") });

// --- Koç (Pi Koç ve kurum paneli) ---

export async function addReadingBookAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await addReadingBook(auth.ctx, str(formData, "studentId"), input(formData));
    refresh();
    return success("Kitap eklendi.");
  });
}

export async function updateReadingBookAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await updateReadingBook(auth.ctx, str(formData, "studentId"), str(formData, "bookId"), int(formData, "pagesRead", 0, 0, 100_000), str(formData, "finished") === "1");
    refresh();
    return success("Kaydedildi.");
  });
}

export async function deleteReadingBookAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteReadingBook(auth.ctx, str(formData, "bookId"));
    refresh();
    return success();
  });
}

// --- Öğrenci (Koçum) ---

export async function portalAddReadingBookAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış. Tekrar giriş yapın.");
  return guard(async () => {
    await addPortalReadingBook(user.id, str(formData, "studentId"), input(formData));
    refresh();
    return success("Kitap eklendi. Koçun görecek.");
  });
}

export async function portalUpdateReadingBookAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış. Tekrar giriş yapın.");
  return guard(async () => {
    const { studentId, bookId } = portal(formData);
    await updatePortalReadingBook(user.id, studentId, bookId, int(formData, "pagesRead", 0, 0, 100_000), str(formData, "finished") === "1");
    refresh();
    return success("Kaydedildi.");
  });
}

export async function portalDeleteReadingBookAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış. Tekrar giriş yapın.");
  return guard(async () => {
    const { studentId, bookId } = portal(formData);
    await deletePortalReadingBook(user.id, studentId, bookId);
    refresh();
    return success();
  });
}
