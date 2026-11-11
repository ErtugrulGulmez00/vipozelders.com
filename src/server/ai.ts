import "server-only";

// Yapay zekâ metin üretimi (OpenRouter, OpenAI uyumlu uç). Anahtar yoksa ya da yanıt gelmezse null döner;
// çağıran taraf kurallı metne düşer. Model listesi sırayla denenir (OpenRouter "models" yedekleme).

const DEFAULT_MODELS = ["nvidia/nemotron-3-ultra-550b-a55b:free", "nvidia/nemotron-3.5-super-vl:free", "google/gemma-4-31b-it:free"];

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function models(): string[] {
  const list = (process.env.OPENROUTER_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  return (list.length ? list : DEFAULT_MODELS).slice(0, 3);
}

export async function aiText({ system, prompt, timeoutMs = 45_000 }: { system: string; prompt: string; timeoutMs?: number }): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Pi Kampus" },
      body: JSON.stringify({
        models: models(),
        max_tokens: 3000,
        // Ücretli modele geçilince OPENROUTER_DENY_TRAINING=1: veriyi eğitimde kullanan sağlayıcılar dışlanır.
        // Ücretsiz modeller bu şartla çalışmaz; onlara yalnızca isimsiz sayılar gider.
        ...(process.env.OPENROUTER_DENY_TRAINING === "1" ? { provider: { data_collection: "deny" } } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      console.warn(`[ai] OpenRouter ${response.status}`);
      return null;
    }
    const json = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    return text ? text : null;
  } catch (error) {
    console.warn("[ai] OpenRouter yanıt vermedi:", error instanceof Error ? error.message : error);
    return null;
  }
}
