/**
 * Every permission a CustomRole (see /v1/roles) can be granted, one per
 * currently `@Roles(...)`-gated write action. Naming matches the audit
 * log's `action` field (resource.verb) for consistency.
 *
 * This list is NOT the whole API surface: most GET/list endpoints have no
 * fixed-role restriction at all (any authenticated, company-scoped user can
 * read), so they need no permission and aren't included here.
 */
export const PERMISSIONS = [
  { id: 'companies.create', label: "Créer une entreprise" },
  { id: 'companies.update', label: "Modifier une entreprise" },
  { id: 'companies.delete', label: "Désactiver une entreprise" },
  { id: 'users.create', label: 'Créer un utilisateur' },
  { id: 'users.read', label: 'Lister les utilisateurs' },
  { id: 'users.update', label: 'Modifier un utilisateur' },
  { id: 'users.delete', label: 'Désactiver un utilisateur' },
  { id: 'roles.manage', label: 'Gérer les rôles personnalisés' },
  { id: 'regions.create', label: 'Créer une région' },
  { id: 'regions.update', label: 'Modifier une région' },
  { id: 'regions.delete', label: 'Désactiver une région' },
  { id: 'zones.create', label: 'Créer une zone' },
  { id: 'zones.update', label: 'Modifier une zone' },
  { id: 'zones.delete', label: 'Désactiver une zone' },
  { id: 'suppliers.create', label: 'Enregistrer un fournisseur' },
  { id: 'suppliers.update', label: 'Modifier un fournisseur' },
  { id: 'suppliers.delete', label: 'Désactiver un fournisseur' },
  { id: 'stores.create', label: 'Créer une boutique' },
  { id: 'stores.update', label: 'Modifier une boutique' },
  { id: 'stores.delete', label: 'Désactiver une boutique' },
  { id: 'warehouses.create', label: 'Créer un entrepôt' },
  { id: 'warehouses.update', label: 'Modifier un entrepôt' },
  { id: 'warehouses.transfer', label: 'Transférer du stock depuis un entrepôt' },
  { id: 'purchase-orders.create', label: 'Créer un bon de commande' },
  { id: 'purchase-orders.update', label: 'Modifier un bon de commande' },
  { id: 'purchase-orders.approve', label: 'Approuver un bon de commande' },
  { id: 'shipments.create', label: 'Enregistrer une expédition' },
  { id: 'shipments.update', label: 'Modifier une expédition' },
  { id: 'shipments.receive', label: 'Réceptionner une expédition' },
  { id: 'products.create', label: 'Créer un produit' },
  { id: 'products.update', label: 'Modifier un produit' },
  { id: 'products.delete', label: 'Désactiver un produit' },
  { id: 'orders.create', label: 'Créer une vente (POS)' },
  { id: 'orders.update', label: 'Gérer retours/remboursements' },
  { id: 'shifts.open', label: 'Ouvrir une caisse' },
  { id: 'shifts.close', label: 'Fermer une caisse' },
  { id: 'customers.create', label: 'Créer une fiche client' },
  { id: 'customers.update', label: 'Modifier une fiche client' },
  { id: 'segments.create', label: 'Créer un segment' },
  { id: 'segments.update', label: 'Modifier un segment' },
  { id: 'segments.recompute', label: "Recalculer l'appartenance à un segment" },
  { id: 'reports.sales', label: 'Voir le rapport des ventes' },
  { id: 'reports.inventory', label: 'Voir le rapport de stock' },
  { id: 'reports.margin', label: 'Voir le rapport des marges' },
  { id: 'reports.credit-aging', label: "Voir l'ancienneté des créances" },
  { id: 'reports.shifts', label: 'Voir le rapport de caisse (écarts)' },
  { id: 'files.upload', label: 'Téléverser un fichier / une image' },
  { id: 'files.delete', label: 'Supprimer un fichier / une image' },
  { id: 'logs.read', label: "Voir le journal d'activité" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]['id'];
export const PERMISSION_IDS: readonly string[] = PERMISSIONS.map((p) => p.id);
