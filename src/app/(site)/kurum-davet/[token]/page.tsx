import { CheckCircle2, Users } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LinkButton } from "@/components/ui/button";
import { Alert, Card, Skeleton } from "@/components/ui/primitives";
import { getCurrentUser } from "@/server/auth/current-user";
import { findInvite } from "@/server/center/portal";
import { AcceptInviteForm } from "./accept-form";

export const metadata: Metadata = { title: "Veli portalı daveti", robots: { index: false } };

export default function GuardianInvitePage({ params }: PageProps<"/kurum-davet/[token]">) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
        <Invite params={params} />
      </Suspense>
    </div>
  );
}

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, user] = await Promise.all([findInvite(token), getCurrentUser()]);
  if (!invite) {
    return (
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Davet bağlantısı geçersiz</h1>
        <p className="mt-2 text-slate-600">Bağlantının süresi dolmuş ya da daha önce kullanılmış olabilir. Kurumdan yeni bir davet isteyin.</p>
        {user?.role === "STUDENT" ? (
          <LinkButton href="/hesabim/kurum" className="mt-6">
            Bağlı öğrencilerim
          </LinkButton>
        ) : null}
      </Card>
    );
  }
  const studentName = `${invite.student.firstName} ${invite.student.lastName}`;
  const next = encodeURIComponent(`/kurum-davet/${token}`);
  return (
    <Card className="p-6 sm:p-8">
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <Users className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{invite.student.center.name} veli portalı</h1>
      <p className="mt-2 text-slate-600">
        <strong>{studentName}</strong> için devamsızlık, etüt, deneme sonuçları, eksik konular, ödeme planı ve duyuruları buradan takip edebilirsiniz.
      </p>
      <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
        {["Derse gelmeyince anında bildirim", "Deneme karnesi ve net gelişimi", "Taksit ve ödeme geçmişi"].map((t) => (
          <li key={t} className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> {t}
          </li>
        ))}
      </ul>
      {user?.role === "STUDENT" ? (
        <div className="mt-6">
          <p className="mb-3 text-sm text-slate-600">
            <strong>
              {user.firstName} {user.lastName}
            </strong>{" "}
            hesabıyla giriş yaptınız ({invite.fullName} · {invite.relation}).
          </p>
          <AcceptInviteForm token={token} />
        </div>
      ) : user ? (
        <Alert tone="warning" className="mt-6">
          Şu an {user.role === "TEACHER" ? "öğretmen" : user.role === "CENTER" ? "kurum" : "yönetici"} hesabıyla giriş yaptınız. Daveti kabul etmek için çıkış yapıp veli hesabınızla giriş yapın.
        </Alert>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-slate-600">Devam etmek için ücretsiz veli hesabınızla giriş yapın ya da yeni hesap açın.</p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/giris?next=${next}`}>Giriş yap</LinkButton>
            <LinkButton href={`/kayit?next=${next}`} variant="outline">
              Ücretsiz hesap aç
            </LinkButton>
          </div>
        </div>
      )}
    </Card>
  );
}
