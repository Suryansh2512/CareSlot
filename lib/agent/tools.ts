import "server-only";
import { defineTool, type AgentTool } from "./defineTool";
import { createClinicService } from "../clinic";
import { readConfirmation, sameAction } from "../confirmation";
import { ClinicError } from "../errors";
import { doctorSearchSchema, slotSearchSchema, appointmentSearchSchema, bookSchema, rescheduleSchema, cancelSchema, type ClinicAction } from "../schemas";

export function createClinicTools(confirmation?: string, clinic = createClinicService()): AgentTool[] {
  const approved = confirmation ? readConfirmation(confirmation) : undefined;
  let approvalUsed = false;
  let pending = false;
  async function write(action: ClinicAction) {
    if (approved) {
      if (approvalUsed || !sameAction(action, approved.action)) throw new ClinicError("Only the exact confirmed action can be performed.");
      approvalUsed = true;
      return clinic.executeAction(action, confirmation!);
    }
    if (pending) throw new ClinicError("An appointment change is awaiting confirmation. Ask the patient to review the confirmation card.");
    const result = await clinic.prepareAction(action);
    pending = true;
    return result;
  }
  return [
    defineTool({
      name: "searchDoctors",
      description: "Use this when the patient needs a department suggestion or wants doctors by specialty, department, name or spoken language. Returns real department common_issues for administrative routing and at most 20 doctors. Call without filters to discover departments.",
      schema: doctorSearchSchema, run: args => clinic.searchDoctors(args),
    }),
    defineTool({
      name: "getAvailableSlots",
      description: "Use this when the patient wants free slots for a real doctor on a date or the next available date. Dates must be YYYY-MM-DD in Asia/Kolkata; returns only future unbooked slots in chronological order.",
      schema: slotSearchSchema, run: args => clinic.getAvailableSlots(args),
    }),
    defineTool({
      name: "getMyAppointments",
      description: "Use this when the patient wants to view appointments or needs an appointment ID before moving or cancelling. Returns only the logged-in patient's appointments with doctor, department, room, slot and status.",
      schema: appointmentSearchSchema, run: ({ status }) => clinic.getMyAppointments(status),
    }),
    defineTool({
      name: "bookAppointment",
      description: "Use this when the patient wants to book one specific available slot. Without signed user confirmation this only prepares a confirmation card and does not book. With a matching approved action it atomically books the slot and returns the real appointment.",
      writes: true, schema: bookSchema, run: args => write({ kind: "book", ...args }),
    }),
    defineTool({
      name: "rescheduleAppointment",
      description: "Use this when the patient wants to move a booked appointment to a specific available slot. First look up their appointment and target slot. Prepares confirmation first; after approval atomically moves it, preserving the appointment ID and rolling back on failure.",
      writes: true, schema: rescheduleSchema, run: args => write({ kind: "reschedule", ...args }),
    }),
    defineTool({
      name: "cancelAppointment",
      description: "Use this when the patient explicitly wants to cancel a specific owned appointment. First look up appointments. Prepares confirmation first; after approval cancels it and releases its slot exactly once.",
      writes: true, schema: cancelSchema, run: args => write({ kind: "cancel", ...args }),
    }),
  ];
}
