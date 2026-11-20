# Operations

## Before the wedding

Check owner OAuth expiry/revocation, free Drive storage, upload dates/timezone and max file sizes. Test on the venue’s likely mobile/Wi-Fi connections. Google One adds storage, not API throughput or cloud billing credit. Set project budget alerts and review quotas. No traffic capacity is claimed before a representative load test.

Check Cloud Run error counts, Firestore usage and Drive/Sheets API quotas. Do not log Authorization headers, resumable session URIs, guest links or photo contents. Backend errors intentionally return generic messages for unexpected failures.

Each personal link has per-invitation reserved file/byte allowances. This is not global bot protection or an IP rate limiter. For an event with broadly circulating links, add infrastructure-level abuse protection before launch; this initial version assumes privately distributed household links. Revoke forwarded links through the host desk.

## Interrupted uploads

Retry in the same page, or reopen the same tab and select the same files. The browser’s file fingerprint maps to the saved upload ID, and the backend queries Drive’s committed offset. Files completed during an ambiguous response are recognised by their completed Drive session. A Drive session can expire after approximately a week; expired sessions need a fresh upload ID (a new tab/session clears the browser mapping). Reserved allowance is deliberately not refunded automatically.

If an invitation hits its allowance because of abandoned sessions, inspect its upload records in Firestore. Only after checking which Drive sessions/files exist, adjust that guest document’s `reservedFiles`/`reservedBytes` or create a replacement invitation. Never delete reservations blindly while uploads are running. Automatic session cleanup and an owner allowance-reset button are not included in this version.

## Sheet sync

The host desk flags saved responses whose Sheet projection failed. Click Retry Sheet sync. Do not delete or rename the `RSVP` tab or change column A’s invitation IDs. Firestore retains the canonical response if the Sheet is accidentally altered.

For duplicate rows after an ambiguous Sheets append, compare column A invitation IDs and keep the row matching the current Firestore RSVP. Unrelated manual edits to the Sheet are not synced back into the app. The owner desk lists up to 500 guest records; larger events need pagination or direct administrative exports.

## Review and publish

Inspect each file in Drive; signature filtering is not a malware guarantee. Approval is a publication action if the approved gallery is already link-shared. Rejected originals stay private and consume Drive storage until the owner deletes them. The root/pending folder must never inherit public sharing.

## After the event

Close uploads in the event configuration and redeploy. Finish moderation, make a separate backup of originals, and choose how long guest names, messages and RSVP data should remain. To stop all writes immediately, make the Cloud Run service private or remove its public invoker access. Disable Hosting only if you also want the invite unavailable.

## Credential loss and rotation

Keep `.private/` and the corresponding Secret Manager values private. Rotate the admin key if exposed. Rotating `INVITE_SECRET` invalidates all guest links. Reauthorising Drive must use the same OAuth client and file-access scope to keep access to app-created resources; do not rerun initial setup into new folders by accident. Keep a secure copy of the original settings/resources.

Revoking the owner’s OAuth grant stops future Drive/Sheet operations. A deployment does not automatically cancel cloud billing; remove unneeded services, secrets and build images when retiring the project.
