# Social Media Studio

Turn one blog post into a reviewed, scheduled, multi-platform social media campaign.

A post is submitted once — as a URL or pasted Markdown — and stored as the single source of truth. From that stored post the system generates one platform-specific variant per configured platform, validates each variant against that platform's constraint profile, routes it through human review, and is designed to publish approved variants on a schedule through a single `SocialPublisher` abstraction.

The interesting part of this project is the **publishing workflow**, not the social APIs: validation, human approval, idempotent publishing, and an auditable attempt history that survives worker restarts.

Full design rationale lives in [`docs/DESIGN.md`](docs/DESIGN.md). Remaining work is tracked in [`TASKS.md`](TASKS.md) and [`PLAN.md`](PLAN.md).

---

## Project status

This is a work in progress. The ingestion, generation, and review foundations are working; the scheduling and publishing core is not implemented yet. This section is kept honest on purpose.

### Working today

- Express 5 + TypeScript API (`GET /health`)
- **Post ingestion**: URL (fetch → Readability → Markdown) and pasted Markdown, stored as the source of truth
- **Platform constraint profiles** as configuration (rows in `platforms`, seeded)
- **Variant generation** through a BullMQ queue + worker, using any OpenAI-compatible LLM
- **Validation** of generated variants against `max_length` and `max_hashtags` before they are stored
- **Review workflow**: get, edit, approve, and reject variant endpoints
- **Publisher adapter layer**: one `SocialPublisher` interface with `TelegramPublisher`, `MockXPublisher`, and `MockLinkedInPublisher` behind a registry
- Dockerized PostgreSQL 18 and Redis

### Not implemented yet

- `POST /api/variants/:id/schedule` is a stub: it refuses unapproved variants but creates no schedule for approved ones
- The publishing worker, durable scheduler, and exactly-once idempotency (the graded core)
- `publish_attempts` is never written; there is no publish-history endpoint
- Mock adapters log to the console but do not persist a preview
- Tone is only requested in the prompt, not enforced by the validator
- Edited variants are not re-validated against their platform profile
- Automated tests (`npm test` currently runs 0 tests)
- `docker compose` starts PostgreSQL and Redis only; the API and worker run on the host
- `EVIDENCE.md` and `BUILDLOG.md` are not written yet

---

## Architecture

Content flows down the left side. The reliability machinery guards the right side. Every publish is intended to go through the same interface.

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
                               scheduler (durable, resumable)   <-- NOT IMPLEMENTED
                                              |
                                              v
                               SocialPublisher interface        <-- adapters exist, not wired
                               +-- Telegram / Discord / Mastodon             (real)
                               +-- MockX + MockLinkedIn                      (yours)
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
human review: PATCH / approve / reject
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

### 1. Start PostgreSQL and Redis

```bash
docker compose up -d
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

### 5. Run the API and the worker

In two terminals:

```bash
# terminal 1 — API
npm run dev

# terminal 2 — generation worker
npm run start:worker
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
```

Or create your own post:

```bash
curl -s -X POST http://localhost:3000/api/posts \
  -H 'Content-Type: application/json' \
  -d '{"sourceType":"markdown","content":"# Hello\n\nIdempotent publishing matters."}'

curl -s -X POST http://localhost:3000/api/posts \
  -H 'Content-Type: application/json' \
  -d '{"sourceType":"url","url":"https://example.com/article"}'
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
| `npm run start:worker` | Start the BullMQ generation worker                 |
| `npm run build`      | Type-check and emit to `dist/` (`tsconfig.build.json`) |
| `npm run typecheck`  | `tsc --noEmit` over `src` and `test`                 |
| `npm run lint`       | Biome check                                          |
| `npm run lint:fix`   | Biome check with fixes                               |
| `npm run format`     | Biome format (write)                                 |
| `npm test`           | Node test runner (no tests yet)                      |
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

A variant that violates its profile is rejected before it can enter the review workflow. Tone is currently requested from the model in the prompt; deterministic tone rules are planned.

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

Implementations live in `src/publishing/adapters/` and are resolved by an adapter registry. Telegram is the one real publishing target; X and LinkedIn are mock adapters that record what *would* have been published. Swapping a mock for a real adapter must not touch business logic.

> The adapters and registry exist today, but no code path invokes them yet — the publishing worker that calls `publish()` is part of the unfinished scheduling core.

### Idempotency (design)

A logical publish is identified by **variant + scheduled slot**, represented as a unique idempotency key on `schedules`. The guarantee being built:

```text
publish → worker failure → worker restart
        → exactly one successful published result
        → zero duplicate posts
```

The database enforces uniqueness of the logical schedule; the worker will coordinate publish and publish-history state. This is not yet implemented at runtime.

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

Create a post with either shape. The URL field is `url` (the design document calls it `sourceUrl`; the code does not yet accept `sourceUrl`):

```json
{ "sourceType": "markdown", "content": "..." }
```

```json
{ "sourceType": "url", "url": "https://example.com/article" }
```

### Variant review

| Method  | Route                        | Status | Purpose                                |
| ------- | ---------------------------- | ------ | -------------------------------------- |
| `GET`   | `/api/variants/:id`          | Done   | Get a variant                          |
| `PATCH` | `/api/variants/:id`          | Done   | Edit content (not re-validated yet)    |
| `POST`  | `/api/variants/:id/approve`  | Done   | Approve                                |
| `POST`  | `/api/variants/:id/reject`   | Done   | Reject                                 |

```json
{ "content": "edited variant text" }
```

```json
{ "reason": "too promotional" }
```

### Scheduling and history

| Method | Route                         | Status         | Purpose                        |
| ------ | ----------------------------- | -------------- | ------------------------------ |
| `POST` | `/api/variants/:id/schedule`  | **Stub**       | Schedule an approved variant   |
| `GET`  | `/api/schedules/:id`          | Not implemented | Get a schedule                 |
| `GET`  | `/api/schedules/:id/attempts` | Not implemented | Full publish history           |

The schedule endpoint is not functional yet. It returns `409` for a variant that is not `APPROVED`, and for an approved variant it currently sends no response. The intended request body is:

```json
{ "scheduledAt": "2026-09-10T18:00:00Z" }
```

Scheduling a variant that is not `APPROVED` must return `4xx` and create no schedule.

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
│   ├── db.ts                # PostgreSQL connection pool
│   ├── schema.sql           # Tables, constraints, indexes
│   └── seed.sql             # Platform profiles + sample post
├── ingestion/               # URL fetch, Readability extraction, Markdown conversion
├── ai/                      # AI provider, prompt, variant validator
├── publishing/
│   ├── social-publisher.ts  # The one publisher interface
│   ├── adapter-registery.ts # Adapter registry
│   └── adapters/            # Telegram + mock X + mock LinkedIn
├── modules/
│   ├── posts/               # route / service / repository / types / schema
│   ├── platforms/           # repository / types
│   ├── variants/            # route / service / repository / types
│   └── generation/          # route / service / repository / queue / types
├── workers/
│   └── generation.worker.ts # BullMQ generation worker
├── middlewares/             # error handler
├── shared/                  # AppError
└── scripts/                 # migrate, seed

docs/
└── DESIGN.md                # Design document
```

---

## Known limitations

- **Scheduling and publishing are not implemented.** There is no publishing worker, no durable scheduler, and no runtime idempotency.
- **The schedule endpoint is a stub** — see above.
- **No publish history.** `publish_attempts` is written nowhere and exposed by no endpoint.
- **Mock adapters do not persist previews**; they log to the console. The adapters are not invoked by any request path yet.
- **Edited variants are not re-validated** against their platform profile.
- **Tone is prompt-only**, not machine-enforced.
- **Configuration is strict**: the API will not boot without LLM and Telegram values, even for endpoints that do not use them.
- **API and worker are not containerized.** `docker compose` provides PostgreSQL and Redis only.
- **No tests** and no `EVIDENCE.md` / `BUILDLOG.md` yet.
- **Design/code divergences**: the design document specifies `sourceUrl` and `PUT`; the code uses `url` and `PATCH`. These should be reconciled.
- **Schema changes require a fresh volume**, because the migration relies on `CREATE TABLE IF NOT EXISTS` and does not add columns to existing tables.

---

## Non-goals

Deliberately out of scope: real X publishing, real LinkedIn publishing, Instagram, image generation, analytics, and engagement tracking.
