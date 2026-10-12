import { KeyRound, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { beginTwoFactorSetupAction, cancelTwoFactorSetupAction } from "@/actions/security";
import { FlashNotice } from "@/components/panel/flash-notice";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { totpUri } from "@/server/auth/totp";
import { totpSetupState } from "@/server/auth/two-factor";
import { getSiteSettings } from "@/server/site";
import { ConfirmTwoFactorForm, DisableTwoFactorForm } from "./two-factor-forms";

export const metadata: Metadata = { title: "Güvenlik" };

export default async function SecurityPage({ searchParams }: PageProps<"/yonetim/guvenlik">) {
  const user = await requireRole("ADMIN");
  const { durum } = await searchParams;
  const [state, settings] = await Promise.all([totpSetupState(user.id), getSiteSettings()]);
  const account = user.username ?? user.email ?? user.id;
  const qrSvg = state.pendingSecret ? await QRCode.toString(totpUri(state.pendingSecret, account, settings.siteName), { type: "svg", margin: 1, width: 208 }) : null;

  return (
    <>
      <PageHeader title="Güvenlik" description="Yönetici hesabınızı şifreye ek olarak telefonunuzdaki tek kullanımlık kodla koruyun." />
      <FlashNotice code={durum} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="İki adımlı doğrulama" description="Google Authenticator, Microsoft Authenticator veya benzeri bir uygulama ile çalışır." />
          <CardBody className="space-y-5">
            {state.enabledAt ? (
              <>
                <p className="flex items-center gap-2 font-semibold text-emerald-700">
                  <ShieldCheck className="size-5" aria-hidden /> Açık · {formatDateTime(state.enabledAt)} tarihinden beri
                </p>
                <p className="text-sm text-slate-600">Her girişte şifrenizden sonra uygulamadaki 6 haneli kod istenir. Kapatmak için güncel kodu yazın.</p>
                <DisableTwoFactorForm />
              </>
            ) : qrSvg && state.pendingSecret ? (
              <>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
                  <li>Telefonunuza doğrulayıcı uygulamayı kurun (ör. Google Authenticator).</li>
                  <li>Uygulamada “QR kodu tara” ile aşağıdaki kodu okutun.</li>
                  <li>Uygulamanın gösterdiği 6 haneli kodu yazıp onaylayın.</li>
                </ol>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-slate-700">QR okutamıyorsanız bu anahtarı elle girin:</p>
                    <p className="mt-1 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-slate-900">{state.pendingSecret.match(/.{1,4}/g)?.join(" ")}</p>
                  </div>
                </div>
                <ConfirmTwoFactorForm />
                <form action={cancelTwoFactorSetupAction}>
                  <Button type="submit" variant="ghost" size="sm">
                    Kurulumu iptal et
                  </Button>
                </form>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 font-semibold text-amber-700">
                  <ShieldAlert className="size-5" aria-hidden /> Kapalı
                </p>
                <p className="text-sm text-slate-600">
                  Yönetici hesabı ödemelere, iadelere ve tüm kullanıcı bilgilerine erişebilir. Şifreniz ele geçirilse bile hesabınıza girilememesi için iki adımlı doğrulamayı açmanızı öneririz.
                </p>
                <form action={beginTwoFactorSetupAction}>
                  <Button type="submit">
                    <Smartphone className="size-4" aria-hidden /> Kurulumu başlat
                  </Button>
                </form>
              </>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Şifre" />
          <CardBody className="space-y-3 text-sm text-slate-600">
            <p>Şifrenizi düzenli aralıklarla değiştirin ve başka sitelerde kullanmayın.</p>
            <LinkButton href="/sifre-degistir" variant="outline">
              <KeyRound className="size-4" aria-hidden /> Şifremi değiştir
            </LinkButton>
            <p className="text-xs text-slate-400">Telefonunuzu kaybederseniz sunucuda “npm run admin:2fa-kapat -- kullanıcı-adı” komutuyla iki adımlı doğrulama kapatılabilir.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
