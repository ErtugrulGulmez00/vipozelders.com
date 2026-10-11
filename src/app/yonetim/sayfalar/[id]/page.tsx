import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui/primitives";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { PageForm } from "../page-form";

export const metadata: Metadata = { title: "Sayfa düzenle" };

export default async function EditPage({ params }: PageProps<"/yonetim/sayfalar/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;
  const page = id === "yeni" ? null : await db.page.findUnique({ where: { id } });
  if (id !== "yeni" && !page) notFound();
  return (
    <>
      <Link href="/yonetim/sayfalar" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Sayfalar
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{page ? page.title : "Yeni sayfa"}</h1>
        {page ? (
          <Link href={`/sayfa/${page.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            Görüntüle <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
      <Card>
        <CardBody className="p-6">
          <PageForm page={page ?? undefined} />
        </CardBody>
      </Card>
    </>
  );
}
