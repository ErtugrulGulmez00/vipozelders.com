"use client";

import { useMemo, useState } from "react";
import { confirmExamPdfAction, discardExamPdfAction, uploadExamPdfAction } from "@/actions/center/exams";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FileInput } from "@/components/ui/file-input";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Badge, type Tone } from "@/components/ui/primitives";
import type { MatchConfidence } from "@/lib/center/exam-match";

export function PdfUploadForm() {
  return (
    <ActionForm action={uploadExamPdfAction} className="space-y-4">
      <FileInput name="file" accept=".pdf,application/pdf" maxMb={25} placeholder="Sonuç PDF’ini seçin" required />
      <SubmitButton size="lg" pendingText="PDF okunuyor…">
        PDF’i oku
      </SubmitButton>
    </ActionForm>
  );
}

export type MatchRow = {
  name: string;
  number: string;
  className: string;
  net: number;
  score: number | null;
  studentId: string | null;
  confidence: MatchConfidence;
  suggestions: string[];
};

export type MatchExam = {
  name: string;
  kindLabel: string;
  summary: string;
  existing: string | null;
  rows: MatchRow[];
};

export type Candidate = { id: string; label: string };

const CONFIDENCE: Record<MatchConfidence, { tone: Tone; text: string }> = {
  alias: { tone: "green", text: "Önceki aktarımdan" },
  exact: { tone: "green", text: "Ad tuttu" },
  number: { tone: "green", text: "Numara tuttu" },
  suggested: { tone: "amber", text: "Benzer ad, kontrol edin" },
  none: { tone: "rose", text: "Eşleşmedi" },
};

export function PdfMatchForm({ draftId, exams, candidates, today }: { draftId: string; exams: MatchExam[]; candidates: Candidate[]; today: string }) {
  const [use, setUse] = useState(() => exams.map(() => true));
  const [picks, setPicks] = useState(() => exams.map((e) => e.rows.map((r) => r.studentId ?? "")));
  const [onlyCheck, setOnlyCheck] = useState(false);
  const labels = useMemo(() => new Map(candidates.map((c) => [c.id, c.label])), [candidates]);

  return (
    <ActionForm action={confirmExamPdfAction} className="space-y-6">
      <input type="hidden" name="draftId" value={draftId} />
      <input type="hidden" name="examCount" value={exams.length} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={onlyCheck} onChange={(e) => setOnlyCheck(e.target.checked)} className="size-4 accent-brand-600" />
        Yalnızca kontrol gereken satırları göster
      </label>
      {exams.map((exam, e) => {
        const chosen = picks[e];
        const counts = new Map<string, number>();
        for (const id of chosen) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
        const matched = chosen.filter(Boolean).length;
        return (
          <section key={e} className="rounded-2xl border border-slate-200 bg-white">
            <input type="hidden" name={`count:${e}`} value={exam.rows.length} />
            <div className="space-y-3 border-b border-slate-100 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Checkbox
                  name={`use:${e}`}
                  checked={use[e]}
                  onChange={(ev) => setUse(use.map((u, i) => (i === e ? ev.target.checked : u)))}
                  label={
                    <span>
                      <span className="font-semibold text-slate-900">{exam.name}</span>
                      <span className="block text-xs text-slate-500">
                        {exam.kindLabel} · {exam.summary}
                      </span>
                    </span>
                  }
                />
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="green">{matched} eşleşti</Badge>
                  {exam.rows.length - matched ? <Badge tone="rose">{exam.rows.length - matched} aktarılmayacak</Badge> : null}
                </div>
              </div>
              {exam.existing ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">“{exam.existing}” adlı deneme zaten var; sonuçlar onun üzerine yazılır. Ayrı deneme olsun istiyorsanız adını değiştirin.</p>
              ) : null}
              {use[e] ? (
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                  <Field label="Deneme adı">
                    <Input name={`name:${e}`} defaultValue={exam.name} required maxLength={120} />
                  </Field>
                  <Field label="Sınav tarihi">
                    <Input name={`date:${e}`} type="date" defaultValue={today} required />
                  </Field>
                  <Field label="Yayınevi (isteğe bağlı)">
                    <Input name={`publisher:${e}`} maxLength={80} />
                  </Field>
                </div>
              ) : (
                <input type="hidden" name={`name:${e}`} value={exam.name} />
              )}
            </div>
            {use[e] ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">PDF’teki öğrenci</th>
                      <th className="px-3 py-2 text-right">Net</th>
                      <th className="px-3 py-2">Kurumdaki öğrenci</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {exam.rows.map((row, i) => {
                      const pick = chosen[i];
                      const dup = pick && (counts.get(pick) ?? 0) > 1;
                      const sure = pick && !dup && (row.confidence === "alias" || row.confidence === "exact" || row.confidence === "number") && pick === row.studentId;
                      const status = !pick ? CONFIDENCE.none : pick !== row.studentId ? { tone: "sky" as Tone, text: "Elle seçildi" } : CONFIDENCE[row.confidence];
                      return (
                        <tr key={i} className={dup ? "bg-rose-50" : onlyCheck && sure ? "hidden" : undefined}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-900">{row.name || "Adsız form"}</p>
                            <p className="text-xs text-slate-500">
                              No {row.number || "—"} · {row.className || "sınıf yok"}
                              {row.score ? ` · ${row.score.toLocaleString("tr-TR")} puan` : ""}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">{row.net.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2">
                            <select
                              name={`st:${e}:${i}`}
                              value={pick}
                              onChange={(ev) => setPicks(picks.map((p, x) => (x === e ? p.map((v, y) => (y === i ? ev.target.value : v)) : p)))}
                              className="h-9 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-2 text-sm"
                              aria-label={`${row.name || "Adsız form"} için öğrenci`}
                            >
                              <option value="">— Aktarma —</option>
                              {row.suggestions.length ? (
                                <optgroup label="Öneriler">
                                  {row.suggestions.map((id) => (
                                    <option key={id} value={id}>
                                      {labels.get(id)}
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null}
                              <optgroup label="Tüm öğrenciler">
                                {candidates.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.label}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            <div className="mt-1">
                              <Badge tone={dup ? "rose" : status.tone}>{dup ? "Başka satırda da seçili" : status.text}</Badge>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Eşleştirmeler hatırlanır; aynı öğrenci sonraki PDF’lerde otomatik bulunur. Sonuçlar siz yayınlayana kadar velilere görünmez.</p>
        <SubmitButton size="lg" pendingText="Aktarılıyor…">
          Sonuçları aktar
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DiscardPdfForm({ draftId }: { draftId: string }) {
  return (
    <ActionForm action={discardExamPdfAction}>
      <input type="hidden" name="draftId" value={draftId} />
      <SubmitButton size="sm" variant="ghost" pendingText="…">
        Vazgeç
      </SubmitButton>
    </ActionForm>
  );
}
