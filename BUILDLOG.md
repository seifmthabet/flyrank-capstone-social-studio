# BUILDLOG — Social Media Studio

Required by the capstone brief (§8): an honest record of where AI assistance was
used, where it was wrong, and what was changed. Honesty is graded; perfection is
not.

## Workflow

Development is **AI-assisted**: an AI coding assistant (opencode) is used for
design review, feature planning, code review, and documentation (DESIGN.md,
README.md, EVIDENCE.md — including this file). The implementation code, commits,
and repository history are owned and committed by the developer.

## Change timeline

| Date | Change | AI role |
| --- | --- | --- |
| 2026-09-12 | Project scaffold: Express, DB pool, env validation, Docker | Assisted with structure and config review |
| 2026-09-13 | README + DESIGN.md (first pass); Markdown ingestion pipeline; post retrieval | Co-authored docs; reviewed ingestion design |
| 2026-09-15 | Generation queue + worker + error middleware; AI variant service; posts validation, URL fetch with timeout | Reviewed queue/worker design and error handling |
| 2026-09-16 | Social-publisher adapters (Telegram + mock X + mock LinkedIn) with factory; variants service/routes; posts fixes | Designed the adapter interface and registry shape |
| 2026-09-17 | Env/`.env.example`; schema timestamp standardization; Groq JSON-response fix; url-fetcher/error-handler fixes; CI workflow; formatting refactor; Docker multi-service compose + health checks; README refresh | Identified each fix during review, including a prompt/JSON-parsing bug in the Groq provider |
| 2026-09-20 | Generation stale-job recovery; DESIGN.md generation read-path invariant + first EVIDENCE.md; variant editing validation; lock published variants; posts URL property fix; remove `.idea` | Introduced stale-job recovery design; documented the "generation reads the stored post only" invariant |
| 2026-09-21 | Publish history tables/types + mock previews; adapter registry; `PublishingService`; scheduling service + repository; variants schedule route | Planned the scheduling module and service shape |
| 2026-09-24 | Schedule queue + validation schema; publishing worker + 30 s sweep; `dbTransaction`; idempotency key fix (`variantId:iso`); first tests | Designed the claim/sweep/short-circuit protocol and the transaction helper |
| 2026-09-25 | `markStatus` boolean completion flag + tests; publish-history routes (`GET /api/schedules...`, `GET /api/schedules/:id/attempts`) | Reviewed the terminal-state semantics and the history API |
| 2026-09-27 | EVIDENCE.md rewrite with captured proof runs; BUILDLOG.md; README refresh for the implemented publishing core | Authored the documentation updates; gathered verification output |

## Where AI was wrong (and what was changed)

These are the specific mistakes surfaced during AI-assisted work, each corrected
in the repository:

1. **Phantom publish payload.** An early `PublishingJobData` carried a
   `publishingJobId` imported from the generation job shape. The publishing
   worker then resolved a schedule id that did not exist (`JOB_NOT_FOUND`). Fixed
   by making the publishing job carry the schedule id only
   (`{ scheduledId }`), with the worker calling
   `publishSchedule(data.scheduledId)`.
2. **Idempotency-key separator.** The scheduling service initially hashed
   `variantId-iso` (hyphen). The brief's "one variant + one slot" identity was
   made explicit with `variantId:iso`; the canonical SHA-256 form is now pinned by
   a test with a golden value (`schedules.service.test.ts`).
3. **Three disagreed attempt ceilings.** The queue was provisioned with BullMQ
   `attempts: 3`, while the publishing service and the sweep each used their own
   `5`. A thrown failure could therefore be swept and re-enqueued indefinitely
   without ever hitting the terminal ceiling. Flagged by AI review; behavior stays
   duplicate-safe today, and reconciling the policy (single exported constant,
   dead-letter queue) is an open follow-up.
4. **Design/code divergences** that were introduced during early scaffolding and
   later reconciled or documented: `sourceUrl` vs `url`, `PUT` vs `PATCH`, and
   `adapter-registery.ts` (typo) renamed to `adapter-registry.ts`.
5. **Stale EVIDENCE.md.** The 2026-09-20 evidence file claimed the scheduling and
   publishing core did not exist. It predated the modules that implemented it and
   was rewritten on 2026-09-27 to match the repository. Same for README bullets
   ("schedule endpoint is a stub", "no publish history") that had gone stale.
6. **Plan/task documents (TASKS.md, PLAN.md) are intentionally git-ignored.**
   Recommended change to keep the working documents out of the submitted repo.
   Low-risk, but noted here so the choice is transparent.

## Known gaps flagged by AI that are still open

- **Tone** is prompt-only; the validator enforces length and hashtags, not tone.
- **Retry policy** not yet exported/centralized (item 3 above) and there is no
  dead-letter queue.
- **Live proofs** (real Telegram post, crash/restart transcript) require running
  infrastructure and real credentials; the repo cannot produce them.
- **Scary-case tests** (blocked variant, refused schedule, duplicate publish,
  adapter swap) are only partially covered; the brief lists them as a stretch
  goal.

## Brief-linked design decisions

The capstone brief's “hard parts” were the explicit design anchors for this repo:

1. **Idempotency**: the project uses a unique per-variant-per-slot idempotency key,
   a conditional claim path, and a success short-circuit to avoid duplicate posts.
2. **Constraint enforcement**: validation is implemented before review, with
   profile-based limits for length and hashtags.
3. **Durable scheduling**: the worker sweep and database-backed ownership model are
   designed so a restart can continue without duplicate posts.
4. **Adapter seam**: the code depends on a single `SocialPublisher` contract and
   switches implementation through configuration rather than business logic.
5. **Honest documentation**: the documents explicitly distinguish code-complete
   features from live-stack proofs that need a real Telegram token and running infra.

## Policy

- No secrets were ever entered by the assistant; all credentials live in the
  local `.env` and are git-ignored.
- The assistant does not run live infrastructure (no database, Redis, or network
  posts) — so it has never observed a real publish. Where evidence needs a live
  run, it is marked "pending live run" in EVIDENCE.md.
- Every change above is attributable to a commit in this repository's history;
  this log reflects the actual commit trail and the documented corrections.