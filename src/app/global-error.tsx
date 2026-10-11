"use client";

// Kök düzen (layout) çöktüğünde gösterilir; kendi <html>/<body> etiketlerini ve stillerini taşır.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <title>Hata</title>
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: 16, textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>Site şu anda yanıt veremiyor</h1>
          <p style={{ color: "#475569" }}>Kısa süre içinde tekrar deneyin.</p>
          {error.digest ? <p style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>Hata kodu: {error.digest}</p> : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 16, padding: "10px 18px", borderRadius: 8, border: 0, background: "#4f46e5", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
