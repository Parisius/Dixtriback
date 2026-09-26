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
automatiquement les unités concernées et horodate `returnedAt` (utilisé par la
réconciliation de caisse, voir Caisses ci-dessous). `cashierId` est renseigné
automatiquement depuis le compte connecté.

**Remises.** Chaque ligne peut porter une remise (`{ type: "percent"|"fixed", value }`),
et la commande peut en porter une supplémentaire sur le total déjà remisé. Une remise ne
peut jamais dépasser ce sur quoi elle s'applique (`400` sinon). La commande stocke
`subtotal` (avant remise), `discountTotal` et `total` (= `subtotal - discountTotal`).

**Paiement fractionné.** `payments` est un tableau (`{ method, amount }`, une ou plusieurs
entrées) — leur somme doit égaler exactement `total` (`400` sinon). Permet par exemple
une partie en espèces et le reste en mobile money sur une même vente.

**Reçu.** `GET /orders/:id/receipt` télécharge un reçu PDF (entreprise, boutique, lignes,
remises, détail des paiements) — même contrôle d'accès que `GET /orders/:id`.

## Caisses (`/v1/shifts`)

Une caisse représente un service : ouverte avec un fonds de départ (`POST /v1/shifts`,
`openingFloat`), fermée avec le montant compté physiquement (`POST /v1/shifts/:id/close`,
`closingCash`). Une seule caisse peut être ouverte à la fois par boutique (`409` sinon).

Les ventes ne référencent pas explicitement une caisse : à la fermeture, la réconciliation
interroge simplement les commandes de cette boutique créées (ou retournées) entre
l'ouverture et la fermeture — `expectedCash = openingFloat + encaissements espèces −
remboursements espèces` sur cette période ; `discrepancy = closingCash − expectedCash`
(négatif = manquant). La réponse inclut aussi un résumé (`summary`) : répartition par
moyen de paiement, remises accordées, nombre de ventes/retours.

`GET /reports/shifts` (permission `reports.shifts`) liste les caisses fermées d'une
période avec leurs écarts, plus un total agrégé — pour repérer rapidement les manquants
de caisse.

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
- Le **super admin** n'a pas d'entreprise propre : il voit et gère **toutes** les entreprises.
  `Company.createdBy` garde la trace du super admin qui a créé chaque entreprise.
  `GET /v1/companies` et `GET /v1/auth/me` (`companyIds`) les listent.
- Tous les autres rôles n'accèdent qu'aux données de **leur** entreprise. Le `?companyId=` d'une
  requête ne peut que restreindre, jamais élargir. Accès à une autre entreprise : `403` (filtre) ou
  `404` (ressource par id, pour ne pas révéler son existence). Logique centralisée dans
  `src/tenancy/tenancy.service.ts`.
- Les comptes sans entreprise (clients) n'ont accès à aucune donnée d'entreprise.
- **Catalogue (vitrine e-commerce)** : `GET /v1/products` et `/v1/products/:id` fonctionnent sans
  connexion (`@OptionalAuth`) : visiteurs et clients voient les produits **actifs** de toutes les
  entreprises. Avec un token, le personnel ne voit que les produits de sa propre entreprise
  (super admin : toutes). Un token invalide est rejeté (401).
- Migration d'une base créée avant `Company.createdBy` :
  `node dist/database/backfill-company-owner.js [email-du-super-admin]`

## Régions

Une région appartient à **une entreprise** (`POST /v1/regions`, admin ou super admin ; `GET`, `PUT`,
`DELETE` = désactivation). Le `regionId` d'une boutique, d'un entrepôt ou d'un utilisateur doit
être l'id d'une région **active de la même entreprise** (sinon `400`). Nom unique par entreprise (`409`).

### Zones (subdivisions d'une région)

Une région peut avoir **plusieurs zones** (`POST /v1/zones` avec `regionId` ; `GET /v1/zones?regionId=`,
`GET /v1/regions/:id/zones`, `PUT`, `DELETE`). Une zone appartient à une seule région (donc à une seule
entreprise) et ne peut pas être déplacée ; nom unique par région. Désactiver une région désactive ses zones.

Boutiques, entrepôts et utilisateurs (ex. agent terrain) peuvent porter un `zoneId` en plus du `regionId` :
la zone doit être active, de la même entreprise, et **dans la région indiquée** (si `regionId` est omis,
il est déduit de la zone). Changer de région en gardant une ancienne zone est refusé (`400`).

Migration d'une base où `regionId` était du texte libre (ex. `"littoral"`) :
`node dist/database/backfill-regions.js` (crée les régions manquantes et remplace le texte par leur id).

## Journal d'activité (`GET /v1/logs`)

- Enregistré automatiquement pour **toute écriture** (POST/PUT/PATCH/DELETE) et tout événement
  d'authentification (connexion, inscription, OTP, refresh, logout), **réussis ou non**.
  Les lectures (GET) ne sont pas journalisées, ni les requêtes refusées avant le contrôleur
  (token absent/invalide, rôle non autorisé).
- Chaque entrée : date, auteur (id, nom, email, rôle), entreprise concernée, `action`
  (ex. `orders.create`, `shipments.receive`, `auth.login`), ressource et id, méthode, chemin,
  code HTTP, succès, IP, user-agent, corps de la requête (mots de passe/secrets **masqués**).
- **Admin d'entreprise** : uniquement les entrées de son entreprise. **Super admin** : toutes les
  entreprises (`?companyId=<id>` pour une seule, `?companyId=none` pour les événements hors
  entreprise, ex. connexions échouées).
- Filtres : `companyId`, `actorId`, `resource`, `action`, `method`, `success`, `from`, `to`, `page`, `limit` (max 100).
- Lecture seule (aucune route d'écriture ni de suppression). Conservation : `AUDIT_RETENTION_DAYS`
  (365 par défaut). `TRUST_PROXY` règle l'IP client derrière un proxy.

## Rôles (`/v1/roles`)

`GET /v1/roles` retourne TOUJOURS deux ensembles :
- les **rôles génériques** (`isSystem: true`, `companyId: null`) — un par valeur de l'enum `Role`
  (`admin`, `cashier`, etc.). Ils sont synchronisés automatiquement au démarrage à partir des
  décorateurs `@Roles(...)`/`@RequirePermission(...)` posés sur chaque route (voir
  `SystemRolesSeeder`) : c'est une vue en base de ce que les rôles fixes peuvent réellement faire,
  jamais modifiable via l'API (`PUT`/`DELETE` → `403`).
- les **rôles personnalisés** de l'entreprise (`isSystem: false`) que ses admins ont créés.

En plus des rôles fixes, chaque entreprise peut créer ses propres rôles avec des permissions
précises : `POST /v1/roles` (nom + `permissions: string[]`), `GET /v1/roles/permissions` pour le
catalogue disponible, `GET/PUT/DELETE /v1/roles/:id`. Nom unique par entreprise.

Pour affecter un rôle personnalisé à un utilisateur : `role: "custom"` + `customRoleId: "<id>"`
(POST/PUT `/v1/users`) — le rôle doit être actif et appartenir à la même entreprise. Le token JWT
porte le `customRoleId` ; désactiver le rôle (`DELETE /v1/roles/:id`) retire immédiatement les
permissions à tous les utilisateurs concernés dès leur prochain token.

Les rôles fixes (`admin`, `cashier`, etc.) sont inchangés et n'ont pas besoin de `customRoleId` ;
un rôle personnalisé ne couvre que les actions listées dans `GET /v1/roles/permissions` (écritures
et rapports) — la lecture (GET) reste ouverte à tout compte authentifié de l'entreprise, comme pour
les rôles fixes.

## Fichiers & images (`/v1/files`)

Un seul endpoint pour tout : photos de produit, logo de boutique / d'entreprise, avatar, documents.
`POST /v1/files` (multipart, champ `file`) + `ownerType` (`product|store|company|user`) et `ownerId`
(l'entreprise est déduite du propriétaire) ; sans propriétaire = document libre de l'entreprise.
`GET /v1/files?ownerType=&ownerId=&kind=&purpose=`, `GET /v1/files/:id`, `DELETE /v1/files/:id`.

- **Visibilité** — les **images de produit sont publiques** : le champ `url` (`/v1/files/:id/public`, sans
  connexion) est aussi ajouté à `product.media`, donc la vitrine les affiche directement. **Tout le reste est
  privé** à l'entreprise : `GET /v1/files/:id/content` avec un jeton, ou `GET /v1/files/:id/link` qui donne
  une URL signée temporaire (30 s–1 h) utilisable dans un `<img src>`. Le bucket S3 lui-même reste privé —
  l'API sert tout (aucune politique de bucket n'est modifiée).
- **Types acceptés** (vérifiés sur le **contenu**, pas sur l'en-tête) : jpg, png, webp, gif, PDF,
  Word/Excel/PowerPoint, txt, csv. SVG, HTML et scripts sont refusés (`415`). Taille max `MAX_UPLOAD_BYTES`
  (10 Mo par défaut, `413` au-delà). 20 fichiers max par élément.
- **Qui peut quoi** — tout rôle du personnel peut téléverser ; rattacher un fichier à un produit / une
  boutique / l'entreprise exige le droit de modifier cet élément (admin ; + chef de boutique pour les
  boutiques) ; chacun peut définir **son propre** avatar. Un rôle personnalisé a besoin de `files.upload`
  et de la permission de modification correspondante. Suppression : l'auteur, ou qui peut modifier l'élément.
- **Stockage** — tout S3 compatible (MinIO). Variables : `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
  `S3_BUCKET` (défaut `dixtri`), `S3_KEY_PREFIX` (dossier dans le bucket, utile s'il est partagé), `S3_REGION`, `S3_AUTO_CREATE_BUCKET`, `API_PUBLIC_URL`. Sans `S3_ENDPOINT`
  l'API démarre normalement et les téléversements répondent `503`. En local, `docker-compose.yml` lance un
  MinIO jetable (l'image n'est plus publiée sur Docker Hub : la charger depuis un serveur qui l'a, voir le
  commentaire du fichier).

## Unités : qui peut quoi, et règles

Une unité = un exemplaire physique sérialisé. Elles ne sont **créées qu'à la réception d'une expédition**
(`POST /shipments/:id/receive`) ; le stock d'un produit = le nombre de ses unités `in_stock`.

- **Transférer** — `POST /units/:id/transfer` (une unité) et `POST /warehouses/:id/transfers` (un lot) :
  réservé aux rôles d'entrepôt (super admin, admin, chef d'entrepôt, superviseur régional ; permission
  `units.transfer` / `warehouses.transfer`). Seule une unité **`in_stock`** peut bouger ; destinations
  autorisées : entrepôt, boutique, agent terrain (`toAgentId`), de la **même entreprise** — les ventes et
  retours passent par `/orders`, jamais par ici (une unité vendue ne revient pas en stock sans retour).
  Un transfert d'entrepôt exige que les unités soient **dans cet entrepôt**, et un lot est
  **tout ou rien** : si une seule unité est invalide, aucune ne bouge. L'historique de l'unité retient l'auteur.
- **Endommagée / radiée** — `POST /units/:id/status` `{ status, reason }` (permission `units.status`, mêmes
  rôles) : `in_stock → damaged | written_off`, `damaged → written_off | in_stock` (réparée). Motif obligatoire,
  `written_off` est définitif, une unité vendue ne change pas ici. L'unité **sort du stock vendable** (POS et
  rapport de stock ne comptent que `in_stock`) mais reste rattachée à son emplacement ; le rapport de stock
  la compte par statut.
- Lecture (liste, détail, `GET /units/:serial/trace`) : tout compte de l'entreprise.

## Bon de commande : `name`

`POST /v1/purchase-orders` exige désormais un **`name`** (2 à 120 caractères) ; modifiable via `PUT`, et
`GET /v1/purchase-orders?q=` cherche dans le nom (insensible à la casse). Les bons créés avant cet ajout n'ont
simplement pas de nom.

