-- WhatsApp izni: bugüne dek velilerden izin alınmadı, kutular varsayılan açıktı. Meta açık rıza ister; kapatılır, izin verildikçe açılır.
-- (Bildirim kanalı henüz e-posta olduğu için kimseye giden mesaj değişmez.)
ALTER TABLE "User" ADD COLUMN "whatsappConsentAt" TIMESTAMP(3);
ALTER TABLE "CenterGuardian" ALTER COLUMN "notifyWhatsapp" SET DEFAULT false;
UPDATE "CenterGuardian" SET "notifyWhatsapp" = false WHERE "notifyWhatsapp" = true;

-- Yasal metinler: WhatsApp/Meta, hizmet sağlayıcılar, yurt dışı aktarım, kurum kayıtları. Yönetimden düzenlenip bu parçası değişmiş metinlere dokunulmaz.
UPDATE "Page" SET "content" = REPLACE("content", $pk$olarak kişisel verilerinizi aşağıda açıklanan kapsamda işlemekteyiz.$pk$, $pk$olarak kişisel verilerinizi aşağıda açıklanan kapsamda işlemekteyiz.

Veri sorumlusu: {companyName} · {companyAddress} · {companyTaxInfo} · {contactEmail}$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$kvkk-aydinlatma-metni$pk$ AND "content" LIKE $pk$%olarak kişisel verilerinizi aşağıda açıklanan kapsamda işlemekteyiz.%$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$IBAN ve T.C. kimlik numarası$pk$, $pk$IBAN ve T.C. kimlik numarası
- Kurum panelindeki öğrenci ve veliler için: kurumun girdiği ad, telefon, e-posta, sınıf, yoklama, deneme sonucu, ödeme planı ve notlar
- Online derslerde: derse giriş ve çıkış zamanları
- Bildirimler: cihaz bildirim anahtarı, WhatsApp tercihiniz ve gönderim kayıtları$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$kvkk-aydinlatma-metni$pk$ AND "content" LIKE $pk$%IBAN ve T.C. kimlik numarası%$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$Sözleşmenin kurulması ve ifası, hukuki yükümlülük, meşru menfaat ve gerektiğinde açık rızanız (KVKK m.5).$pk$, $pk$Sözleşmenin kurulması ve ifası, hukuki yükümlülük, meşru menfaat ve gerektiğinde açık rızanız (KVKK m.5). WhatsApp bildirimleri ve pazarlama iletileri yalnızca açık rızanıza dayanır.$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$kvkk-aydinlatma-metni$pk$ AND "content" LIKE $pk$%Sözleşmenin kurulması ve ifası, hukuki yükümlülük, meşru menfaat ve gerektiğinde açık rızanız (KVKK m.5).%$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$Kişisel verileriniz yalnızca hizmetin gerektirdiği ölçüde ödeme kuruluşu, barındırma ve e-posta hizmet sağlayıcıları ile yetkili kamu kurumlarıyla paylaşılır. Yurt dışında bulunan hizmet sağlayıcılara aktarım KVKK m.9 kapsamındaki şartlara uygun yapılır.$pk$, $pk$Kişisel verileriniz yalnızca hizmetin gerektirdiği ölçüde aşağıdaki taraflarla paylaşılır:
- Ödeme kuruluşu ve banka: ödeme ve iade işlemleri
- Barındırma ve e-posta hizmet sağlayıcıları: sitenin çalışması ve bildirim e-postaları
- LiveKit: online derslerde görüntü ve sesin iletilmesi
- Google (Firebase Cloud Messaging, Google Drive): mobil uygulama bildirimleri ve şifrelenmiş yedekler
- Meta Platforms (WhatsApp) ve WhatsApp iş ortağımız LetsBot: yalnızca WhatsApp bildirimi alıyorsanız telefon numaranız ve mesaj içeriği
- Yetkili kamu kurumları: yasal zorunluluk hâlinde

LiveKit, Google ve Meta sunucuları yurt dışında bulunabilir. Yurt dışına aktarım KVKK m.9 kapsamındaki şartlara uygun yapılır.

## WhatsApp bildirimleri
WhatsApp bildirimleri isteğe bağlıdır ve yalnızca izninizle gönderilir. İzninizi kayıt sırasında ya da Hesap ayarlarından verebilir, aynı yerden geri alabilir ya da WhatsApp’tan DUR yazarak bildirimleri durdurabilirsiniz. Bu durum e-posta ve site bildirimlerini etkilemez. Kurum öğrencilerinin velilerine giden WhatsApp bildirimleri için izni kurum alır.

## Kurum kayıtları
Etüt merkezi ya da dershane panelinde kurumun girdiği öğrenci ve veli verileri için veri sorumlusu ilgili kurumdur; {siteName} bu verileri kurum adına, veri işleyen olarak işler.$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$kvkk-aydinlatma-metni$pk$ AND "content" LIKE $pk$%Kişisel verileriniz yalnızca hizmetin gerektirdiği ölçüde ödeme kuruluşu, barındırma ve e-posta hizmet sağlayıcıları ile yetkili kamu kurumlarıyla paylaşılır. Yurt dışında bulunan hizmet sağlayıcılara aktarım KVKK m.9 kapsamındaki şartlara uygun yapılır.%$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$- vd_center: Kurum paneli oturumu (yalnızca kurum personeli, zorunlu)$pk$, $pk$- vd_center: Kurum paneli oturumu (yalnızca kurum personeli, zorunlu)
- vd_2fa: İki adımlı doğrulama sırasında kısa süreli oturum (zorunlu)
- vd_davet: Arkadaş davet bağlantısıyla gelenlerde davet kodu (zorunlu)$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$gizlilik-ve-cerez-politikasi$pk$ AND "content" LIKE $pk$%- vd_center: Kurum paneli oturumu (yalnızca kurum personeli, zorunlu)%$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$Şifreler geri döndürülemez biçimde saklanır; kart bilgileri sistemimizde tutulmaz; hassas veriler şifrelenir.$pk$, $pk$Şifreler geri döndürülemez biçimde saklanır; kart bilgileri sistemimizde tutulmaz; hassas veriler ve yedekler şifrelenir.

## WhatsApp bildirimleri
Telefon numaranız, yalnızca izin verdiyseniz ders ve hesap bildirimleri için WhatsApp üzerinden kullanılır; bu amaçla Meta Platforms ve iş ortağımız LetsBot ile paylaşılır. Reklam ya da kampanya mesajı göndermek için kullanılmaz. Bildirimleri Hesap ayarlarından kapatabilir ya da WhatsApp’tan DUR yazarak durdurabilirsiniz.

## Kişisel verileriniz
Hangi verileri neden işlediğimiz, kimlerle paylaştığımız ve haklarınız KVKK Aydınlatma Metni’nde yer alır. Hesabınızı ve verilerinizi silmek için “Verilerimi Nasıl Sildiririm?” sayfasına bakın.$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$gizlilik-ve-cerez-politikasi$pk$ AND "content" LIKE $pk$%Şifreler geri döndürülemez biçimde saklanır; kart bilgileri sistemimizde tutulmaz; hassas veriler şifrelenir.%$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$Gizlilikle ilgili sorularınız için: {contactEmail}$pk$, $pk$Gizlilikle ilgili sorularınız için: {companyName} · {contactEmail}$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$gizlilik-ve-cerez-politikasi$pk$ AND "content" LIKE $pk$%Gizlilikle ilgili sorularınız için: {contactEmail}%$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$WhatsApp ve SMS bildirimleri dahil$pk$, $pk$WhatsApp bildirimleri dahil$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$veri-silme$pk$ AND "content" LIKE $pk$%WhatsApp ve SMS bildirimleri dahil%$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$WhatsApp/SMS için kullanılan$pk$, $pk$WhatsApp için kullanılan$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$veri-silme$pk$ AND "content" LIKE $pk$%WhatsApp/SMS için kullanılan%$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$## 3. Kurum (etüt merkezi / dershane) kayıtları$pk$, $pk$Yalnızca WhatsApp bildirimlerini durdurmak istiyorsanız WhatsApp’tan DUR yazmanız yeterlidir.

## 3. Kurum (etüt merkezi / dershane) kayıtları$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$veri-silme$pk$ AND "content" LIKE $pk$%## 3. Kurum (etüt merkezi / dershane) kayıtları%$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$## Üyelik$pk$, $pk$Bu şartlar, {companyName} tarafından işletilen {siteName} sitesinin ve mobil uygulamasının kullanımını düzenler.

## Hizmet
{siteName}; özel ders, soru çözüm ve koçluk için öğrenci ve velileri öğretmenlerle buluşturur. Etüt merkezi ve dershanelere ise kurum yönetim yazılımı sunar. Kurum paneli için Kurum Hizmet Sözleşmesi geçerlidir.

## Üyelik$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$kullanim-sartlari$pk$ AND "content" LIKE $pk$%## Üyelik%$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk${siteName}, öğretmen ile öğrenci arasında aracı hizmet sağlayıcıdır.$pk$, $pk${siteName}, öğretmen ile öğrenci arasında aracı hizmet sağlayıcıdır. Dersin içeriğinden ve yürütülmesinden dersi veren öğretmen sorumludur. Ödeme, iptal ve iade kuralları Mesafeli Satış Sözleşmesi ile İptal ve İade Politikası’nda yer alır.

## Fikri haklar
Sitedeki yazılım, marka ve tasarım {companyName}’a aittir; izinsiz kopyalanamaz. Öğretmenlerin ve kurumların yüklediği içeriklerin sorumluluğu kendilerine aittir.

## Değişiklikler
Bu şartlar güncellenebilir; güncel metin bu sayfada yayımlanır ve sayfanın başındaki tarih değişir.

## Uyuşmazlık ve iletişim
Tüketici işlemlerinde tüketici hakem heyetleri ve tüketici mahkemeleri yetkilidir. Sorularınız için: {companyName} · {contactEmail} · {contactPhone}$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$kullanim-sartlari$pk$ AND "content" LIKE $pk$%{siteName}, öğretmen ile öğrenci arasında aracı hizmet sağlayıcıdır.%$pk$;

INSERT INTO "Page" ("id", "slug", "title", "content", "showInFooter", "isPublished", "sortOrder", "updatedAt")
VALUES ($pk$pg_kurum_hizmet_sozlesmesi$pk$, $pk$kurum-hizmet-sozlesmesi$pk$, $pk$Kurum Hizmet Sözleşmesi$pk$, $pk$Bu sözleşme, {companyName} ("{siteName}") ile kurum paneli için başvuran etüt merkezi ya da dershane ("Kurum") arasında geçerlidir.

## Taraf bilgileri
Hizmet sağlayıcı: {companyName}
Adres: {companyAddress}
Vergi bilgileri: {companyTaxInfo}
Telefon: {contactPhone} · E-posta: {contactEmail}

## Hizmet
{siteName}, Kurum'a seçtiği pakete göre öğrenci, yoklama, etüt, deneme, veli iletişimi ve tahsilat takibi için web ve mobil yazılım sunar. Paket özellikleri ve fiyatlar Kurumlar İçin sayfasında yer alır.

## Deneme süresi ve abonelik
- Deneme süresi için kart bilgisi istenmez; süre sonunda otomatik ücret alınmaz.
- Abonelik seçilen paket, öğrenci sayısı ve dönem için geçerlidir. Bedel havale / EFT ile ödenir; ödeme kaydedilince süre uzar.
- Abonelik sona erer ve yenilenmezse panel salt okunur olur. Kayıtlar silinmez; abonelik başlatıldığında kaldığınız yerden devam edilir.
- Dönem bitmeden ayrılma ve iade koşulları abonelik sırasında yazılı olarak belirlenir.

## Kurumun sorumlulukları
- Panele girdiği öğrenci ve veli bilgilerinin doğru ve güncel olması
- Personel hesaplarının ve şifrelerinin korunması, yetkilerin doğru verilmesi
- Tahsilatlarını ve velilerle arasındaki ticari ilişkiyi kendisinin yürütmesi; {siteName} bu ilişkinin tarafı değildir
- Veli ve öğrencilere yasalara uygun bilgilendirme yapması

## Kişisel veriler
Panele girilen öğrenci ve veli verileri için veri sorumlusu Kurum'dur; {siteName} bu verileri Kurum adına ve talimatları doğrultusunda, veri işleyen olarak işler. Kurum; aydınlatma yükümlülüğünü yerine getirmekten ve gerekli izinleri almaktan sorumludur. {siteName} bu verileri kendi pazarlaması için kullanmaz, gerekli güvenlik önlemlerini alır ve Kurum istediğinde verileri dışa aktarma imkânı sunar.

## Mesajlar ve WhatsApp
- Velilere WhatsApp bildirimi yalnızca izin vermiş veli için gönderilir. İzni almak ve panelde işaretlemek Kurum'un sorumluluğundadır.
- WhatsApp yalnızca bilgilendirme içindir (devamsızlık, toplantı, program değişikliği gibi). Reklam ve kampanya mesajı gönderilemez.
- WhatsApp bildirimleri açıldığında kurum başına aylık mesaj sınırı uygulanır; sınır dolduğunda bildirimler e-postayla gider.

## Hizmetin askıya alınması
Bu sözleşmeye ya da yasalara aykırı kullanımda, özellikle başkalarının verilerinin izinsiz işlenmesinde ve istenmeyen mesaj gönderiminde hesap askıya alınabilir.

## Değişiklikler ve uyuşmazlık
Sözleşme güncellenebilir; güncel metin bu sayfada yayımlanır. Sorularınız için {contactEmail} adresine yazabilirsiniz.$pk$, true, true, 17, NOW())
ON CONFLICT ("slug") DO NOTHING;
