import { notificationScope, notificationScopeWhere } from "@/lib/sides";
import { sideFacts } from "../sides";
import type { MobileAccount } from "./auth";

/** ?taraf=kurum|ozel: iki tarafı olan hesapta yalnızca o tarafın bildirimleri; taraf verilmezse ya da tek taraflı hesapta hepsi. */
export async function notificationSideWhere(user: MobileAccount, side: unknown) {
  if (side !== "kurum" && side !== "ozel") return {};
  return notificationScopeWhere(notificationScope(await sideFacts(user.id, user.role), side));
}
