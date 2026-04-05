export const ADMIN_PERMISSION_KEYS = {
  viewDashboard: 'view_dashboard',
  viewOrders: 'view_orders',
  manageOrders: 'manage_orders',
  assignDrivers: 'assign_drivers',
  cancelOrders: 'cancel_orders',
  refundOrders: 'refund_orders',
  viewCustomers: 'view_customers',
  manageCustomers: 'manage_customers',
  viewMerchants: 'view_merchants',
  createMerchants: 'create_merchants',
  editMerchants: 'edit_merchants',
  approveMerchants: 'approve_merchants',
  suspendMerchants: 'suspend_merchants',
  viewDrivers: 'view_drivers',
  createDrivers: 'create_drivers',
  editDrivers: 'edit_drivers',
  approveDrivers: 'approve_drivers',
  suspendDrivers: 'suspend_drivers',
  viewPayouts: 'view_payouts',
  createPayouts: 'create_payouts',
  approvePayouts: 'approve_payouts',
  viewCodReconciliation: 'view_cod_reconciliation',
  manageCodSettlements: 'manage_cod_settlements',
  viewPlatformRevenue: 'view_platform_revenue',
  viewReports: 'view_reports',
  exportReports: 'export_reports',
  viewAdmins: 'view_admins',
  createAdmins: 'create_admins',
  editAdmins: 'edit_admins',
  suspendAdmins: 'suspend_admins',
  manageRolesPermissions: 'manage_roles_permissions',
  viewSettings: 'view_settings',
  manageSettings: 'manage_settings',
  viewPromotions: 'view_promotions',
  managePromotions: 'manage_promotions'
} as const;

export const ADMIN_PERMISSION_GROUPS = [
  {
    label: 'Operations',
    permissions: [
      ADMIN_PERMISSION_KEYS.viewDashboard,
      ADMIN_PERMISSION_KEYS.viewOrders,
      ADMIN_PERMISSION_KEYS.manageOrders,
      ADMIN_PERMISSION_KEYS.assignDrivers,
      ADMIN_PERMISSION_KEYS.cancelOrders,
      ADMIN_PERMISSION_KEYS.refundOrders,
      ADMIN_PERMISSION_KEYS.viewMerchants,
      ADMIN_PERMISSION_KEYS.createMerchants,
      ADMIN_PERMISSION_KEYS.editMerchants,
      ADMIN_PERMISSION_KEYS.approveMerchants,
      ADMIN_PERMISSION_KEYS.suspendMerchants,
      ADMIN_PERMISSION_KEYS.viewDrivers,
      ADMIN_PERMISSION_KEYS.createDrivers,
      ADMIN_PERMISSION_KEYS.editDrivers,
      ADMIN_PERMISSION_KEYS.approveDrivers,
      ADMIN_PERMISSION_KEYS.suspendDrivers,
      ADMIN_PERMISSION_KEYS.viewPromotions,
      ADMIN_PERMISSION_KEYS.managePromotions
    ]
  },
  {
    label: 'Support',
    permissions: [
      ADMIN_PERMISSION_KEYS.viewCustomers,
      ADMIN_PERMISSION_KEYS.manageCustomers
    ]
  },
  {
    label: 'Finance',
    permissions: [
      ADMIN_PERMISSION_KEYS.viewPayouts,
      ADMIN_PERMISSION_KEYS.createPayouts,
      ADMIN_PERMISSION_KEYS.approvePayouts,
      ADMIN_PERMISSION_KEYS.viewCodReconciliation,
      ADMIN_PERMISSION_KEYS.manageCodSettlements,
      ADMIN_PERMISSION_KEYS.viewPlatformRevenue,
      ADMIN_PERMISSION_KEYS.viewReports,
      ADMIN_PERMISSION_KEYS.exportReports
    ]
  },
  {
    label: 'Administration',
    permissions: [
      ADMIN_PERMISSION_KEYS.viewAdmins,
      ADMIN_PERMISSION_KEYS.createAdmins,
      ADMIN_PERMISSION_KEYS.editAdmins,
      ADMIN_PERMISSION_KEYS.suspendAdmins,
      ADMIN_PERMISSION_KEYS.manageRolesPermissions,
      ADMIN_PERMISSION_KEYS.viewSettings,
      ADMIN_PERMISSION_KEYS.manageSettings
    ]
  }
] as const;
