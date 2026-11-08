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
- Koçluk: Sınav hazırlığında çalışma programı ve düzenli takip.
- Kurum paneli: Etüt merkezlerine öğrenci, yoklama, deneme ve tahsilat takibi için yazılım.

## Nasıl güven sağlıyoruz?
- Öğretmenlerimizin kimlik ve diploma bilgilerini kontrol ediyor, onaylı öğretmenleri rozetle gösteriyoruz.
- Ödemeyi 3D Secure ile alıyor, ders gerçekleşip itiraz süresi dolana kadar öğretmene aktarmıyoruz.
- Öğretmen onaylamazsa ya da derse gelmezse ödemenin tamamını iade ediyoruz.
- Yorumları yalnızca dersi gerçekten tamamlanmış öğrenciler ve veliler yazabilir.

## Şirket bilgileri
Unvan: {companyName}
Marka: {siteName} markası {companyName} tarafından işletilmektedir.
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
    content: `{siteName}'te birebir ders ve grup dersi tek yerde. İhtiyacınıza uygun yolu seçin.

## Birebir özel ders
1. Öğretmeni bulun: kademe, ders, ders şekli, il/ilçe ve fiyata göre filtreleyin; onaylı öğretmen rozetine ve gerçek yorumlara bakın. Birçok öğretmenle ücretsiz 15 dakikalık tanışma görüşmesi yapabilirsiniz.
2. Saati seçin ve ödeyin: öğretmenin takviminde yalnızca boş saatler seçilebilir. Ödeme 3D Secure ile alınır; seçtiğiniz saat ödeme süresince sizin için ayrılır.
3. Öğretmen onaylar: talebinizi {approvalWindowHours} saat içinde onaylar. Onaylamazsa ya da süresinde yanıt vermezse ödediğiniz tutarın tamamı iade edilir.
4. Derse katılın: online derslerde ders saatinden {classroomOpensMinutesBefore} dakika önce "Derse Katıl" düğmesi açılır; program kurmanız gerekmez. Yüz yüze derslerde adres bilgisi onaydan sonra öğretmenle paylaşılır.
5. Değerlendirin: ders bitince puan ve yorum bırakabilirsiniz. Bir sorun yaşadıysanız {disputeWindowHours} saat içinde bildirin; bu süre dolmadan öğretmene ödeme yapılmaz.

## Paket ders ve düzenli ders
- Paket: aynı öğretmenden birden fazla dersi peşin ve indirimli alırsınız; saatleri öğretmenin takviminden dilediğiniz zaman seçip "Paketimden kullan" ile ders alırsınız.
- Düzenli ders: saat seçerken "Her hafta bu saatte tekrarla"yı işaretlerseniz dersler peşin ödenir ve her hafta için öğretmeninize talep gider.
- Öğretmen bir dersi onaylamazsa ya da dersi erken iptal ederseniz ders paketinize geri eklenir.

## Ders saatini değiştirmek (erteleme)
Onaylı bir dersin saatini dersten en az {rescheduleMinHours} saat önce değiştirmek isteyebilirsiniz. Ders sayfasından yeni bir saat önerin; öğretmeniniz kabul ederse ders yeni saate taşınır. Öğretmeniniz de size yeni saat önerebilir.

## Grup dersleri
{groupMinParticipants}–{groupMaxCapacity} kişilik online sınıflarda, birebir dersten çok daha uygun fiyata ders alırsınız. Ders, kayıt bitişinde en az katılımcı sayısına ulaşırsa açılır; ulaşmazsa ödediğiniz ücretin tamamı iade edilir.

## Dersle birlikte soru çözümü
Bazı öğretmenler, tamamlanan her dersin ardından 30 dakikalık ücretsiz bir soru çözüm dersi açar. Bu öğretmenlerin profilinde belirtilir; ayrı bir ücret alınmaz.

## Aradığınızı bulamazsanız
Öğretmen listesinin altındaki formdan ders ve uygun saatlerinizi bırakın; size uygun öğretmeni bulup dönelim. Sorularınız için sağ alttaki WhatsApp düğmesini de kullanabilirsiniz.`,
  },
  {
    slug: "sss",
    title: "Sıkça Sorulan Sorular",
    sortOrder: 3,
    showInFooter: true,
    content: `## Ödememi ne zaman yaparım?
Randevu talebini gönderirken ödersiniz. Öğretmen onaylamazsa ödemenin tamamı otomatik olarak iade edilir. Paket ve düzenli derslerde dersler peşin ödenir; öğretmen onaylamadığı ders paketinize geri eklenir.

## Dersi iptal edebilir miyim?
Evet. Dersten {fullRefundHours} saat öncesine kadar yapılan iptallerde tamamı, {partialRefundHours} saat öncesine kadar %{partialRefundPercent}'si iade edilir. Daha geç iptallerde ve derse katılınmadığında iade yapılmaz. Paketten alınan derste tam iade gereken durumda ders paketinize geri döner.

## Ders saatini değiştirebilir miyim?
Evet. Dersten en az {rescheduleMinHours} saat önce ders sayfasından yeni saat önerebilirsiniz; öğretmeniniz kabul ederse ders taşınır. Bir ders en fazla {rescheduleMaxPerBooking} kez ertelenebilir.

## Paket almanın avantajı ne?
Öğretmeniniz paket indirimi sunuyorsa dersler daha uygun olur ve aynı öğretmenle düzenli çalışırsınız. Paket {packageValidityMonths} ay geçerlidir; süresi dolduğunda kullanılmayan derslerin ücreti iade edilir.

## Öğretmen derse gelmezse ne olur?
Ödediğiniz tutarın tamamı iade edilir ve öğretmen hakkında işlem yapılır. Grup derslerinde öğretmenin katılmadığı oturumun ücreti iade edilir.

## Grup dersi nasıl işliyor?
Öğretmen bir program ilan eder (ör. 4 hafta, haftada 2 ders). Kayıt bitişinde en az katılımcı sayısına ulaşılırsa ders kesinleşir; ulaşılmazsa ücretin tamamı iade edilir. İlk dersten önce kaydınızı iptal ederseniz tam iade alırsınız.

## İndirim kodumu nereye yazarım?
Ödeme adımındaki "İndirim kodum var" bağlantısına tıklayıp kodu yazın ve "Uygula"ya basın. Arkadaşınızın davet bağlantısıyla kayıt olduysanız ilk siparişinizde indirim kendiliğinden uygulanır.

## Arkadaşımı nasıl davet ederim?
Hesabım → Arkadaşını davet et sayfasındaki bağlantınızı paylaşın. Arkadaşınız ilk siparişinde indirim kazanır.

## Online ders için ne gerekiyor?
Kamera ve mikrofonu olan bir bilgisayar, tablet ya da telefon ve güncel bir tarayıcı yeterlidir. Ders sitemizin içinde açılır.

## Kimler yorum yapabilir?
Yalnızca o öğretmenle en az bir dersi tamamlanmış öğrenciler ve veliler yorum yapabilir. Bu sayede tüm yorumlar gerçek derslere dayanır.

## Aradığım öğretmeni bulamadım, ne yapmalıyım?
Öğretmen listesinin altındaki "Aradığınız öğretmeni bulamadınız mı?" formunu doldurun; uygun öğretmeni bulup size dönelim.

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
- Marka: {siteName} markası {companyName} tarafından işletilmektedir.
- Adres: {companyAddress}
- Vergi dairesi ve vergi numarası: {companyTaxInfo}`,
  },
  {
    slug: "kvkk-aydinlatma-metni",
    title: "KVKK Aydınlatma Metni",
    sortOrder: 10,
    showInFooter: true,
    content: `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca veri sorumlusu sıfatıyla {companyName} ("{siteName}") olarak kişisel verilerinizi aşağıda açıklanan kapsamda işlemekteyiz.

Veri sorumlusu: {companyName} · {companyAddress} · {companyTaxInfo} · {contactEmail}

## İşlenen kişisel veriler
- Kimlik ve iletişim: ad, soyad, e-posta, telefon
- Ders bilgileri: dersin kimin için alındığı, sınıf/kademe, ders notları, randevu geçmişi
- Yüz yüze derslerde adres ve ilçe bilgisi
- İşlem güvenliği: IP adresi, oturum ve giriş kayıtları
- Ödeme bilgileri: kart bilgileriniz tarafımızca saklanmaz, lisanslı ödeme kuruluşu tarafından işlenir
- Öğretmenler için ayrıca: eğitim ve deneyim bilgileri, diploma/sertifika, adli sicil kaydı, IBAN ve T.C. kimlik numarası
- Kurum panelindeki öğrenci ve veliler için: kurumun girdiği ad, telefon, e-posta, sınıf, yoklama, deneme sonucu, ödeme planı ve notlar
- Online derslerde: derse giriş ve çıkış zamanları
- Bildirimler: cihaz bildirim anahtarı, WhatsApp tercihiniz ve gönderim kayıtları

## İşleme amaçları
Üyelik ve randevu süreçlerinin yürütülmesi, ödeme ve iadelerin yapılması, derslerin gerçekleştirilmesi, öğretmen doğrulaması, müşteri hizmetleri, yasal yükümlülüklerin yerine getirilmesi ve hizmet güvenliğinin sağlanması.

## Hukuki sebepler
Sözleşmenin kurulması ve ifası, hukuki yükümlülük, meşru menfaat ve gerektiğinde açık rızanız (KVKK m.5). WhatsApp bildirimleri ve pazarlama iletileri yalnızca açık rızanıza dayanır.

## Aktarım
Kişisel verileriniz yalnızca hizmetin gerektirdiği ölçüde aşağıdaki taraflarla paylaşılır:
- Ödeme kuruluşu ve banka: ödeme ve iade işlemleri
- Barındırma ve e-posta hizmet sağlayıcıları: sitenin çalışması ve bildirim e-postaları
- LiveKit: online derslerde görüntü ve sesin iletilmesi
- Google (Firebase Cloud Messaging, Google Drive): mobil uygulama bildirimleri ve şifrelenmiş yedekler
- Meta Platforms (WhatsApp) ve WhatsApp iş ortağımız LetsBot: yalnızca WhatsApp bildirimi alıyorsanız telefon numaranız ve mesaj içeriği
- Telegram: site yöneticilerine giden iç bildirimler (ad ve işlem özeti)
- Yetkili kamu kurumları: yasal zorunluluk hâlinde

LiveKit, Google, Meta ve Telegram sunucuları yurt dışında bulunabilir. Yurt dışına aktarım KVKK m.9 kapsamındaki şartlara uygun yapılır.

## WhatsApp bildirimleri
WhatsApp bildirimleri isteğe bağlıdır ve yalnızca izninizle gönderilir. İzninizi kayıt sırasında ya da Hesap ayarlarından verebilir, aynı yerden geri alabilir ya da WhatsApp’tan DUR yazarak bildirimleri durdurabilirsiniz. Bu durum e-posta ve site bildirimlerini etkilemez. Kurum öğrencilerinin velilerine giden WhatsApp bildirimleri için izni kurum alır.

## Kurum kayıtları
Etüt merkezi panelinde kurumun girdiği öğrenci ve veli verileri için veri sorumlusu ilgili kurumdur; {siteName} bu verileri kurum adına, veri işleyen olarak işler.

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
- vd_2fa: İki adımlı doğrulama sırasında kısa süreli oturum (zorunlu)
- vd_davet: Arkadaş davet bağlantısıyla gelenlerde davet kodu (zorunlu)

İleride analiz veya pazarlama çerezleri eklenirse yalnızca açık onayınızla kullanılacaktır.

## Güvenlik
Şifreler geri döndürülemez biçimde saklanır; kart bilgileri sistemimizde tutulmaz; hassas veriler ve yedekler şifrelenir.

## WhatsApp bildirimleri
Telefon numaranız, yalnızca izin verdiyseniz ders ve hesap bildirimleri için WhatsApp üzerinden kullanılır; bu amaçla Meta Platforms ve iş ortağımız LetsBot ile paylaşılır. Reklam ya da kampanya mesajı göndermek için kullanılmaz. Bildirimleri Hesap ayarlarından kapatabilir ya da WhatsApp’tan DUR yazarak durdurabilirsiniz.

## Kişisel verileriniz
Hangi verileri neden işlediğimiz, kimlerle paylaştığımız ve haklarınız KVKK Aydınlatma Metni’nde yer alır. Hesabınızı ve verilerinizi silmek için “Verilerimi Nasıl Sildiririm?” sayfasına bakın.

## İletişim
Gizlilikle ilgili sorularınız için: {companyName} · {contactEmail}`,
  },
  {
    slug: "veri-silme",
    title: "Verilerimi Nasıl Sildiririm?",
    sortOrder: 11,
    showInFooter: true,
    content: `{siteName} hesabınızı ve kişisel verilerinizi istediğiniz zaman sildirebilirsiniz. Bu sayfa, WhatsApp bildirimleri dahil sitemizde ve uygulamalarımızda işlenen tüm veriler için geçerlidir.

## 1. Hesabınızı kendiniz silin (en hızlı yol)
- Veli / öğrenci: Giriş yapın → Hesabım → Hesap ayarları → “Hesabı sil”.
- Öğretmen: Giriş yapın → Öğretmen paneli → Ayarlar → “Hesabı sil”.

Silme işlemi onaylandığında hesabınız hemen kapatılır; ad, e-posta, telefon, profil fotoğrafı, mesajlar ve bildirim tercihleriniz silinir ya da anonimleştirilir.

## 2. E-postayla talep edin
Hesabınıza giremiyorsanız ya da yalnızca belirli verilerin (ör. WhatsApp için kullanılan telefon numaranızın) silinmesini istiyorsanız {contactEmail} adresine, kayıtlı e-posta adresinizden “Veri silme talebi” konulu bir e-posta gönderin. Kimliğinizi doğruladıktan sonra talebinizi en geç 30 gün içinde sonuçlandırır ve size bilgi veririz.

Yalnızca WhatsApp bildirimlerini durdurmak istiyorsanız WhatsApp’tan DUR yazmanız yeterlidir.

## 3. Kurum (etüt merkezi) kayıtları
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
- Özel ders ve koçluk görüşmesi: seçilen öğretmen, hizmet türü, kademe, ders, süre, tarih, saat ve ders şekli (online / yüz yüze) ödeme adımındaki sipariş özetinde yer alır.
- Grup dersi: öğretmenin ilan ettiği programdaki (tarih, saat ve oturum sayısı sipariş özetinde yer alır) online grup oturumlarına katılım hakkıdır. Bedel kişi başı ve tüm program için tek seferde alınır.
- Paket ders ve düzenli ders: aynı öğretmenden, sipariş özetinde belirtilen ders ve sürede, belirtilen sayıda ders hakkıdır. Bedel peşin alınır; dersler öğretmenin takviminden seçilir ve öğretmen onayıyla kesinleşir. Paket {packageValidityMonths} ay geçerlidir.

## 3. Bedel ve ödeme
Hizmet bedeli tüm vergiler dahil olarak sipariş özetinde gösterilir; ek ücret alınmaz. Ödeme kredi veya banka kartıyla, 3D Secure doğrulamalı olarak tek çekim alınır. Kart bilgileri {siteName} tarafından görülmez ve saklanmaz; yalnızca bankanın güvenli ödeme sayfasında girilir. Tahsil edilen ders bedeli, ders gerçekleşip itiraz süresi dolana kadar öğretmene aktarılmaz.

## 4. Hizmetin ifası (teslimat)
Hizmet fiziksel olarak kargo ile teslim edilmez. Online dersler onaylanan tarih ve saatte sitedeki sanal sınıfta, yüz yüze dersler taraflarca belirlenen adreste yapılır. Grup dersi, kayıt bitiş tarihinde en az katılımcı sayısına ulaşılırsa kesinleşir ve programdaki saatlerde sitedeki sanal sınıfta yapılır; ulaşılamazsa iptal edilir ve bedelin tamamı iade edilir. Ayrıntılar Teslimat ve Hizmet Bilgileri sayfasındadır.

## 5. Öğretmen onayı
Ders talebi öğretmenin onayıyla kesinleşir. Öğretmen talebi reddederse ya da {approvalWindowHours} saat içinde yanıt vermezse ödenen tutarın tamamı kartınıza iade edilir.

## 6. Cayma hakkı ve iptal
- Alıcı, hizmetin ifasına başlanmadan önce siparişini iptal edebilir. Dersten {fullRefundHours} saat öncesine kadar yapılan iptallerde bedelin tamamı, {partialRefundHours} saat öncesine kadar %{partialRefundPercent}'si iade edilir.
- Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca, alıcının onayıyla ifasına başlanan hizmetlerde (başlamış ya da tamamlanmış ders) cayma hakkı kullanılamaz.
- Paket dersinde tam iade gerektiren durumlarda (öğretmen onaylamaz ya da ders zamanında iptal edilir) ders pakete geri eklenir; kısmi iadeler karta yapılır. Kullanılmamış dersler istenildiğinde iade edilir; bu durumda kullanılan dersler paket indirimi uygulanmadan tek ders ücretinden düşülür. Paket süresi dolduğunda kullanılmayan derslerin bedeli iade edilir.
- Grup dersi kaydı, ilk oturum başlamadan önce iptal edilirse bedelin tamamı iade edilir. İlk oturum başladıktan sonra iptal ve iade yapılmaz; öğretmenin katılmadığı ya da iptal edilen oturumların bedeli iade edilir.
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
- Ders: hizmet türü (özel ders, koçluk), kademe, ders, süre, tarih-saat, ders şekli (online / yüz yüze) ve öğretmen bilgisi sipariş özetinde yer alır.
- Grup dersi: öğretmen, program (oturum tarihleri ve saatleri), kontenjan, en az katılımcı sayısı ve kayıt bitiş tarihi sipariş özetinde yer alır.

## Toplam bedel
Tüm vergiler dahil toplam bedel sipariş özetinde gösterilir. Ek bir ücret ya da kargo bedeli alınmaz.

## Ödeme
Kredi veya banka kartıyla, 3D Secure doğrulamalı olarak tek çekim.

## Teslimat
Hizmet elektronik ortamda ya da yüz yüze ifa edilir; kargo gönderimi yoktur. Online dersler sitedeki sanal sınıfta yapılır.

## İptal, cayma ve iade
- Öğretmen talebi onaylamazsa veya {approvalWindowHours} saat içinde yanıt vermezse: tam iade
- Dersten {fullRefundHours} saat öncesine kadar iptal: tam iade
- Dersten {partialRefundHours} saat öncesine kadar iptal: %{partialRefundPercent} iade
- Daha geç iptal veya derse katılmama: iade yapılmaz
- Öğretmen iptal ederse veya derse gelmezse: tam iade
- Grup dersi: en az katılımcıya ulaşılamazsa tam iade; ilk oturumdan önce iptalde tam iade; sonrasında iade yok, öğretmenin katılmadığı ya da iptal edilen oturumların bedeli iade
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

## Paket ders ve düzenli ders
- Öğretmen paketten alınan bir dersi onaylamazsa, iptal ederse ya da dersten {fullRefundHours} saat öncesine kadar siz iptal ederseniz ders paketinize geri eklenir. Daha geç iptallerde yukarıdaki kısmi iade kuralları paketin ödemesinden uygulanır.
- Kullanılmamış derslerinizi Hesabım → Derslerim → Paketlerim sayfasından iade edebilirsiniz; kullanılan dersler paket indirimi olmadan tek ders ücretinden düşülür.
- Paket {packageValidityMonths} ay geçerlidir; süresi dolduğunda kullanılmayan derslerin bedeli kartınıza iade edilir.

## Ders saatinin değiştirilmesi
Onaylı bir dersin saati, dersten en az {rescheduleMinHours} saat önce taraflardan birinin önerisi ve diğerinin kabulüyle değiştirilebilir. Erteleme ücret değişikliğine yol açmaz.

## Grup dersi
- Ders, kayıt bitiş tarihinde en az katılımcı sayısına ulaşmazsa iptal edilir ve ödediğiniz bedelin tamamı kartınıza iade edilir.
- İlk oturum başlamadan Hesabım → Grup derslerim sayfasından kaydınızı iptal ederseniz bedelin tamamı iade edilir. İlk oturum başladıktan sonra iptal ve iade yapılmaz.
- Öğretmen bir oturuma katılmazsa ya da ders iptal edilirse, yapılmayan oturumların bedeli kartınıza iade edilir.

## Cayma hakkı
İfasına sizin onayınızla başlanan hizmetlerde (başlamış ya da tamamlanmış ders) Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca cayma hakkı kullanılamaz. Bunun dışındaki iptallerde yukarıdaki kurallar uygulanır.

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

## Online özel ders ve koçluk
- Ödemeniz alındıktan sonra öğretmen talebinizi en geç {approvalWindowHours} saat içinde onaylar; onay e-posta ve site bildirimiyle size iletilir.
- Ders, onaylanan tarih ve saatte sitedeki sanal sınıfta yapılır. "Derse Katıl" düğmesi ders saatinden {classroomOpensMinutesBefore} dakika önce Hesabım sayfasında açılır; program kurmanız gerekmez.
- Ders süresi sipariş özetinde yazan süre kadardır.

## Yüz yüze ders
Ders, öğretmenin hizmet verdiği ilçede, randevuda belirtilen adreste yapılır. Adresiniz yalnızca öğretmen onay verdikten sonra öğretmenle paylaşılır.

## Grup dersi
- Kaydınız ödemeyle tamamlanır. Ders, kayıt bitiş tarihinde en az katılımcı sayısına ulaşırsa kesinleşir ve size bildirilir.
- Oturumlar programdaki tarih ve saatlerde sitedeki sanal sınıfta yapılır; “Derse katıl” düğmesi Hesabım → Grup derslerim sayfasında ders saatinden {classroomOpensMinutesBefore} dakika önce açılır.

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
    content: `Bu şartlar, {companyName} tarafından işletilen {siteName} sitesinin ve mobil uygulamasının kullanımını düzenler.

## Hizmet
{siteName}; özel ders ve koçluk için öğrenci ve velileri öğretmenlerle buluşturur. Etüt merkezlerine ise kurum yönetim yazılımı sunar. Kurum paneli için Kurum Hizmet Sözleşmesi geçerlidir.

## Üyelik
Üyelik ücretsizdir. 18 yaşından küçükler adına hesap veli veya yasal temsilci tarafından açılır. Hesap bilgilerinin gizliliğinden kullanıcı sorumludur.

## Platform dışı ödeme yasağı
Site üzerinden tanışılan öğretmenle site dışında ödeme yapılması yasaktır. Bu durumda iade güvencesi, değerlendirme ve itiraz hakları kullanılamaz; ilgili hesaplar askıya alınabilir.

## Davranış kuralları
Derslerde ve mesajlarda saygılı bir dil kullanılır; çocuk güvenliğini tehlikeye atan her türlü davranış hesabın kapatılması ve yetkili makamlara bildirim sebebidir.

## Değerlendirmeler
Yorumlar gerçek ders deneyimine dayanmalıdır. Hakaret, kişisel veri veya reklam içeren yorumlar yayından kaldırılır.

## Sorumluluk
{siteName}, öğretmen ile öğrenci arasında aracı hizmet sağlayıcıdır. Dersin içeriğinden ve yürütülmesinden dersi veren öğretmen sorumludur. Ödeme, iptal ve iade kuralları Mesafeli Satış Sözleşmesi ile İptal ve İade Politikası’nda yer alır.

## Fikri haklar
Sitedeki yazılım, marka ve tasarım {companyName}’a aittir; izinsiz kopyalanamaz. Öğretmenlerin ve kurumların yüklediği içeriklerin sorumluluğu kendilerine aittir.

## Değişiklikler
Bu şartlar güncellenebilir; güncel metin bu sayfada yayımlanır ve sayfanın başındaki tarih değişir.

## Uyuşmazlık ve iletişim
Tüketici işlemlerinde tüketici hakem heyetleri ve tüketici mahkemeleri yetkilidir. Sorularınız için: {companyName} · {contactEmail} · {contactPhone}`,
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
  {
    slug: "kurum-hizmet-sozlesmesi",
    title: "Kurum Hizmet Sözleşmesi",
    sortOrder: 17,
    showInFooter: true,
    content: `Bu sözleşme, {companyName} ("{siteName}") ile kurum paneli için başvuran etüt merkezi ("Kurum") arasında geçerlidir.

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
Sözleşme güncellenebilir; güncel metin bu sayfada yayımlanır. Sorularınız için {contactEmail} adresine yazabilirsiniz.`,
  },
];
