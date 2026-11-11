"use server";

import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import { getCurrentUser } from "@/server/auth/current-user";
import { createSession, requestMeta } from "@/server/auth/session";
import { email, guard, int, opt, requiredText, str } from "@/server/center/form";
import { CenterError } from "@/server/center/errors";
import { addCoachToUser, signupCoach } from "@/server/koc-signup";

/** Pi Koç kaydı: hesap açılır, deneme başlar, koç doğrudan paneline girer. */
export async function kocSignupAction(_: ActionState, formData: FormData): Promise<ActionState> {
  // Bot tuzağı (gizli alan doluysa sessizce geç)
  if (str(formData, "website")) return success();
  const result = await guard(async () => {
    if (formData.get("kvkk") !== "on") throw new CenterError("Devam etmek için aydınlatma metnini ve hizmet sözleşmesini onaylayın.", { kvkk: "Onay gerekli." });
    const address = email(formData, "email");
    if (!address) throw new CenterError("E-posta adresinizi yazın.", { email: "E-posta gerekli." });
    const { ipAddress } = await requestMeta();
    const userId = await signupCoach(
      {
        firstName: requiredText(formData, "firstName", "Ad", 2, 50),
        lastName: requiredText(formData, "lastName", "Soyad", 2, 50),
        email: address,
        phone: str(formData, "phone", 30),
        password: String(formData.get("password") ?? ""),
        panelName: opt(formData, "panelName", 120),
        students: int(formData, "students", 0, 0, 1000),
      },
      ipAddress,
    );
    await createSession(userId);
    return success();
  });
  if (!result.ok) return result;
  redirect("/koc?durum=hosgeldin");
}

/** Giriş yapmış kişi (ör. özel ders öğretmeni) hesabına Pi Koç ekler. */
export async function kocAddToAccountAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return failure("Oturumunuz kapanmış. Tekrar giriş yapın.");
  const result = await guard(async () => {
    if (formData.get("kvkk") !== "on") throw new CenterError("Devam etmek için aydınlatma metnini ve hizmet sözleşmesini onaylayın.", { kvkk: "Onay gerekli." });
    await addCoachToUser(user, opt(formData, "panelName", 120), int(formData, "students", 0, 0, 1000));
    return success();
  });
  if (!result.ok) return result;
  redirect("/koc?durum=hosgeldin");
}
