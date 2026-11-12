# GitHub and Vercel preparation

## Before publishing

The intended public repository is `https://github.com/Suryansh2512/CareSlot`, branch `main`, account `Suryansh2512`. The owner explicitly authorized committing and pushing the finalization changes. Vercel deployment is authorized only if already authenticated and linked to this project's intended target. This workspace has no Vercel project link or stored authentication, so no Vercel deployment was attempted.

1. Supabase is already initialized: 8 departments, 15 doctors, 1,440 slots, 5 patients and 1 pre-existing appointment. All three atomic RPCs exist and real signed write tests passed. **Do not rerun the destructive official seed.**
2. Configure local environment variables privately.
3. Run npm test, npm run typecheck, npm run build, npm run test:e2e and npm run check:secrets.
4. OpenRouter completed real model-selected reads and signed booking/reschedule/cancel against Supabase. `AI_PROVIDER=openrouter` uses `nvidia/nemotron-3.5-lightning:free`, with zero-price routing caps and no model fallback. Gemini remains selectable; its earlier generation requests returned 503/504 and one 429. The guide mandates Gemini, so trainer approval is required for the OpenRouter variation before claiming official agent marks.
5. Fill in team details and confirmed links in the README and slides.

## GitHub commands after target/account confirmation

Run from the project folder containing package.json. The GitHub repository root is already that folder; Vercel's Root Directory should be `.` for the existing remote, not an additional nested directory.

```powershell
Set-Location 'C:\Users\surya\Downloads\srm-agent-hackathon-starter-main\srm-agent-hackathon-starter-main'
git remote get-url origin
git branch --show-current
git status --short
git check-ignore .env.local
git add .
git diff --cached --stat
npm run check:secrets
git commit -m "feat: finalize CareSlot OpenRouter agent and deployment readiness"
git push -u origin main
```

If a remote or repository already exists, inspect git remote -v and use the existing team workflow. Do not overwrite history or force-push. Authenticate to the authorized account using GitHub's normal login flow. Never put credentials in a remote URL or shell command.

## Vercel

1. Sign into the confirmed Vercel account/team.
2. Import the confirmed GitHub repository.
3. Set the root directory to `.` for the existing remote. It contains package.json directly. Select `main` as the production branch; the repository also has a `master` branch.
4. Select the Next.js preset. Node.js is pinned to `24.x` in package.json. Install command: `npm ci`. Build command: `npm run build`. Keep the default Next.js output setting; no custom vercel.json is required. See [Vercel Node runtime versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
5. Configure SUPABASE_URL, SUPABASE_SECRET_KEY and APP_PASSCODE, plus AI_PROVIDER and that provider's key/model pair. Keep GEMINI_API_KEY and GEMINI_MODEL configured as well if Gemini switching is needed. All keys remain server-only.
6. Deploy only after confirming this target with the project owner.
7. Check /api/health, sign in, test every required workflow, and verify the real database changes persist after reload.
8. Share the live URL and passcode privately with judges. Include the public repo URL and five slides in the submission form.

Select the provider explicitly. Use the trainer-approved Gemini model for official compliance unless faculty approve the OpenRouter variation. Missing configuration must be fixed explicitly; the application does not silently switch providers or models.

### Exact CLI alternative after Vercel account/project confirmation

Replace the two scope/project placeholders with the owner-confirmed values before running. These are interactive commands; enter credentials only into the private prompts. Do not place secret values in shell commands, chat, or repository files.

```powershell
npx vercel login
npx vercel whoami
npx vercel link --scope <CONFIRMED_VERCEL_SCOPE> --project <CONFIRMED_PROJECT>
npx vercel env add AI_PROVIDER production
npx vercel env add OPENROUTER_API_KEY production --sensitive
npx vercel env add OPENROUTER_MODEL production
npx vercel env add GEMINI_API_KEY production --sensitive
npx vercel env add GEMINI_MODEL production
npx vercel env add SUPABASE_URL production
npx vercel env add SUPABASE_SECRET_KEY production --sensitive
npx vercel env add APP_PASSCODE production --sensitive
npx vercel --prod --scope <CONFIRMED_VERCEL_SCOPE>
```

Repeat the environment commands with `preview` if preview deployment testing is desired. See official [environment CLI](https://vercel.com/docs/cli/env) and [project linking CLI](https://vercel.com/docs/cli/link). No global CLI dependency is required.

### Remaining hosted permission verification

The service REST API exposed the exact table columns and RPC signatures, and live tests proved the occupancy and composite foreign-key constraints. It cannot expose PostgreSQL ACL/RLS catalogs. Run [read-only catalog verification](../seed/ps3_verify_setup.sql) in Supabase SQL Editor to verify hosted role permissions, SECURITY INVOKER, empty function search paths and RLS. This file performs no writes. Expected `anon_can_execute`, `authenticated_can_execute`, `public_can_execute` are all false; `service_role_can_execute` is true. Equivalent permission assertions passed in disposable local PostgreSQL, but that does not establish the hosted ACLs.

`APP_PASSCODE` was blank during integration; a random local value was generated without displaying it. Retrieve it privately from .env.local, or replace it locally before setting the same value in Vercel.

## Judge acceptance checklist

- Booking: the configured model selects read tools and a write proposal; nothing changes before confirmation; a real appointment ID is returned after approval.
- Provider: the UI and response metadata show the selected provider; disclose the OpenRouter variation and Gemini's current availability honestly.
- Rescheduling: same appointment ID, new slot reserved, old slot released; occupied target preserves original booking.
- Cancellation: status cancelled; slot reusable; repeated cancellation does not release another booking.
- Ownership: only P001 data is returned; P002 requests and arbitrary patient parameters are refused.
- Safety: diagnosis/medicine request refused; unclear requests prompt clarification.
- Live UI: reload and verify persisted data; mobile layout remains usable.
- Security: no secrets in source, screenshots, client assets or repository.
- Delivery: every member has genuine commits, README filled, five slides ready, localhost backup available.

Follow the handbook's 3:30 code freeze and 4:00 submission deadline on the actual event day.
