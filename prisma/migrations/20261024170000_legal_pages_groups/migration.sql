-- Yasal sayfalar: grup dersi maddeleri eklendi.
-- Yönetimden düzenlenmiş sayfalara dokunulmaz (yalnızca içeriği eski şablonla aynı olanlar güncellenir).

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
Alıcı, ödeme adımında bu sözleşmeyi ve Ön Bilgilendirme Formu'nu okuyup onayladığında sözleşme kurulmuş sayılır.$pk$;

UPDATE "Page" SET "content" = $pk$## Satıcı / Aracı Hizmet Sağlayıcı
Unvan: {companyName}
Adres: {companyAddress}
Vergi bilgileri: {companyTaxInfo}
Telefon: {contactPhone} · E-posta: {contactEmail}

## Hizmetin temel nitelikleri
- Ders: hizmet türü (özel ders, soru çözüm, koçluk), kademe, ders, süre, tarih-saat, ders şekli (online / yüz yüze) ve öğretmen bilgisi sipariş özetinde yer alır.
- Soru kredisi: paketteki soru sayısı sipariş özetinde yer alır; her soru {questionAnswerHours} saat içinde çözülür, çözülmezse kredi iade edilir.
- Soru aboneliği: öğretmen, kademe ve ders, {subscriptionDays} günlük dönem, günlük soru sınırı ve cevap süresi sipariş özetinde yer alır. Otomatik yenileme ve otomatik çekim yoktur.
- Grup dersi: öğretmen, program (oturum tarihleri ve saatleri), kontenjan, en az katılımcı sayısı ve kayıt bitiş tarihi sipariş özetinde yer alır.

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
- Grup dersi: en az katılımcıya ulaşılamazsa tam iade; ilk oturumdan önce iptalde tam iade; sonrasında iade yok, öğretmenin katılmadığı ya da iptal edilen oturumların bedeli iade
- İfasına başlanan hizmetlerde cayma hakkı kullanılamaz (Mesafeli Sözleşmeler Yönetmeliği m.15).

## Şikayet
Şikayetlerinizi {contactEmail} adresine ya da {contactPhone} numarasına iletebilir, tüketici hakem heyetlerine ve tüketici mahkemelerine başvurabilirsiniz.$pk$, "updatedAt" = NOW()
WHERE "slug" = $pk$on-bilgilendirme-formu$pk$ AND "content" = $pk$## Satıcı / Aracı Hizmet Sağlayıcı
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
Şikayetlerinizi {contactEmail} adresine ya da {contactPhone} numarasına iletebilir, tüketici hakem heyetlerine ve tüketici mahkemelerine başvurabilirsiniz.$pk$;

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

## Cayma hakkı
İfasına sizin onayınızla başlanan hizmetlerde (başlamış ya da tamamlanmış ders, çözümü gönderilmiş soru) Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca cayma hakkı kullanılamaz. Bunun dışındaki iptallerde yukarıdaki kurallar uygulanır.

## Sorun bildirme
Ders bitiminden itibaren {disputeWindowHours} saat içinde "Sorun bildir" ile başvurabilirsiniz. İnceleme sonuçlanana kadar öğretmene ödeme yapılmaz.

## İade süresi
İadeler ödemenin yapıldığı karta en geç 14 gün içinde yapılır; tutarın hesabınıza yansıma süresi bankanıza göre değişebilir. Sorularınız için: {contactEmail} · {contactPhone}$pk$;

UPDATE "Page" SET "content" = $pk${siteName} üzerinden satılan tüm hizmetler eğitim hizmetidir; fiziksel ürün satışı ve kargo gönderimi yapılmaz. Hizmetler aşağıdaki şekilde teslim edilir.

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

## Grup dersi
- Kaydınız ödemeyle tamamlanır. Ders, kayıt bitiş tarihinde en az katılımcı sayısına ulaşırsa kesinleşir ve size bildirilir.
- Oturumlar programdaki tarih ve saatlerde sitedeki sanal sınıfta yapılır; “Derse katıl” düğmesi Hesabım → Grup derslerim sayfasında ders saatinden {classroomOpensMinutesBefore} dakika önce açılır.

## Teslim edilemeyen hizmet
Öğretmen onay vermezse, dersi iptal ederse ya da derse gelmezse ödediğiniz tutarın tamamı kartınıza iade edilir. Ayrıntılar İptal ve İade Politikası sayfasındadır.

## İletişim
{companyName} · {contactPhone} · {contactEmail}$pk$, "updatedAt" = NOW()
WHERE "slug" = $pk$teslimat-ve-hizmet-bilgileri$pk$ AND "content" = $pk${siteName} üzerinden satılan tüm hizmetler eğitim hizmetidir; fiziksel ürün satışı ve kargo gönderimi yapılmaz. Hizmetler aşağıdaki şekilde teslim edilir.

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
{companyName} · {contactPhone} · {contactEmail}$pk$;

