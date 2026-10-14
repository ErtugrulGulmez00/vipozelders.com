import type { ExceptionRow } from "@/components/teacher/availability-editor";
import type { OfferingRow } from "@/components/teacher/offerings-editor";
import type { ProfileFormValues } from "@/components/teacher/profile-form";
import { dbDateToString, formatDate, minutesToTime, toLocalDateString, zonedDateTime } from "@/lib/dates";
import { fullName, initials } from "@/lib/text";
import { loadDistricts } from "./catalog";
import { db } from "./db";
import { loadSettings } from "./settings";
import { uploadUrl } from "./storage";

/** Öğretmen ve admin ekranlarındaki düzenleyicilerin başlangıç verileri. */
export async function loadTeacherEditorData(teacherId: string) {
  const [teacher, settings] = await Promise.all([
    db.teacherProfile.findUniqueOrThrow({
      where: { userId: teacherId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        serviceDistricts: { select: { districtId: true } },
        offerings: { include: { level: true, subject: true, serviceType: true }, orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] },
        availabilityRules: { orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] },
        availabilityExceptions: {
          where: { date: { gte: new Date(`${toLocalDateString(new Date())}T00:00:00.000Z`) } },
          orderBy: [{ date: "asc" }, { startMinute: "asc" }],
        },
      },
    }),
    loadSettings(),
  ]);

  const profile: ProfileFormValues = {
    teacherId,
    name: fullName(teacher.user),
    initials: initials(teacher.user),
    photoUrl: uploadUrl(teacher.photoKey),
    headline: teacher.headline ?? "",
    bio: teacher.bio ?? "",
    education: teacher.education ?? "",
    experienceYears: teacher.experienceYears,
    gender: teacher.gender,
    videoUrl: teacher.videoUrl ?? "",
    cityId: teacher.cityId,
    districtId: teacher.districtId,
    offersOnline: teacher.offersOnline,
    offersInPerson: teacher.offersInPerson,
    inPersonAtStudentHome: teacher.inPersonAtStudentHome,
    inPersonAtTeacherPlace: teacher.inPersonAtTeacherPlace,
    serviceDistrictIds: teacher.serviceDistricts.map((d) => d.districtId),
    declared: Boolean(teacher.statusDeclarationAt),
  };

  const offerings: OfferingRow[] = teacher.offerings.map((o) => ({
    id: o.id,
    serviceTypeId: o.serviceTypeId,
    levelId: o.levelId,
    subjectId: o.subjectId,
    hourlyPrice: o.hourlyPrice,
    durations: o.durations,
    questionPrice: o.questionPrice,
    isActive: o.isActive,
    label: `${o.level.name} · ${o.subject.name} · ${o.serviceType.name}`,
  }));

  const rules = teacher.availabilityRules.map((r) => ({ weekday: r.weekday, start: minutesToTime(r.startMinute), end: minutesToTime(r.endMinute) }));

  const exceptions: ExceptionRow[] = teacher.availabilityExceptions.map((e) => ({
    id: e.id,
    dateLabel: formatDate(zonedDateTime(dbDateToString(e.date), 12 * 60)),
    type: e.type,
    timeLabel: e.startMinute === null ? "Bütün gün" : `${minutesToTime(e.startMinute)}–${minutesToTime(e.endMinute ?? e.startMinute)}`,
    note: e.note,
  }));

  return {
    teacher,
    profile,
    offerings,
    rules,
    exceptions,
    districts: teacher.cityId ? await loadDistricts(teacher.cityId) : [],
    commissionBps: teacher.commissionRateBps ?? settings.commissionRateBps,
  };
}
