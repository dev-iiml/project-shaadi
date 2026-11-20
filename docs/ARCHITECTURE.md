# Architecture

One event per repository/deployment. Firebase Hosting serves the built invite and PWA. Same-origin `/api/` requests reach the Cloud Run Node service. Firestore holds private invitation, RSVP and upload-session records. The owner’s OAuth grant gives the service access to app-created Drive files and the app-created RSVP Sheet.

## Invitation authority

The owner creates an invitation with a random 128-bit ID. The API signs the ID with HMAC-SHA256 and returns a personal URL whose fragment contains the capability. Fragments do not enter HTTP requests; the frontend removes it from the address bar and retains it in sessionStorage, then supplies it in the Authorization header. Server-side guest records define accommodation eligibility and maximum party size. Revoking a record blocks further guest API requests. The link is not proof of a real-world identity: whoever holds it can reply for that household.

The host desk uses an independent 256-bit random bearer secret over HTTPS. It stays only in page memory. There is no browser-to-Firestore access and no guest access to owner OAuth tokens. The Cloud Run runtime service account uses Firestore and Secret Manager; the owner’s separate OAuth identity creates Drive photos against their own quota.

## Upload flow

The guest selects an original file. The browser computes a SHA-256 fingerprint for resuming the same file within the same tab session. The guest’s upload session ID is random; its Drive URI stays only on the backend.

The backend checks the upload window, allowlisted type, file size and invitation allowance, reserves capacity transactionally and creates a Drive resumable session. The browser sends at most 4 MiB per request to Cloud Run. Before a retry, the API queries Drive’s committed offset. The first chunk must have an allowed image signature matching the declared type. The API forwards raw bytes without resizing, re-encoding or base64 conversion. Completion verifies Drive file size, MIME type and private parent folder.

Upload records and resumable URIs survive Cloud Run instance changes in Firestore. Per-record transaction leases prevent overlapping writes/reviews. Leases expire after 90 seconds; cloud requests time out earlier. Upload sessions abandoned during setup count against limits; no background sweeper or automatic refunds are implemented.

Signatures detect common disguised non-images but do not parse the complete image or detect malware. Originals remain private until manual host review. HEIC rendering depends on the browser/Drive; unsupported previews do not require conversion of the stored original.

## RSVP and Sheets

An authenticated RSVP replaces the household’s previous response. Firestore is the durable source of truth; Sheets is a projection. If Sheets fails, the guest still receives a truthful saved confirmation and the record is marked unsynced for owner retry. Projection looks up the invitation ID and updates its row instead of appending a second response. A rare ambiguous timeout on a Sheets append can still create duplicate rows; the operations guide covers reconciliation. Sheets is never published.

## Moderation

Pending originals live under `Pending uploads — PRIVATE / Guest name — ID`. Approval moves a file to `Approved gallery / Guest name — ID`, where it inherits the gallery’s viewer permissions. A retry checks destination parent membership before moving again. Rejection changes review status and keeps the original private. Nothing automatically changes folder sharing permissions.

## PWA

The manifest has stable same-origin URLs and PNG icons. The service worker caches only an explicit allowlist of public invite files. API requests, admin pages/scripts, query URLs and external services are excluded. Updated caches activate after the normal service-worker lifecycle; guests may need to close all app windows and reopen to receive a new worker. Original uploads and guest responses are not cached by the service worker. RSVP and uploads require internet; uploading in the background is not promised.
