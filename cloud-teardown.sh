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

if [ -z "$GOOGLE_CLOUD_PROJECT" ] || [ -z "$GOOGLE_CLOUD_REGION" ]; then
  echo -e "${RED}✖ GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_REGION must be set in .env${NC}"
  exit 1
fi

PROJECT_ID="$GOOGLE_CLOUD_PROJECT"
REGION="$GOOGLE_CLOUD_REGION"
SERVICE_NAME="article-caster"
BUCKET_NAME="${GCS_BUCKET_NAME:-article-caster-media-$PROJECT_ID}"

echo -e "${BLUE}ℹ Deleting Cloud Run service...${NC}"
gcloud run services delete "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --quiet || echo -e "${YELLOW}⚠ Service already deleted or doesn't exist.${NC}"

echo -e "${BLUE}ℹ Deleting Cloud Tasks queues...${NC}"
QUEUES=$(gcloud tasks queues list --location="europe-west1" --project="$PROJECT_ID" --format="value(name)" 2>/dev/null || true)
for QUEUE in $QUEUES; do
  if [[ "$QUEUE" == *"ingest-queue"* ]]; then
    QUEUE_ID=$(basename "$QUEUE")
    echo -e "${YELLOW}Deleting queue: $QUEUE_ID${NC}"
    gcloud tasks queues delete "$QUEUE_ID" --location="europe-west1" --project="$PROJECT_ID" --quiet || echo -e "${YELLOW}⚠ Queue already deleted or doesn't exist.${NC}"
  fi
done

echo -e "${BLUE}ℹ Deleting GCS bucket and all its contents...${NC}"
gcloud storage rm --recursive "gs://$BUCKET_NAME" --project="$PROJECT_ID" --quiet || echo -e "${YELLOW}⚠ Bucket already deleted or doesn't exist.${NC}"

echo -e "${BLUE}ℹ Deleting Firestore database...${NC}"
gcloud firestore databases delete --database="(default)" --project="$PROJECT_ID" --quiet || echo -e "${YELLOW}⚠ Database already deleted or doesn't exist.${NC}"

echo -e "${GREEN}✔ Complete teardown finished. ALL infrastructure and data has been destroyed.${NC}"
