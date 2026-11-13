"use server";

import { refresh } from "next/cache";
import { failure, success, type ActionState } from "@/lib/action-state";
import { parseProgramTable, PLACEMENT_EXAMS, readPlacementInput, type PlacementExamName } from "@/lib/placement";
import { actionUser } from "@/server/auth/current-user";
import { centerAction, coachFeatureLocked } from "@/server/center/context";
import { CenterError } from "@/server/center/errors";
import { readSpreadsheet } from "@/server/center/spreadsheet";
import { addToPlacementList, changePlacementList, deleteProgramYear, savePlacementNote, upsertPrograms } from "@/server/placement";

function examOf(formData: FormData): PlacementExamName | null {
  const v = String(formData.get("exam") ?? "");
  return v === "LGS" || v === "YKS" ? v : null;
}

async function listAuth(formData: FormData) {
  const exam = examOf(formData);
  if (!exam) return { ok: false as const, state: failure("Geçersiz istek.") };
  const auth = await centerAction("students.view", { module: exam === "LGS" ? "lgs-tercih" : "yks-tercih" });
  if (!auth.ok) return auth;
  const locked = coachFeatureLocked(auth.ctx, exam === "LGS" ? "lgsRobot" : "yksRobot");
  if (locked) return { ok: false as const, state: locked };
  return { ok: true as const, ctx: auth.ctx, exam };
}

async function guard(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof CenterError) return failure(error.message);
    throw error;
  }
}

export async function placementAddAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await listAuth(formData);
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const input = readPlacementInput(auth.exam, { score: formData.get("score"), rank: formData.get("rank"), percentile: formData.get("percentile") });
    const scoreType = String(formData.get("scoreType") ?? "").slice(0, 10) || null;
    await addToPlacementList(auth.ctx.center.id, String(formData.get("studentId") ?? ""), auth.exam, String(formData.get("programId") ?? ""), { ...input, scoreType });
    refresh();
    return success("Tercih listesine eklendi.");
  });
}

export async function placementChangeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await listAuth(formData);
  if (!auth.ok) return auth.state;
  const op = String(formData.get("op") ?? "");
  if (op !== "up" && op !== "down" && op !== "remove") return failure("Geçersiz istek.");
  return guard(async () => {
    await changePlacementList(auth.ctx.center.id, String(formData.get("studentId") ?? ""), auth.exam, String(formData.get("programId") ?? ""), op);
    refresh();
    return success(op === "remove" ? "Listeden çıkarıldı." : "Sıra değişti.");
  });
}

export async function placementNoteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await listAuth(formData);
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const note = String(formData.get("note") ?? "").trim().slice(0, 2000) || null;
    await savePlacementNote(auth.ctx.center.id, String(formData.get("studentId") ?? ""), auth.exam, note);
    refresh();
    return success("Not kaydedildi.");
  });
}

/** Yönetim: YÖK Atlas / MEB tablosunu yükler (aynı yıl yeniden yüklenirse güncellenir). */
export async function importPlacementAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await actionUser("ADMIN");
  if (!admin) return failure("Yetkiniz yok.");
  const exam = examOf(formData);
  const year = Number(formData.get("year"));
  if (!exam || !Number.isInteger(year)) return failure("Sınav ve yıl seçin.");
  return guard(async () => {
    const table = await readSpreadsheet(formData.get("file") as File, 25 * 1024 * 1024);
    const parsed = parseProgramTable(exam, table);
    if (parsed.missing.length) return failure(`Tabloda şu sütunlar bulunamadı: ${parsed.missing.join(", ")}. Tanınan sütunlar: ${parsed.columns.join(", ") || "yok"}.`);
    const result = await upsertPrograms(admin.id, exam, year, parsed.rows, formData.get("removeMissing") === "on");
    refresh();
    return success(
      `${PLACEMENT_EXAMS[exam].label} ${year}: ${result.count.toLocaleString("tr-TR")} satır aktarıldı${parsed.skipped ? `, ${parsed.skipped} satır atlandı (ad, il ya da tür boş / tekrar)` : ""}${result.removed ? `, tabloda olmayan ${result.removed} kayıt silindi` : ""}. Tanınan sütunlar: ${parsed.columns.join(", ")}.`,
    );
  });
}

export async function deletePlacementYearAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await actionUser("ADMIN");
  if (!admin) return failure("Yetkiniz yok.");
  const exam = examOf(formData);
  const year = Number(formData.get("year"));
  if (!exam || !Number.isInteger(year)) return failure("Geçersiz istek.");
  const count = await deleteProgramYear(admin.id, exam, year);
  refresh();
  return success(`${PLACEMENT_EXAMS[exam].label} ${year} verisi silindi (${count} kayıt).`);
}
