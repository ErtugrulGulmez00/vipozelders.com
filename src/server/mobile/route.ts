import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { authenticate, type MobileUser } from "./auth";
import { errorJson } from "./http";

type Context<P> = { params: Promise<P> };

/** Next.js'in kendi iç sinyalleri (ör. derlemede "bu uç nokta dinamik" bildirimi) yakalanmadan geçmeli. */
function handleError(error: unknown): Response {
  unstable_rethrow(error);
  return errorJson(error);
}

/** Oturum gerektiren mobil uç nokta: Bearer anahtarı doğrulanır, hatalar ortak biçimde döner. */
export function withUser<P = Record<string, never>>(
  handler: (args: { request: NextRequest; user: MobileUser; params: P }) => Promise<Response>,
  options: { allowPasswordChange?: boolean } = {},
) {
  return async (request: NextRequest, context: Context<P>): Promise<Response> => {
    try {
      const user = await authenticate(request, options);
      return await handler({ request, user, params: await context.params });
    } catch (error) {
      return handleError(error);
    }
  };
}

/** Oturum gerektirmeyen mobil uç nokta. */
export function publicRoute<P = Record<string, never>>(handler: (args: { request: NextRequest; params: P }) => Promise<Response>) {
  return async (request: NextRequest, context: Context<P>): Promise<Response> => {
    try {
      return await handler({ request, params: await context.params });
    } catch (error) {
      return handleError(error);
    }
  };
}
