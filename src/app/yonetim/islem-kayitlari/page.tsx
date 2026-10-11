import type { Metadata } from "next";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "İşlem kayıtları" };

export default async function AuditLogPage() {
  await requireRole("ADMIN");
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { firstName: true, lastName: true, username: true } } },
  });
  return (
    <>
      <PageHeader title="İşlem kayıtları" description="Yönetimsel ve parasal işlemlerin kim tarafından, ne zaman yapıldığı." />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Tarih</Th>
              <Th>Kişi</Th>
              <Th>İşlem</Th>
              <Th>Kayıt</Th>
              <Th>Ayrıntı</Th>
              <Th>IP</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <Td className="whitespace-nowrap text-xs">{formatCompact(log.createdAt)}</Td>
                <Td className="text-xs">{log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "sistem"}</Td>
                <Td className="font-mono text-xs">{log.action}</Td>
                <Td className="text-xs">
                  {log.entityType}
                  {log.entityId ? ` · ${log.entityId.slice(0, 10)}…` : ""}
                </Td>
                <Td className="max-w-xs truncate font-mono text-[11px] text-slate-500">{log.details ? JSON.stringify(log.details) : "—"}</Td>
                <Td className="text-xs">{log.ipAddress ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
