import { Download } from "lucide-react";
import type { Metadata } from "next";
import { shortDate } from "@/components/center/center-ui";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import { formatCompact, toLocalDateString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireCenter } from "@/server/center/context";
import { overdueByStudent } from "@/server/center/finance";
import { OverdueReminderForm } from "../finance-forms";
import { FinanceTabs } from "../finance-tabs";

export const metadata: Metadata = { title: "Geciken ödemeler" };

export default async function OverduePage() {
  const ctx = await requireCenter("finance.view");
  const rows = await overdueByStudent(ctx.center.id, toLocalDateString(new Date()));
  const total = rows.reduce((t, r) => t + r.amount, 0);
  return (
    <>
      <PageHeader
        title="Geciken ödemeler"
        description={ctx.center.remindPayments ? `Otomatik hatırlatma açık: vadeden ${ctx.center.reminderDaysBefore} gün önce ve vade geçince bir kez.` : "Otomatik hatırlatma kapalı (Kurum ayarları)."}
        actions={
          <a href="/api/kurum/disa-aktar/borclar" download className={buttonClasses("outline", "sm")}>
            <Download className="size-4" aria-hidden /> Borç listesi (CSV)
          </a>
        }
      />
      <FinanceTabs ctx={ctx} active="gecikenler" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Geciken toplam" value={<span className="text-rose-600">{formatMoney(total)}</span>} />
        <StatCard label="Öğrenci" value={rows.length} />
        <StatCard label="Taksit" value={rows.reduce((t, r) => t + r.installments, 0)} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Geciken ödeme yok" description="Tüm vadesi gelen taksitler ödenmiş." />
      ) : ctx.can("finance.edit") ? (
        <OverdueReminderForm
          rows={rows.map((r) => ({
            studentId: r.studentId,
            name: r.name,
            meta: [r.studentNumber, r.gradeName].filter(Boolean).join(" · "),
            amount: r.amount,
            installments: r.installments,
            oldestDue: shortDate(r.oldestDue),
            guardian: r.guardianName ?? "—",
            phone: r.guardianPhone,
            lastReminded: r.lastReminded ? formatCompact(r.lastReminded) : null,
          }))}
        />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {rows.map((r) => (
            <li key={r.studentId} className="flex justify-between px-4 py-3 text-sm">
              <span>{r.name}</span>
              <span className="font-bold text-rose-600">{formatMoney(r.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
