import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Skeleton } from "@/components/ui/primitives";
import { getSiteSettings } from "@/server/site";

// Hesap silme: uygulama mağazaları (Google Play) uygulamayı açmadan da ulaşılabilen bir silme talebi adresi ister.
// Talep akışı: giriş yapıp Ayarlar → Hesabı sil (src/server/account-deletion.ts) ya da e-postayla.

export const metadata: Metadata = {
  title: "Hesap silme",
  description: "Pi Kampüs hesabınızın ve verilerinizin silinmesini nasıl talep edeceğiniz, neyin silindiği ve neyin ne kadar saklandığı.",
  alternates: { canonical: "/hesap-silme" },
};

export default function AccountDeletionPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const settings = await getSiteSettings();
  const email = settings.contactEmail;
  return (
    <Card className="p-6 sm:p-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Hesap silme</h1>
      <p className="mt-3 text-slate-600">
        {settings.siteName} hesabınızın ve hesabınıza bağlı kişisel verilerinizin silinmesini istediğiniz zaman talep edebilirsiniz. Bu sayfa web sitesi ve {settings.siteName} mobil uygulaması (Android ve iOS) için geçerlidir; ikisi aynı hesabı kullanır.
      </p>

      <h2 className="mt-8 text-xl font-bold text-slate-900">1. Giriş yaparak talep etme</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
        <li>
          <b>Öğretmen ve koç hesabı:</b> <Link href="/giris" className="font-semibold text-brand-700 hover:underline">Giriş yapın</Link> → Öğretmen paneli → Ayarlar → <b>Hesabı sil</b>.
        </li>
        <li>
          <b>Veli ve öğrenci hesabı:</b> <Link href="/giris" className="font-semibold text-brand-700 hover:underline">Giriş yapın</Link> → Hesabım → Hesap ayarları → <b>Hesabı sil</b> (kurum öğrencisi ya da velisiyseniz kurum portalındaki Hesap ayarları).
        </li>
        <li>
          <b>Kurum (etüt merkezi, dershane) hesabı ve kurumun açtığı öğrenci hesapları:</b> kurum yöneticiniz öğrenci kaydını panelden silebilir; kurum hesabının tamamen kapatılması için aşağıdaki e-posta adresine yazın.
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-bold text-slate-900">2. Giriş yapamıyorsanız e-postayla talep etme</h2>
      <p className="mt-3 text-slate-700">
        <a href={`mailto:${email}?subject=${encodeURIComponent("Hesap silme talebi")}`} className="font-semibold text-brand-700 hover:underline">
          {email}
        </a>{" "}
        adresine “Hesap silme talebi” konulu bir e-posta gönderin. E-postada hesabınızda kayıtlı e-posta adresini ya da kullanıcı adınızı yazın. Hesabın size ait olduğunu doğrulamak için hesaptaki e-posta adresinden yazmanızı ya da kısa bir doğrulama yapmamızı isteyebiliriz.
      </p>

      <h2 className="mt-8 text-xl font-bold text-slate-900">Talepten sonra ne olur?</h2>
      <p className="mt-3 text-slate-700">
        Talebiniz bize ulaşır; açık dersleriniz, bekleyen ödeme ya da iadeleriniz kontrol edildikten sonra hesabınız <b>en geç 30 gün içinde</b> silinir ve size e-postayla bilgi verilir. Silinen hesap geri getirilemez.
      </p>

      <h2 className="mt-8 text-xl font-bold text-slate-900">Silinen veriler</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">
        <li>Ad, soyad, e-posta, telefon, kullanıcı adı ve profil bilgileri (öğretmen profili, fotoğraf, tanıtım yazısı)</li>
        <li>Mesajlar, yüklediğiniz soru fotoğrafları ve dosyalar</li>
        <li>Program, çalışma ve deneme kayıtlarınız (hesabınıza ait olanlar)</li>
        <li>Bildirim tercihleri ve mobil uygulamanın bildirim kayıtları (cihaz anahtarları)</li>
      </ul>

      <h2 className="mt-8 text-xl font-bold text-slate-900">Saklanan veriler ve süreleri</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
        <li>
          <b>Fatura, ödeme ve abonelik kayıtları:</b> vergi ve ticaret mevzuatı gereği bu mevzuatta öngörülen süre boyunca (genellikle 10 yıl) saklanır ve yalnızca bu amaçla kullanılır.
        </li>
        <li>
          <b>Güvenlik ve erişim kayıtları</b> (giriş zamanı, IP adresi): ilgili mevzuatın öngördüğü süre boyunca saklanır, sonra silinir.
        </li>
        <li>
          <b>Kurumların kendi kayıtları:</b> bir etüt merkezi ya da dershanenin sizin için tuttuğu kayıtlar (yoklama, deneme sonuçları, ödemeler) o kurumun sorumluluğundadır; bu kayıtların silinmesi için kurumunuza da başvurabilirsiniz.
        </li>
      </ul>

      <p className="mt-8 text-sm text-slate-500">
        Kişisel verilerinizin işlenmesi hakkında ayrıntılar:{" "}
        <Link href="/sayfa/kvkk-aydinlatma-metni" className="font-semibold text-brand-700 hover:underline">
          KVKK aydınlatma metni
        </Link>{" "}
        ·{" "}
        <Link href="/sayfa/gizlilik-ve-cerez-politikasi" className="font-semibold text-brand-700 hover:underline">
          Gizlilik politikası
        </Link>
      </p>
    </Card>
  );
}
