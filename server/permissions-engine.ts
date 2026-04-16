/**
 * Human Roles System - Phase 4
 * Permission Matrix for café staff
 * Competitive advantage: Simple but powerful role-based access
 */

export type Role = 'cashier' | 'barista' | 'supervisor' | 'branch_manager' | 'owner' | 'admin';

export type Permission = 
  | 'order.create'
  | 'order.view'
  | 'order.void'
  | 'order.refund'
  | 'order.apply_discount'
  | 'order.modify'
  | 'kitchen.view_queue'
  | 'kitchen.update_status'
  | 'inventory.view'
  | 'inventory.stock_in'
  | 'inventory.stock_out'
  | 'inventory.waste'
  | 'inventory.adjustment'
  | 'menu.view'
  | 'menu.create'
  | 'menu.edit'
  | 'menu.delete'
  | 'recipe.view'
  | 'recipe.create'
  | 'recipe.edit'
  | 'reports.daily'
  | 'reports.branch'
  | 'reports.all_branches'
  | 'reports.export'
  | 'employees.view'
  | 'employees.create'
  | 'employees.edit'
  | 'employees.delete'
  | 'settings.branch'
  | 'settings.cafe'
  | 'settings.billing';

const PERMISSION_MATRIX: Record<Role, Permission[]> = {
  cashier: [
    'order.create',
    'order.view',
    'order.apply_discount',
    'menu.view',
    'kitchen.view_queue',
  ],
  
  barista: [
    'order.view',
    'kitchen.view_queue',
    'kitchen.update_status',
    'menu.view',
    'recipe.view',
  ],
  
  supervisor: [
    'order.create',
    'order.view',
    'order.void',
    'order.apply_discount',
    'order.modify',
    'kitchen.view_queue',
    'kitchen.update_status',
    'menu.view',
    'inventory.view',
    'inventory.waste',
    'recipe.view',
    'reports.daily',
    'employees.view',
  ],
  
  branch_manager: [
    'order.create',
    'order.view',
    'order.void',
    'order.refund',
    'order.apply_discount',
    'order.modify',
    'kitchen.view_queue',
    'kitchen.update_status',
    'inventory.view',
    'inventory.stock_in',
    'inventory.stock_out',
    'inventory.waste',
    'inventory.adjustment',
    'menu.view',
    'menu.create',
    'menu.edit',
    'recipe.view',
    'recipe.create',
    'recipe.edit',
    'reports.daily',
    'reports.branch',
    'reports.export',
    'employees.view',
    'employees.create',
    'employees.edit',
    'settings.branch',
  ],
  
  owner: [
    'order.create',
    'order.view',
    'order.void',
    'order.refund',
    'order.apply_discount',
    'order.modify',
    'kitchen.view_queue',
    'kitchen.update_status',
    'inventory.view',
    'inventory.stock_in',
    'inventory.stock_out',
    'inventory.waste',
    'inventory.adjustment',
    'menu.view',
    'menu.create',
    'menu.edit',
    'menu.delete',
    'recipe.view',
    'recipe.create',
    'recipe.edit',
    'reports.daily',
    'reports.branch',
    'reports.all_branches',
    'reports.export',
    'employees.view',
    'employees.create',
    'employees.edit',
    'employees.delete',
    'settings.branch',
    'settings.cafe',
    'settings.billing',
  ],
  
  admin: [
    'order.create',
    'order.view',
    'order.void',
    'order.refund',
    'order.apply_discount',
    'order.modify',
    'kitchen.view_queue',
    'kitchen.update_status',
    'inventory.view',
    'inventory.stock_in',
    'inventory.stock_out',
    'inventory.waste',
    'inventory.adjustment',
    'menu.view',
    'menu.create',
    'menu.edit',
    'menu.delete',
    'recipe.view',
    'recipe.create',
    'recipe.edit',
    'reports.daily',
    'reports.branch',
    'reports.all_branches',
    'reports.export',
    'employees.view',
    'employees.create',
    'employees.edit',
    'employees.delete',
    'settings.branch',
    'settings.cafe',
    'settings.billing',
  ],
};

const ROLE_HIERARCHY: Record<Role, number> = {
  cashier: 1,
  barista: 1,
  supervisor: 2,
  branch_manager: 3,
  owner: 5,
  admin: 5,
};

const ROLE_NAMES_AR: Record<Role, string> = {
  cashier: 'كاشير',
  barista: 'باريستا',
  supervisor: 'مشرف',
  branch_manager: 'مدير فرع',
  owner: 'مالك',
  admin: 'مدير النظام',
};

export class PermissionsEngine {
  static hasPermission(role: string, permission: Permission): boolean {
    const normalizedRole = this.normalizeRole(role);
    const permissions = PERMISSION_MATRIX[normalizedRole];
    return permissions?.includes(permission) || false;
  }

  static getPermissions(role: string): Permission[] {
    const normalizedRole = this.normalizeRole(role);
    return PERMISSION_MATRIX[normalizedRole] || [];
  }

  static canAccessBranch(role: string, employeeBranchId: string | undefined, targetBranchId: string): boolean {
    const normalizedRole = this.normalizeRole(role);
    if (normalizedRole === 'owner' || normalizedRole === 'admin') {
      return true;
    }
    return employeeBranchId === targetBranchId;
  }

  static getRoleLevel(role: string): number {
    const normalizedRole = this.normalizeRole(role);
    return ROLE_HIERARCHY[normalizedRole] || 0;
  }

  static isHigherRole(role1: string, role2: string): boolean {
    return this.getRoleLevel(role1) > this.getRoleLevel(role2);
  }

  static canManageRole(managerRole: string, targetRole: string): boolean {
    return this.getRoleLevel(managerRole) > this.getRoleLevel(targetRole);
  }

  static getRoleNameAr(role: string): string {
    const normalizedRole = this.normalizeRole(role);
    return ROLE_NAMES_AR[normalizedRole] || role;
  }

  static getAllRoles(): { id: Role; nameAr: string; level: number }[] {
    return Object.entries(ROLE_HIERARCHY).map(([role, level]) => ({
      id: role as Role,
      nameAr: ROLE_NAMES_AR[role as Role],
      level,
    }));
  }

  static getAvailableRolesForManager(managerRole: string): Role[] {
    const managerLevel = this.getRoleLevel(managerRole);
    return Object.entries(ROLE_HIERARCHY)
      .filter(([_, level]) => level < managerLevel)
      .map(([role]) => role as Role);
  }

  private static normalizeRole(role: string): Role {
    const roleMap: Record<string, Role> = {
      'cashier': 'cashier',
      'barista': 'barista',
      'cook': 'barista',
      'waiter': 'cashier',
      'supervisor': 'supervisor',
      'manager': 'branch_manager',
      'branch_manager': 'branch_manager',
      'owner': 'owner',
      'admin': 'admin',
    };
    return roleMap[role.toLowerCase()] || 'cashier';
  }
}

export const PERMISSIONS = {
  ORDER_CREATE: 'order.create' as Permission,
  ORDER_VIEW: 'order.view' as Permission,
  ORDER_VOID: 'order.void' as Permission,
  ORDER_REFUND: 'order.refund' as Permission,
  ORDER_APPLY_DISCOUNT: 'order.apply_discount' as Permission,
  KITCHEN_VIEW_QUEUE: 'kitchen.view_queue' as Permission,
  KITCHEN_UPDATE_STATUS: 'kitchen.update_status' as Permission,
  INVENTORY_VIEW: 'inventory.view' as Permission,
  INVENTORY_STOCK_IN: 'inventory.stock_in' as Permission,
  REPORTS_DAILY: 'reports.daily' as Permission,
  REPORTS_BRANCH: 'reports.branch' as Permission,
  REPORTS_ALL: 'reports.all_branches' as Permission,
  REPORTS_EXPORT: 'reports.export' as Permission,
  EMPLOYEES_VIEW: 'employees.view' as Permission,
  EMPLOYEES_CREATE: 'employees.create' as Permission,
  SETTINGS_BRANCH: 'settings.branch' as Permission,
  SETTINGS_CAFE: 'settings.cafe' as Permission,
};
