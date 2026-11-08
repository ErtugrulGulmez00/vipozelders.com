-- Yasal metinler: ücretli soru çözüm ve Dershane anlatımları kalkar, silinen ayar değişkenleri ({creditRefundDays} vb.) metinden çıkar.
-- Yönetimden düzenlenip bu parçası değişmiş metinlere dokunulmaz.
UPDATE "Page" SET "content" = REPLACE("content", $pk$
- Soru çözüm: Takıldığınız sorunun fotoğrafını yüklersiniz, branş öğretmeni {questionAnswerHours} saat içinde çözümü gönderir.$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$hakkimizda$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$- Kurum paneli: Etüt merkezi ve dershanelere öğrenci$pk$, $pk$- Kurum paneli: Etüt merkezlerine öğrenci$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$hakkimizda$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$birebir ders, grup dersi ve soru çözüm tek yerde$pk$, $pk$birebir ders ve grup dersi tek yerde$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$nasil-calisir$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$## Grup dersleri (sanal dershane)$pk$, $pk$## Grup dersleri$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$nasil-calisir$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$## Soru çözüm
- Soru kredisi: takıldığınız sorunun fotoğrafını gönderin; branş öğretmenlerimizden biri {questionAnswerHours} saat içinde adım adım çözer. Çözülmezse krediniz iade edilir.
- Aylık soru aboneliği: kendi öğretmeninize {subscriptionDays} gün boyunca her gün soru gönderin. Otomatik çekim yoktur; dönem bitmeden yenileyebilirsiniz.

$pk$, $pk$## Dersle birlikte soru çözümü
Bazı öğretmenler, tamamlanan her dersin ardından 30 dakikalık ücretsiz bir soru çözüm dersi açar. Bu öğretmenlerin profilinde belirtilir; ayrı bir ücret alınmaz.

$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$nasil-calisir$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$## Soru kredisi ile soru aboneliği arasındaki fark ne?
Kredide her soru 1 kredidir ve sorunuz o derste ders veren öğretmenlerden birine gider. Abonelikte {subscriptionDays} gün boyunca kendi seçtiğiniz öğretmene, günlük sınır içinde istediğiniz kadar soru gönderirsiniz.

$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$sss$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$; ilk ödemesini yaptığında size soru kredisi hediye edilir.$pk$, $pk$.$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$sss$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$Etüt merkezi ya da dershane panelinde$pk$, $pk$Etüt merkezi panelinde$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$kvkk-aydinlatma-metni$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$## 3. Kurum (etüt merkezi / dershane) kayıtları$pk$, $pk$## 3. Kurum (etüt merkezi) kayıtları$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$veri-silme$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$- Özel ders, soru çözüm dersi ve koçluk görüşmesi:$pk$, $pk$- Özel ders ve koçluk görüşmesi:$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$mesafeli-satis-sozlesmesi$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$
- Soru kredisi paketi: paketteki soru sayısı ve bedeli ödeme adımında gösterilir. Her kredi bir sorunun branş öğretmeni tarafından çözülmesi hakkıdır.$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$mesafeli-satis-sozlesmesi$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$
- Soru aboneliği: seçilen öğretmene {subscriptionDays} gün boyunca, günlük soru sınırı ve cevap süresi ödeme adımında belirtilen şekilde soru gönderme hakkıdır. Bedel dönem başında tek seferde alınır; otomatik yenileme ve otomatik çekim yoktur.$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$mesafeli-satis-sozlesmesi$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$ Soru kredileri ödeme onaylanır onaylanmaz hesaba tanımlanır ve {creditValidityMonths} ay içinde kullanılabilir. Soru aboneliği ödeme onaylanınca başlar; aynı öğretmenden süren bir dönem varsa onun bitişinden itibaren başlar.$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$mesafeli-satis-sozlesmesi$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$(başlamış ya da tamamlanmış ders, çözümü gönderilmiş soru)$pk$, $pk$(başlamış ya da tamamlanmış ders)$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$mesafeli-satis-sozlesmesi$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$(başlamış ya da tamamlanmış ders, çözümü gönderilmiş soru)$pk$, $pk$(başlamış ya da tamamlanmış ders)$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$iptal-ve-iade-politikasi$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$
- Kullanılmamış soru kredileri, satın alma tarihinden itibaren {creditRefundDays} gün içinde iade edilebilir; kullanılan krediler iade tutarından düşülür.$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$mesafeli-satis-sozlesmesi$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$
- Soru aboneliği, alıcının açık onayıyla ödeme anında ifasına başlanan bir hizmettir; Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca cayma hakkı bulunmaz ve bedeli iade edilmez. Öğretmen hizmeti veremez hâle gelirse (ör. hesabının kapanması) kalan günlerin bedeli iade edilir.$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$mesafeli-satis-sozlesmesi$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$hizmet türü (özel ders, soru çözüm, koçluk)$pk$, $pk$hizmet türü (özel ders, koçluk)$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$on-bilgilendirme-formu$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$
- Soru kredisi: paketteki soru sayısı sipariş özetinde yer alır; her soru {questionAnswerHours} saat içinde çözülür, çözülmezse kredi iade edilir.$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$on-bilgilendirme-formu$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$
- Soru aboneliği: öğretmen, kademe ve ders, {subscriptionDays} günlük dönem, günlük soru sınırı ve cevap süresi sipariş özetinde yer alır. Otomatik yenileme ve otomatik çekim yoktur.$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$on-bilgilendirme-formu$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$sitedeki sanal sınıfta yapılır, soru kredileri ödeme onayı ile hesaba tanımlanır.$pk$, $pk$sitedeki sanal sınıfta yapılır.$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$on-bilgilendirme-formu$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$
- Kullanılmamış soru kredileri: satın almadan itibaren {creditRefundDays} gün içinde iade$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$on-bilgilendirme-formu$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$
- Soru aboneliği: ödemeyle hemen başlar, cayma hakkı ve iade yoktur; öğretmen hizmeti veremez hâle gelirse kalan günlerin bedeli iade edilir$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$on-bilgilendirme-formu$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$## Soru kredileri
- Gönderdiğiniz soru {questionAnswerHours} saat içinde çözülmezse krediniz hesabınıza geri yüklenir.
- Kullanılmamış kredileriniz satın alma tarihinden itibaren {creditRefundDays} gün içinde Hesabım sayfasından iade edilebilir; kullanılan krediler düşülür.
- Krediler satın almadan itibaren {creditValidityMonths} ay geçerlidir.

$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$iptal-ve-iade-politikasi$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$## Soru aboneliği
- Abonelik ödemeyle birlikte hemen başlar; ödeme adımında onayladığınız üzere cayma hakkı ve iadesi yoktur.
- Öğretmeniniz hizmeti veremez hâle gelirse (ör. hesabının kapanması) abonelik sonlandırılır ve kalan günlerin bedeli kartınıza iade edilir.
- Abonelik kendiliğinden yenilenmez; dönem bitmeden size hatırlatma gönderilir.

$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$iptal-ve-iade-politikasi$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$## Soru aboneliği
- Abonelik ödeme onaylanınca başlar ve {subscriptionDays} gün sürer; aynı öğretmenden süren bir aboneliğiniz varsa yeni dönem onun bitişinden başlar.
- Sorularınızı Hesabım → Soru aboneliklerim sayfasından doğrudan öğretmeninize gönderirsiniz; öğretmen belirtilen cevap süresi içinde çözümü gönderir.

$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$teslimat-ve-hizmet-bilgileri$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$## Soru kredisi
- Krediler ödeme onaylanır onaylanmaz hesabınıza tanımlanır ve {creditValidityMonths} ay geçerlidir.
- Gönderdiğiniz soru {questionAnswerHours} saat içinde branş öğretmeni tarafından çözülür; çözüm Hesabım sayfasında görünür ve size bildirilir. Süresinde çözülmezse krediniz iade edilir.

$pk$, $pk$$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$teslimat-ve-hizmet-bilgileri$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$## Online özel ders, soru çözüm dersi ve koçluk$pk$, $pk$## Online özel ders ve koçluk$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$teslimat-ve-hizmet-bilgileri$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk${siteName}; özel ders, soru çözüm ve koçluk için öğrenci ve velileri öğretmenlerle buluşturur. Etüt merkezi ve dershanelere ise$pk$, $pk${siteName}; özel ders ve koçluk için öğrenci ve velileri öğretmenlerle buluşturur. Etüt merkezlerine ise$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$kullanim-sartlari$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$başvuran etüt merkezi ya da dershane ("Kurum")$pk$, $pk$başvuran etüt merkezi ("Kurum")$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$kurum-hizmet-sozlesmesi$pk$;
