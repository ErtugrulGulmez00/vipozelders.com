import { BadgeCheck, Clock, MapPin, Monitor, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { Avatar, Badge, RatingSummary } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import type { TeacherCard as TeacherCardData } from "@/server/teachers";

function responseLabel(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes < 60) return "1 saat içinde yanıt verir";
  if (minutes < 360) return `Ortalama ${Math.round(minutes / 60)} saatte yanıt verir`;
  return null;
}

export function TeacherCard({ teacher }: { teacher: TeacherCardData }) {
  const response = responseLabel(teacher.avgResponseMinutes);
  return (
    <Link
      href={`/ogretmen/${teacher.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        <Avatar src={teacher.photoUrl} name={teacher.name} initials={teacher.name.slice(0, 1) + (teacher.name.split(" ")[1]?.slice(0, 1) ?? "")} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-700">{teacher.name}</h3>
            {teacher.verified ? <BadgeCheck className="size-4 text-emerald-600" aria-label="Onaylı öğretmen" /> : null}
            {teacher.isNew ? <Badge tone="sky">Yeni</Badge> : null}
            {teacher.featured ? (
              <Badge tone="amber" className="ml-auto">
                <Sparkles className="size-3" aria-hidden /> Öne çıkan
              </Badge>
            ) : null}
          </div>
          {teacher.headline ? <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{teacher.headline}</p> : null}
          <div className="mt-2">
            {/* Yeni öğretmende "0 ders / değerlendirme yok" yerine olumlu bir etiket */}
            {teacher.ratingCount > 0 ? <RatingSummary average={teacher.ratingAvg} count={teacher.ratingCount} /> : <Badge tone="sky">Yeni öğretmen</Badge>}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {teacher.offersIntro ? <Badge tone="green">Ücretsiz tanışma</Badge> : null}
        {teacher.subjects.map((subject) => (
          <Badge key={subject} tone="brand">
            {subject}
          </Badge>
        ))}
      </div>

      <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
        <li className="flex items-center gap-1.5">
          <Monitor className="size-3.5" aria-hidden />
          {[teacher.offersOnline && "Online", teacher.offersInPerson && "Yüz yüze"].filter(Boolean).join(" · ")}
          {teacher.cityName && teacher.offersInPerson ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden /> {teacher.cityName}
            </span>
          ) : null}
        </li>
        <li className="flex items-center gap-1.5">
          <Users className="size-3.5" aria-hidden />
          {teacher.experienceYears} yıl deneyim{teacher.completedLessons > 0 ? ` · ${teacher.completedLessons} tamamlanan ders` : ""}
        </li>
        {response ? (
          <li className="flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden /> {response}
          </li>
        ) : null}
      </ul>

      <div className="mt-auto flex items-end justify-between pt-5">
        <p className="text-sm text-slate-500">
          <span className="text-xl font-bold text-slate-900">{formatMoney(teacher.minHourlyPrice)}</span>
          <span>&nbsp;/ saat’ten başlayan</span>
        </p>
        <span className="text-sm font-semibold text-brand-700 group-hover:underline">Profili gör →</span>
      </div>
    </Link>
  );
}
