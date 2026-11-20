# Verification and launch checklist

## Automated locally

`npm test` tests invitation tamper resistance, RSVP count and accommodation restrictions, image signature filtering, upload size/window policy, Drive offset handling, formula-like Sheet text, and the PWA build. `npm run build` validates configuration and emits frontend assets.

These checks do not contact Google. API route tests use fake Firestore/Drive adapters and verify request behaviour; they are not a substitute for a live Google test.

## Required with the event owner’s Google project

- [ ] Create two invitations, one attendance-only and one with accommodation. Try editing the query string; entitlement must stay unchanged.
- [ ] Save a response; edit it; confirm one household record in Firestore and the correct Sheet row. Decline after accepting and confirm all counts become zero.
- [ ] Attempt a guest count above the invitation’s maximum; the server must reject it.
- [ ] Revoke a link; subsequent API requests must fail.
- [ ] Upload JPEG, PNG, WebP and iPhone HEIC originals. Try an SVG and a text file renamed .jpg; reject them.
- [ ] Upload a photo larger than 4 MiB. Disconnect after a chunk; reconnect and retry. Compare downloaded originals with the source file’s SHA-256 hash. Do not compare against a phone-picker original the browser never supplied.
- [ ] Retry after the last chunk’s response is lost; confirm no duplicate Drive file.
- [ ] Close/reopen the same tab, reselect the same file, and check resume. Explain that a new browser/session may not retain the mapping.
- [ ] Confirm a guest cannot read another invitation’s reply or upload session.
- [ ] Check Drive folder permissions while logged out. Pending/root and Sheet must be inaccessible.
- [ ] Approve one photo and reject another. The approved file must be visible only according to the gallery’s viewer sharing; rejected file stays private.
- [ ] Simulate Sheet failure; RSVP stays saved in Firestore and owner retry repairs its projection.
- [ ] Test real iPhone Safari and Android Chrome camera/picker flows, including any HEIC conversion by the phone.
- [ ] Install the PWA; reopen it; test airplane-mode artwork. RSVP/uploads must not falsely confirm offline success. No admin/API records should appear in service-worker Cache Storage.
- [ ] Test representative simultaneous uploads on venue-like connections; monitor failure rate, memory, quota usage and cost. Set operating limits based on results.
- [ ] Check mobile keyboard, 200% zoom, reduced motion, focus order and photo queue controls.

Do not mark these boxes passed until the real integrations/devices have been exercised.
