import { api, queryObject, validate } from "@/lib/http";
import { appointmentSearchSchema, actionRequestSchema } from "@/lib/schemas";
import { createClinicService } from "@/lib/clinic";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return api(request, async () => {
    const args = validate(appointmentSearchSchema.safeParse(queryObject(request)));
    return createClinicService().getMyAppointments(args.status, 50);
  });
}
export async function POST(request: Request) {
  return api(request, async () => {
    const { action, confirmation } = validate(actionRequestSchema.safeParse(await request.json().catch(() => null)));
    const clinic = createClinicService();
    return confirmation ? clinic.executeAction(action, confirmation) : clinic.prepareAction(action);
  });
}
