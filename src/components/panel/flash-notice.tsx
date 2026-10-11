import { Alert } from "@/components/ui/primitives";

// İşlemden sonra formun kendisi sayfadan kalktığında (ör. onaylanan talep listeden düşer)
// sonuç mesajı yönlendirilen sayfada ?durum=... ile gösterilir.
const MESSAGES: Record<string, string> = {
  onaylandi: "Ders onaylandı; öğrenciye bildirildi.",
  reddedildi: "Talep reddedildi; öğrenciye ücretin tamamı iade ediliyor.",
  iptal: "Randevu iptal edildi. İade varsa kartınıza işleniyor.",
  "ogretmen-iptal": "Ders iptal edildi; öğrenciye ücretin tamamı iade ediliyor.",
  bildirildi: "Bildiriminiz alındı. Ekibimiz inceleyip size dönüş yapacak; inceleme bitene kadar öğretmene ödeme yapılmaz.",
  "yonetici-iptal": "Randevu iptal edildi; taraflara bildirim gönderildi.",
  itiraz: "İtiraz sonuçlandırıldı; taraflara bildirim gönderildi.",
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
