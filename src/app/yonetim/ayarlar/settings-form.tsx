"use client";

import { PhoneInput } from "@/components/ui/phone-input";
import type { ReactNode } from "react";
import { saveSettingsAction } from "@/actions/admin";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { CHANNEL_MODE_LABEL, CHANNEL_MODES } from "@/lib/notification-channels";
import type { SiteSettings } from "@/server/settings";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function NumberField({ name, label, hint, value, suffix }: { name: keyof SiteSettings; label: string; hint?: string; value: number; suffix: string }) {
  return (
    <Field label={`${label} (${suffix})`} hint={hint}>
      <Input name={name} type="number" defaultValue={value} required />
      <FieldError name={name} />
    </Field>
  );
}

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  return (
    <ActionForm action={saveSettingsAction} className="space-y-6">
      <Section title="Genel" description="Sitede, e-postalarda ve yasal sayfalarda kullanılır.">
        <Field label="Site adı">
          <Input name="siteName" defaultValue={settings.siteName} required />
        </Field>
        <Field label="Slogan">
          <Input name="siteTagline" defaultValue={settings.siteTagline} />
        </Field>
        <Field label="İletişim e-postası">
          <Input name="contactEmail" type="email" defaultValue={settings.contactEmail} />
        </Field>
        <Field label="İletişim telefonu">
          <PhoneInput name="contactPhone" defaultValue={settings.contactPhone} />
        </Field>
        <Field label="WhatsApp destek numarası" hint="Sitenin sağ altındaki WhatsApp düğmesi bu numaraya yazar. Boş bırakırsanız düğme gösterilmez.">
          <Input name="supportWhatsapp" defaultValue={settings.supportWhatsapp} placeholder="+90 5xx xxx xx xx" />
        </Field>
        <Field label="Bildirim kanalı" className="sm:col-span-2" hint="Öğrenci, veli, öğretmen ve kurum bildirimlerinin dış kanalı. WhatsApp şablonları Meta’da onaylanana kadar “Yalnızca e-posta” seçili kalsın; onaylanınca buradan değiştirin. Site/uygulama bildirimi her zaman gider.">
          <Select name="notificationChannel" defaultValue={settings.notificationChannel}>
            {CHANNEL_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {CHANNEL_MODE_LABEL[mode]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="WhatsApp bildirim şablonu (Meta onaylı)" hint="LetsBot panelinde onaylanan şablonun adı; 3 değişkenli: {{1}} başlık, {{2}} metin, {{3}} bağlantı. Boşsa düz metin gider ve yalnızca son 24 saatte size yazmış kişiye ulaşır.">
          <Input name="whatsappTemplateName" defaultValue={settings.whatsappTemplateName} placeholder="pikampus_bildirim" />
        </Field>
        <Field label="Şablon dili">
          <Input name="whatsappTemplateLanguage" defaultValue={settings.whatsappTemplateLanguage} placeholder="tr" />
        </Field>
        <NumberField name="centerWhatsappMonthlyLimit" label="Kurum başına aylık WhatsApp sınırı" hint="Dolunca kurumun velilerine yalnızca site/uygulama bildirimi gider. 0: kurumlara WhatsApp kapalı." value={settings.centerWhatsappMonthlyLimit} suffix="mesaj" />
        <Field label="Ticari unvan" hint="Örn: VIP Eğitim Teknolojileri Ltd. Şti.">
          <Input name="companyName" defaultValue={settings.companyName} />
        </Field>
        <Field label="Vergi dairesi / no · MERSİS">
          <Input name="companyTaxInfo" defaultValue={settings.companyTaxInfo} />
        </Field>
        <Field label="Şirket adresi" className="sm:col-span-2">
          <Textarea name="companyAddress" rows={2} defaultValue={settings.companyAddress} />
        </Field>
        <Field label="Duyuru şeridi (boşsa gösterilmez)" className="sm:col-span-2">
          <Input name="announcement" defaultValue={settings.announcement} placeholder="Örn: LGS kampı kayıtları başladı!" />
        </Field>
        <Field label="Ana sayfa teklif satırı" className="sm:col-span-2" hint="Ana sayfadaki sarı kutu; boşsa görünmez. İki noktadan önceki kısım kalın yazılır.">
          <Input name="homeFounderOffer" defaultValue={settings.homeFounderOffer} placeholder="Örn: Kurucu kurum teklifi: ilk 10 kuruma ilk yıl %40 indirim." />
        </Field>
        <Field label="Ana sayfa kurum yorumları" className="sm:col-span-2" hint="Her satıra bir yorum: Yorum | Kişi | Kurum, il. Boşsa bölüm görünmez. Yalnızca izin aldığınız gerçek yorumları yazın.">
          <Textarea name="homeTestimonials" rows={3} defaultValue={settings.homeTestimonials} placeholder="Yoklama artık 2 dakika sürüyor. | Ayşe Yılmaz | Örnek Etüt, Bitlis" />
        </Field>
      </Section>

      <Section title="Komisyon ve randevu kuralları">
        <Field label="Varsayılan komisyon (%)" hint="Öğretmen bazında ayrıca değiştirilebilir.">
          <Input name="commissionRateBps" inputMode="decimal" defaultValue={String(settings.commissionRateBps / 100)} required />
        </Field>
        <NumberField name="paymentHoldMinutes" label="Ödeme için saat ayırma süresi" value={settings.paymentHoldMinutes} suffix="dakika" />
        <NumberField name="approvalWindowHours" label="Öğretmen onay süresi" value={settings.approvalWindowHours} suffix="saat" />
        <NumberField name="approvalMinHoursBeforeStart" label="Onay en geç dersten kaç saat önce" value={settings.approvalMinHoursBeforeStart} suffix="saat" />
        <NumberField name="minNoticeHours" label="En erken randevu" hint="Şu andan itibaren" value={settings.minNoticeHours} suffix="saat" />
        <div className="sm:col-span-2">
          <Checkbox name="allowSameDayBooking" defaultChecked={settings.allowSameDayBooking} label="Aynı güne randevu alınabilsin (kapalıyken en erken yarına randevu alınır; öğretmenin onaylayacak zamanı olur)" />
        </div>
        <NumberField name="maxAdvanceDays" label="En geç randevu" value={settings.maxAdvanceDays} suffix="gün ileri" />
        <NumberField name="classroomOpensMinutesBefore" label="Sanal sınıf dersten kaç dakika önce açılsın" value={settings.classroomOpensMinutesBefore} suffix="dakika" />
      </Section>

      <Section title="İptal, iade ve itiraz" description="Bu değerler yasal sayfalardaki metinlere de otomatik yansır.">
        <NumberField name="fullRefundHours" label="Tam iade için en az" value={settings.fullRefundHours} suffix="saat önce" />
        <NumberField name="partialRefundHours" label="Kısmi iade için en az" value={settings.partialRefundHours} suffix="saat önce" />
        <NumberField name="partialRefundPercent" label="Kısmi iade oranı" value={settings.partialRefundPercent} suffix="%" />
        <NumberField name="disputeWindowHours" label="Sorun bildirme süresi" hint="Ders ya da çözümden sonra öğrencinin itiraz edebileceği süre." value={settings.disputeWindowHours} suffix="saat" />
        <Field label="Öğretmen ödeme günleri" hint="Ayın hangi günleri ödenebilir bakiyeler havale edilir (1-28, virgülle). Öğretmenlere ve size bu günler gösterilir.">
          <Input name="payoutDays" defaultValue={settings.payoutDays} placeholder="1,15" required />
          <FieldError name="payoutDays" />
        </Field>
        <NumberField name="settlementDays" label="Ödeme kuruluşu aktarım süresi" hint="Öğretmen hakedişi, öğrencinin ödemesinden bu kadar gün geçmeden serbest kalmaz (PayTR anlaşması)." value={settings.settlementDays} suffix="gün" />
        <NumberField name="reviewWindowDays" label="Değerlendirme yapma süresi" value={settings.reviewWindowDays} suffix="gün" />
      </Section>

      <Section title="Grup dersi" description="Öğretmen 4–10 kişilik grup dersi programı açar; öğrenciler kişi başı öder. Kayıt bitişinde en az kişi dolmazsa ders iptal olur, herkese tam iade yapılır. Öğretmen payı her oturum yapıldıkça serbest kalır.">
        <div className="sm:col-span-2">
          <Checkbox name="groupsEnabled" defaultChecked={settings.groupsEnabled} label="Grup dersi açık" />
        </div>
        <Field label="Grup dersi komisyonu (%)">
          <Input name="groupCommissionBps" inputMode="decimal" defaultValue={String(settings.groupCommissionBps / 100)} required />
        </Field>
        <div className="hidden sm:block" />
        <NumberField name="groupMinParticipants" label="En az katılımcı" value={settings.groupMinParticipants} suffix="kişi" />
        <NumberField name="groupMaxCapacity" label="En fazla kontenjan" value={settings.groupMaxCapacity} suffix="kişi" />
        <NumberField name="groupMinPriceTl" label="En düşük kişi başı ücret" value={settings.groupMinPriceTl} suffix="TL" />
        <NumberField name="groupMaxPriceTl" label="En yüksek kişi başı ücret" value={settings.groupMaxPriceTl} suffix="TL" />
      </Section>

      <Section title="Paket ders, düzenli ders ve erteleme" description="Öğretmen paket indirimlerini kendisi belirler (en fazla aşağıdaki yüzde). Düzenli ders, haftalık randevuları otomatik oluşturan bir pakettir. Erteleme: taraflardan biri yeni saat önerir, diğeri kabul eder.">
        <div className="sm:col-span-2">
          <Checkbox name="packagesEnabled" defaultChecked={settings.packagesEnabled} label="Paket ders ve düzenli ders açık" />
        </div>
        <NumberField name="packageMaxLessons" label="Pakette en fazla ders" value={settings.packageMaxLessons} suffix="ders" />
        <NumberField name="packageMaxDiscountPercent" label="Öğretmenin verebileceği en yüksek paket indirimi" value={settings.packageMaxDiscountPercent} suffix="%" />
        <NumberField name="packageValidityMonths" label="Paket geçerlilik süresi" hint="Süre dolunca kullanılmayan derslerin ücreti iade edilir." value={settings.packageValidityMonths} suffix="ay" />
        <div className="hidden sm:block" />
        <NumberField name="rescheduleMinHours" label="Erteleme en geç dersten kaç saat önce" value={settings.rescheduleMinHours} suffix="saat" />
        <NumberField name="rescheduleMaxPerBooking" label="Ders başına en fazla erteleme" value={settings.rescheduleMaxPerBooking} suffix="kez" />
      </Section>

      <Section title="Arkadaşını getir" description="Her veli/öğrencinin kişisel davet bağlantısı olur. Davetle kayıt olan yeni üyeye ilk siparişinde indirim yapılır. İndirim platformun hizmet bedelinden karşılanır.">
        <div className="sm:col-span-2">
          <Checkbox name="referralEnabled" defaultChecked={settings.referralEnabled} label="Arkadaşını getir açık" />
        </div>
        <NumberField name="referralDiscountPercent" label="Yeni üyeye ilk sipariş indirimi" value={settings.referralDiscountPercent} suffix="%" />
      </Section>

      <Section title="Kurum paneli abonelikleri" description="Tek paket vardır, fiyatı öğrenci kademesi belirler. Fiyatlar KDV dahil; “Kurumlar için” sayfasında görünür.">
        <NumberField name="centerTrialDays" label="Yeni kuruma tanınan ilk kullanım süresi" hint="Sitede ilan edilmez; kurum hesabı açılırken uygulanır." value={settings.centerTrialDays} suffix="gün" />
        <div className="hidden sm:block" />
        <NumberField name="centerTier20Students" label="20 öğrenciye kadar · öğrenci sınırı (yalnızca Etüt Merkezi)" value={settings.centerTier20Students} suffix="öğrenci" />
        <div className="hidden sm:block" />
        <NumberField name="centerTier100Students" label="100 öğrenciye kadar · öğrenci sınırı" value={settings.centerTier100Students} suffix="öğrenci" />
        <div className="hidden sm:block" />
        <NumberField name="centerTier200Students" label="200 öğrenciye kadar · öğrenci sınırı" value={settings.centerTier200Students} suffix="öğrenci" />
        <div className="hidden sm:block" />
        <NumberField name="centerTierPlusStudents" label="Kurumsal (200+) · öğrenci sınırı" hint="Yeni Kurumsal kurum için başlangıç sınırı; kurum sayfasından değiştirilir." value={settings.centerTierPlusStudents} suffix="öğrenci" />
        <div className="hidden sm:block" />
        <NumberField name="centerEtut20PriceTl" label="20 öğrenciye kadar · aylık" value={settings.centerEtut20PriceTl} suffix="TL / ay" />
        <NumberField name="centerEtut20YearlyTl" label="20 öğrenciye kadar · yıllık" value={settings.centerEtut20YearlyTl} suffix="TL / yıl" />
        <NumberField name="centerEtut100PriceTl" label="100 öğrenciye kadar · aylık" value={settings.centerEtut100PriceTl} suffix="TL / ay" />
        <NumberField name="centerEtut100YearlyTl" label="100 öğrenciye kadar · yıllık" value={settings.centerEtut100YearlyTl} suffix="TL / yıl" />
        <NumberField name="centerEtut200PriceTl" label="200 öğrenciye kadar · aylık" value={settings.centerEtut200PriceTl} suffix="TL / ay" />
        <NumberField name="centerEtut200YearlyTl" label="200 öğrenciye kadar · yıllık" value={settings.centerEtut200YearlyTl} suffix="TL / yıl" />
        <NumberField name="centerEtutPlusPriceTl" label="Kurumsal (200+) · aylık" value={settings.centerEtutPlusPriceTl} suffix="TL / ay" />
        <NumberField name="centerEtutPlusYearlyTl" label="Kurumsal (200+) · yıllık" value={settings.centerEtutPlusYearlyTl} suffix="TL / yıl" />
        <Field label="Havale / EFT bilgileri" hint="Banka, alıcı adı ve IBAN. Kurumların abonelik sayfasında gösterilir." className="sm:col-span-2">
          <Textarea name="centerBankInfo" rows={3} defaultValue={settings.centerBankInfo} placeholder={"Örn: X Bankası · Pi Kampüs Eğitim Teknolojileri Ltd. Şti.\nTR00 0000 0000 0000 0000 0000 00"} />
        </Field>
      </Section>

      <Section title="Pi Koç" description="Bireysel koçlara satılan panelin fiyatları. /pi-koc sayfasında görünür.">
        <Field label="Kademeler" hint="Öğrenci sayısı:aylık TL, virgülle. Örnek: 5:349,10:599,20:999. KDV dahil." className="sm:col-span-2">
          <Input name="piKocTiers" defaultValue={settings.piKocTiers} required />
          <FieldError name="piKocTiers" />
        </Field>
        <Field label="Pi Koç ücretsiz paket (öğrenci)" hint="Bu sayıya kadar öğrenci süresiz ücretsiz. 0 yazarsanız ücretsiz paket kapanır.">
          <Input name="piKocFreeStudents" type="number" min={0} max={50} defaultValue={settings.piKocFreeStudents} required />
          <FieldError name="piKocFreeStudents" />
        </Field>
        <NumberField name="piKocHoursPerStudent" label="Görüşme havuzu (öğrenci başına)" value={settings.piKocHoursPerStudent} suffix="saat / ay" />
        <NumberField name="piKocFreeMeetingMinutes" label="Ücretsiz pakette görüşme başına" value={settings.piKocFreeMeetingMinutes} suffix="dakika" />
      </Section>

      <Section title="Bakım modu">
        <div className="sm:col-span-2">
          <Checkbox name="maintenanceMode" defaultChecked={settings.maintenanceMode} label="Vitrini bakım moduna al (paneller ve giriş çalışmaya devam eder)" />
        </div>
        <Field label="Bakım mesajı" className="sm:col-span-2">
          <Input name="maintenanceMessage" defaultValue={settings.maintenanceMessage} />
        </Field>
      </Section>

      <SubmitButton size="lg">Ayarları kaydet</SubmitButton>
    </ActionForm>
  );
}
