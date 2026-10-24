import type { Tone } from "@/components/ui/primitives";

// Kurum paneli durum ve tür adları.

export const CENTER_KIND_LABEL: Record<string, string> = {
  ETUT: "Etüt merkezi",
  DERSHANE: "Dershane / temel lise destek",
  KURS: "Kurs merkezi",
  OTHER: "Diğer eğitim kurumu",
};

export const CENTER_STATUS: Record<string, { label: string; tone: Tone }> = {
  TRIAL: { label: "Deneme sürümü", tone: "sky" },
  ACTIVE: { label: "Aktif", tone: "green" },
  SUSPENDED: { label: "Askıda", tone: "rose" },
};

export const CENTER_ACCESS_LABEL: Record<string, { label: string; tone: Tone }> = {
  trial: { label: "Deneme sürümü", tone: "sky" },
  active: { label: "Aktif", tone: "green" },
  grace: { label: "Ödeme bekleniyor", tone: "amber" },
  expired: { label: "Süresi doldu", tone: "rose" },
  suspended: { label: "Askıda", tone: "rose" },
};

export const CENTER_PLAN_LABEL: Record<string, string> = {
  STARTER: "Başlangıç",
  PRO: "Profesyonel",
  ENTERPRISE: "Kurumsal",
};

export const STUDENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Aktif", tone: "green" },
  PASSIVE: { label: "Pasif", tone: "slate" },
  LEFT: { label: "Ayrıldı", tone: "rose" },
};

export const ATTENDANCE_STATUS: Record<string, { label: string; short: string; tone: Tone }> = {
  PRESENT: { label: "Geldi", short: "G", tone: "green" },
  ABSENT: { label: "Gelmedi", short: "Y", tone: "rose" },
  LATE: { label: "Geç geldi", short: "Gç", tone: "amber" },
  EXCUSED: { label: "İzinli", short: "İ", tone: "sky" },
};

export const ETUD_STATUS: Record<string, { label: string; tone: Tone }> = {
  PLANNED: { label: "Planlandı", tone: "sky" },
  DONE: { label: "Yapıldı", tone: "green" },
  CANCELLED: { label: "İptal", tone: "slate" },
};

export const HOMEWORK_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Kontrol edilmedi", tone: "slate" },
  DONE: { label: "Yaptı", tone: "green" },
  PARTIAL: { label: "Eksik yaptı", tone: "amber" },
  MISSING: { label: "Yapmadı", tone: "rose" },
};

export const NOTE_KIND_LABEL: Record<string, string> = {
  GENERAL: "Genel not",
  GUIDANCE: "Rehberlik görüşmesi",
  PARENT_MEETING: "Veli görüşmesi",
  BEHAVIOR: "Davranış",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Nakit",
  CARD: "Kredi / banka kartı",
  TRANSFER: "Havale / EFT",
  OTHER: "Diğer",
};

export const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  RENT: "Kira",
  SALARY: "Maaş / personel",
  UTILITY: "Fatura (elektrik, su, internet)",
  SUPPLIES: "Kırtasiye / yayın",
  MARKETING: "Reklam",
  TAX: "Vergi / SGK",
  OTHER: "Diğer",
};

export const MESSAGE_STATUS: Record<string, { label: string; tone: Tone }> = {
  QUEUED: { label: "Sırada", tone: "amber" },
  SENT: { label: "Gönderildi", tone: "green" },
  FAILED: { label: "Gönderilemedi", tone: "rose" },
  SKIPPED: { label: "Gönderilmedi", tone: "slate" },
};

export const MESSAGE_KIND_LABEL: Record<string, string> = {
  absence: "Devamsızlık",
  etud_absence: "Etüt devamsızlığı",
  payment_reminder: "Ödeme hatırlatma",
  payment_overdue: "Geciken ödeme",
  payment_receipt: "Tahsilat bilgisi",
  announcement: "Duyuru",
  exam_result: "Deneme sonucu",
  invite: "Veli portalı daveti",
  homework: "Ödev",
  homework_missing: "Yapılmayan ödev",
  hall_absence: "Çalışma salonu devamsızlığı",
  subscription: "Abonelik",
  custom: "Mesaj",
};

export const LEAD_STATUS: Record<string, { label: string; tone: Tone }> = {
  NEW: { label: "Yeni", tone: "amber" },
  CONTACTED: { label: "Görüşüldü", tone: "sky" },
  ENROLLED: { label: "Kayıt oldu", tone: "green" },
  LOST: { label: "Vazgeçti", tone: "slate" },
};

export const INSTALLMENT_STATE: Record<string, { label: string; tone: Tone }> = {
  paid: { label: "Ödendi", tone: "green" },
  partial: { label: "Kısmen ödendi", tone: "sky" },
  overdue: { label: "Gecikti", tone: "rose" },
  due: { label: "Bugün", tone: "amber" },
  upcoming: { label: "Bekliyor", tone: "slate" },
};

export const GUARDIAN_RELATIONS = ["Anne", "Baba", "Vasi", "Kardeş", "Diğer"];

export const GRADE_OPTIONS = [
  "1. Sınıf",
  "2. Sınıf",
  "3. Sınıf",
  "4. Sınıf",
  "5. Sınıf",
  "6. Sınıf",
  "7. Sınıf",
  "8. Sınıf",
  "9. Sınıf",
  "10. Sınıf",
  "11. Sınıf",
  "12. Sınıf",
  "Mezun",
];

export const TARGET_EXAMS = ["LGS", "YKS (TYT-AYT)", "TYT", "Okula destek", "KPSS", "YDS", "Diğer"];
