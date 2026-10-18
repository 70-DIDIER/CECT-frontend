# CECT v5.6 — Packs et cashback (frontend public)

Décision du 18 octobre 2026. Référence normative : `70-DIDIER/cecet-api:Cahier_des_charges_CECT_YEM_v5.0.md`, addendum 18. La gestion est réalisée uniquement dans `70-DIDIER/cect-admin:custum` via `/admin/packs`.

## Fonctionnement pour les membres

- **Consommateur** : le membre achète son pack et reçoit des YEM sur les périodes fixées. S'il existe un bonus actif sur **la version du pack souscrite**, des YEM supplémentaires sont ajoutés et répartis sur les périodes. Le prix en FCFA n'est pas réduit.
- **Personnel** : pas de quota périodique fixe. Le membre recharge en FCFA ; le taux YEM en vigueur au moment du rechargement détermine ses YEM achetés. Si la version du pack Personnel possède un bonus, ce bonus s'ajoute à chaque rechargement et reste figé pour celui-ci.
- **Vendeur** et **Marchand** : aucun cashback (contrôle backend obligatoire, même en présence d'une ancienne configuration mal formée).
- Les anciens packs sans `rules.cashback` conservent leur traitement historique ; une nouvelle version publiée n'affecte pas les anciennes souscriptions.
- Les API de souscription, rechargement et tableau membre sont la source des **soldes achetés, cashback et périodes**. Le frontend public n'a jamais à calculer ni à modifier l'avantage final, ni à appliquer une réduction en FCFA.
- Le module Admin unique est « Packs, quotas et avantages ». Les taux, plafonds et règles de cashback spécifiques sont édités dans la fiche d'un pack Consommateur ou Personnel, pas sur un écran autonome.

## Contrôle de non-régression

Tout changement du parcours membre doit vérifier que les soldes achetés et offerts demeurent distincts dans le tableau de bord, que seuls les packs publiés sont proposés et que le tarif affiché et le montant payé correspondent à la version du pack souscrite. Les nouvelles grilles commerciales nécessitent une validation métier avant publication.

Ce fichier est documentaire. Il n'exécute aucune modification sur les souscriptions ni les tarifs des 25 packs existants.

## Complément v5.7 — gestion Admin et nouvelle adhésion

- La console `cect-admin` utilise des onglets séparés Vendeur/Consommateur/Personnel/Marchand et une vue Archives. L'archive d'un pack publié est une **désactivation commerciale** et non un effacement des droits déjà achetés ; le portail ne liste pas les packs archivés comme souscriptibles.
- Pour tout nouveau pack Consommateur, le SuperAdmin saisit **un prix FCFA** et un nombre de périodes ; l'API calcule le quota YEM selon le cours de vente en vigueur et fige ce cours dans la version. Exemple : 100 000 FCFA / 650 = 153,846153 YEM achetés ; 5 % donne 7,692307 YEM en plus, soit 161,538460 YEM, sous réserve des règles d'arrondi backend.
- Le SuperAdmin règle le cashback individuellement dans les versions Consommateur/Personnel, jamais Vendeur/Marchand ; aucune remise FCFA.
- Le formulaire public `/inscription` accepte un lien d'invitation administratif préremplissant **type PF/PM, prénom, nom et e-mail**, mais le candidat doit fournir lui-même ses données, choisir son mot de passe, accepter les statuts, signer et vérifier son email. Une invitation n'est pas une inscription ni un paiement.
- Les membres suspendus ou clos ne doivent pouvoir effectuer aucune nouvelle opération. L'API reste la source des autorisations et historiques de compte.
