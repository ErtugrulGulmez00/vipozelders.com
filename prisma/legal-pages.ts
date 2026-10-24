// Yasal sayfa şablonları. {süslü} ifadeler sayfa gösterilirken site ayarlarıyla doldurulur.
// Metinler genel şablondur; şirketin durumuna göre bir avukata kontrol ettirilmesi önerilir (Yönetim → Sayfalar'dan düzenlenir).

export const LEGAL_PAGES: { slug: string; title: string; sortOrder: number; showInFooter: boolean; content: string }[] = [
  {
    slug: "hakkimizda",
    title: "Hakkımızda",
    sortOrder: 1,
    showInFooter: true,
    content: `{siteName}, okul öncesinden üniversite sınavına kadar her kademede öğrencileri doğru öğretmenle buluşturan bir online eğitim platformudur. Veliler ve öğrenciler öğretmenleri inceler, boş saatlerinden randevu alır ve dersi sitemizdeki sanal sınıfta ya da yüz yüze yapar.

## Ne sunuyoruz?
- Özel ders: İlkokul, ortaokul, lise, LGS ve YKS hazırlıkta birebir dersler. Fiyatlar öğretmen profillerinde KDV dahil gösterilir.
- Soru çözüm: Takıldığınız sorunun fotoğrafını yüklersiniz, branş öğretmeni {questionAnswerHours} saat içinde çözümü gönderir.
- Koçluk: Sınav hazırlığında çalışma programı ve düzenli takip.
- Kurum paneli: Etüt merkezi ve dershanelere öğrenci, yoklama, deneme ve tahsilat takibi için yazılım.

## Nasıl güven sağlıyoruz?
- Öğretmenlerimizin kimlik ve diploma bilgilerini kontrol ediyor, onaylı öğretmenleri rozetle gösteriyoruz.
- Ödemeyi 3D Secure ile alıyor, ders gerçekleşip itiraz süresi dolana kadar öğretmene aktarmıyoruz.
- Öğretmen onaylamazsa ya da derse gelmezse ödemenin tamamını iade ediyoruz.
- Yorumları yalnızca dersi gerçekten tamamlanmış öğrenciler ve veliler yazabilir.

## Şirket bilgileri
Unvan: {companyName}
Adres: {companyAddress}
Vergi bilgileri: {companyTaxInfo}
Telefon: {contactPhone}
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
"Öğretmen ol" sayfasındaki başvuru formunu doldurun; belgeleriniz incelendikten sonra ekibimiz sizinle iletişime geçer.`,
  },
  {
    slug: "iletisim",
    title: "İletişim",
    sortOrder: 4,
    showInFooter: true,
    content: `Sorularınız, önerileriniz ve şikayetleriniz için bize ulaşabilirsiniz. Hafta içi 09.00–18.00 arasında yanıt veriyoruz.

## İletişim kanalları
- Telefon: {contactPhone}
- E-posta: {contactEmail}

## Şirket bilgileri
- Unvan: {companyName}
- Adres: {companyAddress}
- Vergi dairesi ve vergi numarası: {companyTaxInfo}`,
  },
  {
    slug: "kvkk-aydinlatma-metni",
    title: "KVKK Aydınlatma Metni",
    sortOrder: 10,
    showInFooter: true,
    content: `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca veri sorumlusu sıfatıyla {companyName} ("{siteName}") olarak kişisel verilerinizi aşağıda açıklanan kapsamda işlemekteyiz.

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
    content: `## Çerezler
Sitemizde oturumunuzu açık tutmak ve güvenliği sağlamak için zorunlu çerezler kullanılır. Bu çerezler olmadan giriş yapılamaz.

- vd_session: Oturum çerezi (zorunlu, en fazla 30 gün)
- vd_cookie_consent: Çerez tercihinizi hatırlar (zorunlu)
- vd_center: Kurum paneli oturumu (yalnızca kurum personeli, zorunlu)

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
    content: `## 1. Taraflar
Satıcı / Aracı Hizmet Sağlayıcı: {companyName}
Adres: {companyAddress}
Vergi bilgileri: {companyTaxInfo}
Telefon: {contactPhone} · E-posta: {contactEmail}

Alıcı: Siteye üye olan ve ödeme adımında bilgileri yer alan kişi (veli, yasal temsilci ya da 18 yaşını doldurmuş öğrenci).

## 2. Konu
İşbu sözleşme, alıcının {siteName} üzerinden satın aldığı eğitim hizmetlerinin satışı ve ifasına ilişkin tarafların hak ve yükümlülüklerini 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca düzenler. Sözleşme konusu hizmetler:
- Özel ders, soru çözüm dersi ve koçluk görüşmesi: seçilen öğretmen, hizmet türü, kademe, ders, süre, tarih, saat ve ders şekli (online / yüz yüze) ödeme adımındaki sipariş özetinde yer alır.
- Soru kredisi paketi: paketteki soru sayısı ve bedeli ödeme adımında gösterilir. Her kredi bir sorunun branş öğretmeni tarafından çözülmesi hakkıdır.
- Soru aboneliği: seçilen öğretmene {subscriptionDays} gün boyunca, günlük soru sınırı ve cevap süresi ödeme adımında belirtilen şekilde soru gönderme hakkıdır. Bedel dönem başında tek seferde alınır; otomatik yenileme ve otomatik çekim yoktur.

## 3. Bedel ve ödeme
Hizmet bedeli tüm vergiler dahil olarak sipariş özetinde gösterilir; ek ücret alınmaz. Ödeme kredi veya banka kartıyla, 3D Secure doğrulamalı olarak tek çekim alınır. Kart bilgileri {siteName} tarafından görülmez ve saklanmaz; yalnızca bankanın güvenli ödeme sayfasında girilir. Tahsil edilen ders bedeli, ders gerçekleşip itiraz süresi dolana kadar öğretmene aktarılmaz.

## 4. Hizmetin ifası (teslimat)
Hizmet fiziksel olarak kargo ile teslim edilmez. Online dersler onaylanan tarih ve saatte sitedeki sanal sınıfta, yüz yüze dersler taraflarca belirlenen adreste yapılır. Soru kredileri ödeme onaylanır onaylanmaz hesaba tanımlanır ve {creditValidityMonths} ay içinde kullanılabilir. Soru aboneliği ödeme onaylanınca başlar; aynı öğretmenden süren bir dönem varsa onun bitişinden itibaren başlar. Ayrıntılar Teslimat ve Hizmet Bilgileri sayfasındadır.

## 5. Öğretmen onayı
Ders talebi öğretmenin onayıyla kesinleşir. Öğretmen talebi reddederse ya da {approvalWindowHours} saat içinde yanıt vermezse ödenen tutarın tamamı kartınıza iade edilir.

## 6. Cayma hakkı ve iptal
- Alıcı, hizmetin ifasına başlanmadan önce siparişini iptal edebilir. Dersten {fullRefundHours} saat öncesine kadar yapılan iptallerde bedelin tamamı, {partialRefundHours} saat öncesine kadar %{partialRefundPercent}'si iade edilir.
- Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca, alıcının onayıyla ifasına başlanan hizmetlerde (başlamış ya da tamamlanmış ders, çözümü gönderilmiş soru) cayma hakkı kullanılamaz.
- Kullanılmamış soru kredileri, satın alma tarihinden itibaren {creditRefundDays} gün içinde iade edilebilir; kullanılan krediler iade tutarından düşülür.
- Soru aboneliği, alıcının açık onayıyla ödeme anında ifasına başlanan bir hizmettir; Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca cayma hakkı bulunmaz ve bedeli iade edilmez. Öğretmen hizmeti veremez hâle gelirse (ör. hesabının kapanması) kalan günlerin bedeli iade edilir.
- İptal ve iade koşullarının tamamı İptal ve İade Politikası'nda yer alır ve bu sözleşmenin ayrılmaz parçasıdır.

## 7. İade yöntemi
İadeler ödemenin yapıldığı karta, iptal ya da iade kararından itibaren en geç 14 gün içinde yapılır. Tutarın hesaba yansıma süresi bankaya göre değişebilir.

## 8. Uyuşmazlık
Uyuşmazlıklarda Ticaret Bakanlığınca her yıl ilan edilen parasal sınırlar dahilinde alıcının yerleşim yerindeki tüketici hakem heyetleri, bu sınırları aşan durumlarda tüketici mahkemeleri yetkilidir.

## 9. Yürürlük
Alıcı, ödeme adımında bu sözleşmeyi ve Ön Bilgilendirme Formu'nu okuyup onayladığında sözleşme kurulmuş sayılır.`,
  },
  {
    slug: "on-bilgilendirme-formu",
    title: "Ön Bilgilendirme Formu",
    sortOrder: 13,
    showInFooter: true,
    content: `## Satıcı / Aracı Hizmet Sağlayıcı
Unvan: {companyName}
Adres: {companyAddress}
Vergi bilgileri: {companyTaxInfo}
Telefon: {contactPhone} · E-posta: {contactEmail}

## Hizmetin temel nitelikleri
- Ders: hizmet türü (özel ders, soru çözüm, koçluk), kademe, ders, süre, tarih-saat, ders şekli (online / yüz yüze) ve öğretmen bilgisi sipariş özetinde yer alır.
- Soru kredisi: paketteki soru sayısı sipariş özetinde yer alır; her soru {questionAnswerHours} saat içinde çözülür, çözülmezse kredi iade edilir.
- Soru aboneliği: öğretmen, kademe ve ders, {subscriptionDays} günlük dönem, günlük soru sınırı ve cevap süresi sipariş özetinde yer alır. Otomatik yenileme ve otomatik çekim yoktur.

## Toplam bedel
Tüm vergiler dahil toplam bedel sipariş özetinde gösterilir. Ek bir ücret ya da kargo bedeli alınmaz.

## Ödeme
Kredi veya banka kartıyla, 3D Secure doğrulamalı olarak tek çekim.

## Teslimat
Hizmet elektronik ortamda ya da yüz yüze ifa edilir; kargo gönderimi yoktur. Online dersler sitedeki sanal sınıfta yapılır, soru kredileri ödeme onayı ile hesaba tanımlanır.

## İptal, cayma ve iade
- Öğretmen talebi onaylamazsa veya {approvalWindowHours} saat içinde yanıt vermezse: tam iade
- Dersten {fullRefundHours} saat öncesine kadar iptal: tam iade
- Dersten {partialRefundHours} saat öncesine kadar iptal: %{partialRefundPercent} iade
- Daha geç iptal veya derse katılmama: iade yapılmaz
- Öğretmen iptal ederse veya derse gelmezse: tam iade
- Kullanılmamış soru kredileri: satın almadan itibaren {creditRefundDays} gün içinde iade
- Soru aboneliği: ödemeyle hemen başlar, cayma hakkı ve iade yoktur; öğretmen hizmeti veremez hâle gelirse kalan günlerin bedeli iade edilir
- İfasına başlanan hizmetlerde cayma hakkı kullanılamaz (Mesafeli Sözleşmeler Yönetmeliği m.15).

## Şikayet
Şikayetlerinizi {contactEmail} adresine ya da {contactPhone} numarasına iletebilir, tüketici hakem heyetlerine ve tüketici mahkemelerine başvurabilirsiniz.`,
  },
  {
    slug: "iptal-ve-iade-politikasi",
    title: "İptal ve İade Politikası",
    sortOrder: 14,
    showInFooter: true,
    content: `## Öğretmen onayı
Ödemeniz alındıktan sonra öğretmenin talebinizi onaylaması gerekir. Talep reddedilirse veya öğretmen {approvalWindowHours} saat içinde yanıt vermezse ödediğiniz tutarın tamamı otomatik olarak kartınıza iade edilir.

## Sizin iptaliniz
Randevunuzu Hesabım sayfasından iptal edebilirsiniz.
- Dersin başlamasına {fullRefundHours} saat veya daha fazla varsa: tam iade
- {fullRefundHours} saatten az, {partialRefundHours} saatten fazla varsa: %{partialRefundPercent} iade
- {partialRefundHours} saatten az kaldıysa veya derse katılmadıysanız: iade yapılmaz

## Öğretmenin iptali veya katılmaması
Öğretmen dersi iptal ederse veya derse katılmazsa ödediğiniz tutarın tamamı iade edilir.

## Soru kredileri
- Gönderdiğiniz soru {questionAnswerHours} saat içinde çözülmezse krediniz hesabınıza geri yüklenir.
- Kullanılmamış kredileriniz satın alma tarihinden itibaren {creditRefundDays} gün içinde Hesabım sayfasından iade edilebilir; kullanılan krediler düşülür.
- Krediler satın almadan itibaren {creditValidityMonths} ay geçerlidir.

## Soru aboneliği
- Abonelik ödemeyle birlikte hemen başlar; ödeme adımında onayladığınız üzere cayma hakkı ve iadesi yoktur.
- Öğretmeniniz hizmeti veremez hâle gelirse (ör. hesabının kapanması) abonelik sonlandırılır ve kalan günlerin bedeli kartınıza iade edilir.
- Abonelik kendiliğinden yenilenmez; dönem bitmeden size hatırlatma gönderilir.

## Cayma hakkı
İfasına sizin onayınızla başlanan hizmetlerde (başlamış ya da tamamlanmış ders, çözümü gönderilmiş soru) Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca cayma hakkı kullanılamaz. Bunun dışındaki iptallerde yukarıdaki kurallar uygulanır.

## Sorun bildirme
Ders bitiminden itibaren {disputeWindowHours} saat içinde "Sorun bildir" ile başvurabilirsiniz. İnceleme sonuçlanana kadar öğretmene ödeme yapılmaz.

## İade süresi
İadeler ödemenin yapıldığı karta en geç 14 gün içinde yapılır; tutarın hesabınıza yansıma süresi bankanıza göre değişebilir. Sorularınız için: {contactEmail} · {contactPhone}`,
  },
  {
    slug: "teslimat-ve-hizmet-bilgileri",
    title: "Teslimat ve Hizmet Bilgileri",
    sortOrder: 14,
    showInFooter: true,
    content: `{siteName} üzerinden satılan tüm hizmetler eğitim hizmetidir; fiziksel ürün satışı ve kargo gönderimi yapılmaz. Hizmetler aşağıdaki şekilde teslim edilir.

## Online özel ders, soru çözüm dersi ve koçluk
- Ödemeniz alındıktan sonra öğretmen talebinizi en geç {approvalWindowHours} saat içinde onaylar; onay e-posta ve site bildirimiyle size iletilir.
- Ders, onaylanan tarih ve saatte sitedeki sanal sınıfta yapılır. "Derse Katıl" düğmesi ders saatinden {classroomOpensMinutesBefore} dakika önce Hesabım sayfasında açılır; program kurmanız gerekmez.
- Ders süresi sipariş özetinde yazan süre kadardır.

## Yüz yüze ders
Ders, öğretmenin hizmet verdiği ilçede, randevuda belirtilen adreste yapılır. Adresiniz yalnızca öğretmen onay verdikten sonra öğretmenle paylaşılır.

## Soru kredisi
- Krediler ödeme onaylanır onaylanmaz hesabınıza tanımlanır ve {creditValidityMonths} ay geçerlidir.
- Gönderdiğiniz soru {questionAnswerHours} saat içinde branş öğretmeni tarafından çözülür; çözüm Hesabım sayfasında görünür ve size bildirilir. Süresinde çözülmezse krediniz iade edilir.

## Soru aboneliği
- Abonelik ödeme onaylanınca başlar ve {subscriptionDays} gün sürer; aynı öğretmenden süren bir aboneliğiniz varsa yeni dönem onun bitişinden başlar.
- Sorularınızı Hesabım → Soru aboneliklerim sayfasından doğrudan öğretmeninize gönderirsiniz; öğretmen belirtilen cevap süresi içinde çözümü gönderir.

## Teslim edilemeyen hizmet
Öğretmen onay vermezse, dersi iptal ederse ya da derse gelmezse ödediğiniz tutarın tamamı kartınıza iade edilir. Ayrıntılar İptal ve İade Politikası sayfasındadır.

## İletişim
{companyName} · {contactPhone} · {contactEmail}`,
  },
  {
    slug: "kullanim-sartlari",
    title: "Kullanım Şartları",
    sortOrder: 15,
    showInFooter: true,
    content: `## Üyelik
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
    content: `## Hizmet
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
