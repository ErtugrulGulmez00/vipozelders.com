import { ImageResponse } from "next/og";

// Bağlantı paylaşıldığında (WhatsApp, Instagram, X…) görünen önizleme görseli.
export const alt = "Pi Kampüs · Özel ders, soru çözüm ve koçluk";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #4338ca 100%)", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ width: 120, height: 120, borderRadius: 32, background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 84, fontWeight: 800, color: "#fcd34d" }}>π</div>
          <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: -2 }}>Pi Kampüs</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 44, lineHeight: 1.3, color: "#e0e7ff", maxWidth: 980 }}>Özel ders, soru çözüm ve koçluk · Etüt merkezleri ve dershaneler için kurum paneli</div>
        <div style={{ marginTop: 40, fontSize: 32, color: "#fcd34d", fontWeight: 700 }}>pikampus.com</div>
      </div>
    ),
    size,
  );
}
