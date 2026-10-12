import { requireRole } from "@/server/mobile/auth";
import { withUser } from "@/server/mobile/route";
import { removeAvailabilityException } from "@/server/teacher-profile";

export const DELETE = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "TEACHER");
  await removeAvailabilityException(user.id, params.id);
  return new Response(null, { status: 204 });
});
