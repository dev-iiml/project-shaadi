# Implementation status

The reusable template includes a standalone invite/PWA build, generic botanical placeholders, configuration examples, server-enforced attendance/stay variants, RSVP persistence and Sheet projection, original-file Drive uploads, pending/approved guest folders, a host desk, Google setup helper, deployment script and guides.

Automated checks cover invitation authorisation, RSVP constraints, upload policies, exact-byte forwarding, resumable offsets, recovery after a lost final acknowledgement, and configuration changes for a different event. API tests use in-memory Firestore/Drive adapters; they do not contact Google.

The generic template contains fictional sample details and placeholder artwork. No real guest records, owner credentials or wedding photographs are included.

Live owner OAuth, Drive/Sheet permissions and API behaviour, Firestore production transactions, Cloud Run/Firebase deployment, real-device camera/picker behaviour, PWA installation, and event-scale traffic remain to be verified. Browser visual QA has not been performed in this environment.

Start with docs/DEPLOY.md, then complete docs/TESTING.md before guest use. The public source repository is https://github.com/dev-iiml/project-shaadi. Publishing source does not deploy a working wedding site or connect any Google account.
