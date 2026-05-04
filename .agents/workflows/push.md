---
description: Safely prepares, verifies, and pushes code to the remote repository.
---

# Push Workflow

Ensures the codebase is healthy and sanitized, then makes atomic, descriptive commits and pushes to the remote repository.

## 1. Pre-Push Quality Gate

Run lint and type-check to catch issues before committing. If either fails, stop and fix the problem before continuing.

// turbo
```bash
npm run lint
```

// turbo
```bash
npx tsc --noEmit
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

## 3. Review Changes

Get a summary of what has changed. Use `--stat` to keep the output concise.

```bash
git status
git diff --stat
```

If `git status` shows **nothing to commit and the working tree is clean**, report this to the user and stop — there is nothing to push.

## 4. Stage and Commit Atomically

Per `.agents/rules/GEMINI.md`:
> *"Keep git commits atomic and descriptive. Do not bundle unrelated features or bug fixes into a single commit."*

Analyze the changes from step 3 and group them into logical units. For each group:

1. Stage the relevant files with `git add <file> [<file> ...]`.
2. Write a clear, descriptive commit message using [Conventional Commits](https://www.conventionalcommits.org/) format (e.g., `fix:`, `feat:`, `docs:`, `chore:`, `refactor:`).
3. The message should explain the *what* and *why*, not just restate the file names.

Example:
```bash
git add README.md .agents/specs/SPEC.md
git commit -m "docs: document Cloud Tasks background worker architecture"

git add src/app/ProcessingList.tsx
git commit -m "fix(ui): replace any[] with typed Ingestion interface and use const for interval"
```

## 5. Push

Push all commits to the remote.

```bash
git push
```

If the push is rejected due to remote changes, run `git pull --rebase` first and then retry the push.

## 6. Summary

After a successful push, report to the user:

- The list of commits that were pushed (run `git log --oneline -n <number of commits>`).
- Any warnings or issues encountered during the process.
