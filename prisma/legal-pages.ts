// Yasal sayfa şablonları. {süslü} ifadeler sayfa gösterilirken site ayarlarıyla doldurulur.
// UYARI: Bu metinler taslaktır; yayına almadan önce bir avukata kontrol ettirilmelidir.

const DRAFT = "> TASLAK METİN: Bu sayfa şablondur. Yayına almadan önce şirket bilgilerinizi admin panelindeki Site Ayarları'ndan girin ve metni avukatınıza kontrol ettirin. Kontrol sonrası bu uyarı satırını silin.";

export const LEGAL_PAGES: { slug: string; title: string; sortOrder: number; showInFooter: boolean; content: string }[] = [
  {
    slug: "hakkimizda",
    title: "Hakkımızda",
    sortOrder: 1,
    showInFooter: true,
    content: `{siteName}, okul öncesinden üniversite sınavına kadar her kademede öğrencileri doğru öğretmenle buluşturan bir sanal dershanedir.

## Ne yapıyoruz?
- Özel ders, soru çözüm ve koçluk hizmetlerini tek çatı altında topluyoruz.
- Öğretmenlerimizin kimlik ve diploma bilgilerini kontrol ediyor, onaylı öğretmenleri rozetle gösteriyoruz.
- Online dersleri sitemizdeki sanal sınıfta, yüz yüze dersleri ise öğretmenin hizmet verdiği ilçelerde planlıyoruz.
- Ödemeyi güvenle alıyor, ders gerçekleşene kadar öğretmene aktarmıyoruz.

## Şirket bilgileri
{companyName}
{companyAddress}
{companyTaxInfo}
E-posta: {contactEmail}`,
  },
  {
    slug: "nasil-calisir",
    title: "Nasıl Çalışır?",
    sortOrder: 2,
    showInFooter: true,
    content: `## 1. Öğretmeni bul
Kademe, ders, hizmet türü, ders şekli, il/ilçe ve fiyata göre filtreleyin; puanlara ve yorumlara bakın.

## 2. Saati seç ve öde
Öğretmenin takviminde yalnızca boş saatler seçilebilir. Ödeme 3D Secure ile alınır; seçtiğiniz saat ödeme süresince sizin için ayrılır.

## 3. Öğretmen onaylar
Öğretmen talebinizi {approvalWindowHours} saat içinde onaylar. Onaylamazsa ya da süresinde yanıt vermezse ödediğiniz tutarın tamamı iade edilir.

## 4. Derse katıl
Online derslerde ders saatinden {classroomOpensMinutesBefore} dakika önce "Derse Katıl" butonu açılır; herhangi bir program kurmanız gerekmez. Yüz yüze derslerde adres bilgisi onaydan sonra öğretmenle paylaşılır.

## 5. Değerlendir
Ders tamamlandıktan sonra öğretmeninize puan ve yorum verebilirsiniz. Bir sorun yaşadıysanız ders bitiminden itibaren {disputeWindowHours} saat içinde bildirebilirsiniz; bu süre dolmadan öğretmene ödeme yapılmaz.`,
  },
  {
    slug: "sss",
    title: "Sıkça Sorulan Sorular",
    sortOrder: 3,
    showInFooter: true,
    content: `## Ödememi ne zaman yaparım?
Randevu talebini gönderirken ödersiniz. Öğretmen onaylamazsa ödemenin tamamı otomatik olarak iade edilir.

## Dersi iptal edebilir miyim?
Evet. Dersten {fullRefundHours} saat öncesine kadar yapılan iptallerde tamamı, {partialRefundHours} saat öncesine kadar %{partialRefundPercent}'si iade edilir. Daha geç iptallerde ve derse katılınmadığında iade yapılmaz. Ayrıntılar İptal ve İade Politikası sayfasındadır.

## Öğretmen derse gelmezse ne olur?
Ödediğiniz tutarın tamamı iade edilir ve öğretmen hakkında işlem yapılır.

## Online ders için ne gerekiyor?
Kamera ve mikrofonu olan bir bilgisayar, tablet ya da telefon ve güncel bir tarayıcı yeterlidir. Ders sitemizin içinde açılır.

## Kimler yorum yapabilir?
Yalnızca o öğretmenle en az bir dersi tamamlanmış öğrenciler ve veliler yorum yapabilir. Bu sayede tüm yorumlar gerçek derslere dayanır.

## Öğretmen olmak istiyorum, nasıl başvururum?
{contactEmail} adresine özgeçmişinizi gönderin; ekibimiz sizinle iletişime geçecektir.`,
  },
  {
    slug: "iletisim",
    title: "İletişim",
    sortOrder: 4,
    showInFooter: true,
    content: `Sorularınız, önerileriniz ve şikayetleriniz için bize ulaşabilirsiniz.

- E-posta: {contactEmail}
- Telefon: {contactPhone}
- Adres: {companyAddress}

{companyName}
{companyTaxInfo}`,
  },
  {
    slug: "kvkk-aydinlatma-metni",
    title: "KVKK Aydınlatma Metni",
    sortOrder: 10,
    showInFooter: true,
    content: `${DRAFT}

6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca veri sorumlusu sıfatıyla {companyName} ("{siteName}") olarak kişisel verilerinizi aşağıda açıklanan kapsamda işlemekteyiz.

## İşlenen kişisel veriler
- Kimlik ve iletişim: ad, soyad, e-posta, telefon
- Ders bilgileri: dersin kimin için alındığı, sınıf/kademe, ders notları, randevu geçmişi
- Yüz yüze derslerde adres ve ilçe bilgisi
- İşlem güvenliği: IP adresi, oturum ve giriş kayıtları
- Ödeme bilgileri: kart bilgileriniz tarafımızca saklanmaz, lisanslı ödeme kuruluşu tarafından işlenir
- Öğretmenler için ayrıca: eğitim ve deneyim bilgileri, diploma/sertifika, adli sicil kaydı, IBAN ve T.C. kimlik numarası

## İşleme amaçları
Üyelik ve randevu süreçlerinin yürütülmesi, ödeme ve iadelerin yapılması, derslerin gerçekleştirilmesi, öğretmen doğrulaması, müşteri hizmetleri, yasal yükümlülüklerin yerine getirilmesi ve hizmet güvenliğinin sağlanması.

## Hukuki sebepler
Sözleşmenin kurulması ve ifası, hukuki yükümlülük, meşru menfaat ve gerektiğinde açık rızanız (KVKK m.5).

## Aktarım
Kişisel verileriniz yalnızca hizmetin gerektirdiği ölçüde ödeme kuruluşu, barındırma ve e-posta hizmet sağlayıcıları ile yetkili kamu kurumlarıyla paylaşılır. Yurt dışında bulunan hizmet sağlayıcılara aktarım KVKK m.9 kapsamındaki şartlara uygun yapılır.

## Reşit olmayanlar
18 yaşından küçük öğrenciler adına hesap, veli veya yasal temsilci tarafından açılmalıdır.

## Haklarınız
KVKK m.11 kapsamındaki haklarınız için {contactEmail} adresine başvurabilirsiniz.`,
  },
  {
    slug: "gizlilik-ve-cerez-politikasi",
    title: "Gizlilik ve Çerez Politikası",
    sortOrder: 11,
    showInFooter: true,
    content: `${DRAFT}

## Çerezler
Sitemizde oturumunuzu açık tutmak ve güvenliği sağlamak için zorunlu çerezler kullanılır. Bu çerezler olmadan giriş yapılamaz.

- vd_session: Oturum çerezi (zorunlu, en fazla 30 gün)
- vd_cookie_consent: Çerez tercihinizi hatırlar (zorunlu)

İleride analiz veya pazarlama çerezleri eklenirse yalnızca açık onayınızla kullanılacaktır.

## Güvenlik
Şifreler geri döndürülemez biçimde saklanır; kart bilgileri sistemimizde tutulmaz; hassas veriler şifrelenir.

## İletişim
Gizlilikle ilgili sorularınız için: {contactEmail}`,
  },
  {
    slug: "veri-silme",
    title: "Verilerimi Nasıl Sildiririm?",
    sortOrder: 11,
    showInFooter: true,
    content: `{siteName} hesabınızı ve kişisel verilerinizi istediğiniz zaman sildirebilirsiniz. Bu sayfa, WhatsApp ve SMS bildirimleri dahil sitemizde ve uygulamalarımızda işlenen tüm veriler için geçerlidir.

## 1. Hesabınızı kendiniz silin (en hızlı yol)
- Veli / öğrenci: Giriş yapın → Hesabım → Hesap ayarları → “Hesabı sil”.
- Öğretmen: Giriş yapın → Öğretmen paneli → Ayarlar → “Hesabı sil”.

Silme işlemi onaylandığında hesabınız hemen kapatılır; ad, e-posta, telefon, profil fotoğrafı, mesajlar ve bildirim tercihleriniz silinir ya da anonimleştirilir.

## 2. E-postayla talep edin
Hesabınıza giremiyorsanız ya da yalnızca belirli verilerin (ör. WhatsApp/SMS için kullanılan telefon numaranızın) silinmesini istiyorsanız {contactEmail} adresine, kayıtlı e-posta adresinizden “Veri silme talebi” konulu bir e-posta gönderin. Kimliğinizi doğruladıktan sonra talebinizi en geç 30 gün içinde sonuçlandırır ve size bilgi veririz.

## 3. Kurum (etüt merkezi / dershane) kayıtları
Bir kurumun öğrencisi ya da velisiyseniz, öğrenci kartı ve yoklama, deneme, ödeme gibi kayıtlar o kurum adına tutulur. Silme talebinizi kurumunuza iletebilir ya da {contactEmail} adresine yazabilirsiniz; talebi kurumla birlikte sonuçlandırırız.

## Saklanması zorunlu kayıtlar
Ödeme, fatura ve muhasebe kayıtları vergi mevzuatı gereği yasal süre boyunca saklanır; bu kayıtlar başka hiçbir amaçla kullanılmaz ve süre dolunca silinir.

## İletişim
{companyName}
{companyAddress}
E-posta: {contactEmail}`,
  },
  {
    slug: "mesafeli-satis-sozlesmesi",
    title: "Mesafeli Satış Sözleşmesi",
    sortOrder: 12,
    showInFooter: true,
    content: `${DRAFT}

## 1. Taraflar
Satıcı/Aracı Hizmet Sağlayıcı: {companyName}, {companyAddress}, {contactEmail}
Alıcı: Siteye üye olan ve randevu talebi oluşturan kişi.

## 2. Konu
İşbu sözleşme, alıcının {siteName} üzerinden seçtiği öğretmenden aldığı eğitim hizmetinin (özel ders, soru çözüm, koçluk) satışı ve ifasına ilişkin tarafların hak ve yükümlülüklerini düzenler. Hizmetin içeriği, tarihi, saati, süresi ve bedeli sipariş özetinde belirtilir.

## 3. Bedel ve ödeme
Hizmet bedeli tüm vergiler dahil olarak sipariş özetinde gösterilir ve randevu talebi sırasında kredi/banka kartıyla tahsil edilir. Tahsil edilen tutar ders gerçekleşene ve itiraz süresi dolana kadar öğretmene aktarılmaz.

## 4. Hizmetin ifası
Online dersler sitedeki sanal sınıfta, yüz yüze dersler taraflarca belirlenen adreste, onaylanan tarih ve saatte yapılır.

## 5. Cayma hakkı ve iptal
Belirli bir tarih ve saatte ifa edilmesi kararlaştırılan hizmetlerde cayma hakkına ilişkin istisnalar saklıdır. İptal ve iade koşulları İptal ve İade Politikası'nda açıklanmıştır ve bu sözleşmenin ayrılmaz parçasıdır.

## 6. Uyuşmazlık
Uyuşmazlıklarda Ticaret Bakanlığınca ilan edilen parasal sınırlar dahilinde tüketici hakem heyetleri ve tüketici mahkemeleri yetkilidir.`,
  },
  {
    slug: "on-bilgilendirme-formu",
    title: "Ön Bilgilendirme Formu",
    sortOrder: 13,
    showInFooter: true,
    content: `${DRAFT}

## Satıcı / Aracı Hizmet Sağlayıcı
{companyName}
{companyAddress}
{companyTaxInfo}
E-posta: {contactEmail} · Telefon: {contactPhone}

## Hizmetin temel nitelikleri
Hizmet türü (özel ders, soru çözüm, koçluk), kademe, ders, süre, tarih-saat, ders şekli (online/yüz yüze) ve öğretmen bilgisi randevu özetinde yer alır.

## Toplam bedel
Tüm vergiler dahil toplam bedel randevu özetinde gösterilir. Ek bir ücret alınmaz.

## Ödeme
Kredi veya banka kartıyla, 3D Secure doğrulamalı olarak tek çekim.

## İptal ve iade
- Öğretmen talebi onaylamazsa veya {approvalWindowHours} saat içinde yanıt vermezse: tam iade
- Dersten {fullRefundHours} saat öncesine kadar iptal: tam iade
- Dersten {partialRefundHours} saat öncesine kadar iptal: %{partialRefundPercent} iade
- Daha geç iptal veya derse katılmama: iade yapılmaz
- Öğretmen iptal ederse veya derse gelmezse: tam iade

## Şikayet
Şikayetlerinizi {contactEmail} adresine iletebilir, tüketici hakem heyetlerine başvurabilirsiniz.`,
  },
  {
    slug: "iptal-ve-iade-politikasi",
    title: "İptal ve İade Politikası",
    sortOrder: 14,
    showInFooter: true,
    content: `${DRAFT}

## Öğretmen onayı
Ödemeniz alındıktan sonra öğretmenin talebinizi onaylaması gerekir. Talep reddedilirse veya öğretmen {approvalWindowHours} saat içinde yanıt vermezse ödediğiniz tutarın tamamı otomatik olarak kartınıza iade edilir.

## Sizin iptaliniz
- Dersin başlamasına {fullRefundHours} saat veya daha fazla varsa: tam iade
- {fullRefundHours} saatten az, {partialRefundHours} saatten fazla varsa: %{partialRefundPercent} iade
- {partialRefundHours} saatten az kaldıysa veya derse katılmadıysanız: iade yapılmaz

## Öğretmenin iptali veya katılmaması
Öğretmen dersi iptal ederse veya derse katılmazsa ödediğiniz tutarın tamamı iade edilir.

## Sorun bildirme
Ders bitiminden itibaren {disputeWindowHours} saat içinde "Sorun bildir" ile başvurabilirsiniz. İnceleme sonuçlanana kadar öğretmene ödeme yapılmaz.

## İade süresi
İadeler kartınıza yapılır; tutarın hesabınıza yansıma süresi bankanıza göre değişebilir.`,
  },
  {
    slug: "kullanim-sartlari",
    title: "Kullanım Şartları",
    sortOrder: 15,
    showInFooter: true,
    content: `${DRAFT}

## Üyelik
Üyelik ücretsizdir. 18 yaşından küçükler adına hesap veli veya yasal temsilci tarafından açılır. Hesap bilgilerinin gizliliğinden kullanıcı sorumludur.

## Platform dışı ödeme yasağı
Site üzerinden tanışılan öğretmenle site dışında ödeme yapılması yasaktır. Bu durumda iade güvencesi, değerlendirme ve itiraz hakları kullanılamaz; ilgili hesaplar askıya alınabilir.

## Davranış kuralları
Derslerde ve mesajlarda saygılı bir dil kullanılır; çocuk güvenliğini tehlikeye atan her türlü davranış hesabın kapatılması ve yetkili makamlara bildirim sebebidir.

## Değerlendirmeler
Yorumlar gerçek ders deneyimine dayanmalıdır. Hakaret, kişisel veri veya reklam içeren yorumlar yayından kaldırılır.

## Sorumluluk
{siteName}, öğretmen ile öğrenci arasında aracı hizmet sağlayıcıdır.`,
  },
  {
    slug: "ogretmen-sozlesmesi",
    title: "Öğretmen Hizmet Sözleşmesi",
    sortOrder: 16,
    showInFooter: false,
    content: `${DRAFT}

## Hizmet
Öğretmen, {siteName} üzerinden öğrencilere eğitim hizmeti verir; ders ücretlerini ve müsaitlik takvimini kendisi belirler.

## Komisyon ve ödeme
Platform, her dersten site ayarlarında belirtilen oranda hizmet bedeli keser. Kalan tutar ders tamamlanıp {disputeWindowHours} saatlik itiraz süresi dolduktan sonra öğretmene aktarılır.

## Yükümlülükler
- Talepleri {approvalWindowHours} saat içinde yanıtlamak
- Onaylanan derslere zamanında katılmak; iptalleri en aza indirmek
- Platform dışında ödeme almamak, öğrencileri platform dışına yönlendirmemek
- Kimlik, diploma ve istenmesi halinde adli sicil kaydı belgelerini doğru sunmak

## Statü beyanı
Öğretmen; devlet okulunda kadrolu olarak çalışmadığını veya ücretli özel ders vermesine mevzuatın izin verdiğini, aksi halde doğacak sorumluluğun kendisine ait olduğunu beyan eder.`,
  },
];
