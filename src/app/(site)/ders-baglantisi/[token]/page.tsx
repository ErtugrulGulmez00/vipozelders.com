import { CalendarClock, Video } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LinkButton } from "@/components/ui/button";
import { Alert, Badge, Card, Skeleton } from "@/components/ui/primitives";
import { formatLessonRange } from "@/lib/dates";
import { durationLabel } from "@/lib/labels";
import { getCurrentUser } from "@/server/auth/current-user";
import { findLessonLink } from "@/server/lesson-links";
import { ClaimLinkForm } from "./claim-form";

export const metadata: Metadata = { title: "Ders bağlantısı", robots: { index: false } };

export default function LessonLinkPage({ params }: PageProps<"/ders-baglantisi/[token]">) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
        <LessonLink params={params} />
      </Suspense>
    </div>
  );
}

function Notice({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-600">{children}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </Card>
  );
}

async function LessonLink({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const [link, user] = await Promise.all([findLessonLink(token), getCurrentUser()]);
  const now = new Date();
  if (!link) return <Notice title="Bağlantı geçersiz">Bağlantıyı eksik kopyalamış olabilirsiniz. Öğretmeninizden yeniden göndermesini isteyin.</Notice>;

  const teacherName = `${link.teacher.user.firstName} ${link.teacher.user.lastName}`;
  if (link.booking) {
    return user && link.booking.studentId === user.id ? (
      <Notice title="Bu derse kaydoldunuz" action={<LinkButton href={`/hesabim/derslerim/${link.booking.id}`}>Ders sayfasına git</LinkButton>}>
        {teacherName} ile dersiniz {formatLessonRange(link.startAt, link.endAt)}. Ders sınıfı, ders saatinden 10 dakika önce ders sayfanızdan açılır.
      </Notice>
    ) : (
      <Notice title="Bağlantı kullanıldı">Bu ders bağlantısıyla başka bir hesap derse kaydoldu. Size ait değilse öğretmeninizden yeni bağlantı isteyin.</Notice>
    );
  }
  if (link.cancelledAt) return <Notice title="Bağlantı iptal edildi">Öğretmen bu ders bağlantısını iptal etti.</Notice>;
  if (link.endAt <= now) return <Notice title="Bağlantının süresi doldu">Dersin saati geçti. Öğretmeninizden yeni bir bağlantı isteyin.</Notice>;

  const next = encodeURIComponent(`/ders-baglantisi/${token}`);
  const wrongStudent = Boolean(user && link.sourceBooking && link.sourceBooking.studentId !== user.id);
  return (
    <Card className="p-6 sm:p-8">
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <Video className="size-6" aria-hidden />
      </span>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">{link.sourceBooking ? "Telafi dersi" : "Ders daveti"}</h1>
        <Badge tone="green">Ücretsiz</Badge>
      </div>
      <p className="mt-2 text-slate-600">
        <strong>{teacherName}</strong> sizi online derse davet ediyor.
      </p>
      <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
        <li className="flex items-center gap-2">
          <CalendarClock className="size-4 text-brand-600" aria-hidden /> {formatLessonRange(link.startAt, link.endAt)} ({durationLabel(link.durationMinutes)})
        </li>
        <li className="flex items-center gap-2">
          <Video className="size-4 text-brand-600" aria-hidden /> {link.levelName} {link.subjectName} · {link.serviceName} · sitemizdeki sanal sınıfta
        </li>
      </ul>
      {user?.role === "STUDENT" ? (
        wrongStudent ? (
          <Alert tone="warning" className="mt-6">
            Bu telafi bağlantısı, dersi alan öğrenci/veli hesabı içindir. Şu an {user.firstName} {user.lastName} hesabıyla giriş yaptınız; dersi aldığınız hesapla giriş yapın.
          </Alert>
        ) : (
          <div className="mt-6">
            <p className="mb-3 text-sm text-slate-600">
              <strong>
                {user.firstName} {user.lastName}
              </strong>{" "}
              hesabıyla kaydolacaksınız.
            </p>
            <ClaimLinkForm token={token} />
          </div>
        )
      ) : user ? (
        <Alert tone="warning" className="mt-6">
          Şu an {user.role === "TEACHER" ? "öğretmen" : user.role === "CENTER" ? "kurum" : "yönetici"} hesabıyla giriş yaptınız. Derse kaydolmak için çıkış yapıp öğrenci/veli hesabınızla giriş yapın.
        </Alert>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-slate-600">Derse kaydolmak için hesabınızla giriş yapın ya da ücretsiz hesap açın.</p>
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
