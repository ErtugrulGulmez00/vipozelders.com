import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logoutAction } from "@/actions/auth";
import { Button, LinkButton } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/primitives";
import { roleHome } from "@/lib/auth-constants";
import { resolveCenter } from "@/server/center/context";
import { getSiteSettings } from "@/server/site";

export const metadata: Metadata = { title: "Kurum paneli erişimi" };
export const instant = false;

/** Kurum paneline girilemeyen durumlar: üyelik yok / pasif ya da kurum askıda. */
export default async function CenterAccessPage() {
  const resolved = await resolveCenter();
  if (resolved.kind === "anonymous") redirect("/giris?next=/kurum");
  if (resolved.kind === "password") redirect("/sifre-degistir");
  if (resolved.kind === "ok") redirect("/kurum");
  const settings = await getSiteSettings();
  const { user } = resolved;
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Kurum paneline giriş yapılamıyor</h1>
      {resolved.kind === "suspended" ? (
        <Alert tone="warning" className="mt-4" title={`${resolved.centerName} hesabı askıya alınmış`}>
          Kayıtlarınız silinmedi. Aboneliğinizi yeniden etkinleştirmek için {settings.siteName} ekibiyle iletişime geçin
          {settings.contactEmail ? ` (${settings.contactEmail}${settings.contactPhone ? `, ${settings.contactPhone}` : ""})` : ""}.
        </Alert>
      ) : (
        <Alert tone="info" className="mt-4" title="Hesabınız bir kuruma bağlı değil">
          Kurum yöneticiniz sizi personelden çıkarmış ya da pasife almış olabilir. Kurumunuzla görüşün.
        </Alert>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        {user.role !== "CENTER" ? <LinkButton href={roleHome(user.role)}>Panelime dön</LinkButton> : null}
        <LinkButton href="/kurumlar-icin" variant="outline">
          Kurumlar için
        </LinkButton>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost">
            Çıkış yap
          </Button>
        </form>
      </div>
    </Card>
  );
}
