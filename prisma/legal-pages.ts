// Yasal sayfa şablonları. {süslü} ifadeler sayfa gösterilirken site ayarlarıyla doldurulur.
// Metinler genel şablondur; şirketin durumuna göre bir avukata kontrol ettirilmesi önerilir (Yönetim → Sayfalar'dan düzenlenir).
// 2026-11-13: ödemeye aracılık edilmeyen modele göre yeniden yazıldı (özel ders ücreti öğretmenle veli arasında;
// sitede satılan hizmet Pi Koç ve kurum paneli aboneliği).

export const LEGAL_PAGES: { slug: string; title: string; sortOrder: number; showInFooter: boolean; content: string }[] = [
  {
    slug: "hakkimizda",
    title: "Hakkımızda",
    sortOrder: 1,
    showInFooter: true,
    content: `{siteName}; etüt merkezleri için kurum paneli, öğrenci koçları ve özel ders öğretmenleri için Pi Koç takip paneli ve velilerin öğretmen bulduğu bir özel ders vitrini sunar.

## Ne sunuyoruz?
- Kurum paneli: Etüt merkezlerine öğrenci, yoklama, etüt, ödev, deneme analizi, veli iletişimi ve tahsilat takibi için yazılım.
- Pi Koç: Koçların ve öğretmenlerin kendi öğrencilerini program, ödev, soru ve deneme takibi, görüntülü görüşme ve veli raporuyla izlediği panel. {piKocFreeStudents} öğrenciye kadar ücretsizdir.
- Özel ders vitrini: Veliler öğretmen profillerini inceler ve ücretsiz ders talebi gönderir. Öğretmen kabul edince veliyi arar; ders saatini ve ücreti taraflar birlikte belirler.

## Özel derste rolümüz
{siteName} özel ders ücretine aracılık etmez ve komisyon almaz. Ders ücreti doğrudan öğretmene ödenir; dersin içeriğinden ve yürütülmesinden öğretmen sorumludur.

## Nasıl güven sağlıyoruz?
- Öğretmenlerin kimlik ve diploma bilgilerini kontrol ediyor, onaylı öğretmenleri rozetle gösteriyoruz.
- Telefon numaranız yalnızca talebinizi kabul eden öğretmenle paylaşılır; ondan önce mesajlarda iletişim bilgisi gizlenir.
- Yorumları yalnızca öğretmenle görüntülü ders yapmış veliler ve öğrenciler yazabilir.

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
    content: `## Özel ders
1. Öğretmeni bulun: kademe, ders, ders şekli, il/ilçe ve fiyata göre süzün; onaylı öğretmen rozetine, tanıtıma ve yorumlara bakın.
2. Ücretsiz ders talebi gönderin: öğretmenin profilindeki formdan dersi, öğrenciyi ve uygun saatlerinizi yazın.
3. Öğretmen sizi arar: talebinizi kabul eden öğretmen telefon numaranızı görür. Ders saatini, ücreti ve ödeme şeklini onunla konuşursunuz; ödemeyi doğrudan öğretmene yaparsınız.
4. Takip edin: öğrenci öğretmenin Pi Koç takibine eklenir. Program, ödev, deneme sonuçları ve koçluk notları Hesabım → Koçum bölümünde görünür.

## Pi Koç
Koçlar ve öğretmenler öğrencilerini tek panelde takip eder. {piKocFreeStudents} öğrenciye kadar ücretsizdir; daha fazlası ve ek özellikler için ücretli paketler Pi Koç sayfasında yazılıdır.

## Kurum paneli
Etüt merkezleri öğrenci, yoklama, deneme, veli iletişimi ve tahsilatı tek panelden yönetir. Ayrıntılar Kurumlar için sayfasındadır.`,
  },
  {
    slug: "sss",
    title: "Sıkça Sorulan Sorular",
    sortOrder: 3,
    showInFooter: true,
    content: `## Ders talebi ücretli mi?
Hayır. Ders talebi göndermek ve siteye üye olmak ücretsizdir.

## Ders ücretini kime, nasıl öderim?
Doğrudan öğretmene. Ücreti, ders saatini ve ödeme şeklini öğretmen sizi aradığında birlikte belirlersiniz. {siteName} ders ücretine aracılık etmez ve komisyon almaz.

## Telefon numaram kimlerle paylaşılır?
Yalnızca talebinizi kabul eden öğretmenle. Talep kabul edilmeden önce mesajlarda telefon, e-posta ve adres paylaşılamaz.

## Öğretmen talebimi kabul etmezse?
Size e-postayla haber veririz; aynı derste başka öğretmenlere talep gönderebilirsiniz. Taleplerinizin durumunu Hesabım → Ders taleplerim sayfasında görürsünüz.

## Koçum bölümünde neler var?
Talebinizi kabul eden öğretmen çocuğunuzu Pi Koç takibine ekler. Haftalık program, ödevler, deneme sonuçları, koçluk notları ve görüntülü ders bağlantısı burada görünür.

## Online ders için ne gerekiyor?
Kamera ve mikrofonu olan bir bilgisayar, tablet ya da telefon ve güncel bir tarayıcı yeterlidir. Görüntülü ders sitemizin içinde açılır.

## Kimler yorum yapabilir?
Öğretmenin talebini kabul ettiği ve öğretmenle sitemizde en az bir görüntülü ders yapmış veliler ve öğrenciler. Bu sayede yorumlar gerçek derslere dayanır.

## Aradığım öğretmeni bulamadım, ne yapmalıyım?
Öğretmen listesinin altındaki "Aradığınız öğretmeni bulamadınız mı?" formunu doldurun; uygun öğretmeni bulup size dönelim.

## Öğretmen olmak istiyorum, ne ödemem gerekir?
Profil açmak ve ders talebi almak ücretsizdir; {siteName} ders ücretinizden komisyon almaz. Öğrencilerinizi takip ettiğiniz Pi Koç {piKocFreeStudents} öğrenciye kadar ücretsizdir; daha fazla öğrenci için aylık paket alırsınız. Başvuru için "Öğretmen ol" sayfasını kullanın.`,
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
- Ders talepleri: talebi gönderen velinin adı ve telefonu, öğrencinin adı ve sınıfı, ders, ders şekli, uygun saatler ve not
- İşlem güvenliği: IP adresi, oturum ve giriş kayıtları
- Öğretmenler için ayrıca: eğitim ve deneyim bilgileri, diploma/sertifika, istenirse adli sicil kaydı; daha önce hakediş almışsa IBAN ve T.C. kimlik numarası
- Kurum paneli ve Pi Koç'taki öğrenci ve veliler için: kurumun ya da koçun girdiği ad, telefon, e-posta, sınıf, yoklama, ödev, deneme sonucu, çalışma programı, görüşme notları ve ödeme planı
- Görüntülü derslerde: görüşmeye giriş ve çıkış zamanları (görüntü ve ses kaydedilmez)
- Abonelik ödemeleri: havale/EFT ile ödeyen kurum ve koçların ödeme tutarı, tarihi ve açıklaması
- Bildirimler: cihaz bildirim anahtarı, WhatsApp tercihiniz ve gönderim kayıtları

## İşleme amaçları
Üyeliğin ve ders taleplerinin yürütülmesi, talebin öğretmene iletilmesi, Pi Koç ve kurum paneli hizmetlerinin sunulması, görüntülü derslerin gerçekleştirilmesi, öğretmen doğrulaması, abonelik ödemelerinin takibi, müşteri hizmetleri, yasal yükümlülüklerin yerine getirilmesi ve hizmet güvenliğinin sağlanması.

## Hukuki sebepler
Sözleşmenin kurulması ve ifası, hukuki yükümlülük, meşru menfaat ve gerektiğinde açık rızanız (KVKK m.5). WhatsApp bildirimleri ve pazarlama iletileri yalnızca açık rızanıza dayanır.

## Ders talebinde paylaşım
Ders talebi gönderdiğinizde talebiniz seçtiğiniz öğretmene iletilir. Adınız ve telefon numaranız öğretmene yalnızca talebinizi kabul ederse gösterilir. Kabul eden öğretmen öğrenciyi Pi Koç takibine ekler; bu andan itibaren takip kayıtları için veri sorumlusu öğretmendir.

## Aktarım
Kişisel verileriniz yalnızca hizmetin gerektirdiği ölçüde aşağıdaki taraflarla paylaşılır:
- Ders talebini kabul eden öğretmen: talep bilgileri ve telefon numarası
- Barındırma ve e-posta hizmet sağlayıcıları: sitenin çalışması ve bildirim e-postaları
- LiveKit: görüntülü derslerde görüntü ve sesin anlık iletilmesi
- Google (Firebase Cloud Messaging, Google Drive): mobil uygulama bildirimleri ve şifrelenmiş yedekler
- OpenRouter ve aracılık ettiği yapay zekâ model sağlayıcıları: kurum ve koçların yüklediği deneme sonuç dosyalarının okunması ve koç raporu taslağı (rapor taslağına öğrenci adı gönderilmez)
- Meta Platforms (WhatsApp): yalnızca WhatsApp bildirimi alıyorsanız telefon numaranız ve mesaj içeriği
- Telegram: site yöneticilerine giden iç bildirimler (ad ve işlem özeti)
- Bankalar: abonelik bedellerinin havale/EFT ile alınması
- Yetkili kamu kurumları: yasal zorunluluk hâlinde

LiveKit, Google, OpenRouter ve yapay zekâ model sağlayıcıları, Meta ve Telegram sunucuları yurt dışında bulunabilir. Yurt dışına aktarım KVKK m.9 kapsamındaki şartlara uygun yapılır.

## WhatsApp bildirimleri
WhatsApp bildirimleri isteğe bağlıdır ve yalnızca izninizle gönderilir. İzninizi kayıt sırasında ya da Hesap ayarlarından verebilir, aynı yerden geri alabilir ya da WhatsApp’tan DUR yazarak bildirimleri durdurabilirsiniz. Bu durum e-posta ve site bildirimlerini etkilemez. Kurum öğrencilerinin velilerine giden WhatsApp bildirimleri için izni kurum alır.

## Kurum ve Pi Koç kayıtları
Kurum panelinde kurumun, Pi Koç'ta koçun girdiği öğrenci ve veli verileri için veri sorumlusu ilgili kurum ya da koçtur; {siteName} bu verileri onlar adına, veri işleyen olarak işler.

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

İleride analiz veya pazarlama çerezleri eklenirse yalnızca açık onayınızla kullanılacaktır.

## Güvenlik
Şifreler geri döndürülemez biçimde saklanır; sitede kart bilgisi alınmaz; hassas veriler ve yedekler şifrelenir.

## Ders talepleri
Ders talebindeki telefon numaranız yalnızca talebinizi kabul eden öğretmene gösterilir. Talep kabul edilmeden önce mesajlarda iletişim bilgileri gizlenir.

## WhatsApp bildirimleri
Telefon numaranız, yalnızca izin verdiyseniz önemli bildirimler için WhatsApp üzerinden kullanılır; bu amaçla Meta Platforms (WhatsApp) ile paylaşılır. Reklam ya da kampanya mesajı göndermek için kullanılmaz. Bildirimleri Hesap ayarlarından kapatabilir ya da WhatsApp’tan DUR yazarak durdurabilirsiniz.

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
- Öğretmen: Giriş yapın → Öğretmen paneli → Hesap ayarları → “Hesabı sil”.

Silme işlemi onaylandığında hesabınız hemen kapatılır; ad, e-posta, telefon, profil fotoğrafı, mesajlar ve bildirim tercihleriniz silinir ya da anonimleştirilir.

## 2. E-postayla talep edin
Hesabınıza giremiyorsanız ya da yalnızca belirli verilerin (ör. WhatsApp için kullanılan telefon numaranızın) silinmesini istiyorsanız {contactEmail} adresine, kayıtlı e-posta adresinizden “Veri silme talebi” konulu bir e-posta gönderin. Kimliğinizi doğruladıktan sonra talebinizi en geç 30 gün içinde sonuçlandırır ve size bilgi veririz.

Yalnızca WhatsApp bildirimlerini durdurmak istiyorsanız WhatsApp’tan DUR yazmanız yeterlidir.

## 3. Kurum ve Pi Koç kayıtları
Bir kurumun ya da Pi Koç kullanan bir koçun öğrencisi veya velisiyseniz; öğrenci kartı, yoklama, deneme, program ve ödeme gibi kayıtlar o kurum ya da koç adına tutulur. Silme talebinizi kurumunuza ya da koçunuza iletebilir veya {contactEmail} adresine yazabilirsiniz; talebi onlarla birlikte sonuçlandırırız.

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
Satıcı: {companyName}
Adres: {companyAddress}
Vergi bilgileri: {companyTaxInfo}
Telefon: {contactPhone} · E-posta: {contactEmail}

Alıcı: {siteName} üzerinden Pi Koç ücretli paketini satın alan kişi.

## 2. Konu
İşbu sözleşme, alıcının {siteName} üzerinden satın aldığı Pi Koç yazılım aboneliğinin satışı ve ifasına ilişkin tarafların hak ve yükümlülüklerini 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca düzenler.

Pi Koç; koçların ve öğretmenlerin öğrencilerini program, ödev, soru ve deneme takibi, görüntülü görüşme ve veli raporuyla izlediği web ve mobil yazılımdır. {piKocFreeStudents} öğrenciye kadar ücretsiz paket süresizdir; ücretli paketler öğrenci sayısına göre aylık olarak satılır. Paketlerin içeriği ve fiyatları Pi Koç sayfasında yer alır.

{siteName} üzerinden öğretmenlerle kurulan özel ders ilişkisi bu sözleşmenin konusu değildir: {siteName} özel ders hizmetinin satıcısı ya da ödemesinin aracısı değildir; ders ücreti öğretmen ile veli arasında belirlenir ve doğrudan öğretmene ödenir.

## 3. Bedel ve ödeme
Paket bedeli tüm vergiler dahil olarak Pi Koç sayfasında ve panelin Abonelik sayfasında gösterilir. Ödeme havale / EFT ile yapılır; ödeme açıklamasına hesap adı ve paket yazılır. Sitede kart bilgisi alınmaz.

## 4. Hizmetin ifası
Ödeme kaydedildiğinde seçilen paket alıcının Pi Koç hesabında açılır ve ödenen süre boyunca geçerli olur. Hizmet elektronik ortamda sunulur; kargo ile teslimat yoktur. Süre bitip yenilenmezse hesap ücretsiz pakete döner; kayıtlar silinmez.

## 5. Cayma hakkı
Paket, alıcının onayıyla ödemenin kaydedildiği anda elektronik ortamda anında ifa edilmeye başlanır. Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesinin (ğ) bendi uyarınca bu hizmette cayma hakkı kullanılamaz. Paket açılmadan önce yapılan ödemenin iadesi istenebilir.

## 6. İade
Hatalı ya da fazla yapılan ödemeler, alıcının bildirdiği hesaba en geç 14 gün içinde iade edilir. Dönem içinde paket bırakılırsa paket dönem sonuna kadar açık kalır.

## 7. Uyuşmazlık
Uyuşmazlıklarda Ticaret Bakanlığınca her yıl ilan edilen parasal sınırlar dahilinde alıcının yerleşim yerindeki tüketici hakem heyetleri, bu sınırları aşan durumlarda tüketici mahkemeleri yetkilidir.

## 8. Yürürlük
Alıcı, ödemeyi yapmadan önce bu sözleşmeyi ve Ön Bilgilendirme Formu'nu okuyup onaylamış sayılır; sözleşme ödemenin kaydedilmesiyle kurulur.`,
  },
  {
    slug: "on-bilgilendirme-formu",
    title: "Ön Bilgilendirme Formu",
    sortOrder: 13,
    showInFooter: true,
    content: `## Satıcı
Unvan: {companyName}
Adres: {companyAddress}
Vergi bilgileri: {companyTaxInfo}
Telefon: {contactPhone} · E-posta: {contactEmail}

## Hizmetin temel nitelikleri
Pi Koç yazılım aboneliği: koçların ve öğretmenlerin öğrencilerini program, ödev, soru ve deneme takibi, görüntülü görüşme ve veli raporuyla izlediği panel. Ücretli paketler öğrenci sayısına göre aylıktır; paket içerikleri Pi Koç sayfasında yazılıdır. {piKocFreeStudents} öğrenciye kadar ücretsiz paket süresizdir.

## Toplam bedel
Tüm vergiler dahil paket bedeli Pi Koç sayfasında gösterilir. Ek ücret alınmaz.

## Ödeme
Havale / EFT. Sitede kart bilgisi alınmaz.

## Teslimat
Ödeme kaydedildiğinde paket Pi Koç hesabınızda elektronik ortamda açılır; kargo gönderimi yoktur.

## Cayma ve iade
- Elektronik ortamda anında ifa edilen hizmet olduğundan, paket açıldıktan sonra cayma hakkı kullanılamaz (Mesafeli Sözleşmeler Yönetmeliği m.15/ğ).
- Paket açılmadan önce yapılan, hatalı ya da fazla ödemeler 14 gün içinde iade edilir.
- Süre bitip yenilenmezse hesap ücretsiz pakete döner; kayıtlar silinmez.

## Özel ders
{siteName}, öğretmenlerle kurulan özel ders hizmetinin satıcısı ya da ödemesinin aracısı değildir; ders ücreti doğrudan öğretmene ödenir.

## Şikayet
Şikayetlerinizi {contactEmail} adresine ya da {contactPhone} numarasına iletebilir, tüketici hakem heyetlerine ve tüketici mahkemelerine başvurabilirsiniz.`,
  },
  {
    slug: "iptal-ve-iade-politikasi",
    title: "İptal ve İade Politikası",
    sortOrder: 14,
    showInFooter: true,
    content: `## Özel ders
{siteName} özel ders ücretine aracılık etmez; ders ücreti, iptal ve iade koşulları öğretmen ile veli arasında belirlenir. Ders talebi göndermek ücretsizdir.

## Pi Koç ücretli paketleri
- Ücretsiz paket süresizdir; iptal gerektirmez.
- Ücretli paket ödendiği süre boyunca açık kalır. Yenilemezseniz süre sonunda hesabınız ücretsiz pakete döner; kayıtlarınız silinmez.
- Paket, ödemeniz kaydedilip açıldığında elektronik ortamda ifa edilmeye başlar; bu andan sonra cayma hakkı kullanılamaz (Mesafeli Sözleşmeler Yönetmeliği m.15/ğ).
- Paket açılmadan önce yapılan, hatalı ya da fazla ödemeler, bildirdiğiniz hesaba en geç 14 gün içinde iade edilir.

## Kurum paneli
Kurum paneli aboneliğinde iptal ve iade koşulları Kurum Hizmet Sözleşmesi'nde yer alır.

## Eski randevu ve paket ödemeleri
Sitede daha önce kartla ödenmiş randevu, paket ya da grup dersi varsa, o ödemeler satın alındıkları tarihte geçerli koşullarla sonuçlandırılır. Sorularınız için: {contactEmail} · {contactPhone}`,
  },
  {
    slug: "teslimat-ve-hizmet-bilgileri",
    title: "Teslimat ve Hizmet Bilgileri",
    sortOrder: 14,
    showInFooter: true,
    content: `{siteName} üzerinden satılan hizmetler yazılım aboneliğidir; fiziksel ürün satışı ve kargo gönderimi yapılmaz.

## Pi Koç
- Ücretsiz paket, hesabınız açıldığında hemen kullanılabilir.
- Ücretli paket, havale / EFT ödemeniz kaydedildiğinde Pi Koç hesabınızda açılır ve size site bildirimi ile haber verilir.
- Hizmete pikampus.com/koc-giris adresinden ve mobil uygulamadan erişilir.

## Kurum paneli
Kurum paneli, başvurunuz onaylanınca açılır; giriş bilgileri e-postanıza gönderilir. Abonelik ödemesi kaydedildiğinde süreniz uzar.

## Özel ders
Özel dersler öğretmen ile veli arasında kararlaştırılan zamanda, sitemizdeki görüntülü ders odasında ya da yüz yüze yapılır. {siteName} özel ders hizmetinin satıcısı değildir.

## İletişim
{companyName} · {contactPhone} · {contactEmail}`,
  },
  {
    slug: "kullanim-sartlari",
    title: "Kullanım Şartları",
    sortOrder: 15,
    showInFooter: true,
    content: `Bu şartlar, {companyName} tarafından işletilen {siteName} sitesinin ve mobil uygulamalarının kullanımını düzenler.

## Hizmet
{siteName}; velilerin özel ders öğretmeni bulup ders talebi gönderdiği bir vitrin, koçlar ve öğretmenler için Pi Koç takip paneli ve etüt merkezleri için kurum yönetim yazılımı sunar. Pi Koç ve kurum paneli için ayrıca Kurum Hizmet Sözleşmesi geçerlidir.

## Üyelik
Üyelik ücretsizdir. 18 yaşından küçükler adına hesap veli veya yasal temsilci tarafından açılır; hesap tipi (veli ya da 18 yaşını doldurmuş öğrenci) kayıtta beyan edilir. Hesap bilgilerinin gizliliğinden kullanıcı sorumludur.

## Ders talepleri ve özel ders
- Ders talebi ücretsizdir. Veli adı ve telefonu, yalnızca talebi kabul eden öğretmene gösterilir.
- Ders saati, ücret ve ödeme şekli öğretmen ile veli arasında belirlenir; ders ücreti doğrudan öğretmene ödenir. {siteName} ders ücretine aracılık etmez, komisyon almaz ve özel ders sözleşmesinin tarafı değildir.
- Talep kabul edilmeden önce mesajlarda telefon, e-posta, adres ve sosyal medya bilgisi paylaşılamaz; paylaşılan bilgiler gizlenir.

## Davranış kuralları
Derslerde ve mesajlarda saygılı bir dil kullanılır; çocuk güvenliğini tehlikeye atan her türlü davranış hesabın kapatılması ve yetkili makamlara bildirim sebebidir.

## Değerlendirmeler
Yorumlar gerçek ders deneyimine dayanmalıdır; öğretmenle sitemizde görüntülü ders yapmış veliler ve öğrenciler yorum yazabilir. Hakaret, kişisel veri veya reklam içeren yorumlar yayından kaldırılır.

## Sorumluluk
Dersin içeriğinden, yürütülmesinden ve ücretinden dersi veren öğretmen sorumludur. Öğretmen profillerindeki bilgiler öğretmenin beyanıdır; {siteName} kimlik ve diploma kontrolü yaptığı öğretmenleri "Onaylı öğretmen" rozetiyle gösterir.

## Fikri haklar
Sitedeki yazılım, marka ve tasarım {companyName}’a aittir; izinsiz kopyalanamaz. Öğretmenlerin, koçların ve kurumların yüklediği içeriklerin sorumluluğu kendilerine aittir.

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
    content: `Bu sözleşme, {companyName} ("{siteName}") ile {siteName}'te öğretmen profili açan öğretmen arasında geçerlidir.

## Hizmet
- Öğretmen, profilinde verdiği dersleri ve bilgi amaçlı ücretlerini yayınlar; veliler profilden ücretsiz ders talebi gönderir.
- Öğretmen talebi kabul edince velinin adını ve telefonunu görür; ders saatini, ücreti ve ödeme şeklini veliyle kendisi belirler. Ders ücreti doğrudan öğretmene ödenir.
- {siteName} ders ücretine aracılık etmez, ders ücretinden komisyon almaz ve öğretmen ile veli arasındaki özel ders ilişkisinin tarafı değildir.

## Pi Koç
- Her öğretmen hesabında Pi Koç ücretsiz paketi açılır ({piKocFreeStudents} öğrenciye kadar, süresiz). Kabul edilen ders talebindeki öğrenci öğretmenin Pi Koç'una eklenir.
- Daha fazla öğrenci ve ek özellikler için ücretli paketler aylık olarak satılır; koşulları Kurum Hizmet Sözleşmesi ve Mesafeli Satış Sözleşmesi'nde yer alır.

## Yükümlülükler
- Profil bilgilerini, eğitim ve deneyim bilgilerini doğru vermek; kimlik, diploma ve istenmesi halinde adli sicil kaydı belgelerini doğru sunmak
- Ders taleplerini makul sürede yanıtlamak
- Talep kabul edilmeden önce mesajlarda kişisel iletişim bilgisi paylaşmamak
- Velinin telefonunu ve öğrenci bilgilerini yalnızca o öğrencinin dersi ve takibi için kullanmak; Pi Koç'a girdiği öğrenci verileri için veri sorumlusu olarak KVKK yükümlülüklerine uymak
- Öğrencilere ve velilere saygılı davranmak; çocuk güvenliğini gözetmek
- Aldığı ders ücretlerine ilişkin vergi ve diğer yasal yükümlülüklerini kendisi yerine getirmek

## Statü beyanı
Öğretmen; devlet okulunda kadrolu olarak çalışmadığını veya ücretli özel ders vermesine mevzuatın izin verdiğini, aksi halde doğacak sorumluluğun kendisine ait olduğunu beyan eder.

## Hesabın askıya alınması
Bu sözleşmeye, yasalara ya da davranış kurallarına aykırılıkta profil yayından kaldırılabilir ve hesap kapatılabilir.`,
  },
  {
    slug: "kurum-hizmet-sozlesmesi",
    title: "Kurum Hizmet Sözleşmesi",
    sortOrder: 17,
    showInFooter: true,
    content: `Bu sözleşme, {companyName} ("{siteName}") ile kurum paneli ya da Pi Koç kullanan etüt merkezi, bireysel koç veya öğretmen ("Kurum") arasında geçerlidir.

## Taraf bilgileri
Hizmet sağlayıcı: {companyName}
Adres: {companyAddress}
Vergi bilgileri: {companyTaxInfo}
Telefon: {contactPhone} · E-posta: {contactEmail}

## Hizmet
{siteName}, Kurum'a seçtiği pakete göre öğrenci, yoklama, etüt, ödev, deneme, çalışma programı, görüntülü görüşme, veli iletişimi ve tahsilat takibi için web ve mobil yazılım sunar. Paket özellikleri ve fiyatlar Kurumlar İçin ve Pi Koç sayfalarında yer alır.

## Pi Koç ücretsiz paketi
- Pi Koç {piKocFreeStudents} öğrenciye kadar süresiz ücretsizdir. Ücretsiz pakette görüntülü görüşme başına {piKocFreeMeetingMinutes} dakika ve aylık toplam süre sınırı uygulanır; bazı özellikler (ör. PDF'ten deneme aktarımı, konu eksik haritası, otomatik veli raporu, tahsilat takibi) ücretli pakette açılır.
- Ücretli paket süresi biterse hesap ücretsiz pakete döner; kayıtlar silinmez.

## Deneme süresi ve abonelik
- Kurum paneli deneme süresi için kart bilgisi istenmez; süre sonunda otomatik ücret alınmaz.
- Abonelik seçilen paket, öğrenci sayısı ve dönem için geçerlidir. Bedel havale / EFT ile ödenir; ödeme kaydedilince süre uzar.
- Kurum paneli aboneliği sona erer ve yenilenmezse panel salt okunur olur. Kayıtlar silinmez; abonelik başlatıldığında kaldığınız yerden devam edilir.
- Dönem bitmeden ayrılma ve iade koşulları abonelik sırasında yazılı olarak belirlenir.

## Kurumun sorumlulukları
- Panele girdiği öğrenci ve veli bilgilerinin doğru ve güncel olması
- Personel hesaplarının ve şifrelerinin korunması, yetkilerin doğru verilmesi
- Tahsilatlarını ve velilerle arasındaki ticari ilişkiyi kendisinin yürütmesi; {siteName} bu ilişkinin tarafı değildir
- Veli ve öğrencilere yasalara uygun bilgilendirme yapması

## Kişisel veriler
- Panele girilen öğrenci ve veli verileri için veri sorumlusu Kurum'dur; {siteName} bu verileri Kurum adına ve talimatları doğrultusunda, veri işleyen olarak işler. Kurum; aydınlatma yükümlülüğünü yerine getirmekten ve gerekli izinleri almaktan sorumludur.
- {siteName} hizmeti sunmak için barındırma, e-posta, görüntülü görüşme (LiveKit) ve yapay zekâ (OpenRouter aracılığıyla model sağlayıcıları; deneme dosyalarının okunması ve rapor taslağı) hizmet sağlayıcılarından yararlanır. Rapor taslağına öğrenci adı gönderilmez.
- {siteName} bu verileri kendi pazarlaması için kullanmaz, gerekli güvenlik önlemlerini alır ve Kurum istediğinde verileri dışa aktarma imkânı sunar.

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
