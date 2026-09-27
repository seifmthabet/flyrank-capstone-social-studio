# Social Media Studio

From one blog post to a reviewed, scheduled, multi-platform campaign — without the chaos.

<div align="left">

[![Status](https://img.shields.io/badge/status-working%20prototype-2ea44f)](README.md)
[![Workflow](https://img.shields.io/badge/workflow-ingest%20%E2%86%92%20review%20%E2%86%92%20schedule-7c3aed)](README.md)
[![Reliability](https://img.shields.io/badge/reliability-idempotent%20%26%20durable-0ea5e9)](README.md)
[![Platforms](https://img.shields.io/badge/platforms-telegram%20%2B%20mocks-ff8a00)](README.md)

</div>

`#social-media` `#automation` `#review-workflow` `#publishing` `#idempotency` `#backend`

This project turns one source post into a safe, reviewable social campaign: one source of truth, one platform-specific variant per target, a human approval step, and a durable scheduler that keeps duplicate posts out of the world.

A post is submitted once — as a URL or pasted Markdown — and stored as the single source of truth. From that stored post the system generates one platform-specific variant per configured platform, validates each variant against that platform's constraint profile, routes it through human review, and publishes approved variants on a schedule through a single `SocialPublisher` abstraction.

The real win is the **publishing workflow**: it enforces validation, prevents unapproved variants from going out, keeps retries duplicate-safe, and records every attempt in a visible history.

Full design rationale lives in [`docs/DESIGN.md`](docs/DESIGN.md). Proofs for each requirement are in [`EVIDENCE.md`](EVIDENCE.md); the AI-usage log is in [`BUILDLOG.md`](BUILDLOG.md).

---

## Why this matters

Most social tooling is either:

- too naive to handle retries safely, or
- too brittle to survive failed workers and reschedules.

This project is designed around the real-world failures that matter most in production:

- a retry that must not publish the same variant twice
- a worker that stops mid-batch and must resume cleanly
- a variant that violates platform rules before it ever reaches a human
- a single publishing seam that swaps adapters without rewriting business logic

---

## What the system does

- Ingests a blog post as a URL or Markdown
- Stores the original post as the single source of truth
- Generates one variant per configured platform
- Validates length, tone intent, and hashtag rules against each profile
- Routes variants through review and approval
- Schedules only approved variants for publish
- Publishes through one adapter interface with real + mock implementations
- Records every attempt in a visible publish history

---

## Project status at a glance

Working end to end: ingest → generate → validate → review → schedule → publish → history. The scheduling and publishing core is implemented and duplicate-safe. See [Known limitations](#known-limitations) for the honest remainder.

### Working today

- Express 5 + TypeScript API (`GET /health`)
- **Post ingestion**: URL (fetch → Readability → Markdown) and pasted Markdown, stored as the source of truth
- **Platform constraint profiles** as configuration (rows in `platforms`, seeded)
- **Variant generation** through a BullMQ queue + worker, using any OpenAI-compatible LLM
- **Validation** of generated and edited variants against `max_length` and `max_hashtags` before they are stored
- **Review workflow**: get, edit, approve, and reject variant endpoints; published variants are locked
- **Publisher adapter layer**: one `SocialPublisher` interface with `TelegramPublisher`, `MockXPublisher`, and `MockLinkedInPublisher` behind a registry
- **Scheduling**: `POST /api/variants/:id/schedule` for approved variants, with a unique idempotency key per variant + slot
- **Publishing**: a worker claims due schedules from PostgreSQL (the source of truth), publishes through the adapter, and records every attempt
- **Durable recovery**: stale `processing` schedules are reclaimed on a 30 s sweep and re-driven without duplicates
- **Publish history**: `GET /api/schedules`, `GET /api/schedules/:id`, and `GET /api/schedules/:id/attempts`
- **Tests**: 4 unit tests (`npm test`), plus green `typecheck`, `build`, and `lint`
- Dockerized full stack: API, generation worker, publishing worker, migrate, PostgreSQL, Redis

### Status notes

- Tone is requested from the model but not machine-enforced
- Live proofs (real Telegram post, crash/restart transcript) need running infrastructure and credentials — see `EVIDENCE.md`
- The retry policy (queue attempts vs. schedule ceiling) is bounded and duplicate-safe but not yet fully reconciled — see `EVIDENCE.md` "Known gaps"

---

## Architecture

Content flows down the left side. The reliability machinery guards the right side. Every publish goes through the same interface.

```text
[blog post: URL or markdown]
             |
             v
   ingest + store          --->     variant generator          --->   constraint validation
                                              |                              |
                                              v                              v
                               review workflow:          draft -> approved | rejected
                                              |
                                              v
                               scheduler (durable, resumable)
                                              |
                                              v
                               SocialPublisher interface
                               +-- Telegram                          (real)
                               +-- MockX + MockLinkedIn              (yours)
                                              |
                                              v
                       publish history:            one slot = one post, always
```

Implemented request path:

```text
POST /api/posts
      │  store source post
      ▼
POST /api/posts/:id/generate
      │  enqueue BullMQ job
      ▼
worker (generation)
      │  read stored post only
      ▼
AI provider ──► validate (length, hashtags) ──► upsert variants as DRAFT
      ▼
GET /api/posts/:id/variants
      ▼
human review: POST / approve / reject
      ▼
POST /api/variants/:id/schedule
      │  approved variant → schedule row (idempotency key = variant + slot)
      ▼
worker (publishing, 30 s sweep of the DB)
      │  claim due schedule → publish via adapter → record attempt
      ▼
GET /api/schedules/:id/attempts
```

> **Generation reads the stored post only.** The source URL is fetched once, at ingestion; generation never re-fetches it (see the invariant in `docs/DESIGN.md`).

---

## Tech stack

| Concern        | Choice                                  |
| -------------- | --------------------------------------- |
| Runtime        | Node.js 22+ + `tsx` (ESM)               |
| Language       | TypeScript (strict)                     |
| API            | Express 5                               |
| Database       | PostgreSQL 18                           |
| Queue          | BullMQ + Redis                          |
| Variant text   | Any OpenAI-compatible LLM (AI optional) |
| Local infra    | Docker Compose                          |
| Lint / format  | Biome                                   |

---

## Quick start

### Prerequisites

- Node.js 22+
- Docker and Docker Compose
- An OpenAI-compatible LLM API key (free options exist, e.g. Groq's free tier)
- A Telegram bot token and target chat id for the real adapter (optional to boot, but required by config — see below)

### 1. Start the infrastructure — or the whole stack

The Compose file has two purposes. Use `-d db cache` for host-run development,
or bring up **everything** (API, both workers, plus a one-shot `migrate` service
that applies the schema and seed) with:

```bash
# full containerized stack (requires a populated .env with real LLM/Telegram values)
docker compose up --build -d
```

For host-run development, start only the databases:

```bash
docker compose up -d db cache
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the environment

```bash
cp .env.example .env
```

Then edit `.env`. The values below match the Compose services; replace the LLM and Telegram placeholders with your own.

```dotenv
PORT=3000

DATABASE_URL=postgres://postgres:dev@localhost:5432/social-studio

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=dev

LLM_API_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=your_key_here
LLM_MODEL=llama-3.3-70b-versatile

TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

> Configuration is strict: the app validates all of the above on boot and exits with a clear error if any are missing. LLM and Telegram values are required even if you only want to exercise the non-AI endpoints.

### 4. Create the schema and seed data

```bash
npm run db:migrate
npm run db:seed
```

`db:migrate` applies `src/database/schema.sql`. `db:seed` inserts the three platform constraint profiles and one sample post. Both are safe to re-run.

> `db:migrate` uses `CREATE TABLE IF NOT EXISTS`. That makes re-runs safe, but it will **not** add new columns to an existing database. If you change the schema, recreate the volume: `docker compose down -v` and repeat from step 1.

### 5. Run the API and the workers

In three terminals:

```bash
# terminal 1 — API
npm run dev

# terminal 2 — generation worker
npm run start:generation-worker

# terminal 3 — publishing worker
npm run start:publish-worker
```

Verify the API:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

### 6. Try the flow

The seed inserts a sample post with a fixed id.

```bash
POST_ID=00000000-0000-0000-0000-000000000001

# enqueue generation for the seeded post (returns a job)
curl -s -X POST "http://localhost:3000/api/posts/$POST_ID/generate"

# list the generated variants
curl -s "http://localhost:3000/api/posts/$POST_ID/variants"

# approve a variant, then schedule it (the schedule gets a unique idempotency key)
VARIANT_ID=<variant id from the list above>
curl -s -X POST "http://localhost:3000/api/variants/$VARIANT_ID/approve"
curl -s -X POST "http://localhost:3000/api/variants/$VARIANT_ID/schedule" \
  -H 'Content-Type: application/json' -d '{"scheduledAt":"2030-01-01T12:00:00.000Z"}'

# once the publishing worker has run (within 30 s of the slot), inspect history
curl -s "http://localhost:3000/api/schedules"
curl -s "http://localhost:3000/api/schedules/<schedule_id>/attempts"
```

Or create your own post:

```bash
curl -s -X POST http://localhost:3000/api/posts \
  -H 'Content-Type: application/json' \
  -d '{"sourceType":"markdown","content":"# Hello\n\nIdempotent publishing matters."}'

curl -s -X POST http://localhost:3000/api/posts \
  -H 'Content-Type: application/json' \
  -d '{"sourceType":"url","sourceUrl":"https://example.com/article"}'
```

---

## Environment variables

| Variable             | Required | Purpose                                             | Example                                             |
| -------------------- | -------- | --------------------------------------------------- | --------------------------------------------------- |
| `PORT`               | no       | API port (default `3000`)                           | `3000`                                              |
| `DATABASE_URL`       | yes      | PostgreSQL connection string                        | `postgres://postgres:dev@localhost:5432/social-studio` |
| `REDIS_HOST`         | yes      | Redis host for BullMQ                               | `localhost`                                         |
| `REDIS_PORT`         | yes      | Redis port                                          | `6379`                                              |
| `REDIS_PASSWORD`     | yes      | Redis password                                      | `dev`                                               |
| `LLM_API_BASE_URL`   | yes      | OpenAI-compatible API base URL                      | `https://api.groq.com/openai/v1`                    |
| `LLM_API_KEY`        | yes      | LLM API key                                         | `gsk_...`                                           |
| `LLM_MODEL`          | yes      | Model used for generation                           | `llama-3.3-70b-versatile`                           |
| `TELEGRAM_BOT_TOKEN` | yes      | Token for the real Telegram adapter                 | `123456:ABC...`                                     |
| `TELEGRAM_CHAT_ID`   | yes      | Target chat/channel the bot posts to                | `@your_channel`                                     |

Secrets live in `.env` only. `.env` is git-ignored; `.env.example` ships placeholders.

---

## Scripts

| Script               | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `npm run dev`        | Start the API with file watching                     |
| `npm start`          | Start the API once                                   |
| `npm run start:generation-worker` | Start the BullMQ generation worker     |
| `npm run start:publish-worker`    | Start the publishing worker + 30 s sweep |
| `npm run build`      | Type-check and emit to `dist/` (`tsconfig.build.json`) |
| `npm run typecheck`  | `tsc --noEmit` over `src` and `test`                 |
| `npm run lint`       | Biome check                                          |
| `npm run lint:fix`   | Biome check with fixes                               |
| `npm run format`     | Biome format (write)                                 |
| `npm test`           | Node test runner (colocated unit tests)              |
| `npm run db:migrate` | Apply `src/database/schema.sql`                      |
| `npm run db:seed`    | Insert platform profiles and a sample post           |

---

## Platform constraint profiles

Platform rules are **configuration, not code**. They live as rows in the `platforms` table, so adding a platform or changing a limit requires no change to the validation architecture.

| Platform | Code            | Max length | Tone                           | Max hashtags | Adapter                 |
| -------- | --------------- | ---------- | ------------------------------ | ------------ | ----------------------- |
| Telegram | `telegram`      | 4096       | Informative and conversational | 5            | `TelegramPublisher`     |
| X        | `mock_x`        | 280        | Concise and engaging           | 3            | `MockXPublisher`        |
| LinkedIn | `mock_linkedin` | 3000       | Professional and informative   | 5            | `MockLinkedInPublisher` |

A variant that violates its profile (length or hashtags) is rejected with an error naming the broken rule before it reaches review — whether it is generated or edited by hand. Tone is requested from the model in the prompt but not machine-enforced.

---

## Data model

```text
posts 1 ──── N variants ──── 1 schedules ──── N publish_attempts
                │
platforms 1 ────┘
```

- **`posts`** — the original blog post; `source_type` records whether it arrived as a URL or Markdown.
- **`platforms`** — configured platforms and their constraint profiles.
- **`variants`** — one platform-specific version of a post. Unique on `(post_id, platform_id)`.
- **`schedules`** — a publishing slot for an approved variant, with a unique `idempotency_key`.
- **`publish_attempts`** — every attempt against a schedule, unique on `(schedule_id, attempt_number)`.
- **`generation_jobs`** — tracks asynchronous variant generation.

### Variant lifecycle

```text
DRAFT
  ├── APPROVED ────→ PUBLISHED
  └── REJECTED
```

Only an `APPROVED` variant can be scheduled.

### Schedule lifecycle

```text
PENDING → PROCESSING → SUCCESS
                     └→ FAILED
```

---

## Publishing architecture

The application depends on exactly one publishing abstraction and contains no platform-specific publishing logic:

```ts
interface SocialPublisher {
  publish(input: PublisherInput): Promise<PublisherResult>;
}
```

Implementations live in `src/publishing/adapters/` and are resolved by an adapter registry. Telegram is the one real publishing target; X and LinkedIn are mock adapters that record what *would* have been published. The publishing worker resolves the adapter for a schedule's platform and calls `publish()`; swapping a mock for a real adapter means changing the `adapter` value on the platform row, not business logic.

### Idempotency

A logical publish is identified by **variant + scheduled slot**, represented as a unique idempotency key on `schedules` (`sha256(variantId:iso)`). The guarantee at runtime:

```text
publish → worker failure → worker restart
        → exactly one successful published result
        → zero duplicate posts
```

Before any adapter call, the publishing service checks the schedule's attempts: a prior success is returned from the database (the adapter is never called again), and the claim itself is a conditional row update so two workers cannot own the same schedule. Attempts and their results are recorded in `publish_attempts`.

---

## API surface

Field names below reflect the implementation. Where the design document uses a different name or verb, the divergence is noted.

### Health

| Method | Route     | Purpose      |
| ------ | --------- | ------------ |
| `GET`  | `/health` | Liveness     |

### Posts

| Method | Route                     | Status | Purpose                          |
| ------ | ------------------------- | ------ | -------------------------------- |
| `POST` | `/api/posts`              | Done   | Create a post (URL or Markdown)  |
| `GET`  | `/api/posts/:id`          | Done   | Get a post                       |
| `POST` | `/api/posts/:id/generate` | Done   | Enqueue variant generation       |
| `GET`  | `/api/posts/:id/variants` | Done   | List a post's variants           |
| `GET`  | `/api/generation/:id`     | Done   | Get a generation job             |

Create a post with either shape:

```json
{ "sourceType": "markdown", "content": "..." }
```

```json
{ "sourceType": "url", "sourceUrl": "https://example.com/article" }
```

### Variant review

| Method  | Route                        | Status | Purpose                                |
| ------- | ---------------------------- | ------ | -------------------------------------- |
| `GET`   | `/api/variants/:id`          | Done   | Get a variant                          |
| `PUT`   | `/api/variants/:id`          | Done   | Edit content (not re-validated yet)    |
| `POST`  | `/api/variants/:id/approve`  | Done   | Approve                                |
| `POST`  | `/api/variants/:id/reject`   | Done   | Reject                                 |

```json
{ "content": "edited variant text" }
```

```json
{ "reason": "too promotional" }
```

### Scheduling and history

| Method | Route                         | Status | Purpose                        |
| ------ | ----------------------------- | ------ | ------------------------------ |
| `POST` | `/api/variants/:id/schedule`  | Done   | Schedule an approved variant   |
| `GET`  | `/api/schedules`              | Done   | List all schedules             |
| `GET`  | `/api/schedules/:id`          | Done   | Get a schedule                 |
| `GET`  | `/api/schedules/:id/attempts` | Done   | Full publish history           |

Scheduling an `APPROVED` variant creates a schedule row and enqueues a BullMQ job at the slot. The request body is:

```json
{ "scheduledAt": "2026-09-10T18:00:00Z" }
```

Scheduling a variant that is not `APPROVED` returns `409 Conflict` with an error
message and creates no schedule. Each schedule carries a unique idempotency key
for its variant + slot, so re-scheduling the same slot is a no-op rather than a
duplicate post.

---

## Project layout

```text
src/
├── index.ts                 # Server entry point
├── app.ts                   # Express app and route wiring
├── config/
│   ├── env.ts               # Validated environment configuration
│   └── container.ts         # Manual dependency injection
├── database/
│   ├── db.ts                # PostgreSQL pool + dbTransaction helper
│   ├── schema.sql           # Tables, constraints, indexes
│   └── seed.sql             # Platform profiles + sample post
├── ingestion/               # URL fetch, Readability extraction, Markdown conversion
├── ai/                      # AI provider, prompt, variant validator
├── publishing/
│   ├── social-publisher.ts  # The one publisher interface
│   ├── adapter-registry.ts  # Adapter registry (config-driven platform → publisher)
│   └── adapters/            # Telegram + mock X + mock LinkedIn
├── modules/
│   ├── posts/               # route / service / repository / types / schema
│   ├── platforms/           # repository / types
│   ├── variants/            # route / service / repository / types
│   ├── generation/          # route / service / repository / queue / types
│   ├── schedules/           # route / service / repository / types / schema
│   └── publishing/          # service / repository / queue / scheduler / types
├── workers/
│   ├── generation.worker.ts # BullMQ generation worker
│   └── publishing.worker.ts # publishing worker + due-schedule sweep
├── middlewares/             # error handler
├── shared/                  # AppError
└── scripts/                 # migrate, seed

EVIDENCE.md                  # Requirement-by-requirement proofs
BUILDLOG.md                  # AI-usage log
docs/
└── DESIGN.md                # Design document
```

---

## Known limitations

- **Tone is prompt-only**, not machine-enforced by the validator; length and hashtags are enforced.
- **Retry policy is partially reconciled.** The BullMQ queue uses `attempts: 3` with exponential backoff while the schedule terminal ceiling is `attempt_count >= 5`; a thrown failure can be swept and re-driven until the ceiling catches it. This is duplicate-safe (EVIDENCE.md, "Known gaps"), and a single exported policy plus a dead-letter queue is planned.
- **Live proofs pending.** A real Telegram post and a worker-crash/restart transcript require running infrastructure and real credentials; see `EVIDENCE.md`.
- **Coverage is thin.** Only the scheduling service/repository have unit tests; the scary cases (blocked variant, duplicate publish, adapter swap) are not yet automated.
- **Configuration is strict**: the API will not boot without LLM and Telegram values, even for endpoints that do not use them.
- **Schema changes require a fresh volume**, because the migration relies on `CREATE TABLE IF NOT EXISTS` and does not add columns to existing tables. Use `docker compose down -v` when the schema changes. The Compose `migrate` service applies schema + seed automatically.

---

## Non-goals

Deliberately out of scope: real X publishing, real LinkedIn publishing, Instagram, image generation, analytics, and engagement tracking.
