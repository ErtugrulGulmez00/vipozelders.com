import { Trash2 } from "lucide-react";
import { addLearnerAction, removeLearnerAction, updateStudentProfileAction } from "@/actions/student";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { whatsappActive } from "@/lib/notification-channels";
import { db } from "@/server/db";
import { loadSettings } from "@/server/settings";
import { getCities } from "@/server/site";
import { AccountDeletionForm } from "@/components/panel/account-deletion-form";
import { PasswordForm } from "@/components/panel/password-form";
import { WhatsAppPreference } from "@/components/panel/whatsapp-pref";

/**
 * Veli / öğrenci hesap ayarları. Kurum tarafında (side="kurum") özel derse ait bölümler (ders alınan çocuklar,
 * hesap tipi, il, kampanya izni) gösterilmez; değerleri gizli alanlarla korunur.
 */
export async function StudentSettings({ userId, side }: { userId: string; side: "kurum" | "ozel" }) {
  const [profile, cities, settings] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, include: { studentProfile: { include: { learners: { orderBy: { createdAt: "asc" } } } } } }),
    getCities(),
    loadSettings(),
  ]);
  const student = profile.studentProfile;
  const privateSide = side === "ozel";

  return (
    <>
      <PageHeader title="Hesap ayarları" />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader title="Kişisel bilgiler" description={profile.email ? `E-posta: ${profile.email}` : `Kullanıcı adı: ${profile.username}`} />
          <CardBody>
            <ActionForm action={updateStudentProfileAction} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ad" htmlFor="firstName">
                  <Input id="firstName" name="firstName" defaultValue={profile.firstName} required />
                </Field>
                <Field label="Soyad" htmlFor="lastName">
                  <Input id="lastName" name="lastName" defaultValue={profile.lastName} required />
                </Field>
              </div>
              <Field label="Cep telefonu" htmlFor="phone">
                <Input id="phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} placeholder="05XX XXX XX XX" />
              </Field>
              <FieldError name="phone" />
              {privateSide ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Hesap tipi" htmlFor="accountType">
                    <Select id="accountType" name="accountType" defaultValue={student?.accountType ?? "PARENT"}>
                      <option value="PARENT">Veli</option>
                      <option value="STUDENT">Öğrenci (18+)</option>
                    </Select>
                  </Field>
                  <Field label="İl" htmlFor="cityId">
                    <Select id="cityId" name="cityId" defaultValue={student?.cityId ?? ""}>
                      <option value="">Seçiniz</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              ) : (
                <>
                  <input type="hidden" name="accountType" value={student?.accountType ?? "PARENT"} />
                  {student?.cityId ? <input type="hidden" name="cityId" value={student.cityId} /> : null}
                  {student?.marketingConsent ? <input type="hidden" name="marketing" value="on" /> : null}
                </>
              )}
              {privateSide ? <Checkbox name="marketing" defaultChecked={student?.marketingConsent} label="Kampanya ve yeniliklerden e-posta ile haberdar olmak istiyorum." /> : null}
              <SubmitButton>Kaydet</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>

        <div className="space-y-6">
          {privateSide ? (
            <Card>
              <CardHeader title="Öğrencilerim" description="Ders aldığınız çocuklarınızı kaydedin; randevu alırken tek tıkla seçin." />
              <CardBody className="space-y-4">
                <ul className="divide-y divide-slate-100">
                  {student?.learners.map((l) => (
                    <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                      <span>
                        <span className="font-medium text-slate-900">{l.name}</span>
                        {l.gradeName ? <span className="text-slate-500"> · {l.gradeName}</span> : null}
                      </span>
                      <form action={removeLearnerAction}>
                        <input type="hidden" name="learnerId" value={l.id} />
                        <button type="submit" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`${l.name} kaydını sil`}>
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
                <ActionForm action={addLearnerAction} resetOnSuccess className="flex flex-wrap items-end gap-2">
                  <Field label="İsim" htmlFor="learner-name" className="min-w-32 flex-1">
                    <Input id="learner-name" name="name" required />
                  </Field>
                  <Field label="Sınıf" htmlFor="learner-grade" className="w-32">
                    <Input id="learner-grade" name="gradeName" placeholder="7. Sınıf" />
                  </Field>
                  <SubmitButton variant="secondary">Ekle</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="WhatsApp bildirimleri" />
            <CardBody>
              <WhatsAppPreference on={!profile.whatsappOptOut} phone={profile.phone} active={whatsappActive(settings.notificationChannel)} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Şifre değiştir" />
            <CardBody>
              <PasswordForm />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Hesabı sil" />
            <CardBody>
              <AccountDeletionForm />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
