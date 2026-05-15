---
description: Actively improves the codebase by removing dead code, unused assets, and applying known best practices.
---

# Clean Workflow

Actively modify and improve the codebase by removing dead code, unused assets, stale dependencies, and automatically fixing issues. Every deletion or change must be justified. Do **not** alter business logic — only clean.

## 1. Load Project Rules (mandatory pre-read)

Read both files below before making any changes. They define the constraints for every subsequent step.

- `.agents/RULES.md` — project structure, code quality, deployment, and version control rules.
- `.agents/SPEC.md` — the canonical business logic. Nothing in this workflow may contradict or alter it.

## 2. Clean Root Directory

Per `RULES.md`, the root should only contain `.md` files, cloud scripts, and essential config files.

- Review the root directory contents.
- Move or delete any stray files (e.g., stray source files, temp scripts, data files). Application source code belongs in `src/` or `app/`.

## 3. Dead Code & Temp File Removal

Scan `src/` and `app/` directories methodically to actively remove:
- **Temp/test files**: Remove any files that are clearly temporary (e.g., `test-*.ts`, `temp-*`, `debug-*`, `*.test.*` without a matching source file).
- **Unreachable code**: Delete commented-out code blocks, `TODO`-only stubs with no implementation, and dead conditional branches.
- **Unused exports**: Remove exported functions, components, or constants that are never imported anywhere.
- **Orphan files**: Delete files (pages, components, utils) that are not imported or routed to from anywhere in the application.

## 4. Unused Assets Removal

- List all files in `public/` and any other static asset directories.
- For each asset, grep the codebase to confirm it is referenced. If it is not referenced anywhere, safely delete it.

## 5. Unused Dependency Removal

Use `depcheck` to identify unused dependencies and actively remove them if safe.
// turbo
```bash
npx depcheck
```
- For any packages that appear unused, confirm they aren't implicitly required (e.g., TypeScript type packages, ESLint configs). If they are truly unused, uninstall them using `npm uninstall <package>`.

## 6. Auto-Lint & Format

Run the linter with the auto-fix flag to automatically resolve formatting and basic code quality issues.
// turbo
```bash
npm run lint -- --fix
```

## 7. Type-Check

Run the TypeScript compiler to catch type errors that lint may miss — especially after removing exports or files.
// turbo
```bash
npx tsc --noEmit
```

Fix any errors reported.

## 8. Apply Agent Skills & Best Practices

Leverage your available Agent Skills to actively improve code quality and avoid common pitfalls.

- **Refactoring**: Proactively refactor code that deviates from established framework-specific best practices (e.g., React, Next.js, TypeScript).
- **Code Optimization**: Look for opportunities to eliminate duplication, extract shared utilities, and apply idiomatic conventions.
- **Architectural Consistency**: Ensure that UI patterns and state management are consistent across the codebase.

## 9. Documentation Sync

Per `RULES.md`, both `SPEC.md` and `README.md` must stay current with the codebase.

- Compare `README.md` and `SPEC.md` against the actual codebase.
- Actively update `README.md` to fix outdated sections, missing features, or inaccurate descriptions.
- Ensure the GCP topology image in `README.md` reflects what is currently deployed.
- If `SPEC.md` has drifted from the implementation, flag the discrepancy to the user before modifying it.

## 10. Build Verification

Run a production build to confirm nothing was broken during cleanup.
// turbo
```bash
npm run build
```

If the build fails, fix the issue before proceeding.

## 11. Summary Report

After all cleanup steps are complete, provide a concise summary:
- **Files deleted** — list each file removed and why.
- **Dependencies removed** — list uninstalled packages.
- **Files modified** — list files formatted or updated.
- **Refactoring applied** — list where Agent Skills were used to improve code quality.
- **Build status** — confirm the build passed.
