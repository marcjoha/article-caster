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

## 2. Registry Sanitization Check

The `package-lock.json` must not contain internal registry URLs that would cause failures during deployment. Check and fix if needed:

// turbo
```bash
grep -q "us-npm.pkg.dev" package-lock.json && echo "CONTAMINATED" || echo "CLEAN"
```

If the output is `CONTAMINATED`, regenerate a clean lockfile before deploying:

```bash
rm package-lock.json && npm install --package-lock-only --registry=https://registry.npmjs.org
```

## 3. Uncommitted Changes Check

Check for uncommitted changes. Deploying from a dirty working tree means the deployed version doesn't match any commit.

// turbo
```bash
git status --porcelain
```

If the output is non-empty, warn the user that there are uncommitted changes and ask whether to continue or abort. If the user wants to commit first, suggest using the `/push` workflow.

## 4. Execute Deployment

Run the deployment script. This is a long-running command — monitor its output and wait for completion.

```bash
./cloud-deploy.sh
```

If the script fails:
- **`.env` not found**: Remind the user to create `.env` from `.env.example`.
- **Missing env vars**: Check `.env` against `.env.example` to ensure all required variables are present.
- **Auth errors from `gcloud`**: Ask the user to run `gcloud auth login` and retry.
- **Build failures (`npm run build`)**: Stop and fix the build error before re-running.

## 5. Post-Deploy Smoke Test

Verify the deployment is actually serving by hitting the public URL.

```bash
curl -s -o /dev/null -w "%{http_code}" <PUBLIC_URL>
```

Replace `<PUBLIC_URL>` with the URL printed at the end of the deployment output. A `200` response confirms the service is healthy. Any other status code should be flagged to the user.

## 6. Post-Deploy Documentation Check

Per `RULES.md`, the GCP topology image in `README.md` must be up-to-date with what's deployed.

If the deployment involved infrastructure changes (e.g., new buckets, queues, databases, or service configurations), remind the user that `README.md` and `SPEC.md` may need updating to reflect the new topology.

## 7. Summary

After a successful deployment, report:

- The public URL of the deployed service.
- The HTTP status code from the smoke test.
- Whether this was a first-time deployment (PUBLIC_URL bootstrapping) or an update.
- Any warnings emitted during provisioning (e.g., resources that already existed).
- Whether documentation may need updating due to infrastructure changes.
