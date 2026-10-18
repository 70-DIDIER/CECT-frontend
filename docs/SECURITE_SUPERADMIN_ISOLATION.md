# CECT public frontend — SuperAdmin security separation

The SuperAdmin authentication is intentionally **not implemented in the public member storefront**. The public frontend serves members (vendors/consumers) with existing signup/login.

The SuperAdmin secure flow is implemented in:
- `70-DIDIER/cecet-api` (branch `custum`): pinned client X.509 mTLS, server-side identity checks, RSA proof-of-possession, onboarding, OTP challenges, key rotation/recovery, expiration, revocation, security settings.
- `70-DIDIER/cect-admin` (branch `custum`): dedicated `/superadmin/connexion` workflow plus `/admin/securite` settings.

**Deployment requirement:** serve the SuperAdmin route only through a certificate-required HTTPS host, e.g. `superadmin.example.tg`; proxy `/api` and `/sanctum` via the same vhost using *server-owned FastCGI variables*. Do not put the private CA key, .p12, .cectkey files or OTP secrets in any repository.

Feature gate `SUPERADMIN_MTLS_ENABLED` remains off until certificate delivery, migration and staging acceptance are complete. No change is required to ordinary member journeys in this repository.


## Coordination CECT v5.1 — 18 octobre 2026

Les évolutions SuperAdmin de la version 5.1 du cahier des charges sont publiées uniquement sur les branches `custum` des dépôts `70-DIDIER/cecet-api` et `70-DIDIER/cect-admin`.

- La route actuelle de démonstration est `https://admin.13-49-203-235.sslip.io/superadmin/connexion`, protégée par certificat X.509 côté Nginx. Aucune route correspondante ne doit être ajoutée au portail public membre.
- Les rôles internes consolidés sont **SuperAdmin, Administrateur et Comptabilité** ; les permissions de validation anciennement confiées à « Validateur » sont transférées à Comptabilité.
- Les fonctions « vendeur », « consommateur », « personnel », « marchand » continuent d'être accordées selon les packs et l'éligibilité des membres, **pas** par une connexion à l'espace SuperAdmin.
- Les frais d'adhésion PF/PM et les paramètres financiers sont toujours obtenus depuis l'API versionnée, jamais copiés dans le frontend. Les règles financières critiques sont réservées au SuperAdmin.
- Aucune donnée privée du SuperAdmin (.p12, .cectkey, OTP, CA privée) ne doit être insérée dans les bundles du portail public.

Cette mise à jour du dépôt frontend est **documentaire uniquement** : aucun parcours d'inscription membre ou de paiement n'a été modifié ici. Consulter `cecet-api/Cahier_des_charges_CECT_YEM_v5.0.md` §13 pour les critères d'acceptation et les écarts restant à recetter.
