import { NextResponse, type NextRequest } from "next/server";
import { completeCheckout } from "@/server/bookings";
import { appUrl } from "@/server/email";

/**
 * iyzico ödeme formu dönüşü. Tarayıcı iyzico'dan buraya POST eder (çerez gelmeyebilir),
 * bu yüzden doğrulama yalnızca token ile iyzico'dan sonucu sorgulayarak yapılır.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  if (!token) return NextResponse.redirect(appUrl("/hesabim"), 303);
  try {
    const { bookingId } = await completeCheckout(token);
    return NextResponse.redirect(appUrl(`/odeme/sonuc/${bookingId}`), 303);
  } catch (error) {
    console.error("[iyzico dönüş]", error);
    return NextResponse.redirect(appUrl("/hesabim/derslerim?odeme=hata"), 303);
  }
}
