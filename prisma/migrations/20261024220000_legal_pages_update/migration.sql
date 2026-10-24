-- Nasıl çalışır ve SSS yenilendi; paket ders, düzenli ders ve erteleme maddeleri eklendi.
-- Yönetimden düzenlenmiş sayfalara dokunulmaz (yalnızca içeriği eski şablonla aynı olanlar güncellenir).

UPDATE "Page" SET "content" = $pk${siteName}'te birebir ders, grup dersi ve soru çözüm tek yerde. İhtiyacınıza uygun yolu seçin.

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

## Grup dersleri (sanal dershane)
{groupMinParticipants}–{groupMaxCapacity} kişilik online sınıflarda, birebir dersten çok daha uygun fiyata ders alırsınız. Ders, kayıt bitişinde en az katılımcı sayısına ulaşırsa açılır; ulaşmazsa ödediğiniz ücretin tamamı iade edilir.

## Soru çözüm
- Soru kredisi: takıldığınız sorunun fotoğrafını gönderin; branş öğretmenlerimizden biri {questionAnswerHours} saat içinde adım adım çözer. Çözülmezse krediniz iade edilir.
- Aylık soru aboneliği: kendi öğretmeninize {subscriptionDays} gün boyunca her gün soru gönderin. Otomatik çekim yoktur; dönem bitmeden yenileyebilirsiniz.

## Aradığınızı bulamazsanız
Öğretmen listesinin altındaki formdan ders ve uygun saatlerinizi bırakın; size uygun öğretmeni bulup dönelim. Sorularınız için sağ alttaki WhatsApp düğmesini de kullanabilirsiniz.$pk$, "updatedAt" = NOW()
WHERE "slug" = $pk$nasil-calisir$pk$ AND "content" = $pk$## 1. Öğretmeni bul
Kademe, ders, hizmet türü, ders şekli, il/ilçe ve fiyata göre filtreleyin; puanlara ve yorumlara bakın.

## 2. Saati seç ve öde
Öğretmenin takviminde yalnızca boş saatler seçilebilir. Ödeme 3D Secure ile alınır; seçtiğiniz saat ödeme süresince sizin için ayrılır.

## 3. Öğretmen onaylar
Öğretmen talebinizi {approvalWindowHours} saat içinde onaylar. Onaylamazsa ya da süresinde yanıt vermezse ödediğiniz tutarın tamamı iade edilir.

## 4. Derse katıl
Online derslerde ders saatinden {classroomOpensMinutesBefore} dakika önce "Derse Katıl" butonu açılır; herhangi bir program kurmanız gerekmez. Yüz yüze derslerde adres bilgisi onaydan sonra öğretmenle paylaşılır.

## 5. Değerlendir
Ders tamamlandıktan sonra öğretmeninize puan ve yorum verebilirsiniz. Bir sorun yaşadıysanız ders bitiminden itibaren {disputeWindowHours} saat içinde bildirebilirsiniz; bu süre dolmadan öğretmene ödeme yapılmaz.$pk$;

UPDATE "Page" SET "content" = $pk$## Ödememi ne zaman yaparım?
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

## Soru kredisi ile soru aboneliği arasındaki fark ne?
Kredide her soru 1 kredidir ve sorunuz o derste ders veren öğretmenlerden birine gider. Abonelikte {subscriptionDays} gün boyunca kendi seçtiğiniz öğretmene, günlük sınır içinde istediğiniz kadar soru gönderirsiniz.

## İndirim kodumu nereye yazarım?
Ödeme adımındaki "İndirim kodum var" bağlantısına tıklayıp kodu yazın ve "Uygula"ya basın. Arkadaşınızın davet bağlantısıyla kayıt olduysanız ilk siparişinizde indirim kendiliğinden uygulanır.

## Arkadaşımı nasıl davet ederim?
Hesabım → Arkadaşını davet et sayfasındaki bağlantınızı paylaşın. Arkadaşınız ilk siparişinde indirim kazanır; ilk ödemesini yaptığında size soru kredisi hediye edilir.

## Online ders için ne gerekiyor?
Kamera ve mikrofonu olan bir bilgisayar, tablet ya da telefon ve güncel bir tarayıcı yeterlidir. Ders sitemizin içinde açılır.

## Kimler yorum yapabilir?
Yalnızca o öğretmenle en az bir dersi tamamlanmış öğrenciler ve veliler yorum yapabilir. Bu sayede tüm yorumlar gerçek derslere dayanır.

## Aradığım öğretmeni bulamadım, ne yapmalıyım?
Öğretmen listesinin altındaki "Aradığınız öğretmeni bulamadınız mı?" formunu doldurun; uygun öğretmeni bulup size dönelim.

## Öğretmen olmak istiyorum, nasıl başvururum?
"Öğretmen ol" sayfasındaki başvuru formunu doldurun; belgeleriniz incelendikten sonra ekibimiz sizinle iletişime geçer.$pk$, "updatedAt" = NOW()
WHERE "slug" = $pk$sss$pk$ AND "content" = $pk$## Ödememi ne zaman yaparım?
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
"Öğretmen ol" sayfasındaki başvuru formunu doldurun; belgeleriniz incelendikten sonra ekibimiz sizinle iletişime geçer.$pk$;

UPDATE "Page" SET "content" = $pk$## 1. Taraflar
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
- Grup dersi: öğretmenin ilan ettiği programdaki (tarih, saat ve oturum sayısı sipariş özetinde yer alır) online grup oturumlarına katılım hakkıdır. Bedel kişi başı ve tüm program için tek seferde alınır.
- Paket ders ve düzenli ders: aynı öğretmenden, sipariş özetinde belirtilen ders ve sürede, belirtilen sayıda ders hakkıdır. Bedel peşin alınır; dersler öğretmenin takviminden seçilir ve öğretmen onayıyla kesinleşir. Paket {packageValidityMonths} ay geçerlidir.

## 3. Bedel ve ödeme
Hizmet bedeli tüm vergiler dahil olarak sipariş özetinde gösterilir; ek ücret alınmaz. Ödeme kredi veya banka kartıyla, 3D Secure doğrulamalı olarak tek çekim alınır. Kart bilgileri {siteName} tarafından görülmez ve saklanmaz; yalnızca bankanın güvenli ödeme sayfasında girilir. Tahsil edilen ders bedeli, ders gerçekleşip itiraz süresi dolana kadar öğretmene aktarılmaz.

## 4. Hizmetin ifası (teslimat)
Hizmet fiziksel olarak kargo ile teslim edilmez. Online dersler onaylanan tarih ve saatte sitedeki sanal sınıfta, yüz yüze dersler taraflarca belirlenen adreste yapılır. Soru kredileri ödeme onaylanır onaylanmaz hesaba tanımlanır ve {creditValidityMonths} ay içinde kullanılabilir. Soru aboneliği ödeme onaylanınca başlar; aynı öğretmenden süren bir dönem varsa onun bitişinden itibaren başlar. Grup dersi, kayıt bitiş tarihinde en az katılımcı sayısına ulaşılırsa kesinleşir ve programdaki saatlerde sitedeki sanal sınıfta yapılır; ulaşılamazsa iptal edilir ve bedelin tamamı iade edilir. Ayrıntılar Teslimat ve Hizmet Bilgileri sayfasındadır.

## 5. Öğretmen onayı
Ders talebi öğretmenin onayıyla kesinleşir. Öğretmen talebi reddederse ya da {approvalWindowHours} saat içinde yanıt vermezse ödenen tutarın tamamı kartınıza iade edilir.

## 6. Cayma hakkı ve iptal
- Alıcı, hizmetin ifasına başlanmadan önce siparişini iptal edebilir. Dersten {fullRefundHours} saat öncesine kadar yapılan iptallerde bedelin tamamı, {partialRefundHours} saat öncesine kadar %{partialRefundPercent}'si iade edilir.
- Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca, alıcının onayıyla ifasına başlanan hizmetlerde (başlamış ya da tamamlanmış ders, çözümü gönderilmiş soru) cayma hakkı kullanılamaz.
- Kullanılmamış soru kredileri, satın alma tarihinden itibaren {creditRefundDays} gün içinde iade edilebilir; kullanılan krediler iade tutarından düşülür.
- Soru aboneliği, alıcının açık onayıyla ödeme anında ifasına başlanan bir hizmettir; Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca cayma hakkı bulunmaz ve bedeli iade edilmez. Öğretmen hizmeti veremez hâle gelirse (ör. hesabının kapanması) kalan günlerin bedeli iade edilir.
- Paket dersinde tam iade gerektiren durumlarda (öğretmen onaylamaz ya da ders zamanında iptal edilir) ders pakete geri eklenir; kısmi iadeler karta yapılır. Kullanılmamış dersler istenildiğinde iade edilir; bu durumda kullanılan dersler paket indirimi uygulanmadan tek ders ücretinden düşülür. Paket süresi dolduğunda kullanılmayan derslerin bedeli iade edilir.
- Grup dersi kaydı, ilk oturum başlamadan önce iptal edilirse bedelin tamamı iade edilir. İlk oturum başladıktan sonra iptal ve iade yapılmaz; öğretmenin katılmadığı ya da iptal edilen oturumların bedeli iade edilir.
- İptal ve iade koşullarının tamamı İptal ve İade Politikası'nda yer alır ve bu sözleşmenin ayrılmaz parçasıdır.

## 7. İade yöntemi
İadeler ödemenin yapıldığı karta, iptal ya da iade kararından itibaren en geç 14 gün içinde yapılır. Tutarın hesaba yansıma süresi bankaya göre değişebilir.

## 8. Uyuşmazlık
Uyuşmazlıklarda Ticaret Bakanlığınca her yıl ilan edilen parasal sınırlar dahilinde alıcının yerleşim yerindeki tüketici hakem heyetleri, bu sınırları aşan durumlarda tüketici mahkemeleri yetkilidir.

## 9. Yürürlük
Alıcı, ödeme adımında bu sözleşmeyi ve Ön Bilgilendirme Formu'nu okuyup onayladığında sözleşme kurulmuş sayılır.$pk$, "updatedAt" = NOW()
WHERE "slug" = $pk$mesafeli-satis-sozlesmesi$pk$ AND "content" = $pk$## 1. Taraflar
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
- Grup dersi: öğretmenin ilan ettiği programdaki (tarih, saat ve oturum sayısı sipariş özetinde yer alır) online grup oturumlarına katılım hakkıdır. Bedel kişi başı ve tüm program için tek seferde alınır.

## 3. Bedel ve ödeme
Hizmet bedeli tüm vergiler dahil olarak sipariş özetinde gösterilir; ek ücret alınmaz. Ödeme kredi veya banka kartıyla, 3D Secure doğrulamalı olarak tek çekim alınır. Kart bilgileri {siteName} tarafından görülmez ve saklanmaz; yalnızca bankanın güvenli ödeme sayfasında girilir. Tahsil edilen ders bedeli, ders gerçekleşip itiraz süresi dolana kadar öğretmene aktarılmaz.

## 4. Hizmetin ifası (teslimat)
Hizmet fiziksel olarak kargo ile teslim edilmez. Online dersler onaylanan tarih ve saatte sitedeki sanal sınıfta, yüz yüze dersler taraflarca belirlenen adreste yapılır. Soru kredileri ödeme onaylanır onaylanmaz hesaba tanımlanır ve {creditValidityMonths} ay içinde kullanılabilir. Soru aboneliği ödeme onaylanınca başlar; aynı öğretmenden süren bir dönem varsa onun bitişinden itibaren başlar. Grup dersi, kayıt bitiş tarihinde en az katılımcı sayısına ulaşılırsa kesinleşir ve programdaki saatlerde sitedeki sanal sınıfta yapılır; ulaşılamazsa iptal edilir ve bedelin tamamı iade edilir. Ayrıntılar Teslimat ve Hizmet Bilgileri sayfasındadır.

## 5. Öğretmen onayı
Ders talebi öğretmenin onayıyla kesinleşir. Öğretmen talebi reddederse ya da {approvalWindowHours} saat içinde yanıt vermezse ödenen tutarın tamamı kartınıza iade edilir.

## 6. Cayma hakkı ve iptal
- Alıcı, hizmetin ifasına başlanmadan önce siparişini iptal edebilir. Dersten {fullRefundHours} saat öncesine kadar yapılan iptallerde bedelin tamamı, {partialRefundHours} saat öncesine kadar %{partialRefundPercent}'si iade edilir.
- Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca, alıcının onayıyla ifasına başlanan hizmetlerde (başlamış ya da tamamlanmış ders, çözümü gönderilmiş soru) cayma hakkı kullanılamaz.
- Kullanılmamış soru kredileri, satın alma tarihinden itibaren {creditRefundDays} gün içinde iade edilebilir; kullanılan krediler iade tutarından düşülür.
- Soru aboneliği, alıcının açık onayıyla ödeme anında ifasına başlanan bir hizmettir; Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca cayma hakkı bulunmaz ve bedeli iade edilmez. Öğretmen hizmeti veremez hâle gelirse (ör. hesabının kapanması) kalan günlerin bedeli iade edilir.
- Grup dersi kaydı, ilk oturum başlamadan önce iptal edilirse bedelin tamamı iade edilir. İlk oturum başladıktan sonra iptal ve iade yapılmaz; öğretmenin katılmadığı ya da iptal edilen oturumların bedeli iade edilir.
- İptal ve iade koşullarının tamamı İptal ve İade Politikası'nda yer alır ve bu sözleşmenin ayrılmaz parçasıdır.

## 7. İade yöntemi
İadeler ödemenin yapıldığı karta, iptal ya da iade kararından itibaren en geç 14 gün içinde yapılır. Tutarın hesaba yansıma süresi bankaya göre değişebilir.

## 8. Uyuşmazlık
Uyuşmazlıklarda Ticaret Bakanlığınca her yıl ilan edilen parasal sınırlar dahilinde alıcının yerleşim yerindeki tüketici hakem heyetleri, bu sınırları aşan durumlarda tüketici mahkemeleri yetkilidir.

## 9. Yürürlük
Alıcı, ödeme adımında bu sözleşmeyi ve Ön Bilgilendirme Formu'nu okuyup onayladığında sözleşme kurulmuş sayılır.$pk$;

UPDATE "Page" SET "content" = $pk$## Öğretmen onayı
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
İfasına sizin onayınızla başlanan hizmetlerde (başlamış ya da tamamlanmış ders, çözümü gönderilmiş soru) Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca cayma hakkı kullanılamaz. Bunun dışındaki iptallerde yukarıdaki kurallar uygulanır.

## Sorun bildirme
Ders bitiminden itibaren {disputeWindowHours} saat içinde "Sorun bildir" ile başvurabilirsiniz. İnceleme sonuçlanana kadar öğretmene ödeme yapılmaz.

## İade süresi
İadeler ödemenin yapıldığı karta en geç 14 gün içinde yapılır; tutarın hesabınıza yansıma süresi bankanıza göre değişebilir. Sorularınız için: {contactEmail} · {contactPhone}$pk$, "updatedAt" = NOW()
WHERE "slug" = $pk$iptal-ve-iade-politikasi$pk$ AND "content" = $pk$## Öğretmen onayı
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

## Grup dersi
- Ders, kayıt bitiş tarihinde en az katılımcı sayısına ulaşmazsa iptal edilir ve ödediğiniz bedelin tamamı kartınıza iade edilir.
- İlk oturum başlamadan Hesabım → Grup derslerim sayfasından kaydınızı iptal ederseniz bedelin tamamı iade edilir. İlk oturum başladıktan sonra iptal ve iade yapılmaz.
- Öğretmen bir oturuma katılmazsa ya da ders iptal edilirse, yapılmayan oturumların bedeli kartınıza iade edilir.

## Cayma hakkı
İfasına sizin onayınızla başlanan hizmetlerde (başlamış ya da tamamlanmış ders, çözümü gönderilmiş soru) Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca cayma hakkı kullanılamaz. Bunun dışındaki iptallerde yukarıdaki kurallar uygulanır.

## Sorun bildirme
Ders bitiminden itibaren {disputeWindowHours} saat içinde "Sorun bildir" ile başvurabilirsiniz. İnceleme sonuçlanana kadar öğretmene ödeme yapılmaz.

## İade süresi
İadeler ödemenin yapıldığı karta en geç 14 gün içinde yapılır; tutarın hesabınıza yansıma süresi bankanıza göre değişebilir. Sorularınız için: {contactEmail} · {contactPhone}$pk$;

