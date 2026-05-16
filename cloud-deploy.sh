#!/bin/bash

# ANSI color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

set -e # Fail script on any error

# Load environment variables safely
if [ -f .env ]; then
  set -a
  source .env
  set +a
else
  echo -e "${RED}✖ .env file not found. Please create one based on .env.example.${NC}"
  exit 1
fi

if [ -z "$GOOGLE_CLOUD_PROJECT" ] || [ -z "$GOOGLE_CLOUD_REGION" ] || [ -z "$CLOUD_TASKS_REGION" ]; then
  echo -e "${RED}✖ GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_REGION, and CLOUD_TASKS_REGION must be set in .env${NC}"
  exit 1
fi

PROJECT_ID="$GOOGLE_CLOUD_PROJECT"
REGION="$GOOGLE_CLOUD_REGION"
TASKS_REGION="$CLOUD_TASKS_REGION"
SERVICE_NAME="article-caster"

echo -e "${BLUE}ℹ Enabling necessary Google Cloud APIs...${NC}"
gcloud services enable firestore.googleapis.com aiplatform.googleapis.com storage.googleapis.com run.googleapis.com cloudbuild.googleapis.com cloudtasks.googleapis.com cloudscheduler.googleapis.com --project="$PROJECT_ID"

echo -e "${BLUE}ℹ Ensuring Firestore database exists...${NC}"
if ! gcloud firestore databases describe --database="(default)" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo -e "${GREEN}✔ Creating Firestore database...${NC}"
  gcloud firestore databases create --database="(default)" --location="$REGION" --project="$PROJECT_ID" --type=firestore-native
else
  echo -e "${YELLOW}⚠ Database already exists.${NC}"
fi

echo -e "${BLUE}ℹ Ensuring Firestore indexes are created...${NC}"
gcloud firestore indexes composite create --collection-group=items --field-config field-path=feed_id,order=ascending --field-config field-path=created_at,order=descending --project="$PROJECT_ID" 2>/dev/null || echo -e "${YELLOW}⚠ Index already exists or is currently building.${NC}"
gcloud firestore indexes composite create --collection-group=ingestions --field-config field-path=feed_id,order=ascending --field-config field-path=created_at,order=descending --project="$PROJECT_ID" 2>/dev/null || echo -e "${YELLOW}⚠ Index already exists or is currently building.${NC}"
gcloud firestore indexes composite create --collection-group=syndications --field-config field-path=feed_id,order=ascending --field-config field-path=created_at,order=descending --project="$PROJECT_ID" 2>/dev/null || echo -e "${YELLOW}⚠ Index already exists or is currently building.${NC}"
gcloud firestore indexes composite create --collection-group=listens --field-config field-path=feed_id,order=ascending --field-config field-path=created_at,order=descending --project="$PROJECT_ID" 2>/dev/null || echo -e "${YELLOW}⚠ Index already exists or is currently building.${NC}"

echo -e "${BLUE}ℹ Ensuring Cloud Tasks queue exists...${NC}"
QUEUE_NAME="article-caster-queue"
if ! gcloud tasks queues describe "$QUEUE_NAME" --project="$PROJECT_ID" --location="$TASKS_REGION" >/dev/null 2>&1; then
  echo -e "${GREEN}✔ Creating queue $QUEUE_NAME...${NC}"
  gcloud tasks queues create "$QUEUE_NAME" --project="$PROJECT_ID" --location="$TASKS_REGION" --max-concurrent-dispatches=3 --max-dispatches-per-second=1 --max-attempts=5 --min-backoff=10s --max-backoff=3600s
else
  echo -e "${YELLOW}⚠ Queue $QUEUE_NAME already exists. Updating limits...${NC}"
  gcloud tasks queues update "$QUEUE_NAME" --project="$PROJECT_ID" --location="$TASKS_REGION" --max-concurrent-dispatches=3 --max-dispatches-per-second=1 --max-attempts=5 --min-backoff=10s --max-backoff=3600s
fi

BUCKET_NAME="article-caster-media-$PROJECT_ID"
echo -e "${BLUE}ℹ Ensuring GCS bucket exists: ${BUCKET_NAME}${NC}"
if ! gcloud storage buckets describe "gs://$BUCKET_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo -e "${GREEN}✔ Creating bucket ${BUCKET_NAME}...${NC}"
  gcloud storage buckets create "gs://$BUCKET_NAME" --project="$PROJECT_ID" --location="$REGION" --uniform-bucket-level-access
  echo -e "${GREEN}✔ Making bucket public...${NC}"
  gcloud storage buckets add-iam-policy-binding "gs://$BUCKET_NAME" --member=allUsers --role=roles/storage.objectViewer >/dev/null
else
  echo -e "${YELLOW}⚠ Bucket ${BUCKET_NAME} already exists.${NC}"
fi

echo -e "${BLUE}ℹ Ensuring Cloud Run service account has required permissions...${NC}"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET_NAME" --member="serviceAccount:${SERVICE_ACCOUNT}" --role=roles/storage.objectAdmin >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${SERVICE_ACCOUNT}" --role=roles/cloudtasks.enqueuer >/dev/null

echo -e "${BLUE}ℹ Building Next.js application...${NC}"
npm run build

echo -e "${BLUE}ℹ Preparing standalone deployment...${NC}"
[ -d public ] && cp -r public .next/standalone/
[ -d .next/static ] && cp -r .next/static .next/standalone/.next/
mkdir -p .next/standalone/node_modules/@google-cloud/
cp -r node_modules/@google-cloud/tasks .next/standalone/node_modules/@google-cloud/

echo -e "${BLUE}ℹ Downloading static FFmpeg and yt-dlp for Linux...${NC}"
mkdir -p .next/standalone/bin
# Delete any existing binary to ensure ffbinaries downloads the linux version
rm -f bin/ffmpeg
rm -f bin/yt-dlp
node scripts/download-ffmpeg.js linux
node scripts/download-ytdlp.js linux
cp bin/ffmpeg .next/standalone/bin/ffmpeg
cp bin/yt-dlp .next/standalone/bin/yt-dlp

echo -e "${GREEN}✔ Linux binaries downloaded.${NC}"

# Restore the macOS binaries for local development
echo -e "${BLUE}ℹ Restoring macOS binaries for local dev...${NC}"
node scripts/download-ffmpeg.js mac
node scripts/download-ytdlp.js mac

echo -e "${BLUE}ℹ Getting public URL for service...${NC}"
PUBLIC_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --format="value(status.url)" 2>/dev/null || echo "")

echo -e "${BLUE}ℹ Deploying to Cloud Run...${NC}"
gcloud beta run deploy "$SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --source .next/standalone \
  --region="$REGION" \
  --allow-unauthenticated \
  --no-build \
  --base-image=nodejs24 \
  --command=node \
  --args=server.js \
  --timeout=3600 \
  --cpu=2 \
  --memory=1024Mi \
  --set-env-vars="^@^GOOGLE_CLOUD_PROJECT=$PROJECT_ID@ADMIN_PASSCODE=$ADMIN_PASSCODE@GCS_BUCKET_NAME=$BUCKET_NAME@PUBLIC_URL=$PUBLIC_URL@QUEUE_NAME=$QUEUE_NAME@CLOUD_TASKS_REGION=$TASKS_REGION"

if [ -z "$PUBLIC_URL" ]; then
  echo -e "${BLUE}ℹ Initial deployment complete. Fetching newly assigned PUBLIC_URL and updating service...${NC}"
  NEW_PUBLIC_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --format="value(status.url)")
  gcloud run services update "$SERVICE_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --update-env-vars="PUBLIC_URL=$NEW_PUBLIC_URL"
  echo -e "${GREEN}✔ Service updated with PUBLIC_URL=$NEW_PUBLIC_URL${NC}"
fi

echo -e "${BLUE}ℹ Ensuring Cloud Scheduler job exists...${NC}"
JOB_NAME="article-caster-syndication-cron"
TARGET_URI="${NEW_PUBLIC_URL:-$PUBLIC_URL}/api/worker/rss-cron"

if ! gcloud scheduler jobs describe "$JOB_NAME" --location="$TASKS_REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo -e "${GREEN}✔ Creating Cloud Scheduler job $JOB_NAME...${NC}"
  gcloud scheduler jobs create http "$JOB_NAME" \
    --project="$PROJECT_ID" \
    --location="$TASKS_REGION" \
    --schedule="0 2 * * *" \
    --uri="$TARGET_URI" \
    --http-method=GET
else
  echo -e "${GREEN}✔ Updating Cloud Scheduler job $JOB_NAME...${NC}"
  gcloud scheduler jobs update http "$JOB_NAME" \
    --project="$PROJECT_ID" \
    --location="$TASKS_REGION" \
    --schedule="0 2 * * *" \
    --uri="$TARGET_URI" \
    --http-method=GET
fi

echo -e "${GREEN}✔ Deployment complete!${NC}"
