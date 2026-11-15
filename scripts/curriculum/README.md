# Hazır konu listeleri

`src/lib/curriculum-presets.ts` bu betiklerle üretilir.

1. MEB TYMM öğretim programlarını oku (yavaş tempoda, yalnızca herkese açık sayfalar):
   `node scripts/curriculum/tymm-scrape.mjs tymm.json ortaokul-matematik-dersi ortaokul-turkce-dersi fen-bilimleri-dersi sosyal-bilgiler-dersi tc-inkilap-tarihi-ve-ataturkculuk-dersi din-kulturu-ve-ahlak-bilgisi-dersi-temel-egitim matematik-dersi turk-dili-ve-edebiyati-dersi fizik-dersi kimya-dersi biyoloji-dersi tarih-dersi cografya-dersi felsefe-dersi din-kulturu-ve-ahlak-bilgisi-dersi-ortaogretim`
2. Dosyayı üret: `node scripts/curriculum/gen-curriculum.mjs tymm.json scripts/curriculum/sinav-konulari.json src/lib/curriculum-presets.ts`

Maarif Modeli'nin hangi sınıflarda uygulandığı `gen-curriculum.mjs` içindeki `ACTIVE` kümesindedir (2026-2027: 5, 6, 7, 9, 10, 11). Her yıl güncelleyin.
`sinav-konulari.json`: TYT/AYT/LGS yaygın konu listeleri (ÖSYM resmi liste yayımlamaz).
