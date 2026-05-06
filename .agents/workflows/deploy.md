---
description: Deploys the application to Google Cloud Run and provisions necessary infrastructure.
---

# Deploy Workflow

Builds the application, provisions all required GCP infrastructure (Firestore, Cloud Tasks, Cloud Storage), and deploys to Cloud Run. The deploy script is idempotent and safe to run repeatedly.

## 1. Pre-Deploy Quality Gate

Run lint and type-check to ensure the codebase is healthy before deploying. If either fails, stop and fix the problem before continuing.

// turbo
```bash
npm run lint
```

// turbo
```bash
npx tsc --noEmit
```

## 2. Uncommitted Changes Check

Check for uncommitted changes. Deploying from a dirty working tree means the deployed version doesn't match any commit.

// turbo
```bash
git status --porcelain
```

If the output is non-empty, warn the user that there are uncommitted changes and ask whether to continue or abort. If the user wants to commit first, suggest using the `/push` workflow.

## 3. Execute Deployment

Run the deployment script. This is a long-running command — monitor its output and wait for completion.

```bash
./cloud-deploy.sh
```

If the script fails:
- **`.env` not found**: Remind the user to create `.env` from `.env.example`.
- **Missing env vars**: Check `.env` contains `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_REGION`, and `CLOUD_TASKS_REGION`.
- **Auth errors from `gcloud`**: Ask the user to run `gcloud auth login` and retry.
- **Build failures (`npm run build`)**: Stop and fix the build error before re-running.

## 4. Summary

After a successful deployment, report:

- The public URL of the deployed service (printed at the end of the script output).
- Whether this was a first-time deployment (PUBLIC_URL bootstrapping) or an update.
- Any warnings emitted during provisioning (e.g., resources that already existed).
