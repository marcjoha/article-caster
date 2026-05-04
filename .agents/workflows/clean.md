---
description: Scans the codebase to remove dead code, unused assets, and enforce project rules
---

# Clean Workflow

Systematically audit the codebase for dead code, unused assets, stale dependencies, and rule violations. Every deletion or change must be justified. Do **not** alter business logic — only clean.

## 1. Load Project Rules (mandatory pre-read)

Read both files below before making any changes. They define the constraints for every subsequent step.

- `.agents/rules/GEMINI.md` — project structure, code quality, deployment, and version control rules.
- `.agents/specs/SPEC.md` — the canonical business logic. Nothing in this workflow may contradict or alter it.

## 2. Audit Root Directory

Per `GEMINI.md`, the root should only contain: `.md` files, cloud scripts (`cloud-deploy.sh`, `cloud-teardown.sh`), and essential config files (`package.json`, `next.config.*`, `tsconfig.json`, `.gitignore`, `.eslintrc.*`, etc.).

- List the root directory contents.
- Flag any file that doesn't belong (e.g., stray source files, temp scripts, data files).
- Move or delete offending files. Application source code belongs in `src/` or `app/`.

## 3. Security & Secrets Audit

- Confirm `.env` is listed in `.gitignore`.
- Grep the entire codebase (excluding `node_modules`, `.next`, `.git`) for hardcoded secrets, API keys, passwords, or credentials. Flag anything suspicious.
- Ensure no secret values are logged, committed, or embedded in client-side code.

## 4. Telemetry & Error Handling Audit

Per `GEMINI.md`, data-fetching and third-party integrations must have robust error handling and propagate to the core telemetry.

- Scan data-fetching logic and integrations (e.g., TTS, Article Extraction).
- Verify they include robust `try/catch` blocks.
- Verify they properly propagate errors to the health monitoring/telemetry systems. Flag any missing error handling.

## 5. Cloud Deployment Parity Check

Per `GEMINI.md`, deployment scripts must be robust and exact inverses.

- Review `cloud-deploy.sh` and `cloud-teardown.sh`.
- Ensure `cloud-deploy.sh` is idempotent.
- Ensure `cloud-teardown.sh` is a true nuclear option that acts as the exact inverse of the deploy script (deleting all provisioned DBs, buckets, queues, etc.).
- Flag any discrepancies (e.g., a resource created in deploy but not deleted in teardown).

## 6. Dead Code & Temp File Removal

Scan `src/` and `app/` directories methodically:

- **Temp/test files**: Remove any files that are clearly temporary (e.g., `test-*.ts`, `temp-*`, `debug-*`, `*.test.*` without a matching source file) unless the user has explicitly asked to keep them.
- **Unreachable code**: Look for commented-out code blocks, `TODO`-only stubs with no implementation, and dead conditional branches.
- **Unused exports**: Check for exported functions, components, or constants that are never imported anywhere.
- **Orphan files**: Look for files (pages, components, utils) that are not imported or routed to from anywhere in the application.

Remove everything you find. Per `GEMINI.md`: *"Never leave dead code behind."*

## 7. Lint

Run the linter and fix all warnings and errors it reports.

// turbo
```bash
npm run lint
```

## 8. Type-Check

Run the TypeScript compiler in check-only mode to catch type errors that the linter misses.

// turbo
```bash
npx tsc --noEmit
```

Fix any errors reported.

## 9. Unused Assets

- List all files in `public/` and any other static asset directories.
- For each asset, grep the codebase to confirm it is referenced. If it is not referenced anywhere, delete it.

## 10. Dependency Audit

- Use `npx depcheck` to identify unused dependencies automatically.
// turbo
```bash
npx depcheck
```
- Flag any packages that appear unused. Do **not** auto-remove them — list them for the user to confirm, as some may be used implicitly (e.g., TypeScript type packages, ESLint configs, or peer dependencies).

## 11. Documentation Sync

Per `GEMINI.md`, `README.md` must stay current with major application functionality.

- Compare `README.md` against `SPEC.md` and the actual codebase.
- Flag any outdated sections, missing features, or inaccurate descriptions.
- Update `README.md` if discrepancies are found.

## 12. Build Verification

Run a production build to confirm nothing was broken during cleanup.

// turbo
```bash
npm run build
```

If the build fails, fix the issue before proceeding.

## 13. Summary Report

After all steps are complete, provide a concise summary to the user:

- **Files deleted** — list each file removed and why.
- **Files modified** — list each file changed and what was cleaned.
- **Flagged items** — anything that needs user judgment (e.g., potentially unused dependencies, missing teardown logic, ambiguous dead code).
- **Build status** — confirm the build passed.
