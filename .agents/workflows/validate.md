---
description: Purely manual/automated check that AGENTS.md and all rules/specs linked from it are followed meticulously.
---

# Validate Workflow

Systematically audit the project to ensure full adherence to the standards defined in `AGENTS.md` and its referenced files (`RULES.md`, `SPEC.md`, and workflows). This workflow does **not** modify code — it only flags discrepancies.

## 1. Load Project Rules (mandatory pre-read)

Read all files below to understand the full set of rules being validated.
- `AGENTS.md` — top-level agent instructions and project structure pointers.
- `.agents/RULES.md` — project structure, code quality, deployment, and version control rules.
- `.agents/SPEC.md` — the canonical business logic and architecture.

## 2. Verify Project Structure

Per `RULES.md`, ensure the root folder is clean and application code is encapsulated. Do not fix — flag only.
- Check that the root folder contains only `.md` files, cloud scripts, and essential configuration files.
- Verify that all application source code is within `src/` or `app/`.
- Flag any stray files.

## 3. Security & Secrets Audit

Do not fix — flag only.
- Confirm `.env` is listed in `.gitignore`.
- Confirm `.env.example` exists and that its variables match the keys in `.env` (no missing or extra keys). Per `RULES.md`: *"Maintain `.env.example` whenever variables are added or removed."*
- Grep the entire codebase (excluding `node_modules`, `.next`, `.git`) for hardcoded secrets, API keys, passwords, or credentials. Flag anything suspicious.
- Ensure no secret values are logged, committed, or embedded in client-side code.

## 4. Telemetry & Error Handling Check

Per `RULES.md`, all data-fetching logic and third-party integrations must include robust error handling and propagate state to core telemetry. Do not fix — flag only.
- Scan all data-fetching logic and third-party integrations throughout the codebase.
- Verify they include robust `try/catch` blocks and propagate errors to the health monitoring/telemetry systems.
- Flag any integration missing error handling.

## 5. Cloud Deployment Parity Check

Per `RULES.md`, deployment scripts must be robust and exact inverses. Do not fix — flag only.
- Ensure `cloud-deploy.sh` is idempotent.
- Ensure `cloud-teardown.sh` is a true nuclear option acting as an exact inverse of `cloud-deploy.sh`. Compare both scripts to verify every resource provisioned in deploy is destroyed in teardown.
- Verify that no ad-hoc `gcloud` commands exist elsewhere in the codebase (outside `cloud-deploy.sh` and `cloud-teardown.sh`). Per `RULES.md`: *"Never modify cloud services directly."*
- Flag any discrepancies.

## 6. Verify SPEC.md and README.md Sync

Per `RULES.md`, both documents must accurately reflect the current state of the codebase. Do not fix — flag only.
- Compare the architecture, business logic, and tech stack in `.agents/SPEC.md` with the current codebase. Flag any drift.
- Compare `README.md` with the codebase to ensure all major functionality is documented.
- Verify `README.md` includes an up-to-date GCP topology image.
- Flag any discrepancies between documentation and actual implementation.

## 7. Code Quality Check

Per `RULES.md`, verify code quality. Do not fix — flag only.
- Run the linter to check for warnings or errors.
// turbo
```bash
npm run lint
```
- Verify no temporary test files or dead code are present.
- Run the TypeScript compiler to catch type errors.
// turbo
```bash
npx tsc --noEmit
```

## 8. Version Control Check

Per `RULES.md`, commits must be atomic and descriptive. Do not fix — flag only.
- Review recent commit history for adherence to conventional commit format and atomic commit practices.
// turbo
```bash
git log --oneline -20
```
- Flag any commits that bundle unrelated changes or have vague messages.

## 9. Build Verification

Ensure the application can successfully build.
// turbo
```bash
npm run build
```

## 10. Report Findings

Provide a comprehensive, structured summary organized by rule section. For each finding:
- **Rule reference** — which section of `RULES.md` or `SPEC.md` is violated.
- **Finding** — what the discrepancy is.
- **Remediation** — actionable steps to fix it.

If all checks pass, report a clean bill of health.
