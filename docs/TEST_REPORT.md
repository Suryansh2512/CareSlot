# CareSlot validation record

## Finalization: OpenRouter and hydration verification

The owner authorized the OpenRouter variation and final GitHub push. The official guide still mandates Gemini; faculty approval of the variation is unconfirmed.

- Catalog and native tool probes: google/gemma-4-26b-a4b-it:free and google/gemma-4-31b-it:free both returned 429. nvidia/nemotron-3.5-lightning:free returned a native searchDoctors tool call in about 1.3 seconds. Its catalog prices were zero, context 1,000,000 tokens and tools supported. This exact model was selected locally. Requests enforce zero-price caps, explicit model identity and no paid/random fallback.
- Live strict UI acceptance: 12 checks passed through real Chromium, real OpenRouter native function calling, Zod, the six existing tools and hosted Supabase. Booking, rescheduling and cancellation each produced a proposal without mutation and committed only after the actual confirmation button. Appointment #18 retained its ID across the move. Immediate booking replay returned 409, same-target reschedule replay was unchanged and repeated cancellation was unchanged. Greeting, dermatologist discovery, Tamil-speaking availability tomorrow, P001 appointments, medicine refusal and ambiguity clarification passed. No console/hydration errors occurred. This is real integration, separate from mocked transports.
- Live database/API acceptance: 14 checks passed, including a booking race with one 200/one 409, failed-reschedule rollback, cross-patient ownership and hosted unique/composite-key probes. Cleanup compared all original rows, preserving 1,440 slots and 1 appointment. The official seed and atomic migration were not modified or rerun.
- Live read-only browser checks: 6 passed across login, directory/filter/slot selection, confirmation dismissal, three pages at 360/1440px and console checks.
- Hydration diagnosis reproduced all three reported errors at localhost:3000, which served the unrelated ChairMate app on an IPv6 listener. The first mismatch was an image in its GlobalGallery (server chair1 vs client chair6), followed by text mismatches and whole-root client recovery. CareSlot on its correct IPv4 origin had no such warnings. CareSlot now has a dedicated development URL, http://127.0.0.1:3300; no ChairMate source/process was changed.
- A separate real CareSlot date defect was reproduced in Pacific/Honolulu: the slot date 2026-11-13 displayed badge day 12 while its appointment text said 13 Nov. The badge now reads the SQL calendar day directly. Month formatting fixes Asia/Kolkata, ISO today is built from explicit date parts, and the date-input min attaches in an effect after an identical SSR/initial-browser render. No global client-only rendering, fake data, new loading screen or hydration-warning suppression was introduced.
- Automated final validation: npm test **45 passed, 0 failed, 2 opt-in live checks skipped**. npm run test:e2e **14 passed** (original 8 plus 6 timezone/clock-skew hydration regressions at 360/1440px). npx tsc --noEmit, npm run typecheck and npm run build passed. The six new regression cases use test-only fixtures; separate live tests above use actual data.
- Five-slide content now follows H12 with actual live screenshots. PPTX tooling (@oai/artifact-tool) is unavailable; no PPTX is claimed. Team identities remain owner-supplied information. Vercel has no .vercel/project.json, stored CLI authentication or environment token; no deployment URL is claimed.
- Hosted ACL/RLS catalog verification still requires the read-only SQL file below. Local permission tests passed, but do not establish hosted role grants.

Earlier entries below are historical snapshots; their model availability and Git-state statements do not describe the finalization state above.

## Live integration follow-up — 2026-11-12

- Environment: five required settings configured; a missing APP_PASSCODE was privately generated. The template remains blank and .env.local is ignored. No key values were printed.
- Hosted Supabase: 8 departments, 15 doctors, 1,440 slots, 5 patients and 1 pre-existing P001 appointment. Actual exposed columns and all three RPC signatures matched the implementation. Existing seed and migration were already applied; no reset or migration execution was needed.
- Live HTTP/API checks: health 200; valid login 200; wrong login 401; protected unauthenticated APIs 401; strict patient/date query validation 400; real directory/language/specialty searches, joined P001 appointments and available slots passed.
- Live writes: signed confirmation required; booking persisted and marked the slot; duplicate booking rejected; rescheduling preserved ID and released its old slot; an occupied target rolled back safely; cancellation released the slot; repeated cancellation preserved a subsequent booking. A P002 fixture was invisible and immutable to P001 through both API and SQL RPC ownership checks. Concurrent signed booking requests returned exactly one 200 and one 409. Hosted constraint probes returned 23505 for occupancy and 23503 for doctor/slot mismatch.
- Live data preservation: only isolated records created by the test were removed. A paginated before/after comparison proved all 1,440 original slots and the original appointment remained byte-for-byte equivalent, including seeded occupancy without appointment rows. Identity sequences advance during isolated tests; no sequence was reset.
- Live API/database harness: 14 checks passed. This is real hosted integration, separate from the disposable PostgreSQL suite.
- Live Chromium: 8 checks passed using actual hosted data, no mocked responses. Tested wrong/correct passcode, doctor search and filters, real slots, signed proposal dismissal, all pages at 360/1440px, explicit confirmed booking/reschedule/cancel on isolated slots, reload persistence and no console/hydration errors. The chat test verified provider failure feedback; it did not verify a successful live Gemini trace. Screenshots were generated and inspected. Screenshot caret injection was disabled to avoid test-induced hydration warnings.
- Gemini: model metadata request succeeded for the exact configured gemini-3.8-flash and listed generateContent support. Minimal generation and all seven requested agent prompts were attempted, plus ambiguous booking. Generation failed with HTTP 503 UNAVAILABLE ("This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."), HTTP 504 DEADLINE_EXCEEDED, and one HTTP 429 quota response. No successful live Gemini-selected tool workflow, medical refusal or ambiguity response is claimed. No model or provider substitution was made.
- Fixes: safe actionable provider errors preserve application authentication errors; SDK retry count is bounded by the existing request budget; Node is pinned to 24.x; secret scanning loads private environment values and scans both browser bundles and tracked files. Windows disposable PostgreSQL shutdown uses pg_ctl to avoid orphaned I/O worker pipes after forced termination.
- Hosted permission limitation: the configured service key provides PostgREST, not management SQL access. Hosted role ACL/RLS catalogs could not be queried. Equivalent permission tests pass locally. Run [read-only hosted verification](../seed/ps3_verify_setup.sql) for final hosted ACL assurance; do not rerun the seed.
- Final validation: `npm test` completed with **39 passed, 0 failed, 2 opt-in live tests skipped** (19 disposable PostgreSQL + 20 unit tests). Actual Gemini requests were attempted separately, as recorded above. `npm run build`, `npm run typecheck`, and `npx tsc --noEmit` all passed. `npm run test:e2e` passed **8/8** with test-only HTTP fixtures. The production server was started on loopback port 3200 and passed **6/6 real hosted read/auth/schema checks**. Final hosted counts remained 1,440 slots and 1 appointment after fixture cleanup.
- Secret checks: 13 browser assets and 71 tracked files passed the credential-value/signature scan; a separate scan including all 75 tracked and untracked source files found no configured secret values. The template assignments were verified blank; the local credentials file is ignored. VS Code diagnostics were clear. Lockfile refresh added no dependencies and npm audit reported 0 vulnerabilities.
- Publishing: original commit 32865bf is on origin/main at Suryansh2512/CareSlot. Follow-up edits were not committed, pushed or deployed. [Exact deployment commands](DEPLOYMENT.md) are prepared; Vercel target confirmation and working Gemini generation remain required.

## Archived original implementation baseline

The remainder records the earlier run before credentials were configured. Its "not verified" and Git-state statements describe that earlier baseline only, and are superseded by the live follow-up above.

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
