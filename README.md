# CareSlot: PS3 Clinic Appointment Agent

SRM Agentic AI Hackathon · Team <number> · Demo patient **P001, Arjun Mehta**

## Problem and solution

Patients call a busy clinic front desk to find a doctor, book a visit, or change an appointment. CareSlot provides a conversational booking assistant, a searchable doctor directory, and a personal appointment workspace.

- Booking Chat: the selected model chooses real tools, reads availability, and proposes a specific appointment change.
- Doctors: search names, specialties and languages; inspect qualifications, experience, consultation fees, rooms and free slots.
- My Appointments: upcoming, past and cancelled visits; safely reschedule across doctors or cancel.
- Every write requires an explicit confirmation of server-verified details.
- All times use **Asia/Kolkata (IST)**. The assistant never diagnoses or recommends medicine.
- Only fictional official seed records are used. There is no real patient onboarding.

## Stack and architecture

Next.js App Router · React · TypeScript · Tailwind CSS · Zod · Supabase PostgreSQL and JS SDK · Gemini API via @google/genai, with an optional OpenRouter HTTP adapter · Git/GitHub · Vercel.

```text
Patient -> protected /api/agent -> explicitly selected model + function declarations
                                 -> selected tool -> Zod validation
                                 -> server-only clinic service -> Supabase
                                 -> tool result -> model -> answer + visible trace

Write proposal -> real details + signed 10-minute confirmation
Patient confirms -> model selects matching write tool -> atomic PostgreSQL RPC
                 -> database receipt -> live appointment refresh
```

Direct screen buttons use the same clinic service, signed confirmation, ownership rules and SQL RPCs. Both provider adapters use the existing agent loop and six tools. No user-keyword routing selects tools. OpenRouter preserves native assistant tool calls and matching tool_call_id results, validates arguments through Zod, and retries generation only, within the existing deadline. Completed tool writes are never replayed by provider retries.

### Provider selection and official-stack disclosure

The official guide requires **Google Gemini and Gemini function calling**. OpenRouter is an owner-authorized runtime variation; faculty approval has **not** been established. Keep Gemini selectable for official compliance, and obtain the trainer's decision before claiming the 30 agent marks with OpenRouter. Provider changes are explicit; there is no automatic provider/model fallback.

The currently verified free OpenRouter model is **nvidia/nemotron-3.5-lightning:free**. The live catalog reported zero prompt/completion prices, a 1,000,000-token context and native tool support. A minimal native function-call request passed in about 1.3 seconds, followed by a full live UI booking/reschedule/cancel workflow. `google/gemma-4-26b-a4b-it:free` and `google/gemma-4-31b-it:free` were also catalog-verified but returned HTTP 429 during the same comparison. Runtime requests enforce zero-price provider caps and reject non-`:free` model IDs. Free availability and rate limits can change. Sources: [OpenRouter models API](https://openrouter.ai/api/v1/models), [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection).

The original defineTool architecture, Supabase client, passcode authentication and function-response loop are retained. The loop has an eight-round / 24-tool-call bound and a 50-second request budget. Provider failure after a completed tool call preserves its receipt on screen.

## Agent tools

| Tool | Access | Purpose |
| --- | --- | --- |
| searchDoctors | Read | Search doctor name, specialty/common issue, department and language; return actual department catalog |
| getAvailableSlots | Read | Future unbooked times for a doctor, date or date range |
| getMyAppointments | Read | P001-only appointments joined to doctors, departments and slots |
| bookAppointment | Write | Prepare confirmation, then atomically book the exact approved slot |
| rescheduleAppointment | Write | Prepare confirmation, then safely move an owned booked appointment |
| cancelAppointment | Write | Prepare confirmation, then cancel and release the slot once |

Read tools return at most 20 records. Screen endpoints return at most 50. Directory search loads up to 50 doctors, sufficient for the official 15-doctor seed.

## Database

The official [seed](seed/ps3_clinic_appointments.sql) is unchanged.

| Table | Existing columns |
| --- | --- |
| departments | id, name, common_issues |
| doctors | id, name, department_id, qualification, experience_years, consultation_fee, languages, room |
| slots | id, doctor_id, slot_date, start_time, is_booked |
| patients | id, name, phone, age, city |
| appointments | id, patient_id, doctor_id, slot_id, reason, status, created_at |

No columns or extra application tables are added. Status is booked, cancelled or completed. Slot IDs and appointment IDs are generated bigint values.

### Migration order

Create a Supabase project, then run these files in its SQL Editor:

1. [Original starter example](seed/00_starter_example.sql) if following the workshop's initial setup; CareSlot does not use its tasks table.
2. [Official PS3 seed](seed/ps3_clinic_appointments.sql).
3. [CareSlot atomic migration](seed/ps3_atomic_operations.sql).

**The official seed drops and recreates its tables.** Run it for first-time setup or an intentional demo reset, not as a normal production migration. Reapply the atomic migration after every reset. The atomic migration is repeatable and preserves existing slot flags, including seeded bookings with no matching appointment record.

The migration creates:
- careslot_book(p_slot_id bigint, p_reason text): locks the slot, checks future availability, derives the doctor, and inserts P001's appointment.
- careslot_reschedule(p_appointment_id bigint, p_slot_id bigint, p_expected_slot_id bigint): locks the owned appointment, locks both slots in ascending ID order, verifies the approved source slot, and updates everything in one transaction.
- careslot_cancel(p_appointment_id bigint): locks the owned appointment and slot, cancels once, and never releases a subsequently rebooked slot.
- A partial unique index for non-cancelled slot occupancy and a composite doctor/slot foreign key.
- Server-only function execution grants. RLS remains enabled without public policies.

The RPCs deliberately bind to P001, accepting no patient-ID parameter. They use SECURITY INVOKER and only service_role has execution permission. Multi-patient production authentication is outside this fixed-user hackathon scope.

## Local setup

Requires Node.js 24.x and npm. The runtime is pinned for consistent local and Vercel builds. Work from the folder containing this README and package.json, not its outer extracted wrapper.

```powershell
npm install
# First setup only: preserve an existing .env.local.
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
# Configure the selected provider and shared database/passcode settings privately.
npm run dev
```

Open **http://127.0.0.1:3300** and enter the team passcode. The dedicated port avoids other local Next.js projects. During diagnosis, `localhost:3000` reached an unrelated ChairMate IPv6 server whose GlobalGallery produced the reported hydration errors. Use the CareSlot origin consistently; `/api/health` must return CareSlot JSON.

### Environment variables

| Variable | Value to configure |
| --- | --- |
| AI_PROVIDER | gemini (default) or openrouter; never switched automatically |
| OPENROUTER_API_KEY | Server-only OpenRouter key, required in OpenRouter mode |
| OPENROUTER_MODEL | Exact verified free model ID; current selection: nvidia/nemotron-3.5-lightning:free |
| GEMINI_API_KEY | Your team's Google AI Studio API key |
| GEMINI_MODEL | Explicit trainer-approved model available to that key; no fallback |
| SUPABASE_URL | Project URL, from the same project as the secret key |
| SUPABASE_SECRET_KEY | Server-only secret/service_role key |
| APP_PASSCODE | A long random team passcode; also signs action confirmations |

The guide names gemini-3.8-flash unless the trainer supplies another model. Confirm model availability in your account. Never expose the Supabase secret key through NEXT_PUBLIC variables.

OpenRouter mode requires its two settings, `AI_PROVIDER=openrouter`, and the three shared Supabase/passcode settings. Gemini mode uses `AI_PROVIDER=gemini` and the original five settings. Restart locally and redeploy after switching providers. The UI displays the actual provider; API responses include its exact model ID for inspection. Gemini remained selectable, but its live generation requests returned 503/504 during integration.

GET /api/health reports the selected provider and required-variable presence only, not credential values. It does not verify connectivity or migrations. Runtime configuration errors are displayed clearly; builds do not require credentials.

## Routes

- /: Booking Chat
- /doctors: doctor directory and availability
- /appointments: My Appointments
- /login: passcode entry
- GET /api/doctors: query, department_id, language
- GET /api/slots: doctor_id; optional date or from_date/to_date
- GET /api/appointments: optional status
- POST /api/appointments: validated action; first prepares details, then executes with matching signed confirmation
- POST /api/agent: validated conversation and optional confirmation token

All clinic endpoints explicitly verify the session in addition to the route proxy. Private data is not cached. Unknown or repeated query parameters are rejected. Other-patient access is refused, and missing/other-patient appointment IDs are indistinguishable.

## Testing

```powershell
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
npm run check:secrets
```

- Unit and mocked-transport tests verify filters, Zod, identity, confirmation integrity, tool dispatch, loop bounds, errors and authentication.
- Database tests launch a disposable **real local PostgreSQL** cluster using a dev-only package. They apply the exact official seed and migration, test transaction rollback and concurrent requests over separate connections, and clean up afterward. They never read live database credentials.
- Browser tests start the production build on loopback port 3100 using an ephemeral passcode and empty external-service variables. HTTP data fixtures are confined to test code. They exercise real login/protection, UI confirmation, tool displays, errors and 360px/1440px layouts.
- Live model behaviour tests are opt-in and skipped by default. A mocked provider test does not prove live behaviour. Separate live OpenRouter UI acceptance verified all six tools, signed writes, medication refusal and ambiguous-request clarification against hosted Supabase.

To run the live diagnosis-refusal and ambiguous-request checks after configuring environment variables:

```powershell
$env:RUN_LIVE_AGENT_TESTS = '1'
node --env-file=.env.local --conditions=react-server --import=tsx --test tests/live.test.ts
Remove-Item Env:RUN_LIVE_AGENT_TESTS
```

These two checks do not approve writes. Perform the full booking/reschedule/cancel acceptance demo manually against the configured Supabase project.

For repeatable checks against the actual running application (start `npm run dev` first):

```powershell
npm run verify:live
# Full strict UI/model/DB acceptance on isolated slots, with real confirmation clicks:
node --env-file=.env.local scripts/verify-agent-workflow.mjs
# Explicitly authorized signed writes on isolated test slots; removes only its own fixtures:
npm run verify:live -- --writes
# Real Chromium with hosted data and explicit confirmation clicks:
npm run verify:browser -- --writes
```

These live scripts do not mock responses, rerun seed SQL, or reset existing data. Hosted verification reports and screenshots stay in ignored `test-results/`. `SUPABASE_JWKS_URL` is not needed for the fixed P001 passcode session. If `APP_PASSCODE` is blank, `node scripts/prepare-local-env.mjs` can generate a private passcode without printing it and safely move any configured template assignments to the local file.

SQL Editor catalog checks are available in [read-only verification SQL](seed/ps3_verify_setup.sql). Expected results: RLS enabled on all five tables, three `security_definer=false` RPCs with empty search paths, execute denied to PUBLIC/anon/authenticated and allowed to service_role, plus the occupancy index and doctor/slot foreign key. The service REST key cannot directly inspect PostgreSQL ACL catalogs.

See [validation record](docs/TEST_REPORT.md) for actual execution results and remaining live checks.

## Demo prompts

1. "I have a skin rash, book me with a doctor on Friday morning."
2. "Move my upcoming appointment to the next free slot."
3. "Which Tamil-speaking doctors have free slots tomorrow?"
4. "Cancel my appointment with Dr. Nisha Menon."
5. "Diagnose my rash and recommend medicine." · must decline diagnosis/medicine and offer booking assistance.

When a confirmation card appears, review the doctor, date, time and fee, then click Confirm. Typing yes alone cannot bypass the signed-confirmation requirement. Availability is checked again on commit.

For judges, expand the real tool traces, show the database receipt, open My Appointments, and reload to demonstrate persistence. Cancellation should make the slot available again. Do not use browser test fixtures as live-demo evidence.

Actual screenshots from the successful isolated live verification: [selected tools and confirmation](docs/screenshots/agent-tools.png), [persisted appointment after reload](docs/screenshots/appointment.png). These show real hosted writes made during the test; those test records were cleaned up afterward. Existing demo data remained intact.

## Team and delivery

| Member | Role |
| --- | --- |
| <name> | Team lead, GitHub, Vercel, demo |
| <name> | Frontend |
| <name> | Backend/API |
| <name> | Database |
| <name> | Gemini agent |

GitHub: https://github.com/Suryansh2512/CareSlot (implementation branch: main)
Vercel: <confirmed live application URL>

Every member should make genuine commits for their own work. Do not fabricate attribution. Keep the passcode in the private submission form, not a public README.

[Deployment steps](docs/DEPLOYMENT.md) · [Five-slide presentation content](docs/SLIDES.md)

The owner authorized finalization and push to the existing confirmed repository. No Vercel URL is claimed; deployment is conditional on a correctly linked/authenticated project. Team number, member roles and trainer approval of the OpenRouter variation still require owner input.
