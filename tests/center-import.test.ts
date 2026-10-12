import { describe, expect, it } from "vitest";
import { mapStudentRows, parseCsv, parseTurkishDate } from "@/lib/center/import";

describe("CSV okuma", () => {
  it("Excel'in ; ayraçlı Türkçe çıktısını ve tırnakları okur", () => {
    const rows = parseCsv('﻿Ad;Soyad;Not\r\nAli;Yılmaz;"Çok ""iyi"";devam"\r\n\r\nAyşe;Kaya;\r\n');
    expect(rows).toEqual([
      ["Ad", "Soyad", "Not"],
      ["Ali", "Yılmaz", 'Çok "iyi";devam'],
      ["Ayşe", "Kaya", ""],
    ]);
  });
  it("virgül ayraçlı dosyayı da tanır", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("öğrenci aktarımı", () => {
  it("başlıkları esnek eşler, veli bilgisini ayırır", () => {
    const { students, problems } = mapStudentRows([
      ["Öğrenci No", "Adı Soyadı", "Sınıfı", "Veli Adı Soyadı", "Veli Tel", "Cinsiyet", "Doğum Tarihi", "Grup"],
      ["1201", "Zeynep Nur Aydın", "8. Sınıf", "Hakan Aydın", "0532 111 22 33", "Kız", "05.03.2012", "8-A"],
      ["", "", "", "", "", "", "", ""],
      ["1202", "Mert Can", "8. Sınıf", "", "", "E", "31.02.2012", ""],
    ]);
    expect(students).toHaveLength(2);
    expect(students[0]).toMatchObject({
      studentNumber: "1201",
      firstName: "Zeynep Nur",
      lastName: "Aydın",
      gradeName: "8. Sınıf",
      gender: "FEMALE",
      birthDate: "2012-03-05",
      group: "8-A",
      guardian: { fullName: "Hakan Aydın", relation: "Veli", phone: "05321112233", email: null },
    });
    expect(students[1]).toMatchObject({ firstName: "Mert", lastName: "Can", gender: "MALE", birthDate: null, guardian: null });
    expect(problems).toEqual([{ row: 4, message: "Doğum tarihi “31.02.2012” anlaşılamadı (GG.AA.YYYY)." }]);
  });
  it("ad sütunu yoksa uyarır", () => {
    expect(mapStudentRows([["Telefon"], ["05321112233"]]).problems[0].message).toContain("Ad");
  });
  it("tarih biçimleri", () => {
    expect(parseTurkishDate("1/9/2011")).toBe("2011-09-01");
    expect(parseTurkishDate("2011-09-01")).toBe("2011-09-01");
    expect(parseTurkishDate("dün")).toBeNull();
  });
});
