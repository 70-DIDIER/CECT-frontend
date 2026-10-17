# CECT — Parcours d'adhésion et paiement fictif (branche custum)

Mise en place sur AWS staging le 17 octobre 2026. Ne pas reporter ces adaptations directement dans `main` de Didier.

## Inscription

Le formulaire public `/inscription` comporte **trois étapes** : identification, engagement, finalisation. Le choix d'un moyen de paiement ne fait plus partie de l'inscription et `preferred_payment_method` est omis du POST `/api/v1/auth/register` (champ facultatif côté backend). Après vérification OTP, l'utilisateur arrive dans `/espace/adhesion`.

## Règlement de l'adhésion

Le composant `src/pages/member/MembershipPage.tsx` préremplit le numéro E.164 reçu de `/api/v1/me`. Le numéro national est affiché avec indicatif et drapeau. Le crayon le rend modifiable pour **cette opération** (sans modifier le téléphone du profil). La sélection du pays réinitialise le numéro afin de prévenir les montants/pays incohérents.

Le sélecteur affiche uniquement les opérateurs dont `/api/v1/config.payment_methods` indique `enabled=true`, `channel=mobile_money`, et dont `countries` correspond au pays. Aucun opérateur hors configuration n'est inventé. Si aucun opérateur n'est activé, continuer est désactivé.

Le formulaire transmet `{ method, payment_phone }` à `POST /api/v1/me/membership/payments`. Une fois la tentative créée, `POST /api/v1/me/payments/{id}/simulate` confirme le paiement **uniquement si le backend autorise le simulateur**.

## Marquage

| Code métier | Logo local | Pays (staging, actuellement activés) |
| --- | --- | --- |
| `TMONEY` | `/payment-logos/mixx.svg` (Mixx, successeur T-Money) | TG |
| `FLOOZ` | `/payment-logos/flooz.png` | TG |
| `WAVE` | `/payment-logos/wave.png` | SN, CI |
| `ORANGE_MONEY` | `/payment-logos/orange-money.svg` | SN, CI |

Sources des éléments graphiques : site officiel Yas (Mixx), Wikimedia Commons (Flooz et Orange Money), J-PAL (Wave Mobile Money). Ces marques appartiennent à leurs titulaires respectifs ; leur présence n'implique aucun partenariat ni intégration PSP.

## Sécurité et limites

- **Simulation seulement** dans l'environnement `staging` avec le fournisseur `fake`, aucun débit/sms réel.
- Les méthodes s'affichent d'après la configuration active de l'API ; aucune méthode mobile n'est promise dans les pays non configurés.
- Le backend contrôle l'appartenance de la tentative au membre et la disponibilité de la méthode pour le pays.
- La présence d'un logo ne signifie pas que l'opérateur encaisse effectivement des FCFA.
- Le pack et les rechargements réutilisent le simulateur authentifié.
- Les tests automatiques et HTTP ne remplacent pas une recette manuelle avec un membre connecté.

## Déploiement de référence

Frontend : commit `00f98d7` de `CECT-frontend/custum`, release `frontend-didier-20261017T190135Z`.

Backend : commit `b100fab` de `cecet-api/custum`.

Le mode FedaPay réel n'a pas été activé. Aucun changement à `main`.
