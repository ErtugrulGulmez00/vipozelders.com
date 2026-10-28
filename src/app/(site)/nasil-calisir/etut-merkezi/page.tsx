import type { Metadata } from "next";
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
  title: "Etüt merkezi paneli nasıl çalışır? Ekran ekran rehber",
  description: "Öğrenci kaydı, etüt planı ve yoklama, ödev, koçluk, deneme analizi, fotoğrafla soru, tahsilat ve veli portalı: Etüt Merkezi paketini gerçek ekranlar ve videolarla tanıyın.",
};

const BASE = "/tanitim/etut-merkezi";
const shot = (file: string, url: string, alt: string, width: number, height: number, tall?: boolean): Shot => ({ src: `${BASE}/${file}.jpg`, url, alt, width, height, tall });
const video = (file: string) => `${BASE}/video/${file}.mp4`;
const img = (file: string) => `${BASE}/${file}.jpg`;

const NAV: [string, string][] = [
  ["neden", "Neden"],
  ["giris", "Giriş"],
  ["ozet", "Özet"],
  ["ogrenci", "Öğrenci"],
  ["etut", "Etüt"],
  ["odev", "Ödev"],
  ["takip", "Koçluk"],
  ["deneme", "Deneme"],
  ["soru", "Soru"],
  ["muhasebe", "Muhasebe"],
  ["iletisim", "İletişim"],
  ["veli", "Veli"],
  ["yonetim", "Yönetim"],
  ["fiyat", "Fiyat"],
  ["baslangic", "Başlangıç"],
];

const VS = [
  ["Öğrenci listesi Excel'de, veli numaraları telefonda", "Öğrenci, veli ve iletişim bilgisi tek kartta; Excel'den tek seferde aktarılır"],
  ["Etüt programı tahtada, çakışmalar son anda fark ediliyor", "Haftalık etüt planı; öğretmen, derslik ve öğrenci çakışması kaydederken engellenir"],
  ["Gelmeyen öğrencinin velisini tek tek aramak", "\"Gelmedi\" işaretlenince veliye otomatik bildirim gider"],
  ["Deneme sonuçları kâğıtta, eksik konu analizi yok", "Optik dosyası ya da Excel ile sonuç; konu ve soru analizi, yazdırılabilir karne"],
  ["Taksitler defterde, gecikenler akılda", "Ödeme planı, sıra numaralı makbuz, geciken listesi ve otomatik hatırlatma"],
  ["Veli \"çocuğum ne yapıyor?\" diye sürekli arıyor", "Veli devamı, ödevi, denemeyi ve ödemeyi telefonundan kendisi görür"],
];

const DAY = [
  ["09:30", "Müdür özet ekranını açar: bugünkü etütler, koç görüşmeleri, geciken ödemeler hazır."],
  ["14:00", "Çalışma salonu açılır; sekreter periyot yoklamasını tek tıkla \"hepsi geldi\" yapar."],
  ["15:00", "Matematik etüdü biter; öğretmen telefondan Geldi / Gelmedi işaretler, işlenen konuyu yazar."],
  ["15:01", "Gelmeyen öğrencinin velisine e-posta ve site bildirimi gider."],
  ["16:30", "Öğrenci takıldığı sorunun fotoğrafını gönderir; branş öğretmeni çözümü yollar."],
  ["18:00", "Veli taksitini öder; muhasebe makbuzu keser, veliye ödeme bilgisi gider."],
  ["21:00", "Veli telefonundan günün etüdünü, ödevini ve son deneme netini görür."],
];

const ROLES = [
  ["Kurum sahibi", "Pi Kampüs ekibi kurumunuzu açar; giriş bilgileriniz başvuruda yazdığınız e-postaya gelir.", "Her şey: personel, ayarlar, abonelik dahil."],
  ["Müdür / koordinatör", "Kurum sahibi Personel ekranından ekler. Kullanıcı adı ve geçici şifre ekranda bir kez görünür, e-postaya şifre belirleme bağlantısı gider.", "Abonelik dışında her şey."],
  ["Öğretmen", "Aynı şekilde Personel ekranından eklenir.", "Öğrencileri görür; kendi etütlerini planlar, yoklama alır, ödev verir, deneme sonucu girer, rehberlik notu yazar, soruları cevaplar. Muhasebeyi göremez."],
  ["Muhasebe / sekreter", "Personel ekranından eklenir.", "Öğrenci kaydı, ödeme planı, tahsilat, gider, duyuru, ön kayıt."],
  ["Öğrenci", "Öğrenci kartında \"Öğrenci giriş hesabı aç\" ile öğrencinin e-postasına hesap açılır.", "Kendi devamı, ödevleri, denemeleri, çalışma programı; fotoğrafla soru sorar."],
  ["Veli", "Öğrenci kartından veli portalı daveti e-postayla gider; veli kendi hesabıyla bağlanır.", "Çocuğunun devamı, etütleri, ödevleri, deneme sonuçları, ödemeleri, duyurular ve veliye açık notlar."],
];

const SECURITY = [
  ["Verileriniz sizin", "Tüm kayıtlarınızı tek Excel dosyasında istediğiniz an indirirsiniz. Abonelik bitse de kayıtlarınız silinmez."],
  ["Kurumlar birbirini göremez", "Her işlem sunucuda kurum ve yetki kontrolünden geçer; bir kurumun verisi başka kuruma görünmez."],
  ["Hassas veri korunur", "T.C. kimlik numaraları şifreli saklanır ve maskeli gösterilir; soru fotoğrafları gizli depodadır."],
  ["Her işlem kayıtlı", "Tahsilat, iptal, personel ve ayar değişiklikleri işlem kaydına yazılır; tahsilatı olan öğrenci silinemez."],
];

export default async function EtudGuidePage() {
  const settings = await getSiteSettings();
  const plans = centerPlans(settings, "ETUT");
  const trial = settings.centerTrialDays;
  const applyHref = "/kurumlar-icin?paket=ETUT#basvuru";

  const faq = [
    ["Kurulum ne kadar sürer?", "Excel listeniz hazırsa öğrenci aktarımı dakikalar sürer. Ekibimiz ilk kurulumda telefonla yanınızda olur."],
    ["Telefondan kullanılır mı?", "Evet. Panel ve veli portalı telefon tarayıcısında çalışır; öğretmen yoklamayı telefondan alır, veli bildirimleri telefonda görür."],
    ["Velilere bildirim nasıl gidiyor?", "Şu an e-posta ve site bildirimiyle. WhatsApp bildirimleri Meta onayından sonra açılacak; kurumunuzun ek bir şey yapması gerekmeyecek."],
    [
      trial > 0 ? "Ücretsiz deneme bitince ne olur?" : "Abonelik bitince ne olur?",
      "Kayıtlarınız silinmez. Aboneliği başlatınca kaldığınız yerden devam edersiniz; başlatmazsanız panel salt okunur olur. Ödeme havale / EFT ile alınır.",
    ],
    ["Öğretmenlerimiz özel ders de veriyorsa?", "Pi Kampüs'te özel ders tarafı ayrıdır. Aynı öğretmen \"Kurum girişi\"nden girince yalnızca kurumunuzu görür; kurum tarafında özel ders tanıtımı yapılmaz."],
    ["Paketi sonra değiştirebilir miyim?", "Evet. Öğrenci sayınız artınca kademeyi, sınıf bazlı yönetim gerekince Dershane paketini seçersiniz; kayıtlarınız olduğu gibi kalır."],
  ];

  return (
    <>
      <GuideSwitcher active="etut-merkezi" />
      <GuideNav items={NAV} />
      <GuideZoom />

      <section className="overflow-hidden bg-ink-900 pt-14 text-ink-50">
        <div className="mx-auto grid max-w-6xl gap-9 px-4">
          <div>
            <p className="text-xs font-bold tracking-[0.12em] text-gold-400 uppercase">Etüt Merkezi paketi · Tanıtım ve kullanım rehberi</p>
            <h1 className="mt-3.5 max-w-[15ch] text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Etüt merkezinizin tamamı <span className="text-gold-400">tek ekranda</span>.
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-ink-200">
              Pi Kampüs; öğrenci kaydından etüt yoklamasına, ödevden deneme karnesine, tahsilattan veli bilgilendirmesine kadar etüt merkezinin bütün işini tek panelde toplar. Bu rehber, paneli ekran ekran ve videolarla anlatır.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {[["Sınırsız", "personel hesabı"], ...(trial > 0 ? [[`${trial} gün`, "ücretsiz deneme"]] : []), ["Kurulumu", "birlikte yapıyoruz"], ["Telefonda", "çalışan veli portalı"]].map(([b, t]) => (
                <span key={t} className="rounded-full border border-white/20 px-3.5 py-1.5 text-sm">
                  <b className="text-gold-400">{b}</b> {t}
                </span>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#video-tur" className={buttonClasses("primary", "lg")}>
                Videolu tura başla
              </a>
              <Link href={applyHref} className={buttonClasses("outline", "lg", "border-white/30 bg-transparent text-white hover:bg-white/10")}>
                {trial > 0 ? `${trial} gün ücretsiz deneyin` : "Başvurun"}
              </Link>
            </div>
          </div>
          <div className="translate-y-6">
            <BrowserShot shot={shot("02-ozet", "pikampus.com/kurum", "Kurum paneli özet ekranı: bugünkü etütler, gelmeyenler, koç görüşmeleri, geciken ödemeler", 1440, 900)} sizes="(min-width: 1152px) 1120px, 100vw" />
          </div>
        </div>
      </section>

      <GuideSection
        id="neden"
        eyebrow="Neden Pi Kampüs"
        title="Excel, defter ve WhatsApp gruplarının yerine tek bir düzen"
        lead="Etüt merkezinin günlük yükü dağınık araçlarda kaybolur. Pi Kampüs her bilgiyi bir kez girmenizi, sonra herkesin kendi ekranında görmesini sağlar."
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
            <h3 className="text-[22px] font-bold">Sabah açtığınız ekran, akşam velinin gördüğü ekrandır</h3>
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
        id="giris"
        eyebrow="Giriş bilgileri"
        title="Herkes aynı adresten, kendi hesabıyla girer"
        lead={
          <>
            Giriş adresi:{" "}
            <Link href="/kurum-giris" className="font-semibold text-brand-700 underline">
              pikampus.com/kurum-giris
            </Link>
            . Personel, öğrenci ve veli aynı kapıyı kullanır; her biri yalnızca yetkisi olan ekranları görür. Bir kişinin tek hesabı (tek e-posta, tek şifre) olur.
          </>
        }
      >
        <Feature
          shot={shot("01-giris", "pikampus.com/kurum-giris", "Kurum girişi ekranı", 1440, 900)}
          title="Giriş ekranı"
          legend={[
            ["Kurum girişi", "sekmesi. Etüt merkezi personeli, öğrencisi ve velisi buradan girer."],
            ["E-posta ya da kullanıcı adı.", "Personel ve öğrenciler kullanıcı adıyla da girebilir."],
            ["Şifre.", "İlk girişte geçici şifre kişinin kendi belirlediği şifreyle değiştirilir."],
            ["Şifremi unuttum.", "Sıfırlama bağlantısı e-postaya gelir; kimseyi aramaya gerek kalmaz."],
          ]}
        >
          <Tip title="Kendi bağlantınız:">kurumunuza özel giriş bağlantısında kurumunuzun adı ve logosu görünür.</Tip>
        </Feature>

        <div className="mt-10 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
          <table className="w-full min-w-[720px] border-collapse text-left text-[15px]">
            <thead>
              <tr className="bg-ink-50 text-xs tracking-[0.08em] text-ink-500 uppercase">
                <th className="border-b border-ink-100 px-4 py-3">Kim</th>
                <th className="border-b border-ink-100 px-4 py-3">Giriş bilgisi nasıl gelir</th>
                <th className="border-b border-ink-100 px-4 py-3">Ne görür, ne yapar</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map(([who, how, what]) => (
                <tr key={who} className="align-top">
                  <td className="border-b border-ink-100 px-4 py-3 font-bold">{who}</td>
                  <td className="border-b border-ink-100 px-4 py-3">{how}</td>
                  <td className="border-b border-ink-100 px-4 py-3">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5">
          <Tip title="Denemek isterseniz:" tone="ok">
            {trial > 0 ? `${trial} günlük ücretsiz deneme için ` : "Başvuru için "}
            <Link href={applyHref} className="font-semibold text-brand-700 underline">
              Kurumlar için
            </Link>{" "}
            sayfasındaki formu doldurun; kart bilgisi istenmez. Ekibimiz sizi arar, dilerseniz paneli örnek bir kurum üzerinde birlikte gezeriz.
          </Tip>
        </div>
      </GuideSection>

      <GuideSection id="video-tur" eyebrow="Videolu tur" title="Bir dakikada panel" lead="Girişten özet ekranına, oradan öğrenci kartına kısa bir tur. Videolarda imleç ve alt yazı her adımı gösterir.">
        <div className="mt-8">
          <GuideVideo src={video("v1-giris-ozet")} poster={img("02-ozet")} title="Panele giriş ve özet ekranı" seconds={35} />
        </div>
      </GuideSection>

      <GuideSection id="ozet" eyebrow="Özet ekranı" title="Güne hazır bir başlangıç" lead="Panele girdiğinizde bugünün tablosu sizi bekler. Her kart ilgili sayfaya götürür; personel yalnızca yetkili olduğu kartları görür.">
        <Feature
          shot={shot("02-ozet", "pikampus.com/kurum", "Özet ekranı işaretli", 1440, 900)}
          legend={[
            ["Menü.", "Paketinizdeki bölümler; kapattığınız modüller menüde görünmez."],
            ["Öğrenci arama.", "Ad, öğrenci numarası ya da veli telefonuyla her sayfadan arayın."],
            ["Hızlı işlemler:", "öğrenci ekle, tahsilat al."],
            ["Bugün gelmeyenler.", "Etütte gelmeyen öğrenciler saatiyle listelenir."],
            ["Bugünkü etütler.", "Yapıldı / planlandı durumu, öğretmen ve öğrenci sayısı."],
            ["Geciken ödemeler.", "En eski vadeden itibaren, öğrenci başına tutar."],
          ]}
        />
        <Feature
          flip
          shot={shot("02b-ozet-alt", "pikampus.com/kurum", "Özet ekranının alt bölümü", 1180, 900)}
          legend={[
            ["Bugünkü koç görüşmeleri.", "Hangi öğrenciyle saat kaçta görüşülecek."],
            ["Son denemeler.", "Katılım ve ortalama net."],
            ["Sınıf seviyesine göre öğrenci", "dağılımı."],
          ]}
        />
      </GuideSection>

      <GuideSection id="ogrenci" eyebrow="Öğrenci ve veli kaydı" title="Her öğrencinin tek bir kartı var" lead="Kayıt, veli bilgileri, devam, ödev, deneme, koçluk ve ödemeler aynı kartta toplanır. Mevcut listenizi Excel'den tek seferde aktarırsınız.">
        <Feature
          shot={shot("03-ogrenciler", "pikampus.com/kurum/ogrenciler", "Öğrenci listesi", 1440, 860)}
          title="Öğrenci listesi"
          legend={[
            ["Yeni öğrenci", "formu."],
            ["Excel'den aktar.", "Şablonu indirip doldurun ya da kendi dosyanızı yükleyin."],
            ["Excel (CSV) çıktısı.", "Listeniz her zaman sizde."],
            ["Arama ve süzgeç:", "sınıf ve durum (aktif / pasif / ayrıldı)."],
            ["Öğrenci satırı:", "veli, telefon, kalan borç ve durum. \"Portalda\" etiketi velinin bağlı olduğunu gösterir."],
          ]}
        />
        <Feature
          flip
          shot={shot("06-yeni-ogrenci", "pikampus.com/kurum/ogrenciler/yeni", "Yeni öğrenci formu", 1180, 1250, true)}
          title="Yeni öğrenci"
          legend={[
            ["Sınıflar.", "Bir öğrenci birden fazla gruba katılabilir (ör. 8-A ve hafta sonu grubu)."],
            ["Veli adı", "ve yakınlığı. En fazla dört veli eklenir."],
            ["Veli e-postası zorunlu.", "Devamsızlık, ödev, deneme ve ödeme bildirimleri bu adrese gider."],
          ]}
        >
          <ul className="grid list-disc gap-1.5 pl-5 text-[15.5px]">
            <li>Öğrenci numarası otomatik verilir.</li>
            <li>T.C. kimlik numarası şifreli saklanır, maskeli gösterilir.</li>
            <li>Ön kayıttan gelen adayın bilgileri forma hazır gelir.</li>
          </ul>
        </Feature>
        <Pair>
          <GuideVideo src={video("v2-ogrenci-kaydi")} poster={img("06-yeni-ogrenci")} title="Öğrenci ve veli kaydı" seconds={27} />
          <Figure shot={shot("07-excel-aktar", "pikampus.com/kurum/ogrenciler/ice-aktar", "Excel'den öğrenci aktarma", 1440, 820)}>
            <b>Excel&apos;den aktarım:</b> ① örnek şablonu indirin, ② dosyayı yükleyin. Sütun adları esnek okunur; eksik sınıflar otomatik açılır, hatalı satırlar ve e-postası olmayan veliler tek tek listelenir.
          </Figure>
        </Pair>
        <Feature
          className="mt-14"
          shot={shot("04-ogrenci-karti", "pikampus.com/kurum/ogrenciler/…", "Öğrenci kartı", 1440, 1750, true)}
          title="Öğrenci kartı"
          legend={[
            ["Sekmeler:", "genel, devam ve ödev, denemeler ve eksikler, program ve kaynaklar, koçluk, ödemeler."],
            ["Veliler.", "Bildirim tercihleri ve veli portalı daveti."],
            ["Öğrenci girişi.", "Öğrenciye e-postasıyla giriş hesabı açın."],
            ["Veliye mesaj.", "Kart üzerinden doğrudan e-posta ve site bildirimi."],
          ]}
        >
          <Tip title="Rehberlik notları:">görüşme notlarını kurum içi tutun ya da &quot;veli portalında görünsün&quot; seçeneğiyle veliyle paylaşın.</Tip>
        </Feature>
        <Gallery
          items={[
            { shot: shot("05-ogrenci-denemeler", "Denemeler ve eksikler", "Öğrenci kartı denemeler sekmesi", 1440, 1100), caption: "Net gelişimi kurum ortalamasıyla birlikte; eksik konular denemelerden otomatik çıkar." },
            { shot: shot("05b-ogrenci-program", "Program ve kaynaklar", "Öğrenci kartı haftalık çalışma programı", 1440, 1000), caption: "Haftalık çalışma programı: gün gün ders, konu, kaynak ve hedef soru." },
            { shot: shot("05c-ogrenci-odemeler", "Ödemeler", "Öğrenci kartı ödemeler sekmesi", 1440, 950), caption: "Ödeme planı: toplam, indirim, peşinat ve 1-36 taksit." },
          ]}
        />
      </GuideSection>

      <GuideSection id="etut" eyebrow="Etüt planı ve yoklama" title="Çakışmasız plan, tek dokunuşla yoklama" lead="Birebir ve küçük grup etütlerini haftalık görünümde planlayın. Aynı öğretmen, derslik ya da öğrenci için çakışan etüt kaydedilemez. Etüt bitince yoklama birkaç saniye sürer.">
        <Feature
          shot={shot("08-etut-plani", "pikampus.com/kurum/etutler", "Haftalık etüt planı", 1440, 900)}
          title="Haftalık etüt planı"
          legend={[
            ["Etüt planla.", "Tarih, saat, ders, konu, derslik, öğretmen ve öğrenciler."],
            ["Hafta geçişi.", "Geçmiş ve gelecek haftalar."],
            ["Yapıldı:", "yoklaması alınmış etüt."],
            ["Planlandı:", "henüz yapılmamış etüt."],
            ["Yalnız benim etütlerim.", "Öğretmen kendi programını görür."],
          ]}
        />
        <Feature
          flip
          shot={shot("09-etut-yoklama", "pikampus.com/kurum/etutler/…", "Etüt yoklaması", 1440, 900)}
          title="Etüt yoklaması"
          legend={[
            ["Katılım:", "her öğrenci için Geldi, Gelmedi, Geç ya da İzinli."],
            ["Etüt notu:", "işlenen konu ve verilen ödev. Veli portalında görünür."],
            ["Gelmeyenin velisine bildirim.", "Aynı devamsızlık için ikinci mesaj gitmez."],
            ["Etüt yapıldı olarak kaydet.", ""],
          ]}
        />
        <Pair>
          <GuideVideo src={video("v3-etut-yoklama")} poster={img("08-etut-plani")} title="Etüt planlama ve yoklama" seconds={31} />
          <Phones className="mt-0 lg:justify-start">
            <Phone caption="Öğretmen yoklamayı telefondan alır; uygulama indirmek gerekmez.">
              <PhoneImage src={img("t8-yoklama-telefon")} alt="Telefonda etüt yoklaması" width={780} height={2600} />
            </Phone>
          </Phones>
        </Pair>
      </GuideSection>

      <GuideSection id="odev" eyebrow="Ödevler" title="Ödev ver, teslim günü tek ekranda kontrol et" lead="Sınıfa ya da seçtiğiniz öğrencilere ödev verin. Teslim günü öğrenci öğrenci işaretleyin; yapmayanın velisine bir kez bildirim gider, yapma oranı karta ve veli portalına yansır.">
        <Feature
          shot={shot("10-odevler", "pikampus.com/kurum/odevler", "Ödev verme ekranı", 1440, 900)}
          title="Ödev ver"
          legend={[
            ["Kime:", "tüm sınıf ya da seçilen öğrenciler."],
            ["Teslim tarihi.", ""],
            ["Velilere e-postayla da bildir", "(portala bağlı velilere bildirim her zaman gider)."],
            ["Ödevi ver.", ""],
          ]}
        />
        <Feature
          flip
          shot={shot("11-odev-kontrol", "pikampus.com/kurum/odevler/…", "Ödev kontrolü", 1440, 900)}
          title="Teslim kontrolü"
          legend={[
            ["Hepsini \"Yaptı\" yap,", "sonra istisnaları değiştirin."],
            ["Yaptı / Eksik / Yapmadı", "ve isteğe bağlı not."],
            ["Yapmayanın velisine bildirim", "(her öğrenciye bir kez)."],
            ["Kontrolü kaydet.", ""],
          ]}
        />
        <div className="mt-8">
          <GuideVideo src={video("v4-odev")} poster={img("10-odevler")} title="Ödev verme ve kontrol" seconds={24} />
        </div>
      </GuideSection>

      <GuideSection id="takip" eyebrow="Birebir takip" title="Koçluk, çalışma salonu, kaynak ve program" lead="Etüt merkezini dershaneden ayıran şey birebir takiptir. Her öğrencinin koçu, haftalık görüşme günü, salon devamı, kitap ilerlemesi ve çalışma programı kayıt altındadır.">
        <Feature
          shot={shot("12-kocluk", "pikampus.com/kurum/kocluk", "Koçluk ekranı", 1440, 1000)}
          title="Koçluk ve rehberlik"
          legend={[
            ["Bu haftanın görüşmeleri:", "görüşüldü, bugün, planlı, gecikti."],
            ["Bugün görüşülecekler", "ve saatleri."],
            ["Koordinatör özeti:", "hangi koç kaç görüşme yaptı."],
            ["Koç ataması:", "öğrenciye koç, haftalık gün ve saat."],
          ]}
        >
          <Note>Görüşme notu, öncelikli konular ve sonraki hedef yazılır; isterseniz veliyle paylaşılır.</Note>
        </Feature>
        <Feature
          flip
          shot={shot("13-calisma-salonu", "pikampus.com/kurum/calisma-salonu/…", "Çalışma salonu yoklaması", 1440, 900)}
          title="Çalışma salonu"
          legend={[
            ["Periyodu tek tıkla \"hepsi geldi\"", "yapın."],
            ["Yoklama tablosu:", "öğrenci × periyot; masa numarasıyla."],
            ["Gün boyu gelmeyenin velisine bildirim", "(günde bir kez)."],
            ["Rapor:", "öğrenci bazında salon devamı."],
          ]}
        />
        <Pair>
          <GuideVideo src={video("v10-kocluk-salon")} poster={img("12-kocluk")} title="Koçluk ve çalışma salonu" seconds={19} />
          <Figure shot={shot("14-kaynak", "pikampus.com/kurum/kaynaklar/…", "Kaynak ve konu ilerlemesi", 1440, 900)}>
            <b>Kaynaklar ve kitaplar:</b> soru bankasını konu listesiyle tanımlayın, öğrencilere atayın; konu konu çözülen, doğru ve yanlış sayısı izlenir.
          </Figure>
        </Pair>
      </GuideSection>

      <GuideSection id="deneme" eyebrow="Denemeler" title="Sonucu girin, analizi ve karneyi Pi Kampüs çıkarsın" lead="LGS, TYT, AYT (SAY / EA / SÖZ), YDT ve serbest şablonlar hazır; yanlış götürme kuralı (3 ya da 4 yanlış) otomatik uygulanır. Sonuçları optik okuyucu dosyasıyla, Excel'den ya da tablodan girin.">
        <Feature
          shot={shot("16-deneme-analiz", "pikampus.com/kurum/denemeler/…", "Deneme analizi", 1440, 1000)}
          title="Deneme analizi"
          legend={[
            ["Sekmeler:", "analiz, sonuç girişi, cevap anahtarı ve konular, Excel / optik aktarım, kelebek düzeni, ayarlar."],
            ["Ders ortalamaları:", "doğru, yanlış, boş, net ve başarı oranı."],
            ["Veli portalında yayın.", "Siz yayınlayana kadar veliler sonucu görmez."],
          ]}
        />
        <Gallery
          items={[
            { shot: shot("16b-konu-analizi", "Konu analizi", "Konu analizi", 1180, 1000), caption: "Konu analizi: soru başına konu dağılımına göre hangi konuda kaç öğrenci zorlanıyor." },
            { shot: shot("16c-siralama", "Sıralama", "Sıralama", 1180, 900), caption: "Sıralama; her satırdan öğrencinin karnesine geçilir." },
            { shot: shot("17-sonuc-girisi", "Sonuç girişi", "Sonuç girişi tablosu", 1440, 900), caption: "Sonuç girişi: öğrenci × ders doğru / yanlış; net anında hesaplanır." },
            { shot: shot("17b-optik", "Excel / optik aktar", "Optik okuyucu ve Excel aktarımı", 1440, 900), caption: "Optik okuyucu dosyası (TXT / DAT) şablonu bir kez tanımlanır; cevaplar anahtarla otomatik okunur." },
          ]}
        />
        <Pair>
          <GuideVideo src={video("v5-deneme-karne")} poster={img("16-deneme-analiz")} title="Deneme analizi ve karne" seconds={34} />
          <Figure shot={shot("18-karne", "Öğrenci karnesi", "Yazdırılabilir öğrenci karnesi", 1440, 1400, true)}>
            <b>Öğrenci karnesi:</b> ders ve konu analizi, eksikler, net gelişimi. Yazdırın ya da PDF olarak veliye verin.
          </Figure>
        </Pair>
      </GuideSection>

      <GuideSection id="soru" eyebrow="Fotoğrafla soru" title="Öğrenci takıldığı soruyu çeker, öğretmen çözümü gönderir" lead="Soru, branşı eşleşen öğretmene bildirim olarak düşer. Öğretmen çözümü yazı, fotoğraf (8 MB) ya da video (25 MB) olarak gönderir veya &quot;yüz yüze anlatacağım&quot; der. Dosyalar gizlidir; yalnızca kurum personeli ve öğrenciye bağlı hesaplar açabilir.">
        <Pair className="items-center">
          <Phones className="mt-0">
            <GuideVideo phone src={video("v8-ogrenci-soru")} poster={img("t5-ogrenci-soru")} title="Öğrenci soruyu telefondan gönderir" seconds={20} />
          </Phones>
          <GuideVideo src={video("v9-ogretmen-cozum")} poster={img("29b-soru-cevap")} title="Öğretmen çözümü gönderir" seconds={17} />
        </Pair>
        <Feature shot={shot("29b-soru-cevap", "pikampus.com/kurum/sorular/…", "Soru ve çözüm", 1440, 1100)} title="Soru ve çözüm">
          <Note>Sorular &quot;cevap bekleyen&quot;, &quot;yüz yüze anlatılacak&quot; ve &quot;çözülen&quot; olarak ayrılır. Öğrenci ve velisi çözüm gelince bildirim alır.</Note>
          <Tip title="Kurumun gücü:">soru çözümü ders saatinin dışına taşar, öğrenci evde de kurumunuza bağlı kalır.</Tip>
        </Feature>
      </GuideSection>

      <GuideSection id="muhasebe" eyebrow="Muhasebe" title="Taksit, tahsilat, makbuz ve gider tek yerde" lead="Öğrenciye ödeme planı yapın; tahsilat en eski taksitten düşülür, sıra numaralı makbuz anında çıkar. Gecikenlere tek tıkla, isterseniz otomatik hatırlatma gider.">
        <Feature
          shot={shot("19-muhasebe", "pikampus.com/kurum/muhasebe", "Muhasebe özeti", 1440, 1000)}
          title="Muhasebe özeti"
          legend={[
            ["Son 12 ay", "tahsilat ve gider grafiği."],
            ["Gecikenler", "listesine geçiş."],
          ]}
        >
          <Note>Üstte sözleşme toplamı, tahsil edilen, kalan alacak, geciken; bu ayın vadesi gelen tutarı, tahsilatı, gideri ve neti.</Note>
        </Feature>
        <Gallery
          items={[
            { shot: shot("20-tahsilat", "Tahsilat", "Tahsilat ekranı", 1440, 900), caption: "Tahsilat: öğrenciyi arayın, tutarı ve ödeme şeklini (nakit, kart, havale) girin." },
            { shot: shot("21-makbuz", "Makbuz", "Tahsilat makbuzu", 1440, 900), caption: "Makbuz: sıra numarası, yazıyla tutar, kalan borç ve imza alanları." },
            { shot: shot("22-gecikenler", "Gecikenler", "Geciken ödemeler", 1440, 900), caption: "Gecikenler: ① tümünü seçin, ② hatırlatma gönderin." },
          ]}
        />
        <div className="mt-8">
          <GuideVideo src={video("v6-tahsilat-makbuz")} poster={img("21-makbuz")} title="Tahsilat ve makbuz" seconds={26} />
        </div>
        <Note className="mt-5">Giderler (kira, maaş, fatura, kırtasiye, reklam, vergi / SGK) de kaydedilir. Tahsilat, borç ve gider listeleri CSV olarak iner; tahsilat iptalinde makbuz numarası korunur.</Note>
      </GuideSection>

      <GuideSection id="iletisim" eyebrow="İletişim" title="Veliye gereken bilgi, kendiliğinden gider" lead="Devamsızlık, ödev, deneme sonucu, ödeme ve duyurular veliye e-posta ve site bildirimiyle ulaşır. Her mesajın durumu (sırada, gönderildi, gönderilemedi) mesaj geçmişinde görünür.">
        <Feature
          shot={shot("23-duyurular", "pikampus.com/kurum/duyurular", "Duyuru ekranı", 1440, 900)}
          title="Duyurular"
          legend={[
            ["Kime:", "tüm kurum ya da bir sınıf."],
            ["E-postayla gönder.", ""],
            ["WhatsApp:", "Meta onayı tamamlanınca açılacak."],
          ]}
        >
          <Tip title="WhatsApp yolda:" tone="ok">
            Pi Kampüs&apos;ün WhatsApp bildirim şablonları onay aşamasında. Onaylanınca aynı bildirimler WhatsApp&apos;tan da gidecek; kurumunuzun bir şey yapması gerekmeyecek.
          </Tip>
        </Feature>
        <Feature flip shot={shot("24-mesaj-gecmisi", "pikampus.com/kurum/mesajlar", "Mesaj geçmişi", 1440, 900)} title="Mesaj geçmişi">
          <Note>Velilere giden her e-posta zaman, alıcı, içerik ve durumuyla listelenir. &quot;Veliye haber verdik mi?&quot; sorusunun cevabı burada.</Note>
          <BrowserShot className="max-w-[420px]" sizes="420px" shot={shot("31-eposta", "Velinin e-posta kutusu", "Veliye giden örnek e-posta", 1020, 1350)} />
          <p className="text-sm text-ink-500">Veliye giden örnek bildirim: gönderen adında kurumunuzun adı yazar.</p>
        </Feature>
      </GuideSection>

      <GuideSection id="veli" eyebrow="Veli ve öğrenci deneyimi" title="Veli telefonundan takip eder, sizi aramasına gerek kalmaz" lead="Veli portalı telefon tarayıcısında uygulama gibi çalışır, bir şey indirmek gerekmez. Veli yalnızca kendi çocuğunu, siz yayınladığınız bilgileri görür.">
        <Phones>
          <GuideVideo phone src={video("v7-veli-portali")} poster={img("t1-veli-ozet")} title="Veli portalı turu" seconds={32} />
          <Phone caption="Devam, son deneme, kalan ödeme, eksik konular, duyurular ve öğretmen notları.">
            <PhoneImage src={img("t2-veli-cocuk")} alt="Veli portalında öğrenci özeti" width={780} height={2552} />
          </Phone>
          <Phone caption="Bildirimler: yeni ödev, deneme sonucu, devamsızlık. Her biri e-postayla da gelir.">
            <PhoneImage src={img("t4-veli-bildirim")} alt="Veli bildirimleri" width={780} height={1944} />
          </Phone>
          <Phone caption="Öğrenci haftalık çalışma programını görür ve &quot;yaptım&quot; diye işaretler.">
            <PhoneImage src={img("t6-ogrenci-program")} alt="Öğrencinin haftalık çalışma programı" width={780} height={2800} />
          </Phone>
        </Phones>
      </GuideSection>

      <GuideSection id="yonetim" eyebrow="Yönetim" title="Ön kayıt, personel, ayarlar ve abonelik" lead="Kurumunuzun vitrin sayfası yeni öğrenci getirir; personel yalnızca yetkili olduğu bölümleri görür; ayarlardan modül ve bildirimleri siz yönetirsiniz.">
        <Feature
          shot={shot("25-on-kayit", "pikampus.com/kurum/on-kayit", "Ön kayıtlar", 1440, 900)}
          title="Ön kayıtlar ve vitrin"
          legend={[
            ["Vitrin sayfanız", "(pikampus.com/kurumlar/kurumunuz). Veliler ön kayıt formunu doldurur, size bildirim gelir."],
            ["Kesin kayda çevir:", "aday bilgileri öğrenci formuna hazır gelir."],
            ["Aday ekle:", "telefonla, ziyaretle ya da tavsiyeyle gelen adaylar."],
          ]}
        />
        <Feature
          flip
          shot={shot("26-personel", "pikampus.com/kurum/personel", "Personel yönetimi", 1440, 967)}
          title="Personel ve yetkiler"
          legend={[
            ["Rol:", "kurum sahibi, müdür, öğretmen, muhasebe / sekreter. Her rol yalnızca kendi bölümlerini görür."],
            ["E-posta:", "giriş bilgileri ve bildirimler bu adrese gider."],
          ]}
        >
          <Note>Personel sayısı sınırsızdır. Ayrılan personel pasife alınır, kayıtları silinmez.</Note>
        </Feature>
        <Gallery
          items={[
            { shot: shot("27-ayarlar-moduller", "Kurum ayarları · Modüller", "Kurum ayarları, modüller", 1180, 1100), caption: "Kullanmadığınız modülü kapatın; menüden ve veli portalından kalkar." },
            { shot: shot("27b-ayarlar-bildirim", "Kurum ayarları · Otomatik bildirimler", "Otomatik bildirim ayarları", 1180, 547), caption: "Otomatik bildirimler: devamsızlık ve taksit hatırlatması (vadeden kaç gün önce)." },
            { shot: shot("28-abonelik", "Abonelik", "Abonelik ekranı", 1440, 1100), caption: "Abonelik: planınız, kullanımınız ve ödemeleriniz." },
            { shot: shot("30-vitrin", "pikampus.com/kurumlar/…", "Kurum vitrin sayfası", 1440, 1100), caption: "Kurumunuzun herkese açık vitrin sayfası ve ön kayıt formu." },
          ]}
        />
        <div className="mt-12 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))]">
          {SECURITY.map(([title, text]) => (
            <div key={title} className="grid content-start gap-2 rounded-2xl border border-ink-100 bg-white p-5">
              <h3 className="text-[19px] font-bold">{title}</h3>
              <p className="text-[15.5px] text-ink-500">{text}</p>
            </div>
          ))}
        </div>
      </GuideSection>

      <GuideSection id="fiyat" eyebrow="Fiyat" title="Etüt Merkezi paketi" lead="Fiyat aktif öğrenci sayınıza göre belirlenir; pasif ve ayrılan öğrenciler sayılmaz. Tüm kademelerde bütün modüller, sınırsız personel ve veli portalı dahildir. Fiyatlara KDV dahildir.">
        <div className="mt-8">
          <TierCards plans={plans} edition="ETUT" />
        </div>
        <Note className="mt-6">
          Sınıf bazlı toplu ders programı, sınıf yoklaması, sınıf defteri, derslik yönetimi ve kurum raporları isteyen kurumlar için{" "}
          <Link href="/nasil-calisir/dershane" className="font-semibold text-brand-700 underline">
            Dershane paketi
          </Link>{" "}
          de var; paket yükseltilince kayıtlar olduğu gibi kalır.
        </Note>
      </GuideSection>

      <GuideSection id="baslangic" eyebrow="Başlangıç" title="İlk hafta nasıl geçer" lead="Kurulumu sizinle birlikte yapıyoruz. Excel listeniz hazırsa öğrencilerinizi ilk gün aktarır, ertesi gün etüt yoklamasına başlayabilirsiniz.">
        <ol className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {[
            ["Başvurun", `Kurumlar için sayfasındaki formu doldurun. Ekibimiz sizi arar, kurumunuzu açar; giriş bilgileriniz e-postanıza gelir.${trial > 0 ? ` İlk ${trial} gün ücretsizdir.` : ""}`],
            ["Öğrencileri aktarın", "Mevcut Excel listenizi yükleyin; öğrenci, veli ve sınıflar tek seferde gelir. Velilerin e-posta adreslerini eksiksiz girin."],
            ["Personeli ekleyin", "Öğretmen ve sekreterleri rolleriyle ekleyin; herkese kendi giriş bilgisi gider."],
            ["Velileri davet edin", "Öğrenci kartından veli portalı davetini gönderin. Veliler bağlandığı andan itibaren devamı, ödevi ve denemeleri telefondan görür."],
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
          <p className="text-xs font-bold tracking-[0.12em] text-gold-400 uppercase">Pi Kampüs · Etüt Merkezi</p>
          <h2 className="max-w-[20ch] text-3xl font-extrabold sm:text-4xl">Öğrencinize odaklanın, gerisini panel taşısın.</h2>
          <p className="max-w-3xl text-lg text-ink-200">
            {trial > 0 ? `${trial} gün ücretsiz deneyin. ` : ""}Kurulumu birlikte yapalım, ilk hafta sonunda farkı velileriniz de görsün.
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
        Ekran görüntüleri ve videolar örnek bir etüt merkezinin (Başarı Etüt Merkezi) gerçek panelinden alınmıştır; kişi ve kurum bilgileri örnektir. Fiyatlara KDV dahildir.
      </p>
    </>
  );
}
