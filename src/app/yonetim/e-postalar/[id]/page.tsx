import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "E-posta" };

export default async function EmailPage({ params }: PageProps<"/yonetim/e-postalar/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;
  const email = await db.emailMessage.findUnique({ where: { id } });
  if (!email) notFound();
  return (
    <>
      <Link href="/yonetim/e-postalar" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> E-posta kutusu
      </Link>
      <Card className="mb-6">
        <CardHeader title={email.subject} />
        <CardBody>
          <DescriptionList
            items={[
              { label: "Alıcı", value: email.to },
              { label: "Oluşturulma", value: formatCompact(email.createdAt) },
              { label: "Durum", value: `${email.status}${email.sentAt ? ` · ${formatCompact(email.sentAt)}` : ""}${email.error ? ` · ${email.error}` : ""}` },
            ]}
          />
        </CardBody>
      </Card>
      <Card className="overflow-hidden">
        {/* E-posta içeriği betik çalıştırılamayan, yalıtılmış bir çerçevede gösterilir. */}
        <iframe title="E-posta önizleme" sandbox="" srcDoc={email.html} className="h-[640px] w-full bg-white" />
      </Card>
    </>
  );
}
