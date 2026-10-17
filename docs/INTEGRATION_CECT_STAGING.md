# Intégration de l'interface CECT (Didier) — environnement de recette

## Cible et périmètre

- Source : `70-DIDIER/CECT-frontend` ; application React/Vite, site public + espace membre + espace Marchand + routes d'administration.
- API : Laravel `70-DIDIER/cecet-api`, sur `https://api.13-49-203-235.sslip.io`.
- Domaine public : `https://13-49-203-235.sslip.io`.
- L'interface admin séparée sur `https://admin.13-49-203-235.sslip.io/admin` est **conservée** : le remplacement n'affecte que le frontend public et membre.
- Données PostgreSQL (comptes, adhésions, packs, transactions, ledgers) inchangées.

## Modifications de la branche d'intégration

1. Remplacement du favicon inexistant par l'image CECT présente dans `public/logos`.
2. Formulaire Contact : ouvre la messagerie avec un brouillon explicite ; ne prétend plus que le message a été envoyé via un serveur. L'envoi exige une action manuelle dans le logiciel de courrier. API Contact à développer plus tard.
3. Script de release réversible avec contrôle de l'environnement staging, sauvegarde logique par maintien du symlink précédent, vérification des builds et tests de santé HTTP.

## Procédure une fois le serveur de nouveau accessible

1. Sur la machine AWS autorisée, cloner cette branche dans un répertoire isolé (sans toucher à l'ancien frontend) :
   `git clone --branch integration/staging-cect-20261017 https://github.com/70-DIDIER/CECT-frontend.git /home/ubuntu/cect-source/frontend-didier`.
2. Vérifier `/var/www/cect-api/.env` : `APP_ENV=staging`, paramètres Sanctum et CORS compatibles avec les sous-domaines publics.
3. Depuis le dépôt cloné, lancer :
   `CECT_STAGING_DEPLOY=YES VITE_API_URL=https://api.13-49-203-235.sslip.io bash scripts/deploy-staging.sh`
4. Le script installe les dépendances, compile, dépose une release sous `/home/ubuntu/cect-releases` et bascule atomiquement le lien `/home/ubuntu/cect-current/frontend`.
5. Il revérifie la réponse réelle Nginx pour `/`, `/connexion`, `/inscription`, `/packs`, `/espace`, `/espace/marchand`, les ressources, le logo et l'API. Si un contrôle échoue, le script remet l'ancienne release.
6. Tester **dans le navigateur avec comptes de recette uniquement** : connexion, OTP, séparation PF/PM, packs, QR Marchand, paiement simulé, rééchange, audit, responsive mobile et expiration de session.
7. Consigner les identifiants de release et les résultats de recette dans l'historique d'exploitation CECT. Aucun flux réel d'argent ou YEM.

## Retour arrière

La release précédente est affichée à la fin du script. Pour revenir à l'ancienne interface, rétablir `/home/ubuntu/cect-current/frontend` vers le chemin de l'ancienne release par un lien symbolique atomique, puis contrôler l'API et l'accueil.

## Limites

- En date du 17 octobre 2026, l'agent Remote Desktop Commander de l'EC2 est **hors ligne**. Cette branche et son script ne constituent **pas** une preuve de déploiement exécuté.
- Aucun build compilé ni test navigateur authentifié n'a pu être exécuté dans l'environnement cible tant que l'agent est hors ligne.
- Le nouveau frontend reprend les routes et client d'API du projet CECT, mais le schéma du backend et les règles financières doivent faire l'objet d'une recette avant publication réelle.
- Ne pas effectuer de `migrate:fresh`, de reset de base ou de seeding de démonstration pendant le déploiement frontend.
