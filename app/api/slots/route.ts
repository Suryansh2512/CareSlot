import { api, queryObject, validate } from "@/lib/http";
import { slotSearchSchema } from "@/lib/schemas";
import { createClinicService } from "@/lib/clinic";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return api(request, async () => {
    const args = validate(slotSearchSchema.safeParse(queryObject(request)));
    return createClinicService().getAvailableSlots(args, 50);
  });
}
