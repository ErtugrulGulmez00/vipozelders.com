import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { KocStudentPortal } from "@/components/koc/student-portal";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Koçluğum" };

/** Pi Koç öğrencisinin (ya da velisinin) koçluk ekranı; adresteki kimlik kişinin öğrenci bağlantısıdır. */
export default async function KocStudentPage({ params, searchParams }: PageProps<"/kocum/[id]">) {
  await connection();
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const sp = await searchParams;
  const link = await db.centerGuardian.findFirst({
    where: { id, userId: user.id, student: { status: "ACTIVE", center: { kind: "COACH", status: { not: "SUSPENDED" } } } },
    include: { student: { include: { center: { select: { name: true } } } } },
  });
  if (!link) notFound();
  return (
    <KocStudentPortal
      student={link.student}
      base={`/kocum/${id}`}
      tab={typeof sp.sekme === "string" ? sp.sekme : "bugun"}
      isStudent={link.isStudentAccount}
      week={typeof sp.hafta === "string" ? sp.hafta : undefined}
    />
  );
}
