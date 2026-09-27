# Evidence — Social Media Studio

This file maps the capstone brief (Section 5, `docs/Social Media Studio Live Capstone.pdf`)
to proofs that exist in this repository. Status labels are deliberate:

- **Verified** — the behavior exists in code and there is a captured command output
  or a structural proof (file references) in this file.
- **Pending live run** — the code path exists and is described precisely, but the
  proof requires the running stack (PostgreSQL, Redis) and/or real credentials,
  which cannot be exercised from this repository checkout alone.

Last verified: **2026-09-27**.

## Brief-to-repository traceability

The brief is explicit about the delivery criteria:

- Ingestion and stored source-of-truth
- Enforced constraint profiles per platform
- Review workflow with `draft` / `approved` / `rejected` / `published`
- One adapter seam, one real target, and mock adapters for non-live targets
- Idempotent, durable scheduling and publish history
- Secrets kept in `.env` only
- README with exact local run steps

The sections below connect each requirement to the implemented code and the
relevant proof artifacts in this repo.

## 0. Baseline verification run

Run from the repository root with dependencies installed:

```text
$ npm run typecheck
> tsc --noEmit
(exit 0, no diagnostics)

$ npm run build
> tsc -p tsconfig.build.json
(exit 0, emit to dist/)

$ npm run lint
> biome check .
Checked 53 files in 156ms. No fixes applied.
(exit 0)

$ npm test
> node --import tsx --test
✔ markStatus uses a dedicated boolean parameter to set completion time (11.672544ms)
✔ schedule payload accepts only a future ISO scheduledAt (20.932776ms)
✔ creates an approved schedule with the canonical idempotency key (3.948637ms)
✔ does not insert a schedule for an unapproved variant (8.523207ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
(exit 0)
```

## Requirement checklist

| Requirement | Status | Proof |
| --- | --- | --- |
| Ingestion and stored source of truth | Verified | [E1](#e1--ingestion-and-stored-source-of-truth) |
| Constraint profiles enforced by code | Partially verified | [E2](#e2--constraint-profiles) |
| Review workflow and refusal of unapproved scheduling | Verified | [E3](#e3--review-workflow) |
| Adapter layer: one interface, one real target, two mocks | Verified | [E4](#e4--publisher-adapter-layer) |
| Idempotent publish | Verified (code) — live proof pending | [E5](#e5--idempotent-publish) |
| Durable scheduling | Verified (code) — live proof pending | [E6](#e6--durable-scheduling) |
| Visible publish history | Verified | [E7](#e7--publish-history) |
| Secrets stay out of the repository | Verified by inspection | [E8](#e8--secrets) |
| README with architecture and exact run steps | Verified by inspection | [E9](#e9--readme) |

## E1 — Ingestion and stored source of truth

**Requirement (brief §5):** a post enters as a URL or Markdown, is stored, and
generation reads only the stored post.

**Proof:** `POST /api/posts` accepts `{"sourceType":"markdown","content":...}` or
`{"sourceType":"url","url":...}` (`src/modules/posts/posts.route.ts`,
`src/modules/posts/posts.schema.ts`). For a URL, `PostsService` calls the
`UrlFetcher`, extracts the article through `ArticleExtractor`, and stores the
normalized Markdown; `source_type`/`source_url` record how it arrived
(`src/modules/posts/posts.service.ts`).

The schema guarantees the invariant: `posts_url_required_for_url` requires a URL
for `source_type = 'url'`, and `posts_no_url_for_markdown` forbids one for
`source_type = 'markdown'` (`src/database/schema.sql`).

Generation cannot re-fetch the source. `GenerationService.processGenerationJob()`
loads the post with `PostRepository.findById(postId)` and supplies `post.content`
to the AI provider; `createGenerationContainer()` (`src/config/container.ts`)
constructs no `UrlFetcher`, `ArticleExtractor`, or `MarkdownConverter`. This
invariant is documented in `docs/DESIGN.md` ("Generation read path").

**Reproduce:** start the stack (README), then:

```bash
curl -s -X POST http://localhost:3000/api/posts -H 'Content-Type: application/json' \
  -d '{"sourceType":"markdown","content":"# Hello\n\nIdempotent publishing matters."}'
# then either
curl -s -X POST http://localhost:3000/api/posts/:id/generate
curl -s http://localhost:3000/api/posts/:id/variants
```

## E2 — Constraint profiles

**Requirement (brief §5):** code enforces each platform's length, tone, and
hashtag rules; a breaking variant is blocked before review, with an error that
names the broken rule.

**Proof:** Platform profiles are configuration rows in `platforms`
(`max_length`, `tone`, `max_hashtags`, `adapter`); the three seeded platforms are
`telegram` (4096 / 5 hashtags), `mock_x` (280 / 3), and `mock_linkedin`
(3000 / 5) (`src/database/seed.sql`, `src/database/schema.sql`).

`VariantValidator` (`src/ai/variant-validator.ts`) rejects:

- empty content — `Generated variant is empty`
- content exceeding `max_length` — `Variant exceeds max length of 280 (got 450)`
- content exceeding `max_hashtags` — `Variant uses 6 hashtags (max 3)`

Each message names the violated rule and is a `400 Bad Request`. Validation runs
on **two** paths: generated variants (`GenerationService`, before `upsertVariants`
writes them) and edited variants (`VariantsService.editVariant`,
`src/modules/variants/variants.service.ts`).

**Verification:** validation is exercised on the edit path, so a reviewer can
prove a blocked variant without invoking the LLM:

```bash
curl -s -X PATCH http://localhost:3000/api/variants/:id -H 'Content-Type: application/json' \
  -d '{"content":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..."}'   # over the platform max
# HTTP 400, message naming the rule and the measured length
```

**Gap:** `tone` is stored in the profile and sent to the model in the prompt, but
`VariantValidator` does not enforce whether the tone of generated text matches
the profile. Length and hashtags are machine-enforced; tone is prompt-only.

## E3 — Review workflow

**Requirement (brief §5):** variants move through `draft`, `approved`, `rejected`,
`published`; only `approved` variants may be scheduled; an unapproved schedule
request returns a 4xx with an error message.

**Proof:**

- Statuses are constrained in the database:
  `variants.status CHECK IN ('draft','approved','rejected','published')`
  (`src/database/schema.sql`).
- Endpoints: `GET /api/variants/:id` (get), `PATCH /api/variants/:id` (edit),
  `POST /api/variants/:id/approve`, `POST /api/variants/:id/reject`
  (`src/modules/variants/variants.route.ts`).
- Published variants are locked: a `published` variant cannot be edited,
  approved again, or rejected (`VariantsService`, `VARIANT_ALREADY_PUBLISHED` /
  `VARIANT_PUBLISHED`).
- `SchedulesService.createSchedule` refuses any non-`approved` variant with
  `AppError.conflict("Variant must be approved before scheduling",
  "VARIANT_NOT_APPROVED")` (`src/modules/schedules/schedules.service.ts`).
- Only a successful publish moves a variant to `published` (`markPublished` in
  `PublishingService`).

**Verification:** pinned by an automated test:
`does not insert a schedule for an unapproved variant` (`src/modules/schedules/
schedules.service.test.ts`) — a `draft` variant causes `VARIANT_NOT_APPROVED`
and the repository `create` is never called.

Pending live run:

```bash
curl -s -i -X POST http://localhost:3000/api/variants/:id/schedule \
  -H 'Content-Type: application/json' -d '{"scheduledAt":"2030-01-01T12:00:00.000Z"}'
# for an unapproved variant -> HTTP 409 Conflict
# {"message":"Variant must be approved before scheduling", ...}
```

## E4 — Publisher adapter layer

**Requirement (brief §5):** one `SocialPublisher` interface, one real free-platform
adapter, and two mock adapters; swapping adapters must not touch business logic.

**Proof:**

- Single contract: `interface SocialPublisher { publish(input: PublisherInput): Promise<PublisherResult> }`
  (`src/publishing/social-publisher.ts`).
- Real: `TelegramPublisher` calls the Telegram Bot API `sendMessage` endpoint over
  `fetch` with `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`
  (`src/publishing/adapters/telegram-publisher.ts`).
- Mocks: `MockXPublisher`, `MockLinkedInPublisher` implement the same interface
  and return a simulated `externalPostId` plus a `response` preview that the
  caller persists (`src/publishing/adapters/mock-x-publisher.ts`,
  `src/publishing/adapters/mock-linkedin-publisher.ts`).
- Swap by configuration: `adapter-registry.ts` maps a platform's `adapter` code
  (`telegram` | `mock_x` | `mock_linkedin` — the `platforms.adapter` column) to a
  publisher via `getPublisher`. `PublishingService` resolves the adapter by
  `platform.code` only; it contains no platform-specific logic.

**Verification (structural):** `src/publishing/`, the registry, and the three
adapters. The swap seam is at configuration, not code: changing `platforms.adapter`
from `telegram` to `mock_x` changes which publisher `resolvePublisher` returns for
that platform. Probe 6 describes how to exercise this live.

**Gap:** the Telegram post can only be proven with real credentials. The mock
path is fully self-contained and runnable with the seeded `mock_x` /
`mock_linkedin` platforms.

## E5 — Idempotent publish

**Requirement (brief §5):** the same variant and slot never posts twice, even
under retries.

**Proof (runtime):** a logical publish is identified by its schedule
`idempotency_key` (`sha256(variantId + ":" + scheduledAt)`, unique in
`schedules`). `PublishingService.publishSchedule` wraps the side-effecting
sequence in database transactions:

1. **TX 1 (short-circuit):** if `findSuccessAttempt(scheduleId)` finds a prior
   success, the schedule is marked `success` and the **stored** result is
   returned — the adapter is never called again.
2. Otherwise the schedule is **claimed** with a conditional
   `UPDATE schedules SET status='processing', attempt_count = attempt_count + 1
   WHERE id=$1 AND status='pending' AND scheduled_at <= NOW() RETURNING *`, and a
   `publish_attempts` row (`attempt_number = MAX + 1`) is inserted. No claim means
   the work is already owned by another worker and the call is a no-op.
3. After the adapter call, **TX 2** atomically records the outcome: success →
   attempt `success`, schedule `success`, variant `published`; failure → attempt
   `failed` and schedule `failed` (terminal) or back to `pending`.

The publish is at-least-once; the **exactly-once effect** comes from the DB:
a retried publish hits the success short-circuit or the claim guard, never a
second real post. The idempotency key is also passed to the adapter
(`PublisherInput.idempotencyKey`).

**Files:** `src/modules/publishing/publishing.service.ts`,
`src/modules/publishing/publishing.repository.ts`, `src/modules/schedules/
schedules.repository.ts` (`claim`), `src/database/schema.sql` (`schedules.
idempotency_key` UNIQUE, `publish_attempts.attempt_number` UNIQUE per schedule).

**Pending live proof:** a repeated-call transcript. With the stack running, approve
a seeded-platform variant and schedule it; watch the worker publish once; then
re-issue the publish (or let a delayed duplicate BullMQ job run) and show the
history holds **one** success rows and `GET /api/schedules/:id` reports `success`.

## E6 — Durable scheduling

**Requirement (brief §5):** a worker stopping mid-batch restarts and continues
with zero duplicate posts.

**Proof (runtime):**

- The database, not the queue, is the source of truth. `schedules.status`
  (`pending | processing | success | failed`) plus `locked_at` and
  `attempt_count` drive who owns work (`src/database/schema.sql`).
- `PublishingWorker` runs `sweepDueSchedules` at startup and every 30 s
  (`src/workers/publishing.worker.ts`, `src/modules/publishing/
  publishing.scheduler.ts`). The sweep (a) reclaims schedules stuck in
  `processing` past a 300 s lease — requeueing them or marking them `failed`
  beyond the attempt ceiling — and (b) enqueues due `pending` schedules as a
  BullMQ job whose `jobId` is the **schedule id** (BullMQ deduplicates by jobId,
  so a sweep re-enqueue cannot double-fire an in-flight job)
  (`src/modules/publishing/publishing.queue.ts`).
- After a crash mid-publish, the attempt row is left `started`; the lease expires,
  the sweep reclaims the schedule to `pending`, and the publish is retried. The
  `claim` guard plus the success short-circuit (E5) guarantee the retry produces
  exactly one post.
- The generation path has the same machinery:
  `recoverStaleGenerationJobs` (`src/modules/generation/generation.recovery.ts`).

**Pending live proof:** stop `publishing-worker` after a successful claim but
before the attempt completes, restart it, and show exactly one `success` row.

## E7 — Publish history

**Requirement (brief §5):** each attempt is recorded and visible, with its
result.

**Proof:** `publish_attempts` stores one row per attempt: `attempt_number`,
`status` (`started | success | failed`), `external_post_id`, `response` (JSONB),
and `error`. Rows are written by `PublishingService.publishSchedule` on every
claim (started) and completion (success/failed) (`src/modules/publishing/
publishing.repository.ts`). The API exposes full history:

- `GET /api/schedules` — all schedules
- `GET /api/schedules/:id` — one schedule with its status, attempt count, and
  last error
- `GET /api/schedules/:id/attempts` — every attempt for that schedule in
  ascending order (`src/modules/schedules/schedules.route.ts`)

**Reproduce:** after any scheduled publish, `curl -s
http://localhost:3000/api/schedules/:id/attempts` returns the attempt list; each
success row carries the external post id returned by the adapter.

## E8 — Secrets

**Requirement (brief §5):** tokens live in `.env` only; the repo ships `.env.example`.

**Proof:** `.env` is absent from the repository and covered by `.gitignore`
(`.env`, `.env.*.local`). `.env.example` ships every variable with safe
placeholders (`your_token_here`), shape-matching what `src/config/env.ts`
validates on boot. No credential or hard-coded token exists in `src/` (checked by
inspection; the Telegram adapter reads `env.telegram.bot_token`, never a literal).

## E9 — README

**Requirement (brief §5):** what the system does, an architecture diagram, and
exact run steps; a stranger can run it with one command.

**Proof:** `README.md` documents the purpose, the architecture (two diagrams:
content flow and the implemented request path), the full platform table, the
exact environment variables, and both run paths — full containerized stack via
`docker compose up --build` and a host-run path. It ends with honest known
limitations. `.env.example` and required startup commands are covered in E8 and
E1.

## Acceptance probes (brief §10)

| Probe | Status |
| ---- | ---- |
| P1 — ingest a post, variants generated and pass profiles | Verified by code. Live run pending (needs LLM key). |
| P2 — a rule-breaking variant is blocked, error names the rule | Verified by code (E2). Proof: edit-path `PATCH` transcript. |
| P3 — scheduling an unapproved variant returns 4xx | Verified by code + unit test (`schedules.service.test.ts`). Live curl pending. |
| P4 — approve + schedule 2 min out, publishes to real target, record links to post | Code complete; needs real Telegram credentials (E4 gap). |
| P5 — stop worker mid-publish, restart, exactly one post | Code complete; live crash transcript pending (E6). |
| P6 — swap adapter via configuration (e.g. `telegram` → `mock_x`), no code change | Code complete; swap proof: update `platforms.adapter`, re-run a schedule, observe the mock result rows. |

## Known gaps

- **Tone is prompt-only**, not machine-enforced by `VariantValidator` (E2).
- **Retry policy not fully reconciled:** the BullMQ queue (`attempts: 3`,
  exponential backoff) and the schedule terminal ceiling (`attempt_count >= 5`)
  use different numbers, so a thrown failure can be re-driven indefinitely by the
  sweep until the ceiling catches it. Exported policy + dead-letter handling are
  planned. Behavior today is still bounded and duplicate-safe.
- **Live-transcript proofs** (P1, P4, P5) require the running stack and real
  credentials; they cannot be produced from this checkout.

## Log

- 2026-09-20: initial EVIDENCE.md. Written before the scheduling/publishing core
  existed; E5/E6/E7 marked "not yet complete".
- 2026-09-27: full rewrite against the implemented scheduling/publishing stack;
  captured `typecheck` / `build` / `lint` / `test` (4 passing) runs. Live-stack
  proofs remain pending by environment limits.