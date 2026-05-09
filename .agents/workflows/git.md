---
description: Safely prepares, verifies, and pushes code to the remote repository.
---

# Push Workflow

Ensures the codebase is healthy and sanitized, then makes atomic, descriptive commits and pushes to the remote repository.

## 1. Pre-Push Quality Gate

Run lint, type-check, and build to catch issues before committing. If any step fails, stop and fix the problem before continuing.

// turbo
```bash
npm run lint
```

// turbo
```bash
npx tsc --noEmit
```

// turbo
```bash
npm run build
```

## 2. Registry Sanitization Check

The `package-lock.json` must not contain internal registry URLs (e.g., `us-npm.pkg.dev`) that would cause `npm install` to fail in public CI environments like GitHub Actions.

Check for internal URLs first. Only regenerate the lockfile if contaminated:

// turbo
```bash
grep -q "us-npm.pkg.dev" package-lock.json && echo "CONTAMINATED" || echo "CLEAN"
```

If the output is `CONTAMINATED`, run the following to regenerate a clean lockfile:

```bash
rm package-lock.json && npm install --package-lock-only --registry=https://registry.npmjs.org
```

If the output is `CLEAN`, skip regeneration and move on.

## 3. Secrets Safety Check

Ensure `.env` is not accidentally staged for commit. Per `RULES.md`: *"Ensure `.env` is... never committed."*

// turbo
```bash
git diff --cached --name-only | grep -q "^\.env$" && echo "DANGER: .env is staged!" || echo "SAFE"
```

If the output is `DANGER`, immediately unstage it with `git reset HEAD .env` before proceeding.

## 4. Review Changes

Get a summary of what has changed. Use `--stat` to keep the output concise.

```bash
git status
git diff --stat
```

If `git status` shows **nothing to commit and the working tree is clean**, report this to the user and stop — there is nothing to push.

## 5. Documentation Freshness Check

Per `.agents/RULES.md`: *"Before finishing any feature implementation or completing a conversation, you must explicitly verify that both `README.md` and `SPEC.md` accurately reflect the current state of the codebase."*

Review the changed files from step 4. If any source code files were modified but neither `README.md` nor `.agents/SPEC.md` appear in the diff, flag this to the user and ask whether the documentation needs updating before committing.

## 6. Stage and Commit Atomically

Per `.agents/RULES.md`:
> *"Keep git commits atomic and descriptive. Do not bundle unrelated features or bug fixes into a single commit."*

Analyze the changes from step 4 and group them into logical units. For each group:

1. Stage the relevant files with `git add <file> [<file> ...]`.
2. Write a clear, descriptive commit message using [Conventional Commits](https://www.conventionalcommits.org/) format (e.g., `fix:`, `feat:`, `docs:`, `chore:`, `refactor:`).
3. The message should explain the *what* and *why*, not just restate the file names.

Example:
```bash
git add README.md .agents/SPEC.md
git commit -m "docs: document Cloud Tasks background worker architecture"

git add src/app/ProcessingList.tsx
git commit -m "fix(ui): replace any[] with typed Ingestion interface and use const for interval"
```

## 7. Push

Push all commits to the remote.

```bash
git push
```

If the push is rejected due to remote changes, run `git pull --rebase` first and then retry the push.

## 8. Summary

After a successful push, report to the user:

- The list of commits that were pushed (run `git log --oneline -n <number of commits>`).
- Any warnings or issues encountered during the process.
