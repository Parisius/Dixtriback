# Backend — Plateforme de Commerce Multi-Entreprises (Phase 1)

API REST pour le Tableau de Bord Admin : Comptes & Entreprise, Approvisionnement &
Entrepôts (avec sérialisation d'unité), Boutiques & POS, CRM & Segmentation, Reporting.

**Stack** : NestJS 10 + MongoDB (Mongoose 8) · Auth JWT (access + refresh) · Swagger/OpenAPI (`@nestjs/swagger`)

Ce backend correspond au schéma directeur (`ecommerce-platform-full-spec.md` v3), au
journal de décisions verrouillées, et à la feuille de route Phase 1 (`phase1-roadmap-userstories-api.pptx`)
produits précédemment pour ce projet.

---

## Démarrage rapide

```bash
npm install
cp .env.example .env        # ajuster MONGODB_URI, secrets JWT si besoin
npm run start:dev
```

- API : `http://localhost:3000/v1`
- Swagger UI : `http://localhost:3000/docs`

Un MongoDB accessible est requis (local, Docker, ou Atlas) — voir `MONGODB_URI` dans `.env`.

```bash
# Option Docker rapide pour un MongoDB local
docker run -d --name mc-mongo -p 27017:27017 mongo:7
```

## Vérification effectuée dans cet environnement

- `npm install` : succès (571 paquets)
- `npx nest build` : succès, zéro erreur TypeScript
- Démarrage de l'application (`node dist/main.js`) avec une URI Mongo invalide :
  le graphe de dépendances NestJS s'est entièrement résolu à travers les 14 modules
  (aucune erreur "Nest can't resolve dependency"), et l'unique échec observé est la
  connexion MongoDB elle-même (attendu, aucun MongoDB n'était disponible dans cet
  environnement sandbox — les domaines de téléchargement de `mongodb-memory-server`
  ne sont pas sur la liste blanche réseau). **À faire de votre côté avant mise en
  production** : démarrer l'app contre un vrai MongoDB et vérifier `/docs` et
  quelques appels réels (voir `npm run seed` ci-dessous).

---

## Comment fonctionne la règle "champs additionnels autorisés"

Décision verrouillée : chaque endpoint `POST`/`PUT`/`PATCH` doit accepter des champs
non prévus, en plus des champs obligatoires. Deux réglages, toujours utilisés ensemble,
réalisent ça :

1. **`ValidationPipe({ whitelist: false })`** dans `src/main.ts` — les champs déclarés
   sur chaque DTO (`class-validator`) sont validés et transformés normalement ; tout
   champ supplémentaire dans le corps de la requête n'est ni rejeté ni supprimé.
2. **`@Schema({ strict: false })`** sur *chaque* modèle Mongoose (voir tout fichier
   `*.schema.ts`) — Mongoose persiste alors n'importe quelle propriété présente sur le
   document, même si elle n'a pas de `@Prop()` correspondant.

Concrètement : `POST /products` avec `{ companyId, sku, name, basePrice, tailleDispo: ["S","M","L"] }`
crée le produit normalement et conserve `tailleDispo` sur le document, alors que ce
champ n'existe dans aucun DTO ni schéma.

Si un jour un champ doit être *rejeté* explicitement (ex. sécurité), retirez ce
comportement au cas par cas plutôt que globalement.

---

## Structure du projet

```
src/
  main.ts              Bootstrap : ValidationPipe, filtre d'exceptions, Swagger
  app.module.ts         Assemble les 14 modules Phase 1, guards globaux (JWT + RBAC)
  config/                Chargement des variables d'environnement
  database/              Connexion Mongoose (async, via ConfigService)
  common/
    constants/roles.enum.ts      Tous les rôles de la plateforme
    decorators/                  @Roles(), @Public(), @CurrentUser()
    guards/                      JwtAuthGuard (global), RolesGuard (global)
    filters/                     Filtre d'exceptions -> { statusCode, message, error }

  auth/          register, login, refresh (rotation), OTP email request/verify, logout, /me
  users/         Comptes staff, tous rôles, mot de passe bcrypt
  companies/     Entreprises (tenants)
  suppliers/     Fournisseurs
  purchase-orders/  Bons de commande + approbation
  shipments/     Expéditions + réception (éclatement des lots, sérialisation par unité)
  warehouses/    Entrepôts national/import & régionaux + transferts de stock
  units/         Unités individuellement sérialisées, historique, traçabilité
  products/      Catalogue produits
  stores/        Boutiques physiques/virtuelles
  orders/        Ventes POS (comptant/carte/mobile money uniquement), retours
  customers/     Fiches client (CRM), historique d'achat
  segments/      Segments basés sur des règles, recalcul d'appartenance
  reports/       Ventes, inventaire, marges (agrégations MongoDB)
```

## Rôles & permissions (RBAC)

Chaque route est protégée par JWT par défaut (`JwtAuthGuard` global). Une route sans
`@Roles(...)` accepte n'importe quel utilisateur authentifié ; `@Roles(Role.ADMIN, ...)`
restreint l'accès. Voir `src/common/constants/roles.enum.ts` pour la liste complète —
Phase 1 utilise principalement `super_admin`, `admin`, `director`, `financial_manager`,
`warehouse_manager`, `regional_supervisor`, `shop_manager`, `cashier`, `marketing_manager`.

## Authentification

- `POST /v1/auth/register` — auto-inscription client (rôle `customer` forcé serveur)
- `POST /v1/auth/login` — email + mot de passe
- `POST /v1/auth/otp/request` / `POST /v1/auth/otp/verify` — flux email + code OTP
  (sans `SMTP_HOST`, en dev uniquement : code statique `OTP_DEV_STATIC_CODE` affiché
  dans la console ; en production, `SMTP_*` est obligatoire — voir `.env.prod.example`)
- `POST /v1/auth/refresh` — rotation du refresh token
- `POST /v1/auth/logout` — révoque tous les refresh tokens de l'utilisateur

Créer le tout premier compte Super Admin se fait via le script de seed (ci-dessous),
puisque `POST /users` exige déjà d'être authentifié en tant qu'Admin.

## Seed de données de démarrage

```bash
npm run seed
```

Crée : un Super Admin (`admin@example.com` / `ChangeMe123!`), une entreprise, un
entrepôt national, un entrepôt régional, et une boutique — de quoi tester la
chaîne complète (bon de commande → expédition → réception/sérialisation → transfert
→ vente POS) depuis Swagger.

## Traçabilité & sérialisation

`POST /shipments/:id/receive` répartit le coût total de l'expédition (marchandises +
fret + droits + manutention) sur chaque unité physique du manifeste, crée une `Unit`
sérialisée par exemplaire, et l'attribue à l'entrepôt de destination. `GET /units/:serial/trace`
retourne la chaîne complète accumulée dans `Unit.history` à chaque transfert de propriété.

## Vente en boutique (POS)

`POST /orders` (canal boutique) n'accepte que `cash`, `card`, `mobile_money` — le crédit
est rejeté avec une erreur explicite, conformément à la décision verrouillée réservant
le crédit à l'agent terrain (non encore construit en Phase 1). Chaque ligne de vente
sélectionne et « vend » des unités sérialisées précises en stock à la boutique, ce qui
décrémente l'inventaire. Un retour (`PUT /orders/:id` avec `status: "returned"`) restocke
automatiquement les unités concernées.

## CRM & Segmentation

`POST /segments` définit des règles (`minSpend`, `minOrders`, `tag`, ...) ;
`POST /segments/:id/recompute` réévalue tous les clients de l'entreprise contre ces
règles et met à jour l'appartenance ainsi que `customerCount`.

## Prochaines étapes suggérées

- Configurer le SMTP (`SMTP_*`) pour l'envoi des OTP par email
- Ajouter des tests (`@nestjs/testing`) — aucun test automatisé n'est encore inclus
- Journalisation/observabilité (Winston, Sentry, etc.) au-delà du filtre d'exceptions actuel
- Le module Crédit (Agent Terrain), le Field Agent App backend, et le module Chat
  restent hors du périmètre Phase 1 — voir `openapi.json` pour leur forme prévue

## Isolation multi-entreprises

- Un utilisateur est rattaché à une entreprise par `User.companyId` (copié dans le JWT).
- Un **super admin** n'a pas d'entreprise propre : il est lié à **toutes les entreprises qu'il crée**
  (`Company.createdBy`). `GET /v1/companies` et `GET /v1/auth/me` (`companyIds`) les listent.
  Un super admin ne voit jamais les entreprises d'un autre super admin.
- Tous les autres rôles n'accèdent qu'aux données de **leur** entreprise. Le `?companyId=` d'une
  requête ne peut que restreindre, jamais élargir. Accès à une autre entreprise : `403` (filtre) ou
  `404` (ressource par id, pour ne pas révéler son existence). Logique centralisée dans
  `src/tenancy/tenancy.service.ts`.
- Les comptes sans entreprise (clients) n'ont accès à aucune donnée d'entreprise.
- Migration d'une base créée avant ce changement (entreprises sans propriétaire) :
  `node dist/database/backfill-company-owner.js [email-du-super-admin]`
