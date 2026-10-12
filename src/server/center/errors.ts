/** Kurum paneli iş kuralı hataları: mesaj kullanıcıya olduğu gibi gösterilir. */
export class CenterError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Prisma benzersizlik ihlali (P2002) mi? */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}
