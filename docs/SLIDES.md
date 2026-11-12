# CareSlot - five-slide presentation content

Use real screenshots after live credentials are configured. Replace placeholders with verified facts. Do not present browser test fixtures as a live demonstration.

## Slide 1 - CareSlot

- Clinic Appointment Agent - PS3
- Care, without the wait
- SRM Agentic AI Hackathon - Team <number>
- <members and their roles>
- Demo patient: Arjun Mehta, P001

## Slide 2 - The problem

- Patients call the front desk to book, move or cancel a visit.
- Busy phone lines create unnecessary waiting.
- Patients need the right department, language and appointment time.
- Official fictional data: 8 departments and 15 doctors.
- Goal: make routine appointment management self-service.

## Slide 3 - Our solution and demo

- Booking Chat, Doctors and My Appointments.
- Ask: "I have a skin rash, book me with a doctor on Friday morning."
- Gemini searches real doctors and available slots.
- The patient reviews and confirms before any write.
- Insert two REAL screenshots: tool trace and persisted appointment.

Speaker demo: confirm a booking, show the receipt, reload My Appointments, then reschedule and cancel.

## Slide 4 - How the agent works

- Patient -> protected API -> Gemini selects tools -> Zod -> Supabase.
- Read: searchDoctors, getAvailableSlots, getMyAppointments.
- Write: bookAppointment, rescheduleAppointment, cancelAppointment.
- PostgreSQL locks and transactions enforce occupancy, ownership and rollback.
- Next.js, TypeScript, Tailwind, Supabase, Gemini, Zod and Vercel.

Explain that a signed confirmation approves one exact action. Gemini does not connect directly to the database. The assistant never diagnoses or recommends medicine.

## Slide 5 - Results and links

- Implemented: three pages, six tools, explicit confirmations and atomic writes.
- Local validation: 38 tests and 8 browser tests passed; build and TypeScript passed; 2 live Gemini checks await credentials.
- Live integration: <verified result after real Gemini/Supabase acceptance>.
- GitHub: <confirmed repository>; Vercel: <verified deployed URL>.
- Next: authenticated multi-patient accounts and a doctor-day view.

Before presenting, show an occupied-slot refusal and a medical-advice refusal. Describe only tests that actually ran. Keep API keys, passwords and the Supabase dashboard out of screenshots.
