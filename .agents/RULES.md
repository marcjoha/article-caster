---
trigger: always_on
---

# Project Rules

## Project structure
- The root folder should be kept as clean as possible. Ideally, only contain `.md` files, cloud scripts, and essential project configuration files (like `package.json`).
- Application source code should be encapsulated in a dedicated sub-directory (like `src/` or `app/`).

## Specification
- **CRITICAL**: [.agents/SPEC.md](file:///.agents/SPEC.md) acts as the single source of truth for the application's major business logic, architecture, and technology stack.
- Whenever new functionality is implemented, existing functionality is modified, or underlying services (like APIs, models, or infrastructure) are changed, **you MUST update `SPEC.md` and `README.md` immediately** to reflect the new state. Never leave the specification or documentation out of sync with the codebase.
- If proposed application logic or technical changes diverge from what is currently specified in [.agents/SPEC.md](file:///.agents/SPEC.md), you must explicitly flag this discrepancy to the user and await approval before proceeding.

## Documentation
- Keep all docs in `README.md`.
- All major application functionality should be documented in `README.md`.
- **CRITICAL**: Before finishing any feature implementation or completing a conversation, you must explicitly verify that both `README.md` and `SPEC.md` accurately reflect the current state of the codebase.
- Docs should include a GCP topology image, always up-to-date with what's deployed. Generate this picture with Gemini and make sure to use up-to-date product icons from http://cloud.google.com/icons.

## Deployment
- Environment variables and secrets must be locally stored in `.env`. Ensure `.env` is immediately added to `.gitignore` and never committed or uploaded to any cloud service. Maintain `.env.example` whenever variables are added or removed.
- Never modify cloud services directly. Everything related to the deployment of this application should be defined in `cloud-deploy.sh` and `cloud-teardown.sh` respectively.
- **CRITICAL**: Whenever you introduce new Firestore queries that require composite indexes, add new environment variables, or rely on new GCP services, you MUST immediately update `cloud-deploy.sh` to provision them.
- `cloud-deploy.sh` should be idempotent, meaning I can run it over and over without causing problems.
- `cloud-teardown.sh` must act as a true nuclear option. It must exact the exact inverse of the deploy script and completely obliterate ALL provisioned infrastructure (including databases, buckets, and queues). Do not hesitate or skip deleting data out of caution; absolute infrastructure parity is required.

## Data Processing & Operations
- **Subscriber-First Principle**: Every podcast feed is a live product with real subscribers. Any operation that adds, removes, or reprocesses articles in a podcast **must** be evaluated through the lens of the end listener's experience.
  - **No Duplicates**: It is absolutely unacceptable for a listener to receive a duplicate episode in their feed. When reprocessing an article (e.g., to improve audio quality or clean up content), the existing `FeedItem` document must be updated **in-place** — preserving the original document ID and RSS `<guid>` — so podcast apps never treat it as a new episode.
  - **Silent by Default**: All reprocessing operations must be invisible to subscribers. Updated audio must seamlessly replace the old version without triggering new-episode notifications in podcast clients.
  - **Guard Against Re-ingestion**: Before ingesting any article, the system must verify that the article has not already been processed for the target podcast. Duplicate detection should be robust and not solely rely on URL matching (e.g., consider content hashes or canonical identifiers).

## Code Quality
- Ensure code is properly linted and resolves all warnings (e.g., unused variables) before committing.
- If you create temporary test files, don't keep these laying around unless told so.
- Never leave dead code behind.
- **Leverage Skills**: When writing or modifying code, always apply framework-specific best practices from your available Skills (e.g., React, Next.js, TypeScript). Proactively refactor code that deviates from established patterns — such as eliminating duplication, extracting shared utilities, and using idiomatic framework conventions.

## Error Handling & Logging
- All data-fetching logic and third-party integrations must include robust error handling (e.g., `try/catch`) and log errors with sufficient context using `console.error`.

## Version Control
- Keep git commits atomic and descriptive. Do not bundle unrelated features or bug fixes into a single commit.

## Definition of Done
Before declaring any feature complete, you MUST verify:
1. The feature code works and builds successfully (`npm run build`).
2. `README.md` and `.agents/SPEC.md` have been updated to document the new behavior.
3. `cloud-deploy.sh` has been updated to provision any new required infrastructure (e.g., Firestore indexes, Pub/Sub, Scheduler jobs).
4. `.env.example` has been updated if new environment variables were added.