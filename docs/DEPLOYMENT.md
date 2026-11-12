# GitHub and Vercel preparation

## Before publishing

Confirm the exact team repository URL, GitHub account, and authorized Vercel team/account and project. Nothing has been pushed or deployed by this implementation.

1. Initialize Supabase using the SQL files in the README, in order.
2. Configure local environment variables privately.
3. Run npm test, npm run typecheck, npm run build, npm run test:e2e and npm run check:secrets.
4. Exercise the real Gemini -> confirmation -> Supabase booking, rescheduling and cancellation flow.
5. Fill in team details and confirmed links in the README and slides.

## GitHub commands after target/account confirmation

Run from the inner project folder containing package.json.

```powershell
git init -b main
git status --short
git check-ignore .env.local
git add .
git diff --cached --stat
# Review the staged files and ensure there are no secrets.
git commit -m "Build CareSlot clinic appointment agent"
# Replace this placeholder with the CONFIRMED team repository URL.
git remote add origin <CONFIRMED_TEAM_REPOSITORY_URL>
git push -u origin main
```

If a remote or repository already exists, inspect git remote -v and use the existing team workflow. Do not overwrite history or force-push. Authenticate to the authorized account using GitHub's normal login flow. Never put credentials in a remote URL or shell command.

## Vercel

1. Sign into the confirmed Vercel account/team.
2. Import the confirmed GitHub repository.
3. Set the root directory to the folder containing package.json. If you upload the outer wrapper as repository root, choose its nested project directory.
4. Select the Next.js preset and a supported Node.js 24 runtime. Build command: npm run build. Keep the default Next.js output setting.
5. Configure GEMINI_API_KEY, GEMINI_MODEL, SUPABASE_URL, SUPABASE_SECRET_KEY and APP_PASSCODE for the intended environment.
6. Deploy only after confirming this target with the project owner.
7. Check /api/health, sign in, test every required workflow, and verify the real database changes persist after reload.
8. Share the live URL and passcode privately with judges. Include the public repo URL and five slides in the submission form.

Use the trainer-approved Gemini model. Missing configuration must be fixed explicitly; the application does not silently switch models.

## Judge acceptance checklist

- Booking: Gemini selects read tools and a write proposal; nothing changes before confirmation; a real appointment ID is returned after approval.
- Rescheduling: same appointment ID, new slot reserved, old slot released; occupied target preserves original booking.
- Cancellation: status cancelled; slot reusable; repeated cancellation does not release another booking.
- Ownership: only P001 data is returned; P002 requests and arbitrary patient parameters are refused.
- Safety: diagnosis/medicine request refused; unclear requests prompt clarification.
- Live UI: reload and verify persisted data; mobile layout remains usable.
- Security: no secrets in source, screenshots, client assets or repository.
- Delivery: every member has genuine commits, README filled, five slides ready, localhost backup available.

Follow the handbook's 3:30 code freeze and 4:00 submission deadline on the actual event day.
