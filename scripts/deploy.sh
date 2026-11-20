#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SHAADI_PROJECT_ID:?Set SHAADI_PROJECT_ID to your Google Cloud/Firebase project ID}"
SHAADI_REGION="${SHAADI_REGION:-us-central1}"
# Firebase Hosting supports a limited set of Cloud Run rewrite regions; this template uses us-central1.
if [ "$SHAADI_REGION" != us-central1 ]; then
  echo 'This template is configured for us-central1. Update firebase.json and check Hosting-supported regions before changing it.' >&2
  exit 1
fi
node scripts/build.mjs
node --test tests/*.test.mjs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com firestore.googleapis.com drive.googleapis.com sheets.googleapis.com --project "$SHAADI_PROJECT_ID"
SHAADI_SA="shaadi-runtime@${SHAADI_PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$SHAADI_SA" --project "$SHAADI_PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create shaadi-runtime --display-name='Project Shaadi runtime' --project "$SHAADI_PROJECT_ID"
fi
gcloud projects add-iam-policy-binding "$SHAADI_PROJECT_ID" --member="serviceAccount:${SHAADI_SA}" --role=roles/datastore.user --condition=None >/dev/null
# Values travel through stdin, never CLI arguments or committed files.
for SHAADI_KEY in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REFRESH_TOKEN INVITE_SECRET ADMIN_SECRET; do
  SHAADI_SECRET="shaadi-${SHAADI_KEY,,}"
  if ! gcloud secrets describe "$SHAADI_SECRET" --project "$SHAADI_PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$SHAADI_SECRET" --replication-policy=automatic --project "$SHAADI_PROJECT_ID"
  fi
  node -e 'const fs=require("fs");process.stdout.write(JSON.parse(fs.readFileSync(".private/secrets.json"))[process.argv[1]])' "$SHAADI_KEY" | gcloud secrets versions add "$SHAADI_SECRET" --data-file=- --project "$SHAADI_PROJECT_ID" >/dev/null
  gcloud secrets add-iam-policy-binding "$SHAADI_SECRET" --member="serviceAccount:${SHAADI_SA}" --role=roles/secretmanager.secretAccessor --project "$SHAADI_PROJECT_ID" >/dev/null
done
# Write a temporary YAML environment file; it contains folder IDs and origin, not OAuth secrets.
node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync(".private/runtime.json"));if(!/^https:\/\//.test(d.PUBLIC_ORIGIN))throw Error("Set PUBLIC_ORIGIN in .private/runtime.json first");fs.writeFileSync(".private/runtime.yaml",Object.entries(d).map(([k,v])=>k+": "+JSON.stringify(v)).join("\n"),{mode:0o600})'
gcloud run deploy shaadi-api --source . --region "$SHAADI_REGION" --project "$SHAADI_PROJECT_ID" --service-account "$SHAADI_SA" --allow-unauthenticated --memory 512Mi --concurrency 8 --max-instances 3 --timeout 60 --env-vars-file .private/runtime.yaml --set-secrets 'GOOGLE_CLIENT_ID=shaadi-google_client_id:latest,GOOGLE_CLIENT_SECRET=shaadi-google_client_secret:latest,GOOGLE_REFRESH_TOKEN=shaadi-google_refresh_token:latest,INVITE_SECRET=shaadi-invite_secret:latest,ADMIN_SECRET=shaadi-admin_secret:latest'
npx firebase-tools deploy --only hosting --project "$SHAADI_PROJECT_ID"
echo 'Deployed. Complete the acceptance checklist in docs/TESTING.md before sending guest links.'
