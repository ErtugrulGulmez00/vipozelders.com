import type { Prisma } from "@/generated/prisma/client";
import { db, type DbTransaction } from "./db";

type AuditInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

/** Yönetimsel ve parasal işlemleri kayıt altına alır. */
export async function audit(input: AuditInput, tx: DbTransaction | typeof db = db) {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      details: input.details,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
