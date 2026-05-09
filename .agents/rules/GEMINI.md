---
trigger: always_on
---

# Project Rules

## Project structure
- The root folder should be kept as clean as possible. Ideally, only contain `.md` files, cloud scripts, and essential project configuration files (like `package.json`).
- Application source code should be encapsulated in a dedicated sub-directory (like `src/` or `app/`).

## Specification
- **CRITICAL**: [.agents/specs/SPEC.md](file:///.agents/specs/SPEC.md) acts as the single source of truth for the application's major business logic, architecture, and technology stack.
- Whenever new functionality is implemented, existing functionality is modified, or underlying services (like APIs, models, or infrastructure) are changed, **you MUST update `SPEC.md` and `README.md` immediately** to reflect the new state. Never leave the specification or documentation out of sync with the codebase.
- If proposed application logic or technical changes diverge from what is currently specified in [.agents/specs/SPEC.md](file:///.agents/specs/SPEC.md), you must explicitly flag this discrepancy to the user and await approval before proceeding.

## Documentation
- Keep all docs in `README.md`.
- All major application functionality should be documented in `README.md`.
- **CRITICAL**: Before finishing any feature implementation or completing a conversation, you must explicitly verify that both `README.md` and `SPEC.md` accurately reflect the current state of the codebase.
- Docs should include a GCP topology image, always up-to-date with what's deployed.

## Deployment
- Environment variables and secrets must be locally stored in `.env`. Ensure `.env` is immediately added to `.gitignore` and never committed or uploaded to any cloud service. Maintain `.env.example` whenever variables are added or removed.
- Never modify cloud services directly. Everything related to the deployment of this application should be defined in `cloud-deploy.sh` and `cloud-teardown.sh` respectively.
- `cloud-deploy.sh` should be idempotent, meaning I can run it over and over without causing problems.
- `cloud-teardown.sh` must act as a true nuclear option. It must exact the exact inverse of the deploy script and completely obliterate ALL provisioned infrastructure (including databases, buckets, and queues). Do not hesitate or skip deleting data out of caution; absolute infrastructure parity is required.

## Code Quality
- Ensure code is properly linted and resolves all warnings (e.g., unused variables) before committing.
- If you create temporary test files, don't keep these laying around unless told so.
- Never leave dead code behind.

## Error Handling & Telemetry
- All new data-fetching logic or third-party integrations must include robust error handling and propagate their state to the application's core telemetry and health monitoring systems.

## Version Control
- Keep git commits atomic and descriptive. Do not bundle unrelated features or bug fixes into a single commit.