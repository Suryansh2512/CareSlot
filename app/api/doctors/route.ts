import { api, queryObject, validate } from "@/lib/http";
import { doctorSearchSchema } from "@/lib/schemas";
import { createClinicService } from "@/lib/clinic";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return api(request, async () => {
    const args = validate(doctorSearchSchema.safeParse(queryObject(request)));
    return createClinicService().searchDoctors(args, 50);
  });
}
