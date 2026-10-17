# Protection des sessions navigateur lors des déploiements CECT
Date : 17 octobre 2026

## Incident de recette
Le site répondait HTTP 200 et l'API /api/v1/health était OK, mais les URL de bundles JS d'anciennes releases renvoyaient HTTP 404 après un déploiement. Une session membre déjà ouverte pouvait charger tardivement un chunk correspondant à sa précédente version. Une page blanche ou une fonction inactive pouvait en résulter.

## Correctif durable
Le script scripts/deploy-staging.sh, exclusivement sur la branche custum du dépôt 70-DIDIER/CECT-frontend, conserve les bundles fingerprintés .js et .css des anciennes releases Didier dans chaque nouvelle release, sans remplacer les fichiers de la version actuelle, sans transporter d'index.html précédent ni toucher à la base. La publication est toujours atomique et conserve le rollback.

Le contrôle de recette HTTP teste désormais les assets de l'ancienne page index.html après la bascule, avec leurs vrais types MIME, afin d'empêcher que le problème réapparaisse.

La configuration Nginx doit par ailleurs être révisée séparément par un administrateur système autorisé pour imposer Cache-Control: no-cache aux documents HTML et des règles immutable aux assets versionnés. Ce chantier n'a pas été appliqué sans accès à la configuration système protégée.

## Tests obligatoires
- URL publique et API accessibles ; HTML et assets courants 200.
- Anciennes empreintes JS/CSS (versions utilisateur conservées en onglet) 200 avec application/javascript ou text/css.
- Navigation et chargement des routes lazy sur navigateur réel après déploiement.
- Aucun changement de compte, de données YEM ni de paramètres tarifaires pour cette correction.
- Mise à jour du cahier des charges cumulatif v5.0.
