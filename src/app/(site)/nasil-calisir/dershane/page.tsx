import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { TierCards } from "@/components/center/pricing";
import {
  BrowserShot,
  Feature,
  Figure,
  Gallery,
  GuideNav,
  GuideSection,
  GuideSwitcher,
  GuideVideo,
  Note,
  Pair,
  Phone,
  PhoneImage,
  Phones,
  type Shot,
  Tip,
} from "@/components/site/guide";
import { GuideZoom } from "@/components/site/guide-zoom";
import { buttonClasses } from "@/components/ui/button";
import { centerPlans } from "@/server/center/plans";
import { getSiteSettings } from "@/server/site";

export const metadata: Metadata = {
  title: "Dershane paneli nasıl çalışır? Ekran ekran rehber",
  description: "Sınıflar ve haftalık ders programı, sınıf yoklaması, sınıf defteri, derslikler ve kurum raporları: Dershane paketini gerçek ekranlar ve videolarla tanıyın.",
};

const BASE = "/tanitim/dershane";
const shot = (file: string, url: string, alt: string, width: number, height: number, tall?: boolean): Shot => ({ src: `${BASE}/${file}.jpg`, url, alt, width, height, tall });
const video = (file: string) => `${BASE}/video/${file}.mp4`;
const img = (file: string) => `${BASE}/${file}.jpg`;
const ETUT = "/nasil-calisir/etut-merkezi";

const NAV: [string, string][] = [
  ["neden", "Neden"],
  ["kapsam", "Kapsam"],
  ["siniflar", "Sınıflar"],
  ["program", "Program"],
  ["yoklama", "Yoklama"],
  ["defter", "Sınıf defteri"],
  ["derslik", "Derslikler"],
  ["rapor", "Raporlar"],
  ["veli", "Veli"],
  ["ortak", "Ortak bölümler"],
  ["fiyat", "Fiyat"],
  ["baslangic", "Başlangıç"],
];

const VS = [
  ["Ders programı Excel'de; her değişiklik öğretmene ve veliye ayrı ayrı iletiliyor", "Haftalık program tek yerde; öğretmen, öğrenci ve veli güncel hâlini kendi ekranında görür"],
  ["Aynı öğretmene ya da dersliğe iki ders yazıldığı ders başlayınca anlaşılıyor", "Öğretmen, sınıf ve derslik çakışması ders saati kaydedilirken engellenir"],
  ["Yoklama kâğıtta; gelmeyenin velisi akşam tek tek aranıyor", "Öğretmen yoklamayı telefondan alır; gelmeyenin velisine bildirim kendiliğinden gider"],
  ["Hangi sınıfın hangi konuda kaldığını öğretmene sormak gerekiyor", "Sınıf defteri: her derste işlenen konu yoklamayla birlikte kaydedilir"],
  ["Derslik doluluğu ve kapasite akılda tutuluyor", "Derslik başına haftalık doluluk; sınıf mevcudu kapasiteyi aşınca uyarı"],
  ["Sınıfların durumu dönem sonunda dosyalardan derleniyor", "Kurum → sınıf → öğrenci raporu: devam, ödev, deneme ve geciken ödeme tek tabloda"],
];

const DAY = [
  ["08:45", "Müdür özet ekranını açar: bugün kaç ders var, hangisinin yoklaması bekliyor, kim gelmedi."],
  ["16:00", "8-A'nın matematik dersi başlar; öğretmen yoklamayı telefonundan alır, işlenen konuyu yazar."],
  ["16:01", "Gelmeyen öğrencinin velisine e-posta ve site bildirimi gider."],
  ["17:30", "Koordinatör sınıf defterinden 8-A ile 8-B'nin aynı konuda olup olmadığına bakar."],
  ["19:00", "Veli telefonundan günün derslerini, işlenen konuları ve yoklamayı görür."],
  ["Ay sonu", "Müdür raporlardan devamı düşen sınıfı ve öğrenciyi bulur, rehber öğretmenle görüşme planlar."],
];

const EXTRAS = [
  ["siniflar", "Sınıflar ve haftalık ders programı", "Ders saatleri bir kez girilir; program, yoklama ve derslikler buradan dolar."],
  ["yoklama", "Sınıf yoklaması", "Programdaki her ders için tek dokunuşla yoklama, gelmeyenin velisine bildirim."],
  ["defter", "Sınıf defteri", "Her derste işlenen konu; hangi sınıfın nerede kaldığı tek listede."],
  ["derslik", "Derslikler", "Haftalık doluluk, kapasite ve çakışma uyarıları."],
  ["rapor", "Kurum raporları", "Kurumdan sınıfa, sınıftan öğrenciye devam, ödev, deneme ve ödeme."],
];

const ROLES = [
  ["Kurum sahibi / müdür", "Sınıfları ve ders programını kurar; bütün yoklamaları, sınıf defterini, derslikleri ve raporları görür. Müdür abonelik dışında her şeye erişir."],
  ["Öğretmen", "Ders programı kendi dersleriyle açılır. Yoklama alır, işlenen konuyu yazar; sınıf defterinde kendi derslerini görür. Sınıf ve ders saati düzenleyemez, kurum raporlarını göremez."],
  ["Muhasebe / sekreter", "Ders programını, sınıf defterini ve derslikleri görür; yoklama almaz. Tahsilat ve kayıt işleri Etüt Merkezi paketindekiyle aynıdır."],
  ["Veli ve öğrenci", "Portalda ders programını, ders ders yoklamayı ve işlenen konuları görür."],
];

const SHARED = [
  ["ogrenci", "Öğrenci ve veli kaydı", "Tek öğrenci kartı, Excel'den aktarım", "03-ogrenciler"],
  ["etut", "Etüt planı ve yoklama", "Birebir ve küçük grup etütleri", "08-etut-plani"],
  ["odev", "Ödevler", "Ödev verme ve teslim kontrolü", "10-odevler"],
  ["takip", "Koçluk ve çalışma salonu", "Koç görüşmeleri, salon yoklaması, kaynaklar", "12-kocluk"],
  ["deneme", "Denemeler", "Optik okuma, konu analizi, karne", "16-deneme-analiz"],
  ["soru", "Fotoğrafla soru", "Öğrenci sorar, branş öğretmeni çözer", "29b-soru-cevap"],
  ["muhasebe", "Muhasebe", "Taksit, tahsilat, makbuz, gider", "19-muhasebe"],
  ["iletisim", "Duyuru ve bildirimler", "E-posta ve site bildirimi, mesaj geçmişi", "23-duyurular"],
  ["yonetim", "Ön kayıt, personel, ayarlar", "Vitrin sayfası, roller, modüller", "26-personel"],
];

export default async function DershaneGuidePage() {
  const settings = await getSiteSettings();
  const plans = centerPlans(settings, "DERSHANE");
  const trial = settings.centerTrialDays;
  const applyHref = "/kurumlar-icin?paket=DERSHANE#basvuru";

  const faq = [
    ["Etüt Merkezi paketinden Dershane'ye geçebilir miyim?", "Evet. Kayıtlarınız olduğu gibi kalır; sınıf programı, yoklama, sınıf defteri, derslikler ve raporlar menüye eklenir. Etüt Merkezi paketine dönerseniz bu bölümler gizlenir, kayıtları silinmez."],
    ["Ders programı dönem ortasında değişirse ne olur?", "Ders saatini programdan çıkarıp yenisini eklersiniz. Geçmiş yoklamalar ve sınıf defteri kayıtları silinmez."],
    ["Programda olmayan bir ders ya da deneme için yoklama alabilir miyim?", "Evet. Yoklama ekranındaki \"Ek yoklama\" formuyla sınıfı, saati ve dersi yazıp yoklama listesini açarsınız."],
    ["Yerine derse giren öğretmen yoklama alabilir mi?", "Evet. Öğretmenler yoklama ekranında günün bütün derslerini görür; \"Yalnız benim derslerim\" süzgeciyle kendi derslerine iner."],
    ["Telefondan kullanılır mı?", "Evet. Panel ve veli portalı telefon tarayıcısında çalışır; öğretmen yoklamayı telefondan alır, veli bildirimleri telefonda görür."],
    ["Velilere bildirim nasıl gidiyor?", "Şu an e-posta ve site bildirimiyle. WhatsApp bildirimleri Meta onayından sonra açılacak; kurumunuzun ek bir şey yapması gerekmeyecek."],
    [
      trial > 0 ? "Ücretsiz deneme bitince ne olur?" : "Abonelik bitince ne olur?",
      "Kayıtlarınız silinmez. Aboneliği başlatınca kaldığınız yerden devam edersiniz; başlatmazsanız panel salt okunur olur. Ödeme havale / EFT ile alınır.",
    ],
  ];

  return (
    <>
      <GuideSwitcher active="dershane" />
      <GuideNav items={NAV} />
      <GuideZoom />

      <section className="overflow-hidden bg-ink-900 pt-14 text-ink-50">
        <div className="mx-auto grid max-w-6xl gap-9 px-4">
          <div>
            <p className="text-xs font-bold tracking-[0.12em] text-gold-400 uppercase">Dershane paketi · Tanıtım ve kullanım rehberi</p>
            <h1 className="mt-3.5 max-w-[16ch] text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Dershanenizi sınıf sınıf, <span className="text-gold-400">ders ders</span> yönetin.
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-ink-200">
              Dershane paketi, Etüt Merkezi paketindeki her şeye sınıf bazlı yönetimi ekler: haftalık ders programı, sınıf yoklaması, sınıf defteri, derslikler ve kurum raporları. Bu rehber, Dershane&apos;ye özel ekranları tek tek ve videolarla anlatır.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {[["Etüt Merkezi'ndeki", "her şey dahil"], ["Sınırsız", "personel hesabı"], ...(trial > 0 ? [[`${trial} gün`, "ücretsiz deneme"]] : []), ["Kurulumu", "birlikte yapıyoruz"]].map(([b, t]) => (
                <span key={t} className="rounded-full border border-white/20 px-3.5 py-1.5 text-sm">
                  <b className="text-gold-400">{b}</b> {t}
                </span>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#program" className={buttonClasses("primary", "lg")}>
                Videolu tura başla
              </a>
              <Link href={applyHref} className={buttonClasses("outline", "lg", "border-white/30 bg-transparent text-white hover:bg-white/10")}>
                {trial > 0 ? `${trial} gün ücretsiz deneyin` : "Başvurun"}
              </Link>
            </div>
          </div>
          <div className="translate-y-6">
            <BrowserShot shot={shot("01-ozet", "pikampus.com/kurum", "Dershane özet ekranı: bugünkü dersler ve yoklama durumu, gelmeyenler, tahsilat", 1440, 960)} sizes="(min-width: 1152px) 1120px, 100vw" />
          </div>
        </div>
      </section>

      <GuideSection
        id="neden"
        eyebrow="Neden Pi Kampüs"
        title="Tahta, kâğıt yoklama ve Excel programın yerine tek bir düzen"
        lead="Dershanede iş sınıfların etrafında döner: hangi sınıf hangi derste, kim geldi, hangi konu işlendi. Pi Kampüs bunları ders saati ve yoklamadan kendiliğinden toplar."
        className="border-t-0 pt-24"
      >
        <div className="mt-8 overflow-hidden rounded-2xl border border-ink-100 bg-white">
          <div className="grid grid-cols-2 border-b border-ink-100 bg-ink-50 text-xs font-bold tracking-[0.08em] uppercase">
            <div className="border-r border-ink-100 px-4 py-3.5 text-ink-500">Bugün</div>
            <div className="px-4 py-3.5 text-brand-600">Pi Kampüs ile</div>
          </div>
          {VS.map(([before, after]) => (
            <div key={before} className="grid grid-cols-2 border-b border-ink-100 text-[15.5px] last:border-b-0">
              <div className="border-r border-ink-100 px-4 py-3.5 text-ink-500">{before}</div>
              <div className="px-4 py-3.5">{after}</div>
            </div>
          ))}
        </div>

        <div className="mt-14 grid items-start gap-6 lg:grid-cols-[1.65fr_1fr]">
          <div className="grid gap-3">
            <p className="text-xs font-bold tracking-[0.12em] text-brand-600 uppercase">Bir günün akışı</p>
            <h3 className="text-[22px] font-bold">Ders saati bir kez girilir, gerisi akar</h3>
            <Note>Aşağıdaki akışın her adımı rehberde ayrıca gösteriliyor.</Note>
          </div>
          <div className="ml-2 border-l-[3px] border-brand-600">
            {DAY.map(([time, text]) => (
              <div key={time} className="relative grid gap-0.5 pb-5 pl-6 last:pb-0">
                <span className="absolute top-1.5 -left-[9px] size-[15px] rounded-full border-[3px] border-brand-600 bg-white" />
                <time className="font-display text-[15px] font-extrabold text-brand-600 tabular-nums">{time}</time>
                <p className="text-[15.5px]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </GuideSection>

      <GuideSection
        id="kapsam"
        eyebrow="Paket kapsamı"
        title="Etüt Merkezi'ndeki her şey, artı sınıf yönetimi"
        lead={
          <>
            Öğrenci ve veli kaydı, etüt, ödev, koçluk, deneme analizi, fotoğrafla soru, muhasebe ve veli portalı iki pakette aynıdır; bunlar{" "}
            <Link href={ETUT} className="font-semibold text-brand-700 underline">
              Etüt merkezi rehberinde
            </Link>{" "}
            anlatılıyor. Bu rehber Dershane&apos;ye özel beş bölümü gösterir.
          </>
        }
      >
        <div className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
          {EXTRAS.map(([id, title, text], i) => (
            <a key={id} href={`#${id}`} className="grid content-start gap-2 rounded-2xl border border-ink-100 bg-white p-5 transition-colors hover:border-brand-300">
              <span className="font-display text-3xl leading-none font-extrabold text-brand-600">{i + 1}</span>
              <h3 className="text-[18px] font-bold">{title}</h3>
              <p className="text-[15px] text-ink-500">{text}</p>
            </a>
          ))}
        </div>

        <div className="mt-10 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
          <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
            <thead>
              <tr className="bg-ink-50 text-xs tracking-[0.08em] text-ink-500 uppercase">
                <th className="border-b border-ink-100 px-4 py-3">Kim</th>
                <th className="border-b border-ink-100 px-4 py-3">Dershane bölümlerinde ne görür, ne yapar</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map(([who, what]) => (
                <tr key={who} className="align-top">
                  <td className="border-b border-ink-100 px-4 py-3 font-bold whitespace-nowrap">{who}</td>
                  <td className="border-b border-ink-100 px-4 py-3">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note className="mt-5">
          Giriş adresi herkes için aynıdır:{" "}
          <Link href="/kurum-giris" className="font-semibold text-brand-700 underline">
            pikampus.com/kurum-giris
          </Link>
          . Personel, öğrenci ve veli hesaplarının nasıl açıldığı{" "}
          <Link href={`${ETUT}#giris`} className="font-semibold text-brand-700 underline">
            Etüt merkezi rehberinde
          </Link>
          .
        </Note>
      </GuideSection>

      <GuideSection id="siniflar" eyebrow="Sınıflar" title="Her sınıfın öğrencileri, rehberi ve ders saatleri bir arada" lead="Sınıfı açın, öğrencileri işaretleyin, haftalık ders saatlerini girin. Sınıfın devam oranı aynı sayfada görünür.">
        <Feature
          shot={shot("02-siniflar", "pikampus.com/kurum/siniflar", "Sınıf listesi", 1440, 620)}
          title="Sınıf listesi"
          legend={[
            ["Sınıf kartı:", "seviye, hedef sınav, derslik ve rehber öğretmen."],
            ["Mevcut / kontenjan.", "Kontenjan dolunca sınıfa öğrenci eklenemez."],
            ["Haftalık ders sayısı", "ve dersin olduğu günler."],
            ["Yeni sınıf:", "ad, rehber öğretmen, seviye, hedef, derslik ve kontenjan."],
          ]}
        />
        <Feature
          flip
          shot={shot("03-sinif", "pikampus.com/kurum/siniflar/…", "Sınıf sayfası: öğrenciler ve haftalık program", 1440, 1090, true)}
          title="Sınıf sayfası"
          legend={[
            ["Öğrenciler", "ve son 30 günün devam oranı."],
            ["Haftalık program:", "ders, öğretmen ve derslik."],
            ["Ders saati ekle:", "gün, saat, ders, öğretmen, derslik. O saatte öğretmen, sınıf ya da derslik doluysa kaydedilmez."],
            ["Yoklama:", "bu sınıfın günlük yoklama ekranı."],
          ]}
        >
          <Note>Sınıf listesi aynı sayfada işaretlenerek düzenlenir; bir öğrenci birden fazla sınıfta olabilir. Yoklama geçmişi olan sınıf silinmez, arşive alınır.</Note>
        </Feature>
      </GuideSection>

      <GuideSection id="program" eyebrow="Haftalık ders programı" title="Bütün sınıfların haftası tek tabloda" lead="Sınıf sayfalarında girilen ders saatleri haftalık programda toplanır. Sınıfa ya da öğretmene göre süzün, yazdırıp panoya asın.">
        <Feature
          shot={shot("04-program", "pikampus.com/kurum/program", "Haftalık ders programı", 1440, 940)}
          legend={[
            ["Sınıf süzgeci.", ""],
            ["Öğretmen süzgeci.", "Öğretmen kendi hesabıyla girince program kendi dersleriyle açılır."],
            ["Yazdır / PDF.", ""],
            ["Ders kartı:", "saat, ders, sınıf, öğretmen ve derslik. Her sınıf kendi renginde."],
          ]}
        />
        <Pair>
          <GuideVideo src={video("v1-sinif-program")} poster={img("04-program")} title="Ders saati ekleme ve haftalık program" seconds={42} />
          <Figure shot={shot("04b-program-ogretmen", "Öğretmenin haftası", "Bir öğretmenin haftalık ders programı", 1180, 900)}>
            <b>Öğretmenin haftası:</b> süzgeçten öğretmeni seçin; hangi gün hangi sınıfta, hangi derslikte olduğu tek bakışta görünür.
          </Figure>
        </Pair>
        <div className="mt-6">
          <Tip title="Videoda dikkat edin:">öğretmen o saatte başka sınıfta derste olduğu için ders saati kaydedilmez; saat değiştirilince programa eklenir.</Tip>
        </div>
      </GuideSection>

      <GuideSection id="yoklama" eyebrow="Sınıf yoklaması" title="Ders biter, yoklama birkaç saniye sürer" lead="Programdaki dersler yoklama ekranına kendiliğinden düşer. Öğretmen hepsini &quot;geldi&quot; yapar, gelmeyeni işaretler; velisine bildirim gider.">
        <Feature
          shot={shot("05-yoklama", "pikampus.com/kurum/yoklama", "Günün dersleri ve yoklama durumu", 1440, 820)}
          title="Günün dersleri"
          legend={[
            ["Gün seçimi:", "önceki ve sonraki günler."],
            ["Yoklaması alınmış ders:", "geldi, gelmedi, geç ve izinli sayıları."],
            ["Yoklama al:", "henüz yoklaması alınmamış ders."],
            ["Ek yoklama:", "programda olmayan bir ders, deneme ya da etkinlik için."],
            ["Devamsızlık raporu.", ""],
          ]}
        />
        <Feature
          flip
          shot={shot("06-yoklama-al", "pikampus.com/kurum/yoklama/al", "Sınıf yoklaması ve sınıf defteri alanı", 1440, 1304, true)}
          title="Yoklama listesi"
          legend={[
            ["Anlık sayım.", ""],
            ["Hepsini \"Geldi\" yap,", "sonra istisnaları değiştirin."],
            ["Sınıf defteri:", "bu derste işlenen konu. Veli portalında da görünür."],
            ["Gelmedi işaretlenen öğrenci.", "\"Veliye bildirildi\" mesajın gittiğini gösterir; \"Not ekle\" ile açıklama yazılır (ör. doktor raporu)."],
            ["Gelmeyenin velisine e-posta ve site bildirimi,", "her öğrenci için bir kez."],
            ["Yoklamayı kaydet.", "Sonradan düzeltilebilir; aynı devamsızlık için ikinci mesaj gitmez."],
          ]}
        />
        <Pair>
          <GuideVideo src={video("v2-yoklama")} poster={img("05-yoklama")} title="Yoklama ve sınıf defteri" seconds={38} />
          <Phones className="mt-0 lg:justify-start">
            <Phone caption="Öğretmen yoklamayı telefonundan alır; uygulama indirmek gerekmez.">
              <PhoneImage src={img("t4-yoklama-telefon")} alt="Telefonda sınıf yoklaması" width={780} height={3000} />
            </Phone>
          </Phones>
        </Pair>
        <Feature
          className="mt-14"
          shot={shot("07-devamsizlik", "pikampus.com/kurum/yoklama/rapor", "Devamsızlık raporu", 1440, 800)}
          title="Devamsızlık raporu"
          legend={[
            ["Tarih aralığı ve sınıf.", ""],
            ["CSV çıktısı:", "özet ya da bütün yoklama kayıtları."],
            ["Toplam devamsızlık", "ve oranı."],
            ["En çok devamsızlık yapan en üstte:", "ders, gelmedi, geç, izinli ve devam oranı."],
          ]}
        />
      </GuideSection>

      <GuideSection id="defter" eyebrow="Sınıf defteri" title="Hangi sınıf hangi konuda, tek listede" lead="Yoklamada yazılan konular sınıf defterini oluşturur. Ayrı bir defter tutmaya gerek kalmaz; konusu girilmemiş dersler de listelenir.">
        <Feature
          shot={shot("08-sinif-defteri", "pikampus.com/kurum/sinif-defteri", "Sınıf defteri", 1440, 820)}
          legend={[
            ["Süzgeç:", "sınıf, ders ve başlangıç tarihi."],
            ["Konusu girilmemiş", "ders sayısı."],
            ["İşlenen konu:", "yoklamada yazılan."],
            ["Devam:", "tam katılım ya da kaç öğrencinin gelmediği."],
          ]}
        />
        <Pair>
          <Figure shot={shot("08b-sinif-defteri-sinif", "Sınıf defteri · 8-B LGS", "Bir sınıfın sınıf defteri", 1180, 998, true)}>
            <b>Sınıfa göre süzünce</b> sınıfın konu konu ilerleyişi çıkar. Konusu girilmemiş derste ① &quot;Konu gir&quot; bağlantısı o dersin yoklamasını açar.
          </Figure>
          <div className="grid content-start gap-4">
            <Tip title="Paralel sınıflar:">8-A ve 8-B&apos;nin aynı konuda olup olmadığını iki süzgeçle karşılaştırın; geride kalan sınıfa ek ders planlayın.</Tip>
            <Note>Öğretmen sınıf defterinde yalnız kendi derslerini görür; müdür bütün sınıfları izler. İşlenen konular veli portalındaki ders yoklamalarında da yazar.</Note>
          </div>
        </Pair>
      </GuideSection>

      <GuideSection id="derslik" eyebrow="Derslikler" title="Derslik doluluğu ve kapasite tek bakışta" lead="Derslikler, sınıfın ya da ders saatinin &quot;derslik&quot; alanına yazılan adla eşleşir. Her dersliğin haftalık programı, doluluğu ve kapasite uyarıları burada.">
        <Feature
          shot={shot("09-derslikler", "pikampus.com/kurum/derslikler", "Derslikler", 1440, 1100, true)}
          legend={[
            ["Yeni derslik:", "ad, kapasite ve not."],
            ["Haftalık doluluk:", "dersliğin haftada kaç saat dolu olduğu."],
            ["Kapasite aşımı:", "sınıf mevcudu derslik kapasitesini geçiyor."],
            ["Kapasiteyi aşan dersler", "kırmızı görünür."],
          ]}
        >
          <Note>Programda geçip kayıtlı olmayan derslikler &quot;Kayıtlı değil&quot; etiketiyle listelenir. Aynı saatte aynı dersliğe düşen dersler sayfanın üstünde uyarı olarak çıkar.</Note>
        </Feature>
      </GuideSection>

      <GuideSection id="rapor" eyebrow="Kurum raporları" title="Kurumdan sınıfa, sınıftan öğrenciye" lead="Seçtiğiniz dönemin devam ve ödev oranı, son deneme ortalaması ve geciken ödemeler önce kurum geneli, sonra sınıf, sonra öğrenci bazında. Raporları kurum sahibi ve müdür görür.">
        <Feature
          shot={shot("10-raporlar", "pikampus.com/kurum/raporlar", "Kurum raporu", 1440, 720)}
          legend={[
            ["Dönem:", "başlangıç ve bitiş tarihi."],
            ["Devam oranı", "ve devamsızlık sayısı."],
            ["Son deneme", "ortalama neti."],
            ["Sınıf satırı:", "tıklayınca öğrenci bazında rapor açılır."],
          ]}
        />
        <Gallery
          items={[
            { shot: shot("11-rapor-sinif", "Rapor · 8-A LGS", "Sınıf raporu", 1180, 1000), caption: "Sınıf raporu: öğrenci öğrenci devam, devamsızlık, ödev, son net ve geciken ödeme. ① Kurum geneline dönüş, ② öğrenci kartına geçiş." },
            { shot: shot("12-ogrenci-devam", "Öğrenci kartı · Devam ve ödev", "Öğrenci kartında ders yoklamaları", 1180, 1100), caption: "Öğrenci kartı: ders ders yoklama ve işlenen konular; veliyle görüşmeden önce açın." },
          ]}
        />
        <div className="mt-8">
          <GuideVideo src={video("v3-raporlar")} poster={img("10-raporlar")} title="Kurum, sınıf ve öğrenci raporu" seconds={23} />
        </div>
        <Note className="mt-5">Geciken ödeme bugünkü duruma göredir; diğer ölçüler seçilen dönemi kapsar.</Note>
      </GuideSection>

      <GuideSection id="veli" eyebrow="Veli ve öğrenci" title="Veli dersleri telefonundan takip eder" lead="Veli portalı telefon tarayıcısında uygulama gibi çalışır, bir şey indirmek gerekmez. Dershane paketinde veli, ders programını ve ders ders yoklamayı işlenen konularla birlikte görür.">
        <Phones>
          <GuideVideo phone src={video("v4-veli")} poster={img("v4-kapak")} title="Veli portalı" seconds={22} />
          <Phone caption="Devam ve etüt: her ders, işlenen konu ve yoklama durumu.">
            <PhoneImage src={img("t1-veli-devam")} alt="Veli portalında ders yoklamaları" width={780} height={3000} />
          </Phone>
          <Phone caption="Ders programı: haftanın dersleri, öğretmeni ve dersliği.">
            <PhoneImage src={img("t2-veli-program")} alt="Veli portalında haftalık ders programı" width={780} height={2700} />
          </Phone>
        </Phones>
      </GuideSection>

      <GuideSection id="ortak" eyebrow="Ortak bölümler" title="Etüt Merkezi paketindeki her şey dahil" lead="Aşağıdaki bölümler iki pakette aynıdır. Her kart Etüt merkezi rehberindeki ekran ekran anlatıma götürür.">
        <div className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          {SHARED.map(([anchor, title, text, file]) => (
            <Link key={anchor} href={`${ETUT}#${anchor}`} className="group grid content-start overflow-hidden rounded-2xl border border-ink-100 bg-white transition-colors hover:border-brand-300">
              <Image src={`/tanitim/etut-merkezi/${file}.jpg`} alt="" width={1440} height={900} sizes="(min-width: 1024px) 360px, 100vw" className="aspect-[16/9] w-full border-b border-ink-100 object-cover object-top" />
              <div className="grid gap-1 p-4">
                <h3 className="text-[17px] font-bold group-hover:text-brand-700">{title}</h3>
                <p className="text-[14.5px] text-ink-500">{text}</p>
              </div>
            </Link>
          ))}
        </div>
      </GuideSection>

      <GuideSection id="fiyat" eyebrow="Fiyat" title="Dershane paketi" lead="Fiyat aktif öğrenci sayınıza göre belirlenir; pasif ve ayrılan öğrenciler sayılmaz. Tüm kademelerde bütün modüller, sınırsız personel ve veli portalı dahildir. Fiyatlara KDV dahildir.">
        <div className="mt-8">
          <TierCards plans={plans} edition="DERSHANE" />
        </div>
        <Note className="mt-6">
          Sınıf bazlı program ve yoklamaya ihtiyacınız yoksa, birebir takip ve etüt odaklı{" "}
          <Link href={ETUT} className="font-semibold text-brand-700 underline">
            Etüt Merkezi paketi
          </Link>{" "}
          de var; paket değiştirince kayıtlar olduğu gibi kalır.
        </Note>
      </GuideSection>

      <GuideSection id="baslangic" eyebrow="Başlangıç" title="İlk hafta nasıl geçer" lead="Kurulumu sizinle birlikte yapıyoruz. Sınıflar ve ders saatleri girildiği gün yoklamaya başlayabilirsiniz.">
        <ol className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {[
            ["Başvurun", `Kurumlar için sayfasındaki formu doldurun. Ekibimiz sizi arar, kurumunuzu açar; giriş bilgileriniz e-postanıza gelir.${trial > 0 ? ` İlk ${trial} gün ücretsizdir.` : ""}`],
            ["Öğrencileri aktarın", "Excel listenizi yükleyin; sınıf sütunu doluysa öğrenciler sınıflarına yerleşir, eksik sınıflar kendiliğinden açılır."],
            ["Ders saatlerini girin", "Her sınıfın haftalık ders saatlerini, öğretmenini ve dersliğini girin; program, yoklama ve derslikler buradan dolar."],
            ["Personeli ve velileri ekleyin", "Öğretmenlere kendi giriş bilgileri gider. Veli portalı davetiyle veliler devamı ve işlenen konuları telefondan görür."],
          ].map(([title, text], i) => (
            <li key={title} className="grid content-start gap-2 rounded-2xl border border-ink-100 bg-white p-5">
              <span className="font-display text-4xl leading-none font-extrabold text-brand-600">{i + 1}</span>
              <h3 className="text-[22px] font-bold">{title}</h3>
              <p className="text-[15.5px] text-ink-500">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 space-y-2.5">
          {faq.map(([q, a]) => (
            <details key={q} className="rounded-2xl border border-ink-100 bg-white px-5 py-1">
              <summary className="cursor-pointer py-3 font-display text-[17px] font-bold">{q}</summary>
              <p className="pb-3.5 text-[15.5px] text-ink-500">{a}</p>
            </details>
          ))}
        </div>
      </GuideSection>

      <section className="bg-ink-900 py-16 text-ink-50">
        <div className="mx-auto grid max-w-6xl gap-4 px-4">
          <p className="text-xs font-bold tracking-[0.12em] text-gold-400 uppercase">Pi Kampüs · Dershane</p>
          <h2 className="max-w-[22ch] text-3xl font-extrabold sm:text-4xl">Programı bir kez girin, yoklama ve raporlar kendiliğinden gelsin.</h2>
          <p className="max-w-3xl text-lg text-ink-200">
            {trial > 0 ? `${trial} gün ücretsiz deneyin. ` : ""}Kurulumu birlikte yapalım; ilk hafta sonunda sınıflarınızın durumu tek ekranda olsun.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href={applyHref} className={buttonClasses("primary", "lg")}>
              {trial > 0 ? "Ücretsiz deneme başvurusu" : "Başvurun"}
            </Link>
            <Link href="/kurum-giris" className={buttonClasses("outline", "lg", "border-white/30 bg-transparent text-white hover:bg-white/10")}>
              Kurum girişi
            </Link>
          </div>
        </div>
      </section>
      <p className="mx-auto max-w-6xl px-4 py-6 text-[13.5px] text-ink-500">
        Ekran görüntüleri ve videolar örnek bir dershanenin (Başarı Dershanesi) gerçek panelinden alınmıştır; ortak bölüm görselleri örnek etüt merkezinden. Kişi ve kurum bilgileri örnektir. Fiyatlara KDV dahildir.
      </p>
    </>
  );
}
