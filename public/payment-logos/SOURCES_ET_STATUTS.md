# Identité visuelle des moyens de paiement — sources et statut

Version 17 octobre 2026. **Les logos sont des marques de tiers, pas la preuve d'un partenariat CECT.**

| Identifiant | Asset local | Provenance / précision |
|---|---|---|
| TMONEY | mixx.svg | Identité Mixx déjà intégrée avant le présent changement ; à vérifier auprès de Yas |
| FLOOZ | flooz.png | Logo Flooz déjà intégré ; Wikimedia Commons, auteur Moov Africa Togo |
| WAVE | wave.png | Asset existant, provenance et version à confirmer |
| ORANGE_MONEY | orange-money.svg | Asset existant, provenance à confirmer ; nouvelle marque Commons "Logo Orange Money.svg" identifiée |
| MPESA | mpesa.svg | M-PESA LOGO-01.svg, Commons, marque M-Pesa |
| MTN_MOMO | mtn.svg | MTN 2022 logo.svg, Commons ; **logo du groupe MTN**, pas le logo propre à MoMo |
| AIRTEL_MONEY | airtel.svg | Airtel logo.svg, Commons ; **logo Airtel**, pas l'identité dédiée Airtel Money |
| CORIS_MONEY | coris.svg | Logo Coris Bank.svg, Commons ; **logo du groupe Coris**, pas le logo propre à Coris Money |
| CARD_SIM | visa.svg, mastercard.svg, american-express.svg | Marques authentiques de réseaux cartes publiées sur Commons, utilisé uniquement pour simulation |

Pour tout autre moyen configuré dans l'API, aucun fichier de logo opérateur authentifié n'a encore été trouvé ou validé. L'interface affiche actuellement un pictogramme **explicitement non officiel**, avec le nom du service. Il ne faut pas générer de contrefaçon, remplacer le nom par une image trompeuse, ni récupérer arbitrairement un logo homonyme.

## Actions pour compléter 100 % des visuels
1. Collecter les kits marque officiels auprès de chaque opérateur, avec autorisation/conditions d'utilisation.
2. Vérifier la correspondance exacte entre logo, marque, opérateur, pays et version actuelle.
3. Intégrer les fichiers dans public/payment-logos avec revue SVG (sans scripts, lien externe, SVG actifs), manifest et licence.
4. Ajouter la correspondance dans NETWORK_BRANDS de src/features/payments/types.ts, tester 200 et rendu responsive.
5. Autoriser le Superadmin à masquer les méthodes non supportées ou en attente de validation contractuelle dans la configuration, même en recette.

### Sources
- https://commons.wikimedia.org/wiki/File:MTN_2022_logo.svg
- https://commons.wikimedia.org/wiki/File:Airtel_logo.svg
- https://commons.wikimedia.org/wiki/File:Logo_Coris_Bank.svg
- https://commons.wikimedia.org/wiki/File:M-PESA_LOGO-01.svg
- https://commons.wikimedia.org/wiki/File:Moov_Money_Flooz.png
- https://commons.wikimedia.org/wiki/File:Logo_Orange_Money.svg
- https://www.bceao.int/fr/content/etablissements-de-monnaie-electronique
