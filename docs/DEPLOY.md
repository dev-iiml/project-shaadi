# Deploy your own wedding

Allow time for Google account setup and real-device checks. This guide deploys an independent event; it does not replace another couple’s site. Use a separate project and storage account for every friend.

## 1. Prepare your repository and information

Install Node.js 22+, Git, Google Cloud CLI and a current Firebase CLI. `npm ci` installs application dependencies. The deploy script invokes Firebase CLI through `npx firebase-tools`.

Create your GitHub repository and enable **Settings → General → Template repository**. A private repository is usable by people with access; a public repository is discoverable. Choose visibility deliberately and inspect all files before making it public. Never upload `node_modules/`, `.private/`, generated archives, credentials or actual guest data.

Edit `config/event.json` and replace `web/assets/` photos. Run `npm test` and `npm run build`. When updating names, replace artwork too: text inside an image cannot be changed by configuration. Files in `public/` are generated.

## 2. Create the Google project

1. At https://console.firebase.google.com create a project, then note its project ID.
2. Enable billing (Blaze) for this deployment’s Cloud Run backend and associated services. This is separate from Google One. Set a budget alert; alerts are not spending caps.
3. In Google Cloud Console enable **Google Drive API** and **Google Sheets API** for the same project.
4. In Firebase Console initialise **Firestore Database**, default database, **production mode** (deny all client access), preferably in `us-central1` for this template. Never select test/open rules. The backend accesses it through its runtime service account. `firestore.rules` documents the intended deny-all client policy; this script does not deploy Firestore rules for you.
5. In Firebase Console initialise **Hosting**. This project uses classic Firebase Hosting, not Firebase App Hosting and not Firebase Cloud Storage. Its default site should match your project ID. If you use a different Hosting site, configure its `site` in `firebase.json` and use that site’s domain below.
6. Sign in locally with `gcloud auth login` and `npx firebase-tools login`. Your deploying account must have permission to deploy Cloud Run, build images, create service accounts and IAM bindings, and manage Secret Manager. A project owner can do the initial setup; organisations may require an administrator.

## 3. Authorise the event owner’s Drive

Uploads must belong to the personal Google account with the intended Drive storage. A service account cannot use the owner’s personal Google One storage just by sharing a folder.

1. In **Google Auth Platform**, configure the app name, support/contact email and audience. Request only `https://www.googleapis.com/auth/drive.file` (access to files this app creates/selects). No full-Drive scope is needed.
2. Create an **OAuth client ID → Web application**. Add the authorised redirect URI `http://localhost:8787/callback` exactly. Download its JSON.
3. Create a local `.private/` directory and save that download as `.private/oauth-client.json`. It is ignored by Git and cloud uploads.
4. Run `npm run setup:google`. Open the printed consent URL on the same computer, and authorise the account that will own the wedding photos. Do not send the authorisation URL or credentials to guests.
5. The helper creates a private wedding root, private pending/approved folders, and an RSVP Sheet with the correct header. It writes `.private/secrets.json`, `.private/runtime.json` and `.private/resources.json`. Check that these exist before proceeding. It refuses to overwrite existing setup.
6. Confirm the Google OAuth audience/publishing state supports long-lived use. External apps left in Testing commonly receive refresh tokens that expire after seven days. Follow Google’s current options for personal-use/production apps; personal mode may be available. If verification is requested, complete the required process. Do not leave the deployment dependent on a short-lived test grant.

Keep all setup files private and backed up securely. If an interrupted setup created some resources before failing, inspect Drive and remove only the unused folders/Sheet you recognise before starting again.

## 4. Set the origin and deploy

Edit `PUBLIC_ORIGIN` in `.private/runtime.json` to the exact HTTPS origin, for example `https://YOUR_PROJECT_ID.web.app`, without a trailing slash. Pick a single canonical origin and use it for guest links. Browser writes from other origins are rejected. A custom domain requires changing this setting and redeploying.

For the default setup, run:

```bash
export SHAADI_PROJECT_ID=your-project-id
npm run deploy
```

The script builds/tests the frontend, enables service APIs, creates the `shaadi-runtime` service account, grants Firestore access, stores owner secrets in Secret Manager, deploys `shaadi-api` to Cloud Run, and publishes Firebase Hosting with `/api/**` routed to that service. Folder IDs/origin are runtime settings; owner credentials are Secret Manager secrets. The runtime image contains only backend code and event configuration.

The default region is `us-central1`. Firebase Hosting only supports certain Cloud Run rewrite regions, so do not substitute an arbitrary region. The script caps Cloud Run at three instances, eight concurrent requests each, and 512 MiB memory per instance. These are initial operating settings, not a guaranteed event capacity or a spending cap.

If source deployment reports build-service-account permission errors, follow the linked Google Cloud guidance and grant the documented build permissions to your actual build account. Do not grant runtime access to your whole personal Drive.

## 5. Prepare the gallery and guests

1. Open your private resources file to find the pending folder, approved folder and Sheet.
2. Leave the wedding root and pending folder restricted. Only share **Approved gallery** as **Anyone with the link → Viewer**, if you want a public album. Never grant guests editor access.
3. Optionally put the approved gallery’s HTTPS URL in `config/event.json` as `galleryUrl`, then rebuild/redeploy. It appears as a “View approved wedding photos” link.
4. Open `https://YOUR_PROJECT_ID.web.app/admin.html`. Copy `ADMIN_SECRET` from your private secrets file into the host access field. The desk retains it only in page memory.
5. Create invitations and privately send their generated links. Name and guest limits are separate from uploaded filenames. Use different links for separate households.
6. For testing now, temporarily adjust the upload window to include today; test with a dedicated invitation. Restore the intended production dates and redeploy afterwards.

## 6. Verify before launch

Complete `docs/TESTING.md`. Do not distribute links before testing with your real Drive, a photo larger than one chunk, interruption/resume, Sheet sync, and approval visibility.

The app itself can be deployed without ChatGPT Sites. Replacing your old public link is a separate migration decision: this project does not overwrite the existing invite or import its RSVP records.

## Official references

- Firebase Hosting with Cloud Run: https://firebase.google.com/docs/hosting/cloud-run
- Cloud Run deployment from source: https://cloud.google.com/run/docs/deploying-source-code
- Drive resumable uploads: https://developers.google.com/workspace/drive/api/guides/manage-uploads
- Drive OAuth scopes: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- OAuth web-server flow: https://developers.google.com/identity/protocols/oauth2/web-server
- Google OAuth audience: https://support.google.com/cloud/answer/15549945
- Firebase usage/billing: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
