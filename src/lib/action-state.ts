// Server Action'ların forma döndürdüğü ortak sonuç biçimi.

export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Formun yeniden çizilmesi için her gönderimde değişen sayaç */
  stamp?: number;
  data?: Record<string, string | number | boolean | null>;
};

export const initialActionState: ActionState = {};

export function success(message?: string, data?: ActionState["data"]): ActionState {
  return { ok: true, message, data, stamp: Date.now() };
}

export function failure(error: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, error, fieldErrors, stamp: Date.now() };
}

/** Zod hatalarını alan bazlı mesajlara çevirir. */
export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
