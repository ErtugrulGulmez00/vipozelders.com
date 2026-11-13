import { BadgeCheck, BookOpenCheck, ClipboardList, HandCoins, LineChart, MessageSquareLock, PhoneCall, PhoneOff, ShieldAlert, Video } from "lucide-react";
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
import { parseCoachTiers } from "@/lib/pi-koc";
import { getSiteSettings } from "@/server/site";

export const metadata: Metadata = {
  alternates: { canonical: "/nasil-calisir/ozel-ders" },
  title: "Özel ders nasıl çalışır? Adım adım rehber",
  description: "Öğretmen bulma, ücretsiz ders talebi, öğretmenin sizi araması ve Pi Koç ile program, ödev ve deneme takibi: Pi Kampüs'te özel dersi gerçek ekranlar ve videolarla tanıyın.",
};

const BASE = "/tanitim/ozel-ders";
const shot = (file: string, url: string, alt: string, width: number, height: number, tall?: boolean): Shot => ({ src: `${BASE}/${file}.jpg`, url, alt, width, height, tall });
const video = (file: string) => `${BASE}/video/${file}.mp4`;
const img = (file: string) => `${BASE}/${file}.jpg`;

const NAV: [string, string][] = [
  ["adimlar", "Adımlar"],
  ["bul", "Öğretmen bul"],
  ["profil", "Profil"],
  ["talep", "Ders talebi"],
  ["kabul", "Kabul"],
  ["takip", "Takip"],
  ["guvence", "Güvence"],
  ["ogretmen", "Öğretmenler için"],
  ["sss", "SSS"],
];

const TRACKING = [
  { Icon: ClipboardList, title: "Haftalık program", text: "Öğretmenin hazırladığı çalışma programı ve ödevler; çocuğunuz yaptıklarını işaretler." },
  { Icon: BookOpenCheck, title: "Soru takibi", text: "Günlük çözülen soru, doğru ve yanlış sayıları derse göre." },
  { Icon: LineChart, title: "Deneme sonuçları", text: "Net grafiği ve ders ders gelişim; deneme deneme karşılaştırma." },
  { Icon: Video, title: "Görüntülü ders", text: "Öğretmen görüşme açar, çocuğunuz aynı hesaptan tek tıkla katılır; program kurmak gerekmez." },
];

export default async function PrivateLessonGuidePage() {
  const s = await getSiteSettings();
  const tiers = parseCoachTiers(s.piKocTiers);
  const tierText = tiers.map((t) => `${t.students} öğrenci ${t.priceTl.toLocaleString("tr-TR")} ₺`).join(", ");

  const steps = [
    ["Öğretmeni bulun", "Kademe, ders, ders şekli, il/ilçe ve fiyata göre süzün; onaylı rozetine, tanıtımına ve yorumlara bakın."],
    ["Ders talebi gönderin", "Profildeki kutuya çocuğunuzun adını, sınıfını, dersi ve uygun saatleri yazın. Talep göndermek ücretsizdir."],
    ["Öğretmen sizi arar", "Talebi kabul eden öğretmen telefonunuzu görür ve sizi arar. Ders saatini ve ücreti birlikte konuşursunuz."],
    ["Takip tek yerde", "Çocuğunuz öğretmenin Pi Koç'una eklenir. Program, ödev, soru ve deneme takibi hesabınızdaki Koçum bölümünde."],
  ];

  const trust = [
    { Icon: BadgeCheck, title: "Onaylı öğretmen", text: "Belgeleri ekibimizce incelenen öğretmenler \"Onaylı öğretmen\" rozeti taşır; listede yalnızca onaylıları gösterebilirsiniz." },
    { Icon: PhoneOff, title: "Numaranız korunur", text: "Telefonunuzu yalnızca talebinizi kabul eden öğretmen görür; profilde ve mesajlarda iletişim bilgisi gizlenir." },
    { Icon: HandCoins, title: "Aracı komisyon yok", text: "Ücreti öğretmenle doğrudan konuşursunuz. Pi Kampüs ders ücretine karışmaz, araya ücret eklemez." },
    { Icon: MessageSquareLock, title: "Kayıtlı mesajlaşma", text: "Talepten önce öğretmenle site içinden yazışabilirsiniz; yazışmalar kayıt altında kalır." },
    { Icon: PhoneCall, title: "Geri dönüş haberi", text: "Öğretmen talebinizi kabul ettiğinde ya da geri çevirdiğinde size bildirim gelir; beklemede kalmazsınız." },
    { Icon: ShieldAlert, title: "Şikâyet ve kurallar", text: "Öğretmenler saygılı iletişim ve doğru bilgi kurallarını kabul eder. Sorun yaşarsanız bize yazın; kurala uymayan öğretmenin hesabı kapatılır." },
  ];

  const faq = [
    ["Üyelik ya da talep ücretli mi?", "Hayır. Öğretmenlere üye olmadan bakabilirsiniz; ders talebi göndermek ve takip için ücretsiz veli hesabı yeterli."],
    ["Ders ücretini kime ödüyorum?", "Doğrudan öğretmene. Ücreti, ders saatini ve ödeme şeklini öğretmenle telefonda konuşursunuz; Pi Kampüs ödemeye aracılık etmez ve komisyon almaz."],
    ["Aynı anda birkaç öğretmene talep gönderebilir miyim?", "Evet, farklı öğretmenlere gönderebilirsiniz. Aynı öğretmene, önceki talebiniz yanıtlanana kadar ikinci talep gönderilemez; günde en fazla 5 talep gönderilebilir."],
    ["Öğretmen talebimi geri çevirirse?", "Size bildirim gelir. Listeden başka bir öğretmen seçebilir ya da listenin altındaki forma ihtiyacınızı yazıp size uygun öğretmeni bulmamızı isteyebilirsiniz."],
    ["Koçum bölümünde neleri görürüm?", "Öğretmenin hazırladığı programı ve ödevleri, çözülen soru sayılarını, deneme sonuçlarını ve öğretmenin gönderdiği haftalık raporları. Öğretmen görüntülü ders açtığında katılım bağlantısı da burada görünür."],
    ["Birden fazla çocuğum var, tek hesap yeter mi?", "Evet. Her talepte dersin hangi çocuğunuz için olduğunu yazarsınız; tüm çocuklarınızın takibi aynı hesapta görünür."],
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
              Doğru öğretmen, <span className="text-gold-400">ücretsiz talep</span>, düzenli takip.
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-ink-200">
              Pi Kampüs&apos;te öğretmeni tanıtımına, derslerine ve fiyatına bakarak seçer, ücretsiz ders talebi gönderirsiniz. Kabul eden öğretmen sizi arar; ücreti doğrudan onunla konuşursunuz. Çocuğunuzun programını, ödevlerini ve deneme sonuçlarını hesabınızdan takip edersiniz. Bu rehber her adımı gerçek ekranlar ve kısa videolarla anlatır.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {[["Onaylı", "öğretmenler"], ["Ücretsiz", "ders talebi"], ["Aracı", "komisyon yok"], ["Tek hesapta", "program ve deneme takibi"]].map(([b, t]) => (
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
            <BrowserShot shot={shot("01-ana-sayfa", "pikampus.com/ozel-ders", "Özel ders sayfası: kademe, ders ve ders şekliyle öğretmen arama", 1440, 900)} sizes="(min-width: 1152px) 1120px, 100vw" />
          </div>
        </div>
      </section>

      <GuideSection id="adimlar" eyebrow="Dört adımda" title="Öğretmen bulmaktan düzenli takibe" lead="Her adımda ne olacağını önceden bilirsiniz; talep ücretsizdir, ücreti öğretmenle siz konuşursunuz." className="border-t-0 pt-24">
        <ol className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          {steps.map(([title, text], i) => (
            <li key={title} className="grid content-start gap-2 rounded-2xl border border-ink-100 bg-white p-5">
              <span className="font-display text-4xl leading-none font-extrabold text-brand-600">{i + 1}</span>
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="text-[15px] text-ink-500">{text}</p>
            </li>
          ))}
        </ol>
      </GuideSection>

      <GuideSection id="bul" eyebrow="Öğretmen bulma" title="Aradığınız öğretmen birkaç tıkla önünüzde" lead="Özel ders sayfasında kademe, ders ve ders şeklini seçin; listede fiyat, puan, müsaitlik ve onaylı öğretmen süzgeçleriyle daraltın.">
        <div className="mt-8">
          <GuideVideo src={video("v1-ogretmen-bul")} poster={img("02-liste")} title="Öğretmen bulma ve profil" seconds={26} />
        </div>
        <Feature
          shot={shot("02-liste", "pikampus.com/ogretmenler", "Öğretmen listesi ve süzgeçler", 1440, 900)}
          title="Öğretmen listesi"
          legend={[
            ["Süzgeçler:", "kademe, ders, hizmet (özel ders, koçluk), online / yüz yüze, il ve ilçe, ücret, puan, uygun saatler; yalnızca onaylı öğretmenler."],
            ["Sıralama:", "önerilen, fiyat, puan, yorum sayısı, en yeni."],
            ["Öğretmen kartı:", "deneyim, ders şekli, verdiği dersler ve saatlik ücret."],
          ]}
        >
          <Tip title="Bulamadınız mı?">listenin altındaki forma ders ve uygun saatlerinizi bırakın; size uygun öğretmeni bulup dönelim.</Tip>
        </Feature>
      </GuideSection>

      <GuideSection id="profil" eyebrow="Öğretmen profili" title="Karar vermeden önce her şeyi görün" lead="Profilde öğretmenin tanıtımı, eğitimi, verdiği dersler ve ücretleri, yorumlar ve ders talebi kutusu bir arada.">
        <Feature
          shot={shot("03-profil", "pikampus.com/ogretmen/…", "Öğretmen profili ve ders talebi kutusu", 1440, 1000)}
          legend={[
            ["Öğretmen bilgileri:", "deneyim, eğitim, ders şekli, ortalama yanıt süresi, onaylı rozeti."],
            ["Ders talebi kutusu:", "talep göndermek için ücretsiz veli hesabıyla giriş yapmanız yeterli."],
          ]}
        />
        <Pair>
          <Figure shot={shot("04-profil-alt", "pikampus.com/ogretmen/…", "Dersler, ücretler ve değerlendirmeler", 1440, 1400, true)}>
            <b>Dersler ve ücretler:</b> kademe ve ders bazında öğretmenin saatlik ücreti. Ücret bilgi içindir; kesin tutarı öğretmenle konuşursunuz.
          </Figure>
          <Phones className="mt-0">
            <Phone caption="Profil ve ders talebi telefonda da aynı kolaylıkta.">
              <PhoneImage src={img("t1-profil-telefon")} alt="Telefonda ders talebi kutusu" width={780} height={3200} />
            </Phone>
          </Phones>
        </Pair>
      </GuideSection>

      <GuideSection id="talep" eyebrow="Ders talebi" title="İhtiyacınızı yazın, öğretmene iletelim" lead="Talep kutusu kısa bir formdur. Telefonunuz yalnızca öğretmen talebi kabul ederse görünür; o zamana kadar gizli kalır.">
        <Feature
          shot={shot("05-talep", "pikampus.com/ogretmen/…", "Ders talebi formu", 1440, 1100, true)}
          title="Ders talebi formu"
          legend={[
            ["Öğrenci:", "çocuğunuzun adı ve sınıfı."],
            ["Ders ve ders şekli:", "öğretmenin verdiği derslerden biri; online, yüz yüze ya da fark etmez."],
            ["Uygun saatler ve not:", "hangi gün ve saatlerin uygun olduğunu, hangi konularda destek istediğinizi yazın."],
            ["Telefon ve onay:", "numaranızın yalnızca talebi kabul eden öğretmenle paylaşılmasını onaylarsınız."],
          ]}
        >
          <Note>Talebiniz iletilince profilde &quot;Talebiniz iletildi&quot; yazar. Aynı öğretmene, bu talep yanıtlanana kadar ikinci talep gönderilemez.</Note>
        </Feature>
        <div className="mt-8">
          <GuideVideo src={video("v2-talep")} poster={img("05-talep")} title="Ders talebi gönderme" seconds={21} />
        </div>
      </GuideSection>

      <GuideSection id="kabul" eyebrow="Öğretmenin yanıtı" title="Öğretmen kabul eder, sizi arar" lead="Talep öğretmenin panelindeki &quot;Ders talepleri&quot; sayfasına düşer. Kabul ederse telefonunuzu görür ve sizi arar; geri çevirirse size nazik bir bildirim gelir.">
        <Feature
          shot={shot("12-ders-talepleri", "pikampus.com/ogretmen-paneli/ders-talepleri", "Öğretmen panelinde yanıt bekleyen ders talebi", 1440, 900)}
          title="Öğretmenin gördüğü ekran"
          legend={[
            ["Talep:", "öğrenci, sınıf, ders, ders şekli, uygun saatler ve velinin notu. Telefon kabul edilene kadar gizlidir."],
            ["Kabul et:", "velinin telefonu görünür, veliye bildirim gider, öğrenci öğretmenin Pi Koç'una eklenir."],
            ["Geri çevir:", "veliye nazik bir bildirim gider."],
          ]}
        />
        <Pair>
          <GuideVideo src={video("v3-kabul")} poster={img("16-kabul")} title="Öğretmen talebi kabul eder" seconds={21} />
          <Figure shot={shot("16-kabul", "pikampus.com/ogretmen-paneli/ders-talepleri", "Kabul edilen talep: telefon ve Pi Koç bağlantısı", 1440, 900)}>
            <b>Kabulden sonra:</b> velinin telefonu, tek tıkla arama ve WhatsApp bağlantısı; öğrencinin Pi Koç sayfasına geçiş.
          </Figure>
        </Pair>
      </GuideSection>

      <GuideSection id="takip" eyebrow="Düzenli takip" title="Çocuğunuzun gelişimi hesabınızda" lead="Talebi kabul edilen öğrenci, öğretmenin Pi Koç hesabına eklenir ve sizin veli hesabınıza bağlanır. Öğretmenin girdiği her şeyi Koçum bölümünden görürsünüz.">
        <Pair>
          <Figure shot={shot("06-kocum", "pikampus.com/kocum", "Velinin Koçum sayfası", 1440, 900)}>
            <b>Koçum:</b> öğretmenin hazırladığı program ve ödevler, soru takibi, deneme sonuçları ve haftalık raporlar.
          </Figure>
          <Phones className="mt-0">
            <Phone caption="Takip telefondan da aynı hesapla.">
              <PhoneImage src={img("t3-kocum-telefon")} alt="Telefonda Koçum sayfası" width={780} height={1688} />
            </Phone>
          </Phones>
        </Pair>
        <div className="mt-10 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))]">
          {TRACKING.map(({ Icon, title, text }) => (
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

      <GuideSection id="guvence" eyebrow="Güvence" title="Numaranız ve çocuğunuz güvende" lead="Pi Kampüs öğretmenleri inceler, iletişim bilgilerinizi korur ve kuralları baştan yazar. Ders ücretine karışmaz.">
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
      </GuideSection>

      <GuideSection
        id="ogretmen"
        eyebrow="Öğretmenler için"
        title="Velilerden ders talebi alın, ücreti kendiniz alın"
        lead={`Profil açmak ve ders talebi almak ücretsiz; ders ücretinizden kesinti yok. Kabul ettiğiniz öğrenciler Pi Koç hesabınıza düşer: ${s.piKocFreeStudents} öğrenciye kadar ücretsiz, daha fazlası için aylık paketler (${tierText}).`}
      >
        <Feature
          shot={shot("13-ogretmen-ol", "pikampus.com/ogretmen-ol", "Öğretmen başvuru sayfası", 1440, 1000)}
          title="Başvuru"
          legend={[
            ["Ne ödersiniz:", "profil ve talepler ücretsiz, Pi Koç paketleri ve ders ücretinizden kesinti olmadığı tek tabloda."],
            ["Başvuru formu:", "ders verdiğiniz kademe ve dersler; ekibimiz belgelerinizi inceleyip hesabınızı açar."],
          ]}
        />
        <Feature
          flip
          shot={shot("11-panel", "pikampus.com/ogretmen-paneli", "Öğretmen paneli", 1440, 900)}
          title="Öğretmen paneli"
          legend={[
            ["Menü:", "ders talepleri, Pi Koç öğrencileri, mesajlar, profil ve fiyatlar, müsaitlik takvimi, yorumlar."],
            ["Özet:", "yanıt bekleyen ders talepleri ve Pi Koç'taki öğrenci sayınız tek bakışta."],
          ]}
        >
          <Note>Ücretli Pi Koç paketindeki öğretmenler aramada öne çıkar; PDF&apos;ten deneme aktarımı, konu analizi ve kendi adınızla otomatik haftalık veli raporu açılır.</Note>
        </Feature>
        <Gallery
          items={[
            { shot: shot("18-pikoc-ogrenci", "Pi Koç · öğrenci", "Pi Koç öğrenci sayfası", 1440, 1000), caption: "Pi Koç: talepten gelen öğrencinin programı, ödevleri, soru ve deneme takibi, veli raporu." },
            { shot: shot("14-takvim", "Müsaitlik takvimi", "Müsaitlik takvimi", 1440, 1100), caption: "Müsaitlik: haftalık uygun saatleriniz; veliler aramada saate göre süzer." },
            { shot: shot("15-fiyatlar", "Dersler ve fiyatlar", "Dersler ve fiyatlar", 1440, 900), caption: "Dersler ve fiyatlar: kademe ve derse göre saatlik ücretiniz; profilde bilgi olarak görünür." },
          ]}
        />
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/ogretmen-ol" className={buttonClasses("ink", "lg")}>
            Öğretmen olarak başvurun
          </Link>
          <Link href="/pi-koc" className={buttonClasses("outline", "lg")}>
            Pi Koç&apos;u inceleyin
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
          <h2 className="max-w-[20ch] text-3xl font-extrabold sm:text-4xl">Doğru öğretmen bir talep uzağınızda.</h2>
          <p className="max-w-3xl text-lg text-ink-200">Öğretmenleri inceleyin, ücretsiz ders talebi gönderin; kabul eden öğretmen sizi arasın.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href="/ogretmenler" className={buttonClasses("primary", "lg")}>
              Öğretmen bul
            </Link>
          </div>
        </div>
      </section>
      <p className="mx-auto max-w-6xl px-4 py-6 text-[13.5px] text-ink-500">Ekran görüntüleri ve videolar Pi Kampüs&apos;ün gerçek ekranlarından örnek hesaplarla alınmıştır; kişi bilgileri örnektir.</p>
    </>
  );
}
