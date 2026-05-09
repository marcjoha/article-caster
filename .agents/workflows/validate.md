---
description: Verifies that the project is entirely in adherence with AGENTS.md, RULES.md, and SPEC.md
---

# Validate Workflow

Systematically audit the project to ensure full adherence to the standards defined in `AGENTS.md` and its referenced files (`RULES.md`, `SPEC.md`, and workflows).

## 1. Verify Project Structure
Per `RULES.md`, ensure the root folder is clean and application code is encapsulated.
- Check that the root folder contains only `.md` files, cloud scripts, and essential configuration files.
- Ensure that application source code is within `src/` or `app/`.
- Flag any stray files.

## 2. Verify SPEC.md and README.md Sync
Per `RULES.md`, `SPEC.md` and `README.md` must be perfectly synced with the codebase.
- Compare the architecture, business logic, and tech stack in `.agents/SPEC.md` with the current codebase.
- Compare `README.md` with the codebase to ensure all major functionality is documented.
- Check if `README.md` includes an up-to-date GCP topology image.
- Flag any discrepancies between documentation and actual implementation.

## 3. Verify Deployment & Secrets
Per `RULES.md`, verify the safe handling of secrets and cloud scripts.
- Ensure `.env` is listed in `.gitignore`.
- Ensure `.env.example` exists.
- Review `cloud-deploy.sh` for idempotency.
- Review `cloud-teardown.sh` to ensure it completely removes all provisioned infrastructure and acts as an exact inverse.

## 4. Code Quality Check
Per `RULES.md`, verify code quality, linting, and dead code.
- Run the linter to ensure no warnings or errors exist.
// turbo
```bash
npm run lint
```
- Ensure no temporary test files are present.
- Ensure there is no dead code.
- Run the TypeScript compiler to catch type errors.
// turbo
```bash
npx tsc --noEmit
```

## 5. Telemetry & Error Handling Check
Per `RULES.md`, verify telemetry and error handling.
- Review data-fetching logic and third-party integrations to confirm robust error handling.
- Ensure that errors propagate their state to the application's core telemetry and health monitoring systems.

## 6. Build Verification
Ensure the application can successfully build.
// turbo
```bash
npm run build
```

## 7. Report Findings
After all steps are complete, provide a comprehensive summary to the user outlining any deviations from `AGENTS.md`, `RULES.md`, or `SPEC.md`, along with actionable steps to rectify them.
