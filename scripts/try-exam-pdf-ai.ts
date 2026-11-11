// Yerel deneme: sonuç PDF'ini önce kurallı okuyucuyla, tanımazsa yapay zekâyla okur ve özetini yazar.
//   node --conditions=react-server --env-file=.env --import tsx scripts/try-exam-pdf-ai.ts <pdf> [kurum-slug]
import { readFileSync } from "node:fs";
import { chunkPages, codeNames, pageText } from "@/lib/center/exam-pdf-ai";
import { parseResultPdf } from "@/lib/center/exam-pdf";
import { readExamPdfWithAi } from "@/server/center/exam-pdf-ai";
import { readPdfItems } from "@/server/center/pdf-text";
import { db } from "@/server/db";

async function main() {
  const [file, slug = "basari-etut-merkezi"] = process.argv.slice(2);
  const pages = await readPdfItems(new Uint8Array(readFileSync(file)));
  const known = parseResultPdf(pages).exams;
  console.log(`sayfa ${pages.length}, kurallı okuyucu: ${known.length ? "TANIDI" : "tanımadı"}`);
  const center = await db.center.findUniqueOrThrow({ where: { slug } });
  const students = await db.centerStudent.findMany({ where: { centerId: center.id }, select: { id: true, firstName: true, lastName: true } });
  const codes = new Map<string, string>();
  const coded = chunkPages(pages.map(pageText).map((t) => codeNames(t, students, codes).text));
  console.log(`--- modele giden metin (ilk parça, ilk 900 karakter; ${coded.length} parça, ${codes.size} ad kodlandı) ---\n${coded[0].slice(0, 900)}\n---`);
  const started = Date.now();
  const result = await readExamPdfWithAi(pages, students);
  console.log(`yapay zekâ: ${Math.round((Date.now() - started) / 1000)} sn, ${result.totalParts} parça, ${result.failedParts} başarısız`);
  for (const exam of result.exams) {
    console.log(`\n# ${exam.name} · ${exam.kind} · yanlış götürme ${exam.wrongPenalty.toFixed(3)} · ${exam.students.length} öğrenci`);
    console.log(`  dersler: ${exam.sections.map((s) => `${s.name} ${s.questionCount}${s.answerKey ? " +anahtar" : ""}${s.topics.length ? " +kazanım" : ""}`).join(", ")}`);
    for (const st of exam.students) {
      const net = st.sections.reduce((t, s) => t + (s?.net ?? 0), 0);
      console.log(`  ${st.name.padEnd(22)} no:${st.number || "-"} net:${net.toFixed(2)}${st.score ? ` puan:${st.score}` : ""}${st.warnings ? `  ⚠ ${st.warnings.join("; ")}` : ""}`);
    }
    if (exam.notes) console.log(`  not: ${exam.notes.join(" ")}`);
  }
}
main().finally(() => db.$disconnect());
