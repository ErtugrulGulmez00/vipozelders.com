import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsFile, type CalendarEvent } from "@/lib/calendar";

const event: CalendarEvent = {
  uid: "abc123@vipozelders.com",
  start: new Date("2026-10-13T15:00:00Z"),
  end: new Date("2026-10-13T16:00:00Z"),
  title: "Lise Matematik dersi - Ayşe Y.",
  description: "Özel Ders; 1 saat, online\nDerse katılım: https://vipozelders.com/ders/abc123 ".repeat(2),
  location: "Online - VIP Özel Ders sanal sınıf",
  url: "https://vipozelders.com/hesabim/derslerim/abc123",
};

describe("takvim", () => {
  it(".ics dosyası RFC 5545 kurallarına uyar", () => {
    const ics = icsFile(event, new Date("2026-10-12T09:00:00Z"));
    expect(ics).toContain("DTSTART:20261013T150000Z\r\n");
    expect(ics).toContain("DTEND:20261013T160000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261012T090000Z\r\n");
    expect(ics).toContain("SUMMARY:Lise Matematik dersi - Ayşe Y.\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // Satır uzunluğu 75 baytı geçmez, kaçış karakterleri doğru
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("DESCRIPTION:Özel Ders\\; 1 saat\\, online\\nDerse katılım: https://vipozelders.com/ders/abc123 ");
  });

  it("Google Takvim bağlantısı UTC saatleri taşır", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("dates")).toBe("20261013T150000Z/20261013T160000Z");
    expect(url.searchParams.get("text")).toBe(event.title);
  });
});
