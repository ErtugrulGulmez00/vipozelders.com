import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PrintButton } from "@/components/center/center-client";
import { WeeklyReport } from "@/components/koc/weekly-report";
import { dbDateToString } from "@/lib/dates";
import { reportByToken, weeklyReportData } from "@/server/koc-report";

export const instant = false;

export const metadata: Metadata = { title: "Haftalık koçluk raporu", robots: { index: false, follow: false } };

/** Velinin giriş yapmadan açtığı rapor (tahmin edilemeyen bağlantı, süreli). */
export default async function PublicReportPage({ params }: PageProps<"/rapor/[token]">) {
  await connection();
  const { token } = await params;
  const report = await reportByToken(token);
  if (!report) notFound();
  const data = await weeklyReportData(report.centerId, report.studentId, dbDateToString(report.weekStart));
  return (
    <main className="min-h-dvh bg-[#f6f5fb] px-3 py-6 sm:px-6 sm:py-10 print:bg-white print:p-0">
      <WeeklyReport data={data} note={report.note} />
      <div className="mx-auto mt-5 flex max-w-4xl flex-wrap items-center justify-between gap-3 px-1 text-sm text-slate-500 print:hidden">
        <PrintButton />
        <span>
          Kendi koçluk hesabınız için{" "}
          <Link href="/pi-koc" className="font-semibold text-brand-700 hover:underline">
            Pi Koç
          </Link>
        </span>
      </div>
    </main>
  );
}
