import { Info, Search } from "lucide-react";
import Link from "next/link";
import { LockedFeature } from "@/components/koc/locked-feature";
import { AddToListButton, ListItemControls, PlacementNoteForm, PrintButton, TargetButton } from "@/components/placement/placement-forms";
import { buttonClasses } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import {
  CHANCE_LABEL,
  CHANCE_ORDER,
  CHANCE_TONE,
  formatPercentile,
  formatScore,
  PLACEMENT_EXAMS,
  placementChance,
  readPlacementInput,
  YKS_SCORE_TYPE_LABEL,
  YKS_SCORE_TYPES,
  type Chance,
  type PlacementExamName,
} from "@/lib/placement";
import { db } from "@/server/db";
import { latestYear, placementList, programFacets, searchPrograms } from "@/server/placement";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * LGS / YKS tercih robotu: kurum panelinde ve Pi Koç'ta aynı sayfa.
 * listLocked: Pi Koç ücretsiz paketi (arama açık; öğrenci listesi, not ve yazdırma kilitli).
 * targets: listedeki programı öğrencinin hedefi yapma (Pi Koç hedef kartında görünür).
 */
export async function PlacementRobot({ exam, centerId, sp, basePath, listLocked = false, targets = false }: { exam: PlacementExamName; centerId: string; sp: SP; basePath: string; listLocked?: boolean; targets?: boolean }) {
  const meta = PLACEMENT_EXAMS[exam];
  const year = await latestYear(exam);
  const header = (
    <PageHeader
      title={meta.title}
      description={
        exam === "LGS"
          ? "LGS puanı ya da yüzdelik dilime göre geçen yılın taban puanlarıyla liseleri güvenli, uygun ve riskli diye ayırır; öğrencinin 5 tercihlik listesini hazırlarsınız."
          : "Puan türü, puan ve başarı sırasına göre geçen yılın tabanlarıyla programları ayırır; öğrencinin 24 tercihlik listesini hazırlarsınız."
      }
    />
  );
  if (!year) {
    return (
      <>
        {header}
        <EmptyState icon={<Info />} title="Taban puan verisi henüz yüklenmedi" description={`${meta.label} taban puanları yüklendiğinde robot burada çalışır.`} />
      </>
    );
  }

  const studentId = listLocked ? "" : one(sp.ogrenci);
  const [students, facets, list, goals] = await Promise.all([
    listLocked ? Promise.resolve([]) : db.centerStudent.findMany({ where: { centerId, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, gradeName: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    programFacets(exam, year),
    studentId ? placementList(centerId, studentId, exam) : Promise.resolve(null),
    targets && studentId ? db.centerStudentGoal.findMany({ where: { studentId, targetExam: exam }, select: { targetCode: true } }) : Promise.resolve([]),
  ]);
  const targetCodes = new Set(goals.map((g) => g.targetCode));
  const student = students.find((s) => s.id === studentId) ?? null;

  // Puan bilgisi: adresten; yoksa öğrencinin listesine son kaydedilenden
  const fromUrl = readPlacementInput(exam, { score: one(sp.puan), rank: one(sp.sira), percentile: one(sp.yuzdelik) });
  const urlEmpty = fromUrl.score === null && fromUrl.rank === null && fromUrl.percentile === null;
  const input = urlEmpty && list ? { score: list.score, rank: list.rank, percentile: list.percentile } : fromUrl;
  const scoreType = exam === "YKS" ? (YKS_SCORE_TYPES as readonly string[]).find((t) => t === (one(sp.tur) || list?.scoreType)) ?? "SAY" : one(sp.tur) && facets.types.includes(one(sp.tur)) ? one(sp.tur) : "";
  const city = facets.cities.includes(one(sp.il)) ? one(sp.il) : "";
  const kind = facets.kinds.includes(one(sp.ut)) ? one(sp.ut) : "";
  const q = one(sp.q).slice(0, 80);
  const chances = many(sp.sans).filter((c): c is Chance => (CHANCE_ORDER as string[]).includes(c));
  const limit = Math.min(1000, Math.max(100, Number(one(sp.daha)) || 100));
  const hasInput = input.score !== null || input.rank !== null || input.percentile !== null;
  const search = hasInput ? await searchPrograms(exam, year, input, { scoreType: scoreType || undefined, city: city || undefined, kind: kind || undefined, q: q || undefined, chances }, limit) : null;

  const params = (patch: Record<string, string | string[] | null>) => {
    const base: Record<string, string | string[]> = {
      ...(studentId ? { ogrenci: studentId } : {}),
      ...(input.score !== null ? { puan: String(input.score) } : {}),
      ...(input.rank !== null ? { sira: String(input.rank) } : {}),
      ...(input.percentile !== null ? { yuzdelik: String(input.percentile) } : {}),
      ...(scoreType ? { tur: scoreType } : {}),
      ...(city ? { il: city } : {}),
      ...(kind ? { ut: kind } : {}),
      ...(q ? { q } : {}),
      ...(chances.length ? { sans: chances } : {}),
    };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete base[k];
      else base[k] = v;
    }
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(base)) for (const x of Array.isArray(v) ? v : [v]) usp.append(k, x);
    const s = usp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const inList = new Set(list?.programIds ?? []);
  const listFull = (list?.programIds.length ?? 0) >= meta.listMax;

  return (
    <>
      {header}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="min-w-0 space-y-6 print:hidden">
          <Card>
            <CardBody>
              <form action={basePath} method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {listLocked ? null : (
                <Field label="Öğrenci (listeye eklemek için)" className="sm:col-span-2">
                  <Select name="ogrenci" defaultValue={studentId}>
                    <option value="">Öğrenci seçmeden ara</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName}
                        {s.gradeName ? ` · ${s.gradeName}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                )}
                {exam === "YKS" ? (
                  <Field label="Puan türü">
                    <Select name="tur" defaultValue={scoreType}>
                      {YKS_SCORE_TYPES.filter((t) => facets.types.includes(t)).map((t) => (
                        <option key={t} value={t}>
                          {YKS_SCORE_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <Field label="Okul türü">
                    <Select name="tur" defaultValue={scoreType}>
                      <option value="">Tümü</option>
                      {facets.types.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field label="İl">
                  <Select name="il" defaultValue={city}>
                    <option value="">Bütün iller</option>
                    {facets.cities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={exam === "LGS" ? "LGS puanı (500 üzerinden)" : "Puan"}>
                  <Input name="puan" inputMode="decimal" placeholder={exam === "LGS" ? "Örn: 452,5" : "Örn: 412,35"} defaultValue={input.score ?? ""} />
                </Field>
                {exam === "LGS" ? (
                  <Field label="Yüzdelik dilim (%)" hint="Varsa daha doğru sonuç verir.">
                    <Input name="yuzdelik" inputMode="decimal" placeholder="Örn: 3,25" defaultValue={input.percentile ?? ""} />
                  </Field>
                ) : (
                  <Field label="Başarı sırası" hint="Varsa daha doğru sonuç verir.">
                    <Input name="sira" inputMode="numeric" placeholder="Örn: 85000" defaultValue={input.rank ?? ""} />
                  </Field>
                )}
                {facets.kinds.length ? (
                  <Field label="Üniversite türü">
                    <Select name="ut" defaultValue={kind}>
                      <option value="">Tümü</option>
                      {facets.kinds.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <Field label={exam === "LGS" ? "Okul / ilçe ara" : "Program / üniversite ara"}>
                  <Input name="q" defaultValue={q} placeholder={exam === "LGS" ? "Örn: Kadıköy" : "Örn: Tıp"} />
                </Field>
                <div className="flex items-end sm:col-span-2 lg:col-span-1">
                  <button type="submit" className={buttonClasses("primary", "md", "w-full")}>
                    <Search className="size-4" aria-hidden /> {exam === "LGS" ? "Liseleri bul" : "Programları bul"}
                  </button>
                </div>
              </form>
              <p className="mt-4 flex gap-2 text-xs text-slate-500">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Tahmindir: {year} yerleştirmesinin taban {exam === "LGS" ? "puanı ve yüzdelik dilimlerine" : "puanı ve başarı sıralarına"} göre hesaplanır. Kontenjan ve puan dağılımı her yıl değişir; kesin
                bilgi için {exam === "LGS" ? "MEB e-Okul" : "ÖSYM kılavuzu ve YÖK Atlas"} esas alınır.
              </p>
            </CardBody>
          </Card>

          {!search ? (
            <EmptyState
              icon={<Search />}
              title={exam === "LGS" ? "LGS puanı ya da yüzdelik dilim girin" : "Puan ya da başarı sırası girin"}
              description={listLocked ? "Sonuçlar güvenli, uygun ve riskli diye ayrılır. Öğrenciye tercih listesi hazırlamak ücretli pakette." : "Öğrenci seçerseniz son girilen puanı hatırlanır ve bulduğunuz okulları tercih listesine ekleyebilirsiniz."}
            />
          ) : (
            <Card>
              <CardHeader
                title={`${search.total.toLocaleString("tr-TR")} ${exam === "LGS" ? "okul" : "program"}`}
                description={
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {CHANCE_ORDER.filter((c) => search.counts[c] > 0).map((c) => {
                      const active = chances.includes(c);
                      const next = active ? chances.filter((x) => x !== c) : [...chances, c];
                      return (
                        <Link key={c} href={params({ sans: next.length ? next : null, daha: null })} className={cn("rounded-full", active && "ring-2 ring-brand-400")}>
                          <Badge tone={CHANCE_TONE[c]}>
                            {CHANCE_LABEL[c]} · {search.counts[c].toLocaleString("tr-TR")}
                          </Badge>
                        </Link>
                      );
                    })}
                  </span>
                }
              />
              {search.results.length ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>Şans</Th>
                      <Th>{exam === "LGS" ? "Okul" : "Program"}</Th>
                      <Th>{exam === "LGS" ? "İl / ilçe" : "Üniversite"}</Th>
                      <Th className="hidden text-right 2xl:table-cell">Kont.</Th>
                      <Th className="text-right">Taban</Th>
                      <Th className="text-right">{exam === "LGS" ? "Yüzdelik" : "Sıra"}</Th>
                      {student ? <Th /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {search.results.map(({ program: p, chance }) => (
                      <tr key={p.id}>
                        <Td>
                          <Badge tone={CHANCE_TONE[chance]}>{CHANCE_LABEL[chance]}</Badge>
                        </Td>
                        <Td className="min-w-44">
                          <p className="font-semibold text-ink-900">{p.name}</p>
                          <p className="text-xs text-slate-500">{[exam === "LGS" ? p.scoreType : p.faculty, p.details].filter(Boolean).join(" · ")}</p>
                        </Td>
                        <Td className="min-w-36">
                          {exam === "LGS" ? (
                            <>
                              {p.city}
                              {p.district ? <span className="text-slate-500"> / {p.district}</span> : null}
                            </>
                          ) : (
                            <>
                              <p>{p.institution}</p>
                              <p className="text-xs text-slate-500">{[p.city, p.kind].filter(Boolean).join(" · ")}</p>
                            </>
                          )}
                        </Td>
                        <Td className="hidden text-right tabular-nums 2xl:table-cell">{p.quota ?? "—"}</Td>
                        <Td className="text-right tabular-nums">{formatScore(p.minScore)}</Td>
                        <Td className="text-right tabular-nums">{exam === "LGS" ? formatPercentile(p.percentile) : p.minRank?.toLocaleString("tr-TR") ?? "—"}</Td>
                        {student ? (
                          <Td className="text-right">
                            {inList.has(p.id) ? (
                              <Badge tone="brand">Listede</Badge>
                            ) : listFull ? (
                              <span className="text-xs text-slate-400">Liste dolu</span>
                            ) : (
                              <AddToListButton exam={exam} studentId={student.id} programId={p.id} input={input} scoreType={scoreType || null} />
                            )}
                          </Td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <CardBody>
                  <p className="text-sm text-slate-500">Bu filtrelerle sonuç yok. İl ya da tür filtresini kaldırmayı deneyin.</p>
                </CardBody>
              )}
              {search.total > search.results.length ? (
                <CardBody>
                  <Link href={params({ daha: String(limit + 200) })} className="text-sm font-semibold text-brand-700 hover:underline">
                    Daha fazla göster ({(search.total - search.results.length).toLocaleString("tr-TR")} kaldı)
                  </Link>
                </CardBody>
              ) : null}
            </Card>
          )}
        </div>

        {listLocked ? (
          <div className="xl:sticky xl:top-20">
            <LockedFeature feature={exam === "LGS" ? "lgsRobot" : "yksRobot"} />
          </div>
        ) : (
        <Card className="xl:sticky xl:top-20">
          <CardHeader
            title={student ? `${student.firstName} ${student.lastName} · tercih listesi` : "Tercih listesi"}
            description={student ? `${list?.programs.length ?? 0} / ${meta.listMax} tercih` : "Listeyi hazırlamak için yukarıdan öğrenci seçin."}
            action={student && list?.programs.length ? <PrintButton /> : undefined}
          />
          {student ? (
            <CardBody className="space-y-4">
              {list?.programs.length ? (
                <ol className="space-y-2">
                  {list.programs.map((p, i) => {
                    const chance = placementChance(exam, p, { score: list.score, rank: list.rank, percentile: list.percentile });
                    return (
                      <li key={p.id} className="flex items-start gap-2 rounded-xl border border-slate-200 p-3">
                        <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-snug text-ink-900">{p.name}</p>
                          <p className="text-xs text-slate-500">
                            {[exam === "YKS" ? p.institution : p.district, p.city, exam === "LGS" ? formatPercentile(p.percentile) : p.minRank ? `${p.minRank.toLocaleString("tr-TR")}. sıra` : null].filter(Boolean).join(" · ")}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {chance ? <Badge tone={CHANCE_TONE[chance]}>{CHANCE_LABEL[chance]}</Badge> : null}
                            {targets ? <TargetButton exam={exam} studentId={student.id} programId={p.id} active={targetCodes.has(p.code)} /> : null}
                          </div>
                        </div>
                        <ListItemControls exam={exam} studentId={student.id} programId={p.id} first={i === 0} last={i === list.programs.length - 1} />
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">Henüz tercih yok. Sonuçlardaki “Ekle” ile listeye ekleyin.</p>
              )}
              {list?.programs.length ? <ListAdvice chances={list.programs.map((p) => placementChance(exam, p, { score: list.score, rank: list.rank, percentile: list.percentile }))} /> : null}
              <PlacementNoteForm exam={exam} studentId={student.id} note={list?.note ?? null} />
              {list?.note ? <p className="hidden whitespace-pre-line text-sm print:block">{list.note}</p> : null}
            </CardBody>
          ) : null}
        </Card>
        )}
      </div>
    </>
  );
}

/** Listenin dengesi: hepsi riskli ya da hiç güvenli tercih yoksa uyarı */
function ListAdvice({ chances }: { chances: (Chance | null)[] }) {
  const safe = chances.filter((c) => c === "high" || c === "open").length;
  const risky = chances.filter((c) => c === "low" || c === "reach").length;
  const text =
    safe === 0
      ? "Listede güvenli tercih yok: yerleşememe riskine karşı sona 1-2 güvenli tercih ekleyin."
      : risky === 0 && chances.length >= 3
        ? "Bütün tercihler güvenli: başa bir-iki iddialı (riskli) tercih koymak kaybettirmez."
        : null;
  return text ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 print:hidden">{text}</p> : null;
}
