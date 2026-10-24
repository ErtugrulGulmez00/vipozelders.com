"use client";

import type { ReactNode } from "react";
import { saveSettingsAction } from "@/actions/admin";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
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
          <Input name="contactPhone" defaultValue={settings.contactPhone} />
        </Field>
        <Field label="WhatsApp destek numarası" hint="Sitenin sağ altındaki WhatsApp düğmesi bu numaraya yazar. Boş bırakırsanız düğme gösterilmez.">
          <Input name="supportWhatsapp" defaultValue={settings.supportWhatsapp} placeholder="+90 5xx xxx xx xx" />
        </Field>
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

      <Section title="Soru kredisi ve soru havuzu" description="Öğrenci kredi paketi alır; her soru 1 kredi. Sorular kademe ve derse uygun öğretmenlerin havuzuna düşer.">
        <Field label="Kredi paketleri" hint="kredi:fiyat (TL, KDV dahil), virgülle. 1 kredilik paket tek soru fiyatıdır; iadede kullanılan krediler bu fiyattan düşülür." className="sm:col-span-2">
          <Input name="questionPackages" defaultValue={settings.questionPackages} placeholder="1:25,10:200,20:360,50:750" required />
          <FieldError name="questionPackages" />
        </Field>
        <NumberField name="poolTeacherFeeTl" label="Öğretmene soru başı ödeme" value={settings.poolTeacherFeeTl} suffix="TL" />
        <NumberField name="questionAnswerHours" label="Çözülmezse kredi iadesi" hint="Soru bu süre içinde çözülmezse kredi öğrenciye döner." value={settings.questionAnswerHours} suffix="saat" />
        <NumberField name="poolClaimMinutes" label="Üstlenilen soruyu çözme süresi" hint="Dolarsa soru havuza geri döner." value={settings.poolClaimMinutes} suffix="dakika" />
        <NumberField name="creditValidityMonths" label="Kredi geçerlilik süresi" value={settings.creditValidityMonths} suffix="ay" />
        <NumberField name="creditRefundDays" label="Paket iadesi için süre" hint="Satın almadan sonra kullanılmayan krediler bu süre içinde iade edilebilir." value={settings.creditRefundDays} suffix="gün" />
        <div className="sm:col-span-2">
          <Checkbox name="poolVerifiedOnly" defaultChecked={settings.poolVerifiedOnly} label="Havuzdaki soruları yalnızca belgeleri onaylı öğretmenler görsün" />
        </div>
      </Section>

      <Section title="Aylık soru aboneliği" description="Öğretmen kademe + ders için dönemlik soru çözüm aboneliği satar; abonenin soruları doğrudan o öğretmene gider. Otomatik çekim yoktur, dönem bitmeden veliye yenileme hatırlatması gider.">
        <div className="sm:col-span-2">
          <Checkbox name="subscriptionsEnabled" defaultChecked={settings.subscriptionsEnabled} label="Soru aboneliği satışı açık" />
        </div>
        <Field label="Abonelik komisyonu (%)">
          <Input name="subscriptionCommissionBps" inputMode="decimal" defaultValue={String(settings.subscriptionCommissionBps / 100)} required />
        </Field>
        <NumberField name="subscriptionDays" label="Dönem uzunluğu" value={settings.subscriptionDays} suffix="gün" />
        <NumberField name="subscriptionMinPriceTl" label="En düşük dönem ücreti" value={settings.subscriptionMinPriceTl} suffix="TL" />
        <NumberField name="subscriptionMaxPriceTl" label="En yüksek dönem ücreti" value={settings.subscriptionMaxPriceTl} suffix="TL" />
        <NumberField name="subscriptionMissLimit" label="Cevaplanmayan soru uyarısı" hint="Bir abonelikte bu kadar soru süresinde cevaplanmazsa size uyarı gelir." value={settings.subscriptionMissLimit} suffix="soru" />
        <NumberField name="subscriptionReminderDays" label="Yenileme hatırlatması" hint="Dönem bitmeden bu kadar gün önce (0: gönderilmez)." value={settings.subscriptionReminderDays} suffix="gün" />
      </Section>

      <Section title="Grup dersi (sanal dershane)" description="Öğretmen 4–10 kişilik grup dersi programı açar; öğrenciler kişi başı öder. Kayıt bitişinde en az kişi dolmazsa ders iptal olur, herkese tam iade yapılır. Öğretmen payı her oturum yapıldıkça serbest kalır.">
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

      <Section title="Arkadaşını getir" description="Her veli/öğrencinin kişisel davet bağlantısı olur. Davetle kayıt olan yeni üyeye ilk siparişinde indirim, davet edene ilk ödeme yapıldığında soru kredisi verilir. İndirim platformun hizmet bedelinden karşılanır.">
        <div className="sm:col-span-2">
          <Checkbox name="referralEnabled" defaultChecked={settings.referralEnabled} label="Arkadaşını getir açık" />
        </div>
        <NumberField name="referralDiscountPercent" label="Yeni üyeye ilk sipariş indirimi" value={settings.referralDiscountPercent} suffix="%" />
        <NumberField name="referralRewardCredits" label="Davet edene ödül" value={settings.referralRewardCredits} suffix="soru kredisi" />
      </Section>

      <Section title="Kurum paneli abonelikleri" description="Etüt merkezi ve dershanelere satılan paneller. Fiyatlar KDV dahil; “Kurumlar için” sayfasında görünür. “Eski fiyat” üstü çizili gösterilir; 0 yazarsanız gösterilmez.">
        <NumberField name="centerTrialDays" label="Yeni kuruma tanınan ilk kullanım süresi" hint="Sitede ilan edilmez; kurum hesabı açılırken uygulanır." value={settings.centerTrialDays} suffix="gün" />
        <div className="hidden sm:block" />
        <NumberField name="centerStarterPriceTl" label="Başlangıç planı · aylık" value={settings.centerStarterPriceTl} suffix="TL / ay" />
        <NumberField name="centerStarterListPriceTl" label="Başlangıç planı · aylık eski fiyat" value={settings.centerStarterListPriceTl} suffix="TL / ay" />
        <NumberField name="centerStarterYearlyPriceTl" label="Başlangıç planı · yıllık" value={settings.centerStarterYearlyPriceTl} suffix="TL / yıl" />
        <NumberField name="centerStarterYearlyListPriceTl" label="Başlangıç planı · yıllık eski fiyat" value={settings.centerStarterYearlyListPriceTl} suffix="TL / yıl" />
        <NumberField name="centerStarterStudents" label="Başlangıç planı öğrenci sınırı" value={settings.centerStarterStudents} suffix="öğrenci" />
        <div className="hidden sm:block" />
        <NumberField name="centerProPriceTl" label="Profesyonel plan · aylık" value={settings.centerProPriceTl} suffix="TL / ay" />
        <NumberField name="centerProListPriceTl" label="Profesyonel plan · aylık eski fiyat" value={settings.centerProListPriceTl} suffix="TL / ay" />
        <NumberField name="centerProYearlyPriceTl" label="Profesyonel plan · yıllık" value={settings.centerProYearlyPriceTl} suffix="TL / yıl" />
        <NumberField name="centerProYearlyListPriceTl" label="Profesyonel plan · yıllık eski fiyat" value={settings.centerProYearlyListPriceTl} suffix="TL / yıl" />
        <NumberField name="centerProStudents" label="Profesyonel plan öğrenci sınırı" value={settings.centerProStudents} suffix="öğrenci" />
        <Field label="Havale / EFT bilgileri" hint="Banka, alıcı adı ve IBAN. Kurumların abonelik sayfasında gösterilir." className="sm:col-span-2">
          <Textarea name="centerBankInfo" rows={3} defaultValue={settings.centerBankInfo} placeholder={"Örn: X Bankası · Pi Kampüs Eğitim Teknolojileri Ltd. Şti.\nTR00 0000 0000 0000 0000 0000 00"} />
        </Field>
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
