import { json } from "@/server/mobile/http";
import { examKindsJson, KOC_SUBJECTS } from "@/server/mobile/koc";
import { withUser } from "@/server/mobile/route";

/** Deneme girişi için sınav türleri ve bölümleri, ders listesi. */
export const GET = withUser(async () => json({ kinds: examKindsJson(), subjects: KOC_SUBJECTS }), { allowCenter: true });
