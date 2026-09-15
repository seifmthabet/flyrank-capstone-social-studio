# Social Media Studio

Turn one blog post into a reviewed, scheduled, multi-platform social media campaign.

A post is submitted once — as a URL or pasted Markdown — and stored as the single source of truth. From that stored post the system generates one platform-specific variant per configured platform, validates each variant against that platform's constraint profile, routes it through human review, and publishes approved variants on a schedule through a single `SocialPublisher` abstraction.

The interesting part of this project is the **publishing workflow**, not the social APIs: validation, human approval, idempotent publishing, and an auditable attempt history that survives worker restarts.

Full design rationale lives in [`docs/DESIGN.md`](docs/DESIGN.md).

---

## Status

The foundation is in place; the feature work is in progress.

**Working today**

- Express 5 + TypeScript app with a `GET /health` endpoint
- PostgreSQL connection pool (`pg`)
- Schema migration and platform seeding scripts
- Dockerized PostgreSQL 18

**Not yet implemented**

- Post, variant, review, scheduling, and publish-history routes
- Variant generation and the platform constraint validator
- `SocialPublisher` adapters (Telegram, mock X, mock LinkedIn)
- BullMQ worker and Redis (not yet in `docker-compose.yaml`)
- Test suite

---

## Tech stack

| Concern    | Choice                        |
| ---------- | ----------------------------- |
| Runtime    | Node.js + `tsx` (ESM)         |
| Language   | TypeScript (strict)           |
| API        | Express 5                     |
| Database   | PostgreSQL 18                 |
| Queue      | BullMQ + Redis *(planned)*    |
| Local infra| Docker Compose                |

---

## Getting started

### Prerequisites

- Node.js 22+
- Docker and Docker Compose

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

```bash
cp .env.example .env
```

Set `DATABASE_URL` to match the Compose database:

```dotenv
DATABASE_URL=postgres://postgres:dev@localhost:5432/social-studio
PORT=3000
```

### 3. Start PostgreSQL

```bash
docker compose up -d
```

### 4. Create the schema and seed the platforms

```bash
npm run db:migrate
npm run db:seed
```

`db:migrate` applies `src/database/schema.sql`. `db:seed` inserts the three platform constraint profiles from `src/database/seed.sql`.

> Both scripts are non-idempotent: `db:migrate` fails if the tables already exist, and `db:seed` fails on the `platforms.code` unique constraint if run twice. To start over, run `docker compose down -v` and repeat from step 3.

### 5. Run the API

```bash
npm run dev
```

Verify it:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

---

## Scripts

| Script               | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `npm run dev`        | Start the API with file watching           |
| `npm start`          | Start the API once                         |
| `npm run db:migrate` | Apply `src/database/schema.sql`            |
| `npm run db:seed`    | Insert the platform constraint profiles    |

---

## Project layout

```text
src/
├── index.ts              # Server entry point
├── app.ts                # Express app and routes
├── config/
│   └── env.ts            # Environment configuration
├── database/
│   ├── db.ts             # PostgreSQL connection pool
│   ├── schema.sql        # Table definitions, constraints, indexes
│   └── seed.sql          # Platform constraint profiles
└── scripts/
    ├── migrate.ts        # Runs schema.sql
    └── seed.ts           # Runs seed.sql

docs/
└── DESIGN.md             # Design document
```

---

## Platform constraint profiles

Platform rules are **configuration, not code**. They live as rows in the `platforms` table, so adding a platform or changing a limit requires no change to the validation architecture.

| Platform | Max length | Tone                           | Max hashtags | Adapter                 |
| -------- | ---------- | ------------------------------ | ------------ | ----------------------- |
| Telegram | 4096       | Informative and conversational | 5            | `TelegramPublisher`     |
| X        | 280        | Concise and engaging           | 3            | `MockXPublisher`        |
| LinkedIn | 3000       | Professional and informative   | 5            | `MockLinkedInPublisher` |

A variant that violates its profile is rejected before it can enter the review workflow. Edits are re-validated before they are persisted.

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
  publish(input: PublishInput): Promise<PublishResult>;
}
```

Telegram is the one real publishing target, included to prove the adapter architecture end to end. X and LinkedIn are mock adapters — they record what *would* have been published and return a preview, which keeps the project free of real X and LinkedIn account requirements. Swapping a mock for a real adapter must not touch business logic.

### Idempotency

A logical publish is identified by **variant + scheduled slot**, represented as a unique idempotency key on `schedules`. The guarantee being built:

```text
publish → worker failure → worker restart
        → exactly one successful published result
        → zero duplicate posts
```

The database enforces uniqueness of the logical schedule; the worker coordinates publish and publish-history state.

---

## API surface

These routes are specified in the design document. Only `GET /health` exists so far.

### Posts

| Method | Route                      | Purpose                          |
| ------ | -------------------------- | -------------------------------- |
| `POST` | `/api/posts`               | Create a post (URL or Markdown)  |
| `GET`  | `/api/posts/:id`           | Get a post                       |
| `POST` | `/api/posts/:id/generate`  | Generate platform variants       |
| `GET`  | `/api/posts/:id/variants`  | List a post's variants           |

Create a post with either shape:

```json
{ "sourceType": "markdown", "content": "..." }
```

```json
{ "sourceType": "url", "sourceUrl": "https://example.com/article" }
```

### Variant review

| Method | Route                         | Purpose                              |
| ------ | ----------------------------- | ------------------------------------ |
| `GET`  | `/api/variants/:id`           | Get a variant                        |
| `PUT`  | `/api/variants/:id`           | Edit content (re-validated)          |
| `POST` | `/api/variants/:id/approve`   | Approve                              |
| `POST` | `/api/variants/:id/reject`    | Reject                               |

### Scheduling and history

| Method | Route                            | Purpose                        |
| ------ | -------------------------------- | ------------------------------ |
| `POST` | `/api/variants/:id/schedule`     | Schedule an approved variant   |
| `GET`  | `/api/schedules/:id`             | Get a schedule                 |
| `GET`  | `/api/schedules/:id/attempts`    | Full publish history           |

```json
{ "scheduledAt": "2026-09-10T18:00:00Z" }
```

Scheduling a variant that is not `APPROVED` returns `4xx` and creates no schedule.

---

## Application flow

```text
POST /api/posts
      ▼
Store source post
      ▼
POST /api/posts/:id/generate
      ▼
Generate platform variants
      ▼
Validate against platform profile ──── invalid → validation error
      ▼
Store valid variants as DRAFT
      ▼
Human review ──── reject
      └── approve
            ▼
      Create schedule
            ▼
      BullMQ job → Worker → SocialPublisher
                              ├── Telegram
                              ├── Mock X
                              └── Mock LinkedIn
                                    ▼
                            Publish history
```

---

## Target infrastructure

Currently `docker-compose.yaml` provides PostgreSQL only. The full topology adds the API, worker, and Redis:

```text
docker-compose
├── api        # Express + TypeScript
├── worker     # BullMQ worker
├── postgres   # PostgreSQL
└── redis      # BullMQ queue backend
```

The API and worker share PostgreSQL and Redis with separate responsibilities: the API owns posts, variants, review, and scheduling; the worker owns due publishing jobs.

---

## Non-goals

Deliberately out of scope: real X publishing, real LinkedIn publishing, Instagram, image generation, analytics, and engagement tracking.
