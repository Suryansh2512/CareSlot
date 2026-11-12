# Implementation file inventory

Paths below are relative to the inner project root.

## Created

- AGENTS.md
- .github/copilot-instructions.md
- seed/ps3_atomic_operations.sql
- lib/currentUser.ts
- lib/clinic.ts
- lib/clinic-types.ts
- lib/confirmation.ts
- lib/errors.ts
- lib/http.ts
- app/api/doctors/route.ts
- app/api/slots/route.ts
- app/api/appointments/route.ts
- app/doctors/page.tsx
- app/appointments/page.tsx
- components/AppShell.tsx
- components/Icons.tsx
- components/DoctorsDirectory.tsx
- components/AppointmentsList.tsx
- components/Slots.tsx
- components/ConfirmationCard.tsx
- components/useClinicAction.tsx
- components/useClinicData.ts
- tests/database.test.ts
- tests/unit.test.ts
- tests/live.test.ts
- tests/browser/careslot.spec.ts
- playwright.config.ts
- scripts/check-client-secrets.mjs
- docs/DEPLOYMENT.md
- docs/SLIDES.md
- docs/TEST_REPORT.md
- docs/IMPLEMENTATION.md

## Modified

- .env.example
- .gitignore
- package.json
- package-lock.json
- next.config.ts
- proxy.ts
- lib/schemas.ts
- lib/dates.ts
- lib/env.ts
- lib/agent/tools.ts
- lib/agent/runAgent.ts
- lib/agent/systemPrompt.ts
- app/api/agent/route.ts
- app/api/health/route.ts
- app/page.tsx
- app/layout.tsx
- app/globals.css
- app/login/page.tsx
- components/AgentChat.tsx
- README.md

## Removed

- components/TaskList.tsx
- app/api/tasks/route.ts

## Preserved

The official PS3 seed and other official seeds, Supabase client, Gemini client, defineTool utility, passcode auth/login/logout, TypeScript and Tailwind setup remain in place. The finalization attachment explicitly authorized an optional OpenRouter adapter using the same six tools and agent loop. AI_PROVIDER selects the provider; no automatic model/provider fallback occurs. The official Gemini requirement and pending trainer approval are documented.

Generated dependency/build/type files and ignored browser-test output are not source deliverables. The intended public remote is Suryansh2512/CareSlot, branch main; the owner authorized finalization commits and push. The original no-remote statement is historical.
