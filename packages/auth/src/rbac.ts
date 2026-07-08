/**
 * Role-Based Access Control (RBAC) implementation
 */

export enum Role {
  ADMIN = 'admin',
  ANALYST = 'analyst',
  VIEWER = 'viewer',
  API_USER = 'api_user',
  SCOUT = 'scout',
}

export enum Permission {
  // Mine permissions
  MINES_READ = 'mines:read',
  MINES_WRITE = 'mines:write',
  MINES_DELETE = 'mines:delete',

  // Convergence permissions
  CONVERGENCE_READ = 'convergence:read',
  CONVERGENCE_COMPUTE = 'convergence:compute',

  // User management
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  USERS_DELETE = 'users:delete',

  // API keys
  API_KEYS_READ = 'api_keys:read',
  API_KEYS_CREATE = 'api_keys:create',
  API_KEYS_REVOKE = 'api_keys:revoke',

  // Data ingestion
  INGESTION_TRIGGER = 'ingestion:trigger',
  INGESTION_VIEW = 'ingestion:view',

  // Scout reports
  REPORTS_READ = 'reports:read',
  REPORTS_SUBMIT = 'reports:submit',
  REPORTS_APPROVE = 'reports:approve',

  // Analytics
  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_EXPORT = 'analytics:export',
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    // Full access to everything
    Permission.MINES_READ,
    Permission.MINES_WRITE,
    Permission.MINES_DELETE,
    Permission.CONVERGENCE_READ,
    Permission.CONVERGENCE_COMPUTE,
    Permission.USERS_READ,
    Permission.USERS_WRITE,
    Permission.USERS_DELETE,
    Permission.API_KEYS_READ,
    Permission.API_KEYS_CREATE,
    Permission.API_KEYS_REVOKE,
    Permission.INGESTION_TRIGGER,
    Permission.INGESTION_VIEW,
    Permission.REPORTS_READ,
    Permission.REPORTS_SUBMIT,
    Permission.REPORTS_APPROVE,
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_EXPORT,
  ],

  [Role.ANALYST]: [
    // Read and analyze data, submit reports, trigger convergence
    Permission.MINES_READ,
    Permission.CONVERGENCE_READ,
    Permission.CONVERGENCE_COMPUTE,
    Permission.REPORTS_READ,
    Permission.REPORTS_SUBMIT,
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_EXPORT,
    Permission.INGESTION_VIEW,
  ],

  [Role.VIEWER]: [
    // Read-only access to mines and convergence
    Permission.MINES_READ,
    Permission.CONVERGENCE_READ,
    Permission.ANALYTICS_VIEW,
  ],

  [Role.API_USER]: [
    // Programmatic access to mines and convergence
    Permission.MINES_READ,
    Permission.CONVERGENCE_READ,
    Permission.CONVERGENCE_COMPUTE,
    Permission.API_KEYS_READ,
  ],

  [Role.SCOUT]: [
    // Submit reports, read mines
    Permission.MINES_READ,
    Permission.REPORTS_READ,
    Permission.REPORTS_SUBMIT,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Check if a user (with multiple roles) has a permission
 */
export function userHasPermission(roles: Role[], permission: Permission): boolean {
  return roles.some((role) => hasPermission(role, permission));
}

/**
 * Get all permissions for a set of roles
 */
export function getRolePermissions(roles: Role[]): Permission[] {
  const allPermissions = new Set<Permission>();

  roles.forEach((role) => {
    const permissions = ROLE_PERMISSIONS[role] || [];
    permissions.forEach((perm) => allPermissions.add(perm));
  });

  return Array.from(allPermissions);
}

/**
 * Middleware to require a specific permission
 */
export function requirePermission(permission: Permission) {
  return (req: any, res: any, next: any) => {
    const user = req.user;

    if (!user || !user.roles) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const hasAccess = userHasPermission(user.roles, permission);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Permission required: ${permission}`,
        requiredPermission: permission,
      });
    }

    next();
  };
}

/**
 * Middleware to require any of multiple permissions (OR logic)
 */
export function requireAnyPermission(permissions: Permission[]) {
  return (req: any, res: any, next: any) => {
    const user = req.user;

    if (!user || !user.roles) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const hasAccess = permissions.some((perm) => userHasPermission(user.roles, perm));

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        requiredPermissions: permissions,
      });
    }

    next();
  };
}

/**
 * Middleware to require all permissions (AND logic)
 */
export function requireAllPermissions(permissions: Permission[]) {
  return (req: any, res: any, next: any) => {
    const user = req.user;

    if (!user || !user.roles) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const hasAllAccess = permissions.every((perm) => userHasPermission(user.roles, perm));

    if (!hasAllAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'All permissions required',
        requiredPermissions: permissions,
      });
    }

    next();
  };
}
