# CECT public frontend — SuperAdmin security separation

The SuperAdmin authentication is intentionally **not implemented in the public member storefront**. The public frontend serves members (vendors/consumers) with existing signup/login.

The SuperAdmin secure flow is implemented in:
- `70-DIDIER/cecet-api` (branch `custum`): pinned client X.509 mTLS, server-side identity checks, RSA proof-of-possession, onboarding, OTP challenges, key rotation/recovery, expiration, revocation, security settings.
- `70-DIDIER/cect-admin` (branch `custum`): dedicated `/superadmin/connexion` workflow plus `/admin/securite` settings.

**Deployment requirement:** serve the SuperAdmin route only through a certificate-required HTTPS host, e.g. `superadmin.example.tg`; proxy `/api` and `/sanctum` via the same vhost using *server-owned FastCGI variables*. Do not put the private CA key, .p12, .cectkey files or OTP secrets in any repository.

Feature gate `SUPERADMIN_MTLS_ENABLED` remains off until certificate delivery, migration and staging acceptance are complete. No change is required to ordinary member journeys in this repository.
