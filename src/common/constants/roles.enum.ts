/**
 * Every role in the platform. Phase 1 (Admin Dashboard) actively uses all of
 * these except the field-agent/marketplace-only roles, which are kept here
 * so the User schema and RBAC guard don't need to change shape later.
 */
export enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  DIRECTOR = 'director',
  FINANCIAL_MANAGER = 'financial_manager',
  SALES_MANAGER = 'sales_manager',
  SALES_HEADMASTER = 'sales_headmaster',
  MARKETING_MANAGER = 'marketing_manager',
  ACCOUNTANT = 'accountant',
  WAREHOUSE_MANAGER = 'country_warehouse_manager',
  REGIONAL_SUPERVISOR = 'regional_supervisor',
  SHOP_MANAGER = 'shop_manager',
  CASHIER = 'cashier',
  FIELD_AGENT = 'field_agent',
  ENTERPRISE_STAFF = 'enterprise_staff',
  CUSTOMER = 'customer',
  /** Permissions come from a company-owned CustomRole (see /v1/roles) instead of a fixed bundle. */
  CUSTOM = 'custom',
}
