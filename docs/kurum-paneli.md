# Pi Kampüs Kurum Paneli (etüt merkezi / dershane)

Etüt merkezlerine, dershanelere ve kurslara aylık abonelikle satılan yönetim paneli. Pazaryeriyle aynı uygulamada çalışır: kurumun velileri sitedeki hesaplarından çocuklarını takip eder, eksik konular için pazaryerindeki öğretmenlere yönlendirilir.

## Adresler

| Adres | Kim | Ne var |
| --- | --- | --- |
| `/kurumlar-icin` | Herkes | Tanıtım, planlar ve fiyatlar, SSS, ücretsiz deneme başvurusu |
| `/kurumlar`, `/kurumlar/<kurum>` | Herkes | Kurum rehberi, kurum vitrin sayfası ve ön kayıt formu (kurum ayarlardan açarsa) |
| `/kurum-giris` (`?kurum=<kurum>`), `kurum.<alan adı>` | Kurum personeli | Kuruma özel giriş sayfası (aynı hesaplar; kurum bağlantısında ad ve logo görünür) |
| `/kurum` | Kurum personeli | Kurum paneli |
| `/kurum-davet/<kod>` | Veli | Veli portalı davetini kabul etme |
| `/hesabim/kurum` | Veli | Veli portalı |
| `/yonetim/kurumlar`, `/yonetim/kurum-basvurulari` | Pi Kampüs yöneticisi | Kurum açma, plan/süre, abonelik ödemeleri, başvurular |
| `/api/mobil/v1/kurum/...` | Mobil uygulama (veli) | Veli portalının JSON karşılığı |

## Roller

| Rol | Görür / yapar |
| --- | --- |
| Kurum sahibi | Her şey; personel, ayarlar ve abonelik dahil. Kurumda en az bir aktif sahip kalır. |
| Müdür | Abonelik dışında her şey (kurum sahibini düzenleyemez) |
| Öğretmen | Öğrenciler (görüntüleme), sınıflar ve program, yoklama, etüt (yalnızca kendi etütleri), denemeler, rehberlik notları |
| Muhasebe / sekreter | Öğrenci kaydı, ödeme planı, tahsilat, gider, duyuru ve mesaj, ön kayıt |
| Veli | Sitedeki hesabından bağlandığı öğrencinin devam, etüt, yayınlanan deneme, eksik konu, ödeme, duyuru ve veliye açık notlarını görür |

Personel kendi giriş sayfasından girer; veliler sitenin normal girişini ve tek hesaplarını kullanır. Eksik konular için Pi Kampüs öğretmeni önerisini kurum, ayarlarından kapatabilir (kapalıyken veli portalı, karne ve mobil uygulamada öneri görünmez).

Sitede öğretmen hesabı olan biri aynı e-postayla personel olarak eklenirse kendi şifresiyle girer; öğretmen panelinde “Kurum paneli” bağlantısı çıkar. Birden çok kurumda görevli personel “Kurum değiştir” ile kurum seçer.

## Modüller

1. **Özet:** bugünkü dersler ve yoklama durumu, bugün gelmeyenler, etütler, bu ay tahsilat ve gecikenler, son denemeler, hızlı işlemler.
2. **Öğrenciler:** kayıt (öğrenci no otomatik, okul, sınıf, hedef, doğum tarihi, şifreli T.C. kimlik no, iletişim, notlar), en fazla 4 veli (WhatsApp/e-posta tercihi), sınıflar, durum (aktif / pasif / ayrıldı), Excel/CSV aktarımı (şablon indirilebilir, öğrenci no ile güncelleme, eksik sınıfları açma), CSV çıktı. Öğrenci kartı: devam oranı, borç, rehberlik/veli görüşme notları (isteğe bağlı veliye açık), veliye mesaj, veli portalı daveti (WhatsApp ile giden ya da elle paylaşılan bağlantı), devam geçmişi, etütler, net gelişim grafiği, eksik konular ve pazaryeri yönlendirmesi, ödeme planları ve tahsilatlar.
3. **Sınıflar ve ders programı:** sınıf (rehber öğretmen, derslik, kontenjan), sınıf listesi, haftalık ders saatleri (aynı sınıf/öğretmen/derslik çakışması engellenir), son 30 günün devam oranları, yazdırılabilir haftalık program (sınıfa ya da öğretmene göre).
4. **Yoklama:** programdaki her ders için gün gün liste, tek dokunuşla Geldi / Gelmedi / Geç / İzinli ve not, ek yoklama (deneme, etkinlik). İlk kez “gelmedi” işaretlenen öğrencinin velisine WhatsApp + site/uygulama bildirimi gider (aynı devamsızlık için ikinci mesaj gitmez). Devamsızlık raporu ve CSV.
5. **Etüt planı:** birebir/küçük grup etütleri; öğretmen, derslik ve öğrenci çakışma kontrolü, haftalık görünüm, katılım ve işlenen konu, gelmeyene bildirim.
6. **Ödevler:** sınıfa ya da seçilen öğrencilere ödev (ders, açıklama, teslim tarihi); veliye bildirim, teslimde öğrenci bazında Yaptı / Eksik / Yapmadı kontrolü ve not, yapmayanın velisine bildirim (bir kez). Öğrenci kartında ve veli portalında ödev geçmişi ve yapma oranı.
7. **Öğrenci soruları:** kurum öğrenci kartından öğrenciye giriş hesabı açar (kullanıcı adı + geçici şifre). Öğrenci (ya da velisi) portalda “Soru sor” ile sorunun fotoğrafını gönderir; branşı eşleşen öğretmene (yoksa yöneticilere) bildirim gider. Öğretmen çözümü yazı, fotoğraf (8 MB) ya da video (25 MB) olarak gönderir veya “yüz yüze anlatacağım” der; öğrenciye ve veliye bildirim gider. Dosyalar gizlidir: yalnızca kurum personeli ve öğrenciye bağlı hesaplar açabilir.
8. **Denemeler:** LGS, TYT, AYT (SAY/EA/SÖZ), YDT ve serbest şablonlar; yanlış götürme kuralı (3/4/yok). Sonuç girişi: tablo (öğrenci × ders D/Y, anlık net), öğrenci cevaplarıyla okuma (anahtar + iptal soru X), Excel aktarımı (öğrenci listeli şablon). Cevap anahtarı ve soru başına konu dağılımı (“1-4: Üslü ifadeler”). Analiz: katılım, ortalama/en yüksek/en düşük, ders ortalamaları ve başarı oranı, net dağılımı, konu analizi, soru analizi (doğru oranı ve en çok işaretlenen yanlış), sınıfa göre süzme, sıralama. Yazdırılabilir öğrenci karnesi (ders/konu analizi, eksikler, net gelişimi, özel ders önerisi). “Velilere yayınla” ile veliler portalda görür ve bildirim alır.
9. **Muhasebe:** öğrenci ödeme planı (toplam, tutar ya da yüzde indirim, peşinat, 1-36 taksit; taksitler tam liraya yuvarlanır), taksit düzenleme, plan iptali. Tahsilat (nakit, kart, havale): tutar en eski taksitten düşülür, sıra numaralı makbuz (yazıyla tutar, kalan borç, imza alanları, yazdır/PDF), veliye ödeme bilgisi, iptal (makbuz no korunur). Gecikenler listesi ve toplu hatırlatma; otomatik hatırlatma (vadeden N gün önce ve vade geçince bir kez). Giderler (kira, maaş, fatura, kırtasiye, reklam, vergi/SGK). Özet: sözleşme toplamı, tahsil edilen, kalan, geciken, bu ay vadesi gelen/tahsilat/gider, 12 aylık gelir-gider grafiği, dağılımlar. CSV: tahsilatlar, borç listesi, giderler.
10. **İletişim:** duyurular (tüm kurum ya da sınıf; site/uygulama bildirimi + WhatsApp, isteğe bağlı e-posta), tüm WhatsApp ve e-postaların geçmişi ve durumu (sırada / gönderildi / gönderilemedi / gönderilmedi).
11. **Ön kayıtlar:** vitrin formundan gelen ve elle eklenen adaylar (yeni / görüşüldü / kayıt oldu / vazgeçti), tek tıkla kesin kayda çevirme.
12. **Personel, ayarlar, abonelik:** personel ekleme (geçici şifre + e-postayla şifre belirleme bağlantısı), rol/görev/branş, pasife alma, şifre sıfırlama; kurum bilgileri, logo, vitrin sayfası, bildirim ayarları, tüm verileri tek Excel dosyasında indirme; plan, kullanım ve abonelik ödemeleri.

## Abonelik

- Planlar (yönetimdeki site ayarlarından değişir): Başlangıç ve Profesyonel (aylık fiyat + öğrenci sınırı), Kurumsal (teklif). Varsayılan deneme süresi 14 gün.
- Yönetici kurumu açar ya da başvurudan oluşturur; ödeme havale/EFT ile alınır, yönetici “Abonelik ödemesi kaydet” ile süreyi uzatır (süre bitmemişse bitişin üzerine eklenir).
- Süre dolunca 7 gün ek süre (uyarıyla), sonra panel salt okunur; kayıtlar silinmez. Askıya alınan kurumun personeli giriş yapamaz, vitrin ve veli portalı gizlenir.
- Bitişten 7, 3 ve 1 gün önce ve süre dolunca kurum sahiplerine (site + e-posta), 3 gün kala ve dolunca Pi Kampüs yöneticilerine bildirim gider; süre uzayınca hatırlatmalar sıfırlanır.
- Öğrenci sınırı aktif öğrenci sayısına uygulanır (ayrılan ve pasif öğrenciler sayılmaz).

## Veli iletişimi: WhatsApp

SMS yok. Velilere her şey WhatsApp (Pi Kampüs numarası, LetsBot, Meta onaylı şablon) ve site/uygulama bildirimiyle gider; e-posta yalnızca kurumun “e-postayla da gönder” seçtiği duyuru ve mesajlarda. Mesajlar genel WhatsApp kuyruğuna girer (dakikada 60, kurum mesajları 12 saat bekleyebilir), durum kurumun mesaj geçmişine eşitlenir. Kurum başına aylık WhatsApp sınırı Site ayarlarındadır (varsayılan 3000); dolunca o ay yalnızca bildirim gider, kurum yöneticilerine bir kez haber verilir. Veli WhatsApp'ı öğrenci kartından kapatılabilir; hesabı bağlı veli kendi profilinden de kapatabilir.

## Güvenlik ve KVKK

Tüm işlemler sunucuda kurum ve yetki kontrolünden geçer; kurumlar birbirinin verisini göremez. T.C. kimlik numaraları şifreli saklanır ve maskeli gösterilir. Tahsilat, iptal, personel ve ayar değişiklikleri işlem kaydına yazılır. Tahsilatı olan öğrenci silinemez (muhasebe kaydı korunur), “Ayrıldı” yapılır.

## Sonraki aşama

Online etüt (sitedeki sanal sınıfla), optik okuyucu dosyası (TXT/DAT) şablonları, pazaryerinde ücretli fotoğraflı soru çözüm, öğrenci girişi, mobil uygulamada personel ekranları, kartla abonelik ödemesi (PayTR), kuruma özel WhatsApp şablonu ve ek WhatsApp paketleri, çok şubeli kurumlar için şube yönetimi.
