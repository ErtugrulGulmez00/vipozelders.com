// Rehber yazıları (depoda tutulan kaynak). Sayfalara basmak: scripts/rehber-yazi-bas.ts
// Biçim: "## Başlık", "- madde", "> kutu", boş satırla paragraf.

export const BLOG_POSTS: { slug: string; title: string; excerpt: string; category: string; content: string }[] = [
  {
    slug: "lgs-tercihi-nasil-yapilir",
    title: "LGS tercihi nasıl yapılır? Tercih listesi hazırlarken 7 kural",
    excerpt: "LGS'de yerleşme puana ve tercih sırasına göre yapılır. Yüzdelik dilimi doğru okumak ve listeyi dengeli kurmak, istenmeyen bir okula düşme riskini azaltır.",
    category: "Veliler için",
    content: `LGS sonuçları açıklandıktan sonra pek çok ailenin aklındaki soru aynıdır: Bu puanla hangi liseye girilir ve tercihler nasıl sıralanmalı? Tercih dönemi kısa sürer; önceden plan yapmak hem çocuğun hem ailenin işini kolaylaştırır.

## Yerleştirme nasıl yapılır?

Merkezi yerleştirmede öğrenciler puan üstünlüğüne ve tercih sırasına göre yerleştirilir. Yani öğrenci, listesinde yerleşebildiği ilk okula yerleşir; listede daha aşağıdaki okullar artık dikkate alınmaz. Bu yüzden sıralama, hangi okulları yazdığınız kadar önemlidir.

Sınavla öğrenci alan liseler için yapılacak tercih sayısı sınırlıdır ve adrese dayalı yerel yerleştirme tercihleri ayrıca yapılır. Kuralları her yıl yayımlanan MEB tercih kılavuzundan mutlaka kontrol edin.

## 1. Puana değil yüzdelik dilime bakın

Puanlar sınavın o yılki zorluğuna göre değişir. Yüzdelik dilim ise öğrencinin Türkiye genelindeki yerini gösterdiği için yıldan yıla daha kararlıdır. Bir okulun geçen yılki yüzdelik dilimi, bu yıl için daha güvenilir bir ölçüdür.

## 2. Listeyi üç parçalı kurun

- Başa: en çok istenen ama biraz iddialı okullar
- Ortaya: yüzdelik dilime uygun okullar
- Sona: yerleşme ihtimali yüksek, güvenli okullar

Listede hiç güvenli tercih yoksa merkezi yerleştirmede hiçbir yere yerleşmeme riski artar.

## 3. Okul türünü bilerek seçin

Fen liseleri, sosyal bilimler liseleri, Anadolu liseleri, Anadolu imam hatip liseleri ve meslek liselerinin ders yükleri ve hedefledikleri öğrenci profili farklıdır. Çocuğun ilgisine uymayan bir okula sırf puanı yüksek diye yazmak ileride motivasyon sorununa dönüşebilir.

## 4. Ulaşımı ve pansiyonu hesaba katın

Her gün iki saat yolda geçecekse o okul gerçekten avantaj mı? Başka ildeki okullar için pansiyon olup olmadığını kontrol edin.

## 5. Hazırlık sınıfı ve yabancı dil

Bazı okullarda yabancı dil hazırlık sınıfı vardır; öğrenim süresi uzar. Okulun hangi dili öğrettiğini de not edin.

## 6. Geçen yılın tabanı bu yılın garantisi değildir

Kontenjan ve aday sayısı her yıl değişir. Tabana çok yakın okulları "güvenli" saymayın.

## 7. Kararı çocuğunuzla birlikte verin

Liste çocuğun dört yılını belirler. Okul ziyaretleri, okulun sosyal imkânları ve çocuğun isteği en az puan kadar önemlidir.

> Pi Kampüs LGS tercih robotunda yüzdelik diliminizi ya da puanınızı girerek liseleri güvenli, uygun ve riskli diye ayırabilirsiniz: pikampus.com/tercih-robotu/lgs`,
  },
  {
    slug: "yks-tercih-listesi-nasil-hazirlanir",
    title: "YKS tercih listesi nasıl hazırlanır? 24 tercihi doğru sıralamak",
    excerpt: "YKS'de aday, listesinde yerleşebildiği ilk programa yerleşir. Başarı sırasını esas almak ve listeye güvenli tercihler koymak boşta kalma riskini azaltır.",
    category: "Öğrenciler için",
    content: `YKS sonuçları geldiğinde asıl iş başlar: Hangi bölüm, hangi üniversite ve hangi sırayla? Tercih listesinde yapılan bir sıralama hatası, puanı yetse bile istenmeyen bir programa yerleşmeye ya da hiç yerleşememeye yol açabilir.

## Yerleştirme nasıl işler?

ÖSYM yerleştirmede adayın puanını ve tercih sırasını esas alır. Aday, listesindeki programlardan puanının yettiği ilk programa yerleşir; o programdan sonraki tercihler dikkate alınmaz. Bu yüzden listeyi gerçekten istediğiniz sırayla yazmalısınız. En fazla 24 program tercih edilebilir.

## Puan değil, başarı sırası

Puanlar her yıl sınavın zorluğuna göre değişir; bir programın tabanı geçen yıl 450 iken bu yıl 440 olabilir. Başarı sırası ise adayın kendi puan türündeki yerini gösterir ve yıldan yıla daha kararlıdır. Programları karşılaştırırken geçen yılın taban başarı sırasını esas alın.

## Listeyi dört gruba ayırın

- Hayal tercihleri: başarı sıranızın biraz üstündeki programlar (listenin başı)
- Uygun tercihler: sıranıza yakın programlar
- Güvenli tercihler: sıranızın rahatça yettiği programlar
- Son güvence: gerçekten okumayı kabul edeceğiniz, sıranızın çok rahat yettiği birkaç program

Hayal tercihleri listenin başında durduğu sürece size bir şey kaybettirmez; çünkü yerleşemezseniz sıradaki tercihe geçilir.

## Bölüm mü, üniversite mi?

Önce meslek ve bölüm kararını verin. Aynı bölümün farklı üniversitelerdeki imkânlarını, öğretim dilini, şehirde yaşam maliyetini ve burs durumunu karşılaştırın. Vakıf üniversitelerinde burslu, indirimli ve ücretli kontenjanlar ayrı programlar olarak tercih edilir.

## Yapılan yaygın hatalar

- Okumak istemediği bir programı "nasılsa gelmez" diye listeye yazmak
- Bütün tercihleri tabana çok yakın programlardan seçmek
- Tek bir şehre ya da tek bir üniversiteye sıkışmak
- Kılavuzdaki özel koşulları (sağlık şartı, yetenek sınavı, yabancı dil) okumamak

## Son kontrol

Tercihleri onaylamadan önce ÖSYM tercih kılavuzundaki program kodlarını ve koşulları bir kez daha kontrol edin.

> Pi Kampüs YKS tercih robotunda başarı sıranızı ya da puanınızı girerek programları güvenli, uygun ve riskli diye ayırabilirsiniz: pikampus.com/tercih-robotu/yks`,
  },
  {
    slug: "etut-merkezi-yazilimi-nasil-secilir",
    title: "Etüt merkezi yazılımı nasıl seçilir? Karar vermeden önce sorulacak 8 soru",
    excerpt: "Yoklama, veli iletişimi, deneme analizi ve tahsilatı tek yerde toplayan bir yazılım zaman kazandırır. Seçmeden önce bu sekiz soruyu sorun.",
    category: "Kurumlar için",
    content: `Etüt merkezlerinin çoğu işe Excel, kâğıt yoklama listeleri ve WhatsApp gruplarıyla başlar. Öğrenci sayısı arttıkça bu düzen zorlaşır: devamsızlık geç fark edilir, ödemeler karışır, veliler aynı soruyu tekrar tekrar sorar. Bir kurum yazılımına geçmeden önce aşağıdaki soruları sorun.

## 1. Kurulum ne kadar sürer?

Öğrenci listenizi Excel'den aktarabiliyor musunuz? Kurulum günler sürüyorsa ve personelin eğitim alması gerekiyorsa sistem günlük işe girmekte zorlanır.

## 2. Yoklama telefondan alınabiliyor mu?

Öğretmen yoklamayı sınıfta telefondan birkaç dokunuşla alabilmeli; gelmeyen öğrencinin velisine bildirim kendiliğinden gitmeli.

## 3. Veli ne görüyor?

Veliler devamsızlığı, etüt programını, deneme sonuçlarını ve ödeme planını kendi hesaplarından görebiliyorsa telefon trafiği belirgin şekilde azalır.

## 4. Deneme sonuçları nasıl giriliyor?

Her öğrencinin netini tek tek girmek saatler alır. Yayınevinin sonuç dosyasını yükleyip otomatik aktarabilmek büyük zaman kazandırır. Konu bazında eksik analizi de öğretmenin işini kolaylaştırır.

## 5. Tahsilat ve makbuz

Taksit planı, geciken ödemeler için hatırlatma ve makbuz çıktısı aynı sistemde mi? Ön muhasebeyi ayrı bir programda tutmak hata riskini artırır.

## 6. Yetkiler

Müdür, öğretmen ve muhasebe aynı ekranları görmemeli. Her personelin yalnızca kendi işine ait bölümleri görebilmesi hem düzen hem veri güvenliği için önemlidir.

## 7. Veri güvenliği ve KVKK

Veriler nerede tutuluyor, yedekleniyor mu, şifreli mi? Öğrenci ve veli verileri için veri sorumlusu kurumdur; yazılım sağlayıcısının veri işleyen olarak hangi önlemleri aldığını sorun.

## 8. Fiyat neye göre belirleniyor?

Öğrenci sayısına göre mi, personel sayısına göre mi? Deneme süresi var mı, kart bilgisi isteniyor mu? Abonelik bitince verilerinize ne oluyor?

> Pi Kampüs kurum paneli yoklama, veli portalı, deneme analizi, tahsilat ve LGS/YKS tercih robotunu tek panelde sunar: pikampus.com/kurumlar-icin`,
  },
  {
    slug: "ogrenci-koclugu-nedir",
    title: "Öğrenci koçluğu nedir? Koç öğrenciyi haftalık nasıl takip eder?",
    excerpt: "Öğrenci koçu ders anlatmaz; hedef koyar, program yapar ve haftalık görüşmelerle öğrencinin düzenli çalışmasını sağlar. İyi bir koçluk sürecinin parçaları.",
    category: "Koçlar için",
    content: `Öğrenci koçluğu, özellikle LGS ve YKS'ye hazırlanan öğrenciler arasında hızla yaygınlaştı. Koç, öğretmen gibi konu anlatmaz; öğrencinin neyi, ne zaman ve ne kadar çalışacağını planlar, ilerlemeyi ölçer ve motivasyonu canlı tutar.

## Koç ne yapar?

- Hedef belirler: hedef okul ya da bölüm ve bunun için gereken net
- Haftalık program yazar: hangi gün hangi ders, hangi kaynak, kaç soru
- Takip eder: çözülen soru, doğruluk oranı, deneme netleri
- Haftalık görüşme yapar: neyin iyi gittiğini, neyin aksadığını konuşur
- Veliyi bilgilendirir: düzenli ve sakin bir dille durum raporu verir

## Haftalık döngü

İyi işleyen bir koçluk süreci her hafta aynı döngüyü izler:

- Pazartesi: yeni haftanın programı öğrenciye iletilir
- Hafta içi: öğrenci çözdüğü soruları ve çalışma süresini kaydeder
- Hafta sonu: deneme çözülür, sonuçlar girilir
- Görüşme günü: koç verilere bakar, programı günceller, öncelikli konuları belirler

## Veriye dayalı koçluk

"Bu hafta çok çalıştım" ile "bu hafta 420 soru çözdüm, matematikte doğruluk yüzde 62'den yüzde 71'e çıktı" arasında büyük fark vardır. Sayılar hem öğrenciye hem veliye somut bir tablo sunar ve koçun kararlarını doğru konuya yönlendirir.

## Konu eksiklerini yakalamak

Deneme sonuçlarındaki yanlışlar ve kaynak kitaplardaki konu ilerlemesi birlikte değerlendirildiğinde öğrencinin zayıf konuları netleşir. Bu konular programa tekrar olarak eklenir.

## Veli iletişimi

Veliler çoğu zaman yalnızca deneme netini görür. Haftalık kısa bir rapor; çalışma düzenini, programa uyumu ve koçun değerlendirmesini göstererek gereksiz kaygıyı azaltır.

## Kaç öğrenciyle çalışılır?

Bireysel koçların çoğu her öğrenciyle haftada bir görüşme yapar. Öğrenci sayısı arttıkça takip yükü de artar; bu noktada program, soru ve deneme takibini tek yerde toplayan bir panel zaman kazandırır.

> Pi Koç; haftalık program, soru ve deneme takibi, görüşme notları, veli raporu ve hedef okul takibini tek panelde toplar. 3 öğrenciye kadar ücretsizdir: pikampus.com/pi-koc`,
  },
];
