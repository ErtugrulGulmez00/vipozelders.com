import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL tanımlı değil (.env dosyasını kontrol edin).");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Uygulama genelinde tek Prisma örneği (geliştirmede sıcak yeniden yüklemede de korunur). */
export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<DbClient["$transaction"]>[0]>[0];
