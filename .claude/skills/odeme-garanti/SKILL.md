---
name: odeme-garanti
description: Garanti BBVA sanal POS entegrasyonu (Ortak Ödeme Sayfası, 3D_OOS_PAY) — nasıl çalıştığı, ayarlar, test terminali, banka hata kodları, iade ve canlıya geçiş. Ödeme, iade, Garanti hatası ya da sanal POS ile ilgili her işte kullan.
---

# Garanti BBVA sanal POS

Kod: `src/server/payments/garanti.ts`; yönlendirme sayfası `src/app/(site)/odeme/garanti/[paymentId]`; bankadan dönüş `src/app/api/odeme/garanti/donus/route.ts`; deneme sayfası Yönetim → Ödeme testi (`src/app/yonetim/odeme-testi`); testler `tests/garanti.test.ts`. Resmi belge: dev.garantibbva.com.tr (Sanal POS → Ortak Ödeme Sayfası, Sorgulama, İade).

## Akış

1. Veli ödeme adımında `/odeme/garanti/[paymentId]` sayfasına gelir; imzalı form bankanın `gt3dengine` adresine kendiliğinden gönderilir. Kart bilgisi yalnızca bankanın sayfasında girilir.
2. Banka müşteriyi `/api/odeme/garanti/donus` adresine POST eder. **Dönen alanlara güvenilmez**: yalnızca kaydedilir; sonuç sunucudan bankaya sipariş sorgusu (`orderinq`, PROVAUT) ile doğrulanır, tutar karşılaştırılır (`retrieveResult`).
3. İade XML ile (`refund`, PROVRFN). Gün sonundan önce kabul edilmezse tam tutar için `void` (orijinal RetrefNum ile) denenir; kısmi iade arka plan göreviyle sonra tekrar denenir.

## İmzalar

- `hashedPassword = SHA1(şifre + terminalNo 9 haneye sıfırla tamamlanmış)` büyük harf hex.
- Form: `secure3dhash = SHA512(terminalId + orderId + tutar + "949" + successUrl + errorUrl + "sales" + taksit("") + storeKey + hashedPassword(PROVOOS))`.
- XML: `HashData = SHA512(orderId + terminalId + kartNo("") + tutar + "949" + hashedPassword(kullanıcı))`.
- Tutar kuruş (LLLLLLKK): `2550` = 25,50 ₺. Sipariş no = Payment id (cuid).

## Ayarlar (.env)

`PAYMENT_PROVIDER="garanti"`, `GARANTI_MODE="PROD"` (yoksa bankanın herkese açık test terminali), `GARANTI_MERCHANT_ID`, `GARANTI_TERMINAL_ID`, `GARANTI_PROV_PASSWORD` (PROVAUT), `GARANTI_OOS_PASSWORD` (PROVOOS), `GARANTI_REFUND_PASSWORD` (PROVRFN), `GARANTI_STORE_KEY` (3D güvenlik anahtarı), `GARANTI_COMPANY_NAME`. Değerleri ekrana yazdırma.

Test terminali (herkese açık, para hareketi yok): üye işyeri 7000679, terminal 30691297, şifre `123qweASD/`, store key `12345678`. Test kartı 5406 6975 4321 1173, 04/27, CVV 423. Banka sayfası robotları captcha ile durdurur; kart adımını bir insan dener (Yönetim → Ödeme testi).

## Banka hata kodları

| Kod | Anlam |
|---|---|
| ReasonCode `0651` "Kimlik doğrulama başarısız" | Test ortamında yanlış şifre/imza |
| ReasonCode `0651` "Kullanıcı şifresi hatalı" | Kullanıcı var, şifre bu kullanıcıya ait değil (panelden PROVAUT/PROVOOS/PROVRFN şifresi ayrı belirlenir) |
| ReasonCode `0110` "İşlem bulunamadı" | Sorguda böyle bir ödeme yok — kimlik kabul edildi demektir |
| ReasonCode `0103` | İade edilecek işlem yok |
| `mdstatus=7` "İşyeri Kullanım Tipi Desteklenmiyor" | Terminalde 3D Secure / Ortak Ödeme Sayfası tanımlı değil — bankanın açması gerekir |

Kimlik denetimi için para hareketi olmayan `orderinq` kullan; tahminle şifre deneme (banka kullanıcıyı kilitleyebilir).

## Durum (2026-10)

İş yeri 3273534, terminal 10411807. PROVAUT/PROVRFN şifreleri sunucuda ve doğrulandı. **Bekleyen:** bankanın terminale 3D Secure + Ortak Ödeme Sayfası tanımlaması ve Store Key. Gelince: `GARANTI_STORE_KEY` sunucuya yazılır → Ödeme testi'nde gerçek kartla 1 ₺ + iade → `PAYMENT_PROVIDER="garanti"`, `GARANTI_MODE="PROD"` → yeniden başlat → hakediş bekleme süresini (Site ayarları → aktarım süresi) bankanın valörüne göre ayarla.

Garanti'de para üye işyeri hesabına gelir; öğretmen hakedişleri Finans'tan havaleyle ödenir.
