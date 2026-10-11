/** Sanal sınıf (LiveKit) ayarlı mı? Ayarlı değilse yoklama kontrolü yapılmaz. */
export function videoConfigured(): boolean {
  return Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
}
