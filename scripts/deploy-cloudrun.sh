#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Deploy YouTube Transcript MCP to Google Cloud Run
# Usage: ./scripts/deploy-cloudrun.sh <GCP_PROJECT_ID> [REGION]
# ============================================================

GCP_PROJECT="${1:?Usage: $0 <GCP_PROJECT_ID> [REGION]}"
REGION="${2:-europe-north1}"
SERVICE_NAME="youtube-transcript-mcp"
REPO_NAME="mcp-images"
IMAGE="${REGION}-docker.pkg.dev/${GCP_PROJECT}/${REPO_NAME}/${SERVICE_NAME}:latest"
DOMAIN="mcp.youtubetranscript.dev"

echo "==> Project: $GCP_PROJECT | Region: $REGION"
gcloud config set project "$GCP_PROJECT"

# Enable APIs
echo "==> Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --quiet

# Create Artifact Registry repo (idempotent)
echo "==> Creating Artifact Registry repo..."
gcloud artifacts repositories create "$REPO_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --description="MCP server images" \
  2>/dev/null || echo "    (already exists)"

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# Build with Cloud Build
echo "==> Building image with Cloud Build..."
gcloud builds submit \
  --tag "$IMAGE" \
  --timeout=600 \
  .

# Deploy to Cloud Run
echo "==> Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --port 8080 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 10 \
  --memory 256Mi \
  --cpu 1 \
  --timeout 60s \
  --set-env-vars "NODE_ENV=production,YTSM_BASE_URL=https://youtubetranscript.dev,YTSM_TIMEOUT_MS=30000" \
  --quiet

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format="value(status.url)")
echo ""
echo "==> Deployed! Service URL: $SERVICE_URL"

# Domain mapping
echo "==> Setting up domain mapping for $DOMAIN..."
gcloud run domain-mappings create \
  --service "$SERVICE_NAME" \
  --domain "$DOMAIN" \
  --region "$REGION" \
  2>/dev/null || echo "    (domain mapping already exists)"

echo ""
echo "============================================"
echo " Deployment complete!"
echo "============================================"
echo ""
echo " Cloud Run URL : $SERVICE_URL"
echo " Custom domain : https://$DOMAIN"
echo ""
echo " DNS: Add a CNAME record:"
echo "   mcp  CNAME  ghs.googlehosted.com."
echo ""
echo " Test:"
echo "   curl -X POST $SERVICE_URL/mcp \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'Authorization: Bearer YOUR_API_KEY' \\"
echo "     -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}'"
echo ""
