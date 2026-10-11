import type { Tone } from "@/components/ui/primitives";

export const BOOKING_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING_PAYMENT: { label: "Ödeme bekleniyor", tone: "amber" },
  PAYMENT_FAILED: { label: "Ödeme başarısız", tone: "rose" },
  PENDING_APPROVAL: { label: "Öğretmen onayı bekleniyor", tone: "amber" },
  CONFIRMED: { label: "Onaylandı", tone: "green" },
  COMPLETED: { label: "Tamamlandı", tone: "brand" },
  REJECTED: { label: "Reddedildi", tone: "rose" },
  EXPIRED: { label: "Süresi doldu", tone: "slate" },
  CANCELLED_BY_STUDENT: { label: "Öğrenci iptal etti", tone: "slate" },
  CANCELLED_BY_TEACHER: { label: "Öğretmen iptal etti", tone: "rose" },
  CANCELLED_BY_ADMIN: { label: "Yönetici iptal etti", tone: "slate" },
  NO_SHOW_STUDENT: { label: "Öğrenci katılmadı", tone: "violet" },
  NO_SHOW_TEACHER: { label: "Öğretmen katılmadı", tone: "rose" },
  DISPUTED: { label: "İtiraz inceleniyor", tone: "violet" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  INITIATED: { label: "Başlatıldı", tone: "slate" },
  SUCCEEDED: { label: "Ödendi", tone: "green" },
  FAILED: { label: "Başarısız", tone: "rose" },
  REFUNDED: { label: "İade edildi", tone: "sky" },
  PARTIALLY_REFUNDED: { label: "Kısmi iade", tone: "sky" },
};

export const REFUND_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "İşleniyor", tone: "amber" },
  SUCCEEDED: { label: "İade edildi", tone: "green" },
  FAILED: { label: "Başarısız", tone: "rose" },
};

export const TEACHER_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Taslak", tone: "slate" },
  PUBLISHED: { label: "Yayında", tone: "green" },
  SUSPENDED: { label: "Askıda", tone: "rose" },
};

export const VERIFICATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  UNVERIFIED: { label: "Doğrulanmadı", tone: "slate" },
  PENDING: { label: "İncelemede", tone: "amber" },
  VERIFIED: { label: "Onaylı öğretmen", tone: "green" },
  REJECTED: { label: "Reddedildi", tone: "rose" },
};

export const MODE_LABEL: Record<string, string> = { ONLINE: "Online", IN_PERSON: "Yüz yüze" };

export const IN_PERSON_PLACE_LABEL: Record<string, string> = {
  STUDENT_HOME: "Öğrencinin adresinde",
  TEACHER_PLACE: "Öğretmenin yerinde",
};

export const GENDER_LABEL: Record<string, string> = { FEMALE: "Kadın", MALE: "Erkek", UNSPECIFIED: "Belirtilmemiş" };

export const ACCOUNT_TYPE_LABEL: Record<string, string> = { PARENT: "Veli", STUDENT: "Öğrenci (18+)" };

export const ROLE_LABEL: Record<string, string> = { ADMIN: "Yönetici", TEACHER: "Öğretmen", STUDENT: "Öğrenci/Veli" };

export const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  DIPLOMA: "Diploma",
  IDENTITY: "Kimlik",
  CRIMINAL_RECORD: "Adli sicil kaydı",
  CERTIFICATE: "Sertifika",
  OTHER: "Diğer",
};

export function durationLabel(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} saat` : minutes > 60 ? `${Math.floor(minutes / 60)} saat ${minutes % 60} dk` : `${minutes} dk`;
}
