import { Alert } from "@/components/ui/primitives";

// İşlemden sonra formun kendisi sayfadan kalktığında (ör. onaylanan talep listeden düşer)
// sonuç mesajı yönlendirilen sayfada ?durum=... ile gösterilir.
const MESSAGES: Record<string, string> = {
  onaylandi: "Ders onaylandı; öğrenciye bildirildi.",
  tanisma: "Tanışma talebiniz öğretmene iletildi. Öğretmen onaylayınca size haber vereceğiz; görüşme sanal sınıfta yapılır.",
  paket: "Ders talebiniz paketinizden öğretmene iletildi. Öğretmen onaylayınca size haber vereceğiz; onaylamazsa ders paketinize geri eklenir.",
  bildirim: "Bildiriminiz alındı ve ders odası kapatıldı. Ekibimiz konuyu hemen inceleyip size dönecek.",
  reddedildi: "Talep reddedildi; öğrenciye ücretin tamamı iade ediliyor.",
  iptal: "Randevu iptal edildi. İade varsa kartınıza işleniyor.",
  "ogretmen-iptal": "Ders iptal edildi; öğrenciye ücretin tamamı iade ediliyor.",
  bildirildi: "Bildiriminiz alındı. Ekibimiz inceleyip size dönüş yapacak; inceleme bitene kadar öğretmene ödeme yapılmaz.",
  "yonetici-iptal": "Randevu iptal edildi; taraflara bildirim gönderildi.",
  itiraz: "İtiraz sonuçlandırıldı; taraflara bildirim gönderildi.",
  "2fa-acildi": "İki adımlı doğrulama açıldı. Bundan sonra girişte şifrenizle birlikte uygulamadaki kod istenecek.",
  "2fa-kapatildi": "İki adımlı doğrulama kapatıldı.",
  test: "Test dersi oluşturuldu. Öğretmen ve öğrenci kendi panellerindeki ders sayfasından “Derse katıl” ile sınıfa girebilir (sınıf ders saatinden 10 dakika önce açılır).",
};

export function FlashNotice({ code }: { code: string | string[] | undefined }) {
  const key = Array.isArray(code) ? code[0] : code;
  const message = key ? MESSAGES[key] : undefined;
  return message ? (
    <Alert tone="success" className="mb-6">
      {message}
    </Alert>
  ) : null;
}
