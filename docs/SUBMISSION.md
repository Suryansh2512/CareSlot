# CareSlot submission handoff

## Verified links and files

- Public GitHub: https://github.com/Suryansh2512/CareSlot, branch main (also the remote default branch).
- Local backup: http://127.0.0.1:3300 after npm run dev.
- Five-slide content: [SLIDES.md](SLIDES.md), with actual screenshots under [screenshots](screenshots/).
- Deployment commands: [DEPLOYMENT.md](DEPLOYMENT.md).
- Validation evidence: [TEST_REPORT.md](TEST_REPORT.md).
- Vercel: no authenticated/linked project here, so no verified deployment URL.

## Before the official form

1. Obtain trainer approval for OpenRouter, or switch explicitly to a working trainer-approved Gemini configuration. The guide mandates Gemini; the owner authorization alone does not establish faculty acceptance.
2. Authenticate Vercel, confirm its account/scope and intended CareSlot project, set the provider and shared server variables, deploy main and verify the actual public app. Follow the exact commands in DEPLOYMENT.md. No deployment was attempted to an unconfirmed project.
3. Supply the team number, each member's name/role and genuine commit contributions. No identities or attributions were fabricated.
4. Assemble the five slides from SLIDES.md and export as PDF or share a view-only Google Slides link. PPTX authoring tooling was unavailable on this host; the ready-to-paste content and real screenshots are provided.
5. Run [read-only hosted permission verification](../seed/ps3_verify_setup.sql) in Supabase SQL Editor. Confirm RPC execute is denied to PUBLIC/anon/authenticated and allowed to service_role, and RLS is enabled. Do not rerun the destructive seed.
6. Share APP_PASSCODE privately in the official form only. Never publish it in the README or slides.
7. Confirm the form destination and final contents before submission. This task did not authorize submitting an unspecified form or identity data.

## Milestone status

The owner reported 70/100 before finalization. No new official score has been awarded or independently verified. Confirmed engineering evidence includes all six tools through live OpenRouter selection, signed hosted write flows, medication refusal, ambiguity handling, 45 automated tests, 14 browser tests and a successful production build. Official Gemini compliance, the public Vercel demo, final deck export, team attribution and judging remain unconfirmed. Do not convert local engineering checks into invented rubric points.
