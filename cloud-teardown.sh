#!/bin/bash

# ANSI color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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
BUCKET_NAME="article-caster-media-$PROJECT_ID"

echo -e "${BLUE}ℹ Deleting Cloud Run service...${NC}"
gcloud run services delete "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --quiet || echo -e "${YELLOW}⚠ Service already deleted or doesn't exist.${NC}"

echo -e "${BLUE}ℹ Deleting Cloud Tasks queues...${NC}"
QUEUES=$(gcloud tasks queues list --location="$TASKS_REGION" --project="$PROJECT_ID" --format="value(name)" 2>/dev/null || true)
for QUEUE in $QUEUES; do
  if [[ "$QUEUE" == *"article-caster-queue"* ]]; then
    QUEUE_ID=$(basename "$QUEUE")
    echo -e "${YELLOW}Deleting queue: $QUEUE_ID${NC}"
    gcloud tasks queues delete "$QUEUE_ID" --location="$TASKS_REGION" --project="$PROJECT_ID" --quiet || echo -e "${YELLOW}⚠ Queue already deleted or doesn't exist.${NC}"
  fi
done

echo -e "${BLUE}ℹ Deleting Cloud Scheduler job...${NC}"
JOB_NAME="article-caster-syndication-cron"
gcloud scheduler jobs delete "$JOB_NAME" --location="$TASKS_REGION" --project="$PROJECT_ID" --quiet || echo -e "${YELLOW}⚠ Job already deleted or doesn't exist.${NC}"

echo -e "${BLUE}ℹ Deleting Cloud Run source archives from GCS...${NC}"
gcloud storage rm --recursive "gs://run-sources-$PROJECT_ID-$REGION/services/$SERVICE_NAME/" --project="$PROJECT_ID" --quiet || echo -e "${YELLOW}⚠ Source archives already deleted or doesn't exist.${NC}"

echo -e "${BLUE}ℹ Deleting GCS bucket and all its contents...${NC}"
gcloud storage rm --recursive "gs://$BUCKET_NAME" --project="$PROJECT_ID" --quiet || echo -e "${YELLOW}⚠ Bucket already deleted or doesn't exist.${NC}"

echo -e "${BLUE}ℹ Deleting Firestore database...${NC}"
gcloud firestore databases delete --database="(default)" --project="$PROJECT_ID" --quiet || echo -e "${YELLOW}⚠ Database already deleted or doesn't exist.${NC}"

echo -e "${BLUE}ℹ Removing IAM policy bindings...${NC}"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)" 2>/dev/null || true)
if [ -n "$PROJECT_NUMBER" ]; then
  SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  gcloud projects remove-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${SERVICE_ACCOUNT}" --role=roles/cloudtasks.enqueuer --quiet >/dev/null 2>&1 || echo -e "${YELLOW}⚠ IAM binding already removed or doesn't exist.${NC}"
fi

echo -e "${GREEN}✔ Complete teardown finished. ALL infrastructure and data has been destroyed.${NC}"
