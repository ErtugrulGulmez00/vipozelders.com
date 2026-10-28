import { BadgeCheck, CreditCard, LockKeyhole, MessageSquareLock, MonitorPlay, PenLine, ScreenShare, Undo2, UserCheck, Users, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
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
import { getSiteSettings } from "@/server/site";

export const metadata: Metadata = {
  title: "Özel ders nasıl çalışır? Adım adım rehber",
  description: "Öğretmen bulma, ücretsiz tanışma, randevu ve güvenli ödeme, öğretmen onayı, sanal sınıf, paket ders ve fotoğrafla soru çözüm: Pi Kampüs'te özel dersi gerçek ekranlar ve videolarla tanıyın.",
};

const BASE = "/tanitim/ozel-ders";
const shot = (file: string, url: string, alt: string, width: number, height: number, tall?: boolean): Shot => ({ src: `${BASE}/${file}.jpg`, url, alt, width, height, tall });
const video = (file: string) => `${BASE}/video/${file}.mp4`;
const img = (file: string) => `${BASE}/${file}.jpg`;

const NAV: [string, string][] = [
  ["adimlar", "Adımlar"],
  ["bul", "Öğretmen bul"],
  ["profil", "Profil"],
  ["randevu", "Randevu"],
  ["onay", "Onay"],
  ["ders", "Ders"],
  ["paket", "Paket"],
  ["soru", "Soru çözüm"],
  ["guvence", "Güvence"],
  ["ogretmen", "Öğretmenler için"],
  ["sss", "SSS"],
];

const CLASSROOM = [
  { Icon: MonitorPlay, title: "Program kurmadan", text: "Ders tarayıcıda açılır; bilgisayar, tablet ya da telefon yeterli." },
  { Icon: Video, title: "Kamera ve ses", text: "Öğretmen ve öğrenci birbirini görür, duyar." },
  { Icon: PenLine, title: "Beyaz tahta", text: "Öğretmen soruyu tahtada adım adım çözer." },
  { Icon: ScreenShare, title: "Ekran paylaşımı", text: "Kitap sayfası, sunum ya da test ekranda paylaşılır." },
  { Icon: UserCheck, title: "Katılım kaydı", text: "Kimin derse ne zaman girdiği kaydedilir; \"gelmedi\" tartışması olmaz." },
  { Icon: LockKeyhole, title: "Yalnızca o derse özel", text: "Sınıfa yalnızca dersin öğretmeni ve öğrencisi, ders saatinde girer." },
];

export default async function PrivateLessonGuidePage() {
  const s = await getSiteSettings();
  const commission = Math.round(s.commissionRateBps / 100);

  const steps = [
    ["Öğretmeni bulun", "Kademe, ders, ders şekli, il/ilçe ve fiyata göre süzün; onaylı rozetine ve gerçek yorumlara bakın. Birçok öğretmenle ücretsiz 15 dakikalık tanışma görüşmesi yapabilirsiniz."],
    ["Saati seçin, ödeyin", "Takvimde yalnızca boş saatler seçilebilir. Ödeme 3D Secure ile alınır; seçtiğiniz saat ödeme süresince sizin için ayrılır."],
    ["Öğretmen onaylar", `Öğretmen talebinizi ${s.approvalWindowHours} saat içinde onaylar. Onaylamazsa ya da süresinde yanıt vermezse ödediğiniz tutarın tamamı kartınıza iade edilir.`],
    ["Derse katılın", `Online derste ders saatinden ${s.classroomOpensMinutesBefore} dakika önce "Derse Katıl" düğmesi açılır. Yüz yüze derste adres yalnızca onaydan sonra öğretmenle paylaşılır.`],
    ["Değerlendirin", `Ders bitince puan ve yorum bırakın. Bir sorun yaşadıysanız ${s.disputeWindowHours} saat içinde bildirin; bu süre dolmadan öğretmene ödeme yapılmaz.`],
  ];

  const trust = [
    { Icon: BadgeCheck, title: "Onaylı öğretmen", text: "Belgeleri ekibimizce incelenen öğretmenler \"Onaylı öğretmen\" rozeti taşır; listede yalnızca onaylıları gösterebilirsiniz." },
    { Icon: Undo2, title: "Onay yoksa tam iade", text: `Öğretmen ${s.approvalWindowHours} saat içinde onaylamazsa, dersi iptal ederse ya da derse gelmezse ödediğiniz tutarın tamamı iade edilir.` },
    { Icon: CreditCard, title: "Kart bilgisi bizde değil", text: "Kart bilgileri yalnızca bankanın 3D Secure sayfasında girilir; Pi Kampüs kart bilgisi saklamaz." },
    { Icon: LockKeyhole, title: "Ödeme ders sonrası", text: `Ücret, ders tamamlanıp ${s.disputeWindowHours} saatlik itiraz süresi dolana kadar öğretmene geçmez.` },
    { Icon: MessageSquareLock, title: "Kayıtlı iletişim", text: "Öğretmenle site içinden yazışırsınız; mesajlardaki telefon ve e-posta bilgileri gizlenir, tüm süreç kayıt altında kalır." },
    { Icon: Users, title: "Gerçek yorumlar", text: "Yorumu yalnızca o öğretmenle dersi tamamlanmış veliler ve öğrenciler yazabilir." },
  ];

  const faq = [
    ["Üyelik ücretli mi?", "Hayır. Öğretmenlere ve fiyatlara üye olmadan bakabilirsiniz; randevu, ödeme ve soru göndermek için ücretsiz üyelik yeterli."],
    ["Dersi iptal edersem ne olur?", `Dersin başlamasına ${s.fullRefundHours} saat veya daha fazla varsa tam iade; ${s.fullRefundHours} saatten az, ${s.partialRefundHours} saatten fazla varsa %${s.partialRefundPercent} iade; ${s.partialRefundHours} saatten az kaldıysa iade yapılmaz.`],
    ["Ders saatini değiştirebilir miyim?", `Evet. Dersten en az ${s.rescheduleMinHours} saat önce ders sayfasından yeni saat önerin; öğretmeniniz kabul ederse ders taşınır. Erteleme ücreti yoktur.`],
    ["Online ders için ne gerekir?", "Kamerası ve mikrofonu olan bir bilgisayar, tablet ya da telefon ve internet bağlantısı. Program kurmanız gerekmez."],
    ["Yüz yüze ders alabilir miyim?", "Evet, öğretmenin hizmet verdiği ilçelerde. Öğrencinin evinde ya da öğretmenin yerinde yapılabilir; adres yalnızca öğretmen dersi onaylarsa paylaşılır."],
    ["Birden fazla çocuğum var, tek hesap yeter mi?", "Evet. Randevu alırken dersin hangi çocuğunuz için olduğunu seçersiniz; tüm dersler ve ödemeler aynı hesapta görünür."],
  ];

  return (
    <>
      <GuideSwitcher active="ozel-ders" />
      <GuideNav items={NAV} />
      <GuideZoom />

      <section className="overflow-hidden bg-ink-900 pt-14 text-ink-50">
        <div className="mx-auto grid max-w-6xl gap-9 px-4">
          <div>
            <p className="text-xs font-bold tracking-[0.12em] text-gold-400 uppercase">Özel ders · Veli ve öğrenci rehberi</p>
            <h1 className="mt-3.5 max-w-[16ch] text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Doğru öğretmen, <span className="text-gold-400">güvenli ödeme</span>, evden ders.
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-ink-200">
              Pi Kampüs&apos;te öğretmeni yorumlarına ve boş saatlerine bakarak seçersiniz; ödemeniz öğretmen onaylayana ve ders tamamlanana kadar güvencededir. Bu rehber, öğretmen bulmaktan derse katılmaya kadar her adımı gerçek ekranlar ve kısa videolarla anlatır.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {[["Onaylı", "öğretmenler"], ["Onay yoksa", "tam iade"], ["Program kurmadan", "sanal sınıf"], ["Ücretsiz", "tanışma görüşmesi"]].map(([b, t]) => (
                <span key={t} className="rounded-full border border-white/20 px-3.5 py-1.5 text-sm">
                  <b className="text-gold-400">{b}</b> {t}
                </span>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#bul" className={buttonClasses("primary", "lg")}>
                Videolu tura başla
              </a>
              <Link href="/ogretmenler" className={buttonClasses("outline", "lg", "border-white/30 bg-transparent text-white hover:bg-white/10")}>
                Öğretmen bul
              </Link>
            </div>
          </div>
          <div className="translate-y-6">
            <BrowserShot shot={shot("01-ana-sayfa", "pikampus.com", "Pi Kampüs ana sayfası: kademe, ders ve ders şekliyle öğretmen arama", 1440, 900)} sizes="(min-width: 1152px) 1120px, 100vw" />
          </div>
        </div>
      </section>

      <GuideSection id="adimlar" eyebrow="Beş adımda" title="Öğretmen bulmaktan derse kadar" lead="Her adımda ne olacağını önceden bilirsiniz; süreler ve iade kuralları baştan bellidir." className="border-t-0 pt-24">
        <ol className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
          {steps.map(([title, text], i) => (
            <li key={title} className="grid content-start gap-2 rounded-2xl border border-ink-100 bg-white p-5">
              <span className="font-display text-4xl leading-none font-extrabold text-brand-600">{i + 1}</span>
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="text-[15px] text-ink-500">{text}</p>
            </li>
          ))}
        </ol>
      </GuideSection>

      <GuideSection id="bul" eyebrow="Öğretmen bulma" title="Aradığınız öğretmen birkaç tıkla önünüzde" lead="Ana sayfadan kademe, ders ve ders şeklini seçin; listede fiyat, puan, müsaitlik ve onaylı öğretmen süzgeçleriyle daraltın.">
        <div className="mt-8">
          <GuideVideo src={video("v1-ogretmen-bul")} poster={img("02-liste")} title="Öğretmen bulma ve profil" seconds={26} />
        </div>
        <Feature
          shot={shot("02-liste", "pikampus.com/ogretmenler", "Öğretmen listesi ve süzgeçler", 1440, 900)}
          title="Öğretmen listesi"
          legend={[
            ["Süzgeçler:", "kademe, ders, hizmet (özel ders, soru çözüm, koçluk), online / yüz yüze, ücret, puan, müsaitlik; yalnızca onaylı ya da ücretsiz tanışma sunan öğretmenler."],
            ["Sıralama:", "önerilen, fiyat, puan, yorum sayısı, en çok ders veren, en yeni."],
            ["Öğretmen kartı:", "puan ve yorum sayısı, deneyim, ders şekli, saatlik ücret."],
          ]}
        >
          <Tip title="Bulamadınız mı?">listenin altındaki forma ders ve uygun saatlerinizi bırakın; size uygun öğretmeni bulup dönelim.</Tip>
        </Feature>
      </GuideSection>

      <GuideSection id="profil" eyebrow="Öğretmen profili" title="Karar vermeden önce her şeyi görün" lead="Profilde öğretmenin tanıtımı, eğitimi, verdiği dersler ve ücretleri, gerçek yorumlar ve boş saatleri bir arada.">
        <Feature
          shot={shot("03-profil", "pikampus.com/ogretmen/…", "Öğretmen profili ve randevu kutusu", 1440, 1000)}
          legend={[
            ["Öğretmen bilgileri:", "deneyim, eğitim, verdiği ders sayısı, ortalama yanıt süresi, onaylı rozeti."],
            ["Takvim:", "yeşil noktalı günlerde boş saat var; dolu saatler seçilemez."],
            ["Randevu kutusu:", "hizmet, ders, süre ve ders şekli; ücret KDV dahil görünür."],
          ]}
        />
        <Pair>
          <Figure shot={shot("04-profil-alt", "pikampus.com/ogretmen/…", "Dersler, ücretler ve değerlendirmeler", 1440, 1400, true)}>
            <b>Dersler ve değerlendirmeler:</b> kademe ve ders bazında ücretler, aylık soru aboneliği ve yalnızca dersi tamamlanmış kişilerin yazabildiği yorumlar.
          </Figure>
          <Phones className="mt-0">
            <Phone caption="Profil ve randevu telefonda da aynı kolaylıkta.">
              <PhoneImage src={img("t1-profil-telefon")} alt="Telefonda randevu kutusu" width={780} height={2330} />
            </Phone>
          </Phones>
        </Pair>
      </GuideSection>

      <GuideSection id="randevu" eyebrow="Randevu ve ödeme" title="Saati seçin, güvenle ödeyin" lead="Seçtiğiniz saat ödeme süresince sizin için ayrılır, başkası alamaz. Ödeme bankanızın 3D Secure sayfasında yapılır.">
        <Feature
          shot={shot("05-rezervasyon", "pikampus.com/rezervasyon", "Randevu formu", 1440, 1100, true)}
          title="Randevuyu tamamlama"
          legend={[
            ["Ders kimin için:", "kayıtlı çocuklarınızdan seçin ya da yeni ekleyin."],
            ["Öğretmene not:", "hangi konularda destek istediğinizi yazın; öğretmen derse hazırlıklı gelir."],
            ["Sözleşmeler:", "ön bilgilendirme formu, mesafeli satış sözleşmesi ve iptal-iade koşulları tek onayla."],
            ["Ödemeye geç.", "Kart bilgileri yalnızca bankanın sayfasında girilir."],
          ]}
        >
          <Tip title="İndirim kodunuz mu var?">Formdaki &quot;İndirim kodum var&quot; bağlantısından girin; tutar ödemeden önce güncellenir.</Tip>
        </Feature>
        <div className="mt-8">
          <GuideVideo src={video("v2-randevu")} poster={img("05-rezervasyon")} title="Randevu alma ve ödeme" seconds={25} />
        </div>
      </GuideSection>

      <GuideSection id="onay" eyebrow="Öğretmen onayı" title={`Öğretmen ${s.approvalWindowHours} saat içinde onaylar`} lead="Talep öğretmenin paneline düşer. Onaylanınca saat dolar, size onay ve takvim daveti gider. Reddedilirse ya da süresinde yanıt gelmezse ödemenin tamamı otomatik iade edilir.">
        <Feature
          shot={shot("12-talepler", "pikampus.com/ogretmen-paneli/talepler", "Öğretmen panelinde onay bekleyen talep", 1440, 900)}
          title="Öğretmenin gördüğü ekran"
          legend={[
            ["Talep:", "öğrenci, ders, saat, ders şekli ve velinin notu; yanıt için kalan süre."],
            ["Onayla:", "saat dolar, veliye onay bildirimi ve takvim daveti gider."],
            ["Reddet:", "gerekçe seçilir; ücretin tamamı iade edilir."],
          ]}
        />
        <Pair>
          <GuideVideo src={video("v3-onay")} poster={img("12-talepler")} title="Öğretmen talebi onaylar" seconds={18} />
          <Figure shot={shot("06-derslerim", "pikampus.com/hesabim/derslerim", "Velinin derslerim sayfası", 1440, 900)}>
            <b>Derslerim:</b> yaklaşan, geçmiş ve iptal edilen dersler; her dersin durumu (onay bekleniyor, onaylandı, tamamlandı) tek listede.
          </Figure>
        </Pair>
      </GuideSection>

      <GuideSection id="ders" eyebrow="Ders günü" title="Saatinde “Derse Katıl”, gerisi tarayıcıda" lead={`Online derslerde ders saatinden ${s.classroomOpensMinutesBefore} dakika önce ders sayfasında "Derse Katıl" düğmesi açılır. Dersten 24 saat ve 1 saat önce hatırlatma gelir.`}>
        <Feature
          shot={shot("07-ders", "pikampus.com/hesabim/derslerim/…", "Ders sayfası", 1440, 1100, true)}
          title="Ders sayfası"
          legend={[
            ["Ders bilgileri:", "öğretmen, saat, süre, ders şekli; tek tıkla Google Takvim'e ya da telefonunuzun takvimine ekleyin."],
            ["Ders saatini değiştir:", `dersten en az ${s.rescheduleMinHours} saat önce yeni saat önerin; öğretmen kabul ederse ders taşınır.`],
            ["Randevuyu iptal et:", "kalan süreye göre iade tutarı önceden gösterilir."],
          ]}
        >
          <Note>Ders bitince ders tamamlandı olarak işaretlenir; size puan ve yorum daveti gelir.</Note>
        </Feature>
        <div className="mt-10 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))]">
          {CLASSROOM.map(({ Icon, title, text }) => (
            <div key={title} className="grid content-start gap-2 rounded-2xl border border-ink-100 bg-white p-5">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="text-[15px] text-ink-500">{text}</p>
            </div>
          ))}
        </div>
      </GuideSection>

      <GuideSection id="paket" eyebrow="Paket ve düzenli ders" title="Düzenli çalışana daha uygun" lead="Aynı öğretmenden birden fazla dersi peşin ve indirimli alın, saatleri dilediğiniz zaman seçin. Ya da saat seçerken &quot;her hafta bu saatte tekrarla&quot; ile dönemi tek seferde planlayın.">
        <Feature
          shot={shot("08-paketlerim", "pikampus.com/hesabim/paketlerim", "Paketlerim sayfası", 1440, 900)}
          title="Paketlerim"
          legend={[
            ["Paket:", "kalan ders sayısı ve geçerlilik; paketten alınan dersler tek tek listelenir."],
            ["Saat seç:", "öğretmenin takviminden saat seçip ödeme yapmadan talep gönderin."],
          ]}
        >
          <Note>Öğretmen paketten alınan bir dersi onaylamazsa ya da erken iptal ederseniz ders paketinize geri eklenir. Kullanmadığınız dersleri aynı sayfadan iade edebilirsiniz.</Note>
        </Feature>
      </GuideSection>

      <GuideSection id="soru" eyebrow="Soru çözüm" title="Takıldığı sorunun fotoğrafını çeksin, öğretmen çözsün" lead={`Soru kredisiyle sorunun fotoğrafını gönderin; branş öğretmenlerimizden biri ${s.questionAnswerHours} saat içinde adım adım çözer. Çözülmezse krediniz iade edilir.`}>
        <Pair className="items-center">
          <Phones className="mt-0">
            <GuideVideo phone src={video("v4-soru")} poster={img("09-soru-sor")} title="Telefondan soru gönderme" seconds={16} />
            <Phone caption="Çözüm yazı ve fotoğrafla gelir; öğrenci puanlar, anlamadığı yeri bir kez daha sorabilir.">
              <PhoneImage src={img("t2-cozum-telefon")} alt="Telefonda soru ve çözüm" width={780} height={3650} />
            </Phone>
          </Phones>
          <Figure shot={shot("09-soru-sor", "pikampus.com/soru-sor", "Soru gönderme sayfası", 1440, 1100, true)}>
            <b>Soru gönder:</b> kalan krediniz, kademe ve ders seçimi, sorunun fotoğrafı ve isteğe bağlı not.
          </Figure>
        </Pair>
        <Feature
          shot={shot("10-soru-cozum", "pikampus.com/hesabim/sorularim/…", "Soru ve öğretmenin çözümü", 1440, 1300, true)}
          title="Soru ve çözüm"
          legend={[
            ["Sorunun fotoğrafı", "ve öğrencinin notu."],
            ["Öğretmenin çözümü:", "adım adım yazı, isterse fotoğraf ya da anlatım videosu."],
          ]}
        >
          <Note>Kendi öğretmeninize her gün soru göndermek isterseniz öğretmen profilindeki aylık soru aboneliğini seçebilirsiniz.</Note>
        </Feature>
        {s.groupsEnabled ? (
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-100 bg-white p-6">
            <div className="max-w-2xl">
              <h3 className="text-xl font-bold">Grup dersleri</h3>
              <p className="mt-1 text-[15px] text-ink-500">
                {s.groupMinParticipants}–{s.groupMaxCapacity} kişilik online sınıflarda birebir dersten çok daha uygun fiyata ders alın. Ders, kayıt bitişinde en az katılımcı sayısına ulaşmazsa ödediğiniz ücretin tamamı iade edilir.
              </p>
            </div>
            <Link href="/grup-dersleri" className={buttonClasses("outline", "md")}>
              Grup derslerini gör
            </Link>
          </div>
        ) : null}
      </GuideSection>

      <GuideSection id="guvence" eyebrow="Güvence" title="Paranız ve çocuğunuz güvende" lead="Pi Kampüs, veliyle öğretmen arasındaki her adımı kayıt altında tutar ve kuralları baştan yazar.">
        <div className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          {trust.map(({ Icon, title, text }) => (
            <div key={title} className="grid content-start gap-2 rounded-2xl border border-ink-100 bg-white p-5">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="text-[15px] text-ink-500">{text}</p>
            </div>
          ))}
        </div>
        <Note className="mt-6">
          Ayrıntılı kurallar:{" "}
          <Link href="/sayfa/iptal-ve-iade-politikasi" className="font-semibold text-brand-700 underline">
            İptal ve iade politikası
          </Link>
          .
        </Note>
      </GuideSection>

      <GuideSection id="ogretmen" eyebrow="Öğretmenler için" title="Bilginizi daha çok öğrenciye ulaştırın" lead={`Fiyatınızı ve takviminizi siz belirlersiniz; öğrenci bulma, ödeme tahsili, sanal sınıf ve hatırlatmalar Pi Kampüs'te. Platform hizmet bedeli oranı: %${commission}.`}>
        <Feature
          shot={shot("13-ogretmen-ol", "pikampus.com/ogretmen-ol", "Öğretmen başvuru sayfası", 1440, 1000)}
          title="Başvuru"
          legend={[
            ["Örnek kazanç:", "öğrencinin ödediği, hizmet bedeli ve elinize geçen tutar."],
            ["Başvuru formu:", "ders verdiğiniz kademe ve dersler; ekibimiz belgelerinizi inceleyip hesabınızı açar."],
          ]}
        />
        <Feature
          flip
          shot={shot("11-panel", "pikampus.com/ogretmen-paneli", "Öğretmen paneli", 1440, 900)}
          title="Öğretmen paneli"
          legend={[
            ["Menü:", "dersler ve talepler, mesajlar, soru havuzu, grup dersleri, profil, takvim, kazançlar."],
            ["Yaklaşan dersler", "ve onay bekleyen talepler tek bakışta."],
          ]}
        >
          <Note>Kazancınız, ders tamamlanıp itiraz süresi ve ödeme kuruluşunun aktarım süresi dolunca kullanılabilir bakiyenize geçer ve IBAN&apos;ınıza ödenir.</Note>
        </Feature>
        <Gallery
          items={[
            { shot: shot("14-takvim", "Müsaitlik takvimi", "Müsaitlik takvimi", 1440, 1100), caption: "Müsaitlik: haftalık şablon, izin günleri ve ek saatler; dersler arası tampon süre." },
            { shot: shot("15-fiyatlar", "Dersler ve fiyatlar", "Dersler ve fiyatlar", 1440, 1100), caption: "Dersler ve fiyatlar: kademe ve derse göre ücret, ücretsiz tanışma görüşmesi, paket indirimleri." },
            { shot: shot("16-havuz", "Soru havuzu", "Soru havuzu", 1440, 900), caption: "Soru havuzu: branşınıza uygun soruyu üstlenip çözün, soru başına kazanın." },
            { shot: shot("17-kazanclar", "Kazançlarım", "Kazançlar", 1440, 1000), caption: "Kazançlarım: bekleyen, kullanılabilir ve ödenen tutarlar, hareketler ve ödeme bilgileri." },
          ]}
        />
        <div className="mt-8">
          <Link href="/ogretmen-ol" className={buttonClasses("ink", "lg")}>
            Öğretmen olarak başvurun
          </Link>
        </div>
      </GuideSection>

      <GuideSection id="sss" eyebrow="Sık sorulan sorular" title="Aklınıza takılanlar">
        <div className="mt-8 space-y-2.5">
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
          <p className="text-xs font-bold tracking-[0.12em] text-gold-400 uppercase">Pi Kampüs · Özel ders</p>
          <h2 className="max-w-[20ch] text-3xl font-extrabold sm:text-4xl">Doğru öğretmen bir tık uzağınızda.</h2>
          <p className="max-w-3xl text-lg text-ink-200">Öğretmenleri inceleyin, ücretsiz tanışın, ilk dersinizi bugün planlayın.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href="/ogretmenler" className={buttonClasses("primary", "lg")}>
              Öğretmen bul
            </Link>
            <Link href="/soru-sor" className={buttonClasses("outline", "lg", "border-white/30 bg-transparent text-white hover:bg-white/10")}>
              Soru sor
            </Link>
          </div>
        </div>
      </section>
      <p className="mx-auto max-w-6xl px-4 py-6 text-[13.5px] text-ink-500">Ekran görüntüleri ve videolar Pi Kampüs&apos;ün gerçek ekranlarından örnek hesaplarla alınmıştır; kişi bilgileri örnektir.</p>
    </>
  );
}
