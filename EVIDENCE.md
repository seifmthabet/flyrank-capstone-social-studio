# Evidence — Social Media Studio

This file maps directly to the requirements in Section 5 of the capstone brief.
Each item includes the evidence a reviewer can inspect or reproduce. Statuses are
deliberately honest: **verified** means the behavior exists in the repository;
**not yet complete** means there is no valid proof because the required feature
has not been implemented.

## Requirement checklist

| Requirement | Status | Proof |
| --- | --- | --- |
| Ingestion and stored source of truth | Verified by code | [E1](#e1--ingestion-and-stored-source-of-truth) |
| Constraint profiles enforced by code | Partially verified | [E2](#e2--constraint-profiles) |
| Review workflow and refusal of unapproved scheduling | Partially verified | [E3](#e3--review-workflow) |
| Adapter layer: one interface, one real target, two mocks | Partially verified | [E4](#e4--publisher-adapter-layer) |
| Idempotent publish | Not yet complete | [E5](#e5--idempotent-publish) |
| Durable scheduling | Not yet complete | [E6](#e6--durable-scheduling) |
| Visible publish history | Not yet complete | [E7](#e7--publish-history) |
| Secrets stay out of the repository | Verified by inspection | [E8](#e8--secrets) |
| README with architecture and exact run steps | Verified by inspection | [E9](#e9--readme) |

## E1 — Ingestion and stored source of truth

**Requirement:** A post enters as a URL or Markdown, is stored, and generation
reads only the stored post.

**Proof:** `POST /api/posts` accepts validated URL or Markdown input in
`src/modules/posts/posts.route.ts`; `PostService` stores the normalized content
through `PostRepository`. URL fetching, extraction, and Markdown conversion are
constructed only by `createPostContainer()` in `src/config/container.ts`.

`GenerationService.processGenerationJob()` reads the post with
`PostRepository.findById(postId)` and supplies `post.content` to the AI provider.
`createGenerationContainer()` does not construct `UrlFetcher`, `ArticleExtractor`,
or `MarkdownConverter`. Therefore generation cannot re-fetch the source URL.

**Reproduce:** start the stack using the README, create a Markdown post with
`POST /api/posts`, then call `POST /api/posts/:id/generate` and
`GET /api/posts/:id/variants`.

## E2 — Constraint profiles

**Requirement:** Code enforces each platform's length, tone, and hashtag rules;
a failing variant is blocked before review.

**Proof:** Platform profiles are stored in `platforms` (`max_length`, `tone`,
and `max_hashtags`) in `src/database/schema.sql`. `VariantValidator` in
`src/ai/variant-validator.ts` rejects empty content, content exceeding
`maxLength`, and content exceeding `maxHashtags`, with messages that name the
broken rule. The generation service validates before `upsertVariants()` writes
the variant.

**Gap:** tone is included in the profile and generation prompt, but is not
currently enforced by `VariantValidator`. No automated test or captured curl
transcript has been added yet. This requirement is therefore not fully proven.

## E3 — Review workflow

**Requirement:** Variants move through `draft`, `approved`, `rejected`, and
`published`; only approved variants may be scheduled, and an unapproved request
gets a 4xx error.

**Proof:** The `variants.status` check constraint in `src/database/schema.sql`
contains all four statuses. The API exposes `PATCH /api/variants/:id`,
`POST /api/variants/:id/approve`, and `POST /api/variants/:id/reject`; the
repository updates the corresponding status.

For an unapproved variant, `POST /api/variants/:id/schedule` returns:

```json
HTTP/1.1 409 Conflict
{"message":"Variant must be approved before scheduling"}
```

**Gap:** the scheduling endpoint is only a guard. For an approved variant it
does not create a schedule or send a response. The `published` transition is
also not implemented, so the full workflow is incomplete.

## E4 — Publisher adapter layer

**Requirement:** One `SocialPublisher` interface, one real free-platform
adapter, and two mock adapters; changing adapters must not require business-logic
changes.

**Proof:** `src/publishing/social-publisher.ts` defines the single
`SocialPublisher.publish(input)` contract. `adapter-registery.ts` maps platform
codes to `TelegramPublisher`, `MockXPublisher`, and `MockLinkedInPublisher`.
The Telegram adapter calls Telegram's `sendMessage`; each mock implements the
same interface and returns a simulated external-post ID.

**Gap:** adapters are not wired to a scheduler or a publishing use case. The
mocks log previews instead of persisting them, and no real Telegram post has
been captured in this repository. This does not yet satisfy the complete
adapter requirement.

## E5 — Idempotent publish

**Requirement:** Retrying the same variant and slot makes exactly one post.

**Current evidence:** `schedules.idempotency_key` is unique and
`publish_attempts` stores an idempotency key in `src/database/schema.sql`.

**Status: not yet complete.** There is no schedule repository, publishing
service, or worker that claims the key and calls an adapter. Consequently there
is no repeated-call test or transcript proving exactly-once publication.

## E6 — Durable scheduling

**Requirement:** A worker stopped mid-batch can restart without duplicate posts.

**Status: not yet complete.** The repository contains durable tables for
`schedules` and `publish_attempts`, but no scheduler or publishing worker.
Generation-job stale recovery exists, but it is not evidence for durable
publishing. A crash/restart proof cannot be provided until the publish path is
implemented.

## E7 — Publish history

**Requirement:** Every publish attempt and its result are recorded and visible.

**Status: not yet complete.** The `publish_attempts` table and indexes exist in
`src/database/schema.sql`, but no code writes to it and no history endpoint or
view exists. There is no valid history transcript yet.

## E8 — Secrets

**Requirement:** Tokens live in `.env`; the repository ships `.env.example`.

**Proof:** `.env.example` lists database, Redis, LLM, and Telegram variables
with placeholders only. The application loads configuration from the environment
in `src/config/env.ts`; no credential is hard-coded in the publishing adapter.

## E9 — README

**Requirement:** Explain the system, include an architecture diagram, exact run
steps, and known limitations so a stranger can run it.

**Proof:** `README.md` documents the purpose, implemented and unimplemented
features, two architecture diagrams, `.env` setup, database seed commands, and
API/worker start commands. It also gives a `docker compose` path for the full
stack.

## Verification note

On 2026-09-20, `npm run typecheck` could not be run in this checkout because
dependencies have not been installed (`tsc` resolved to the placeholder command
rather than the local TypeScript compiler). No passing command output is claimed
in this file. After `npm ci`, run:

```bash
npm run typecheck
npm run build
npm test
npm run lint
```

The current `npm test` script is wired to Node's test runner, but the repository
does not yet contain automated test files.
