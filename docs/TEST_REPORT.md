# CareSlot validation record

Executed locally on 2026-11-12 using Node.js 24.16.0, Next.js 16.4.5, TypeScript, real disposable PostgreSQL and Playwright Chromium.

| Executed command | Final result |
| --- | --- |
| npm install / npm install --package-lock-only | Succeeded; audit reported 0 vulnerabilities |
| npm test | 38 passed, 0 failed, 2 live tests skipped |
| npm run typecheck | Passed |
| npm run build | Passed; all three pages and protected APIs compiled |
| npx playwright install chromium | Completed |
| npm run test:e2e | 8 passed, 0 failed |
| npm run check:secrets | Passed; 13 client assets scanned |
| git check-ignore .env.local node_modules/ .next/ test-results/ | All ignored |
| VS Code workspace diagnostics | No errors reported |

## What the passing tests establish

19 database tests apply the unmodified official seed and actual atomic migration to a disposable real PostgreSQL cluster. They cover:

- Repeatable migration and preservation of seeded booked slots without appointment rows.
- Successful booking, duplicate rejection, past/missing slots and full rollback on forced insertion failure.
- Cancellation, repeat cancellation after rebooking, ownership and completed-state restrictions.
- Cross-doctor rescheduling with the same appointment ID.
- Occupied/past/missing targets and stale approval preserving the original appointment.
- Simultaneous bookings over separate connections with exactly one winner.
- Concurrent rescheduling/cancellation and concurrent reschedules to one target.
- Unique/composite foreign-key constraints and function execution permissions.

19 unit/mocked-transport tests cover doctor search, language/specialty/common-issue filters, availability, P001 scoping, IST time comparisons, Zod, token tampering/expiry, exact-action approval, single execution per turn, RPC errors, function declarations, provider-selected tool dispatch, bounded loops, post-write provider failure, missing configuration and authentication.

8 browser tests use the production Next.js server and real login/session protection. Data and provider responses are HTTP fixtures confined to tests. They verify:

- Unauthenticated API/page protection.
- Wrong passcode and missing-environment error states.
- Rejection of other-patient query parameters and malformed inputs.
- All three pages at 360px and 1440px, with no horizontal overflow.
- Direct booking confirmation and returned receipt display.
- Chat tool traces and confirmation flow.
- Appointment rescheduling/cancellation controls and status refresh.

Desktop and phone screenshots were visually inspected. Production bundle scanning found no server-secret identifiers or confirmation-signing code in client assets. No live secret values were available for a value-based scan.

## Required 20-case coverage

| Requested case | Evidence |
| --- | --- |
| 1. Doctor search by department | Unit service test |
| 2. Search by language | Unit service test |
| 3. Available slots | Unit service test; browser fixture rendering |
| 4. Successful booking | Actual PostgreSQL RPC |
| 5. Duplicate booking | Actual PostgreSQL RPC and constraint |
| 6. Past slot booking | Actual PostgreSQL RPC |
| 7. Invalid slot ID | Actual PostgreSQL RPC |
| 8. Cancellation | Actual PostgreSQL RPC; UI fixture flow |
| 9. Repeated cancellation | Actual PostgreSQL RPC after slot rebooking |
| 10. Unauthorized cancellation | Actual PostgreSQL RPC |
| 11. Rescheduling | Actual PostgreSQL RPC; UI fixture flow |
| 12. Occupied target | Actual PostgreSQL RPC |
| 13. Failed move preserves original | Actual PostgreSQL state checks |
| 14. Concurrent bookings | Separate real PostgreSQL connections |
| 15. Other-patient access | Server service scoping and SQL ownership |
| 16. Invalid Zod arguments | Validation prevents tool execution |
| 17. Medical diagnosis refusal | Live Gemini test implemented; SKIPPED |
| 18. Ambiguous request | Live Gemini test implemented; SKIPPED |
| 19. Missing variables | Unit and real-server browser checks |
| 20. API authentication | Unit and real-server browser checks |

## Not verified / manual acceptance still required

No live Supabase URL/key, Gemini key/model, or application passcode was configured. No live Supabase operations or Gemini API calls were executed. The two opt-in Gemini behaviour tests were skipped. Local PostgreSQL correctness and mocked tool dispatch do not prove hosted Supabase/PostgREST or real-model behaviour.

After setup, run the live tests documented in the README, then demonstrate booking, rescheduling and cancellation through genuine Gemini tool selection against the configured Supabase project. Verify joined PostgREST responses, persistent records after reload, medical refusals, ambiguous requests and model availability.

No remaining failures are known in the executed local suite. Hosted integration and medical-response behaviour remain unverified until credentials are provided.

Git was initialized locally. No commit, remote, push, publication or Vercel deployment was performed.
