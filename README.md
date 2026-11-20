# Project Shaadi

A single-event wedding invitation template. Each couple deploys their own copy, using their own Google account, Drive storage, RSVP Sheet and Google Cloud/Firebase project. No ChatGPT Sites dependency.

The default configuration uses fictional sample names, a sample date, generic venue text and botanical placeholder artwork. Replace these before publishing your own invitation.

## Included

- Responsive five-frame scroll invitation, keyboard-accessible story controls and reduced-motion support.
- Personal invitation links with server-enforced guest limits and attendance/stay variants.
- Editable RSVPs, durably saved in Firestore and mirrored to a private Google Sheet.
- Original-file JPEG, PNG, WebP and HEIC/HEIF uploads to the host’s Drive. Files are not resized or recompressed.
- 4 MiB resumable chunks, retries, upload progress, file-signature checks, per-invitation allowances and upload opening/closing dates.
- Owner desk to create/revoke guest links, retry Sheet sync, and approve/reject photos.
- Private pending uploads, guest-named subfolders, and a separate approved gallery.
- PWA manifest, PNG icons and offline invitation artwork. RSVP and uploads need internet and an open page.
- Deployment script, Google owner-authorisation helper, GitHub CI and tests.

## Start locally

Requires Node.js 22+ and npm.

```bash
npm ci
npm test
npm run build
npm run dev
```

Open http://localhost:4173. This is an honest static preview: it does not save RSVPs or photos. The API returns a clear not-connected message until deployed with owner credentials.

## Make your own copy

1. Create a repository from this template (or upload these files into a new GitHub repository and enable **Settings → Template repository**).
2. Start from `config/event.example.json`, save as `config/event.json`, and edit the names, date, venue, story captions, theme and photo window.
3. Replace the five story images and venue image in `web/assets/`; update paths in the config if needed. Do not republish the example couple’s personal artwork as your wedding artwork.
4. Follow [the deployment guide](docs/DEPLOY.md), including Google authorisation and billing setup.
5. Complete [the acceptance checklist](docs/TESTING.md) on real phones before sharing links.

The default upload window is **25 November–15 December 2028, India time**, with 50 MiB per file, 100 files and 2 GiB reserved per invitation. Change these to suit your event. Abandoned sessions count toward allowances; see operations guidance.

## Host desk

Open `/admin.html` on your deployed site. Unlock using `ADMIN_SECRET` from your private setup file. Create a guest/family link, specify the maximum guests and whether to ask about accommodation, then send the link privately. No guest Google login is required. A personal link is a bearer capability: anyone receiving it can act for that invitation. Revoke it if forwarded unintentionally.

Guests’ RSVP variants come from their server-side invitation record; changing `?q=stay` cannot grant accommodation entitlement. Query parameters only change the unauthenticated preview.

Review originals in Drive before approval. Approving moves a file into its guest subfolder under the approved gallery. Share only that gallery with viewer access if you want a public album. Pending folders and RSVP data remain private.

## Status and limitations

This is an initial implementation with automated tests and a build check. Real Google deployment, phone-camera behaviour, interrupted uploads, PWA installation and event-scale traffic must be verified with the owner’s accounts. See the detailed checklist; no live Google integration results are claimed.

- The original bytes supplied by the browser are preserved. A phone may convert HEIC before supplying a selected file.
- Signature checks are an image-type filter, not an antivirus guarantee or full image decoder. Manual approval remains necessary.
- Upload sessions may expire (Drive sessions last about a week). Browser background uploads are not guaranteed. Reopening requires selecting the same files again in the same tab/session to match saved upload IDs.
- The owner’s Drive OAuth grant must remain valid. Google One storage does not pay for Cloud Run, Firestore, Secret Manager or Hosting.
- Owner guest list currently shows up to 500 invitations per page load; pending-photo review loads 100 at a time. Use Drive/Firestore for larger-event administration until pagination is added.
- Source Sheet data is not automatically imported from a previous Apps Script invite. The previous live invitation is not modified by this project.

## Architecture and operations

See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [OPERATIONS.md](docs/OPERATIONS.md) and [TESTING.md](docs/TESTING.md).

Code is MIT-licensed; personal photos, illustration frames and venue imagery are excluded from that licence. See [ASSETS.md](docs/ASSETS.md). Never commit `.private/`, credentials, guest lists or real RSVP exports.
