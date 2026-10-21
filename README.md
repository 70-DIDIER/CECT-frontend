# CECT Togo — site et espaces membre / administration

> **Onboarding développeur :** cette application est le **site public + espace membre**, et non le nouveau portail Admin isolé. Pour copier les trois composants et les règles du serveur dans un **lab local sans données privées**, suivre le [guide complet de reproduction locale CECT](https://github.com/70-DIDIER/cecet-api/blob/custum/docs/REPRODUCTION_LOCALE_CECT.md) ; branches **`custum`** des dépôts `70-DIDIER` exclusivement.

Application React (Vite, TypeScript, Tailwind) du site public de la Coopérative d'Entraide Communautaire du Togo et de l'espace membre. Le nouveau back-office est dans le dépôt distinct [`cect-admin`](https://github.com/70-DIDIER/cect-admin/tree/custum). Cette application consomme l'API CECT / YEM.

## Démarrage

```bash
npm ci                   # package-lock.json est versionné
cp .env.example .env     # VITE_API_URL=http://localhost:8000
npm run dev -- --host 127.0.0.1 --port 5173
```

`VITE_API_URL` est l'origine de l'API, sans `/api/v1` (ex. `http://localhost:8000`). L'authentification utilise le cookie de session de l'API : le site et l'API doivent être déclarés dans `SANCTUM_STATEFUL_DOMAINS` et `CORS_ALLOWED_ORIGINS` côté API.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | vérification des types et build de production |
| `npm run lint` | analyse du code |

## Organisation

- `src/pages` : pages publiques, `member/` (espace membre) et `admin/` (back-office)
- `src/features` : authentification, paiements, packs
- `src/components` : interface (`ui`), mise en page (`layout`), tableaux de bord (`dashboard`)
- `src/lib` : client de l'API, formats, pays et indicatifs

## Reproduction du comportement de staging

- Démarrer d'abord l'API locale avec PostgreSQL, migrations, `settings:sync`, rôles, worker et scheduler (voir guide complet). Utiliser `APP_ENV=staging` **uniquement dans le labo local** si le provider de paiements simulés `fake` est requis : son gestionnaire actuel ne l'autorise pas en `APP_ENV=local`.
- Le formulaire d'inscription n'encaisse **rien** ; il envoie un OTP et l'adhésion se règle **après** vérification de l'adresse e-mail. Le choix du moyen de paiement dépend du pays et des méthodes publiées par l'API.
- `VITE_SIMULATE_PAYMENT=false` est la valeur attendue pour le parcours actuel ; la simulation est décidée **côté API** et ne doit jamais provoquer un débit réel.
- `http://localhost:5173/inscription` pour une inscription, `http://localhost:5173/espace` pour les utilisateurs connectés, `http://localhost:5173/espace/adhesion` pour les droits d'adhésion.
- `npm run lint` et `npm run build` avant toute pull request. Les logos sont contenus dans `public/payment-logos` ; leur affichage ne démontre pas une intégration bancaire réelle.
- La copie des sources n'importe pas les packs ni les taux stockés dans PostgreSQL sur le serveur ; comparer l'API publique de référence (`/api/v1/config`, `/api/v1/packs`) et documenter les différences.
- Pour proposer une amélioration, créer une branche `feat/...` depuis `custum`, puis une PR **vers `custum`**, avec captures non sensibles, tests et impact éventuel sur l'API.

**Ne pas committer :** `.env`, jetons, adresses privées, données d'adhérents, e-mails OTP, clés d'accès ou base de staging.
