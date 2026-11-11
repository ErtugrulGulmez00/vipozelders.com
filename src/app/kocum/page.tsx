import { HeartHandshake } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StudentAvatar } from "@/components/koc/student-card";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/server/auth/current-user";
import { kocPortalLinks } from "@/server/koc";

export const metadata: Metadata = { title: "Koçluğum" };

/** Tek bağlantıda doğrudan koçluk ekranı; velinin birden çok çocuğu varsa seçim. */
export default async function KocStudentHome() {
  const user = await requireRole("STUDENT");
  const links = await kocPortalLinks(user.id);
  if (links.length === 1) redirect(`/kocum/${links[0].id}`);
  if (!links.length) {
    return (
      <EmptyState
        icon={<HeartHandshake className="size-8" />}
        title="Bağlı Pi Koç kaydı yok"
        description="Koçunuz size Pi Koç öğrenci hesabı açınca giriş bilgileri e-postanıza gelir. Kurum ya da özel ders hesabınız varsa üstteki geçiş bağlantısını kullanın."
      />
    );
  }
  return (
    <>
      <PageHeader title="Koçluk" description="Takip etmek istediğiniz öğrenciyi seçin." />
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((l) => (
          <Link key={l.id} href={`/kocum/${l.id}`} className="flex items-center gap-3 rounded-3xl border border-ink-100 bg-white p-5 shadow-xs hover:border-brand-200 hover:shadow-md">
            <StudentAvatar id={l.student.id} firstName={l.student.firstName} lastName={l.student.lastName} />
            <span>
              <span className="block font-semibold text-ink-900">
                {l.student.firstName} {l.student.lastName}
              </span>
              <span className="text-sm text-slate-500">{l.student.center.name}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
