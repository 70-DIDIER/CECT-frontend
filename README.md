# CECT Togo — site et espaces membre / administration

Application React (Vite, TypeScript, Tailwind) du site public de la Coopérative d'Entraide Communautaire du Togo, de l'espace membre et du back-office. Elle consomme l'API CECT / YEM.

## Démarrage

```bash
npm install
cp .env.example .env     # adapter VITE_API_URL
npm run dev              # http://localhost:5173
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
