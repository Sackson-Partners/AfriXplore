/**
 * Role-Based Access Control (RBAC) implementation
 */
export declare enum Role {
    ADMIN = "admin",
    ANALYST = "analyst",
    VIEWER = "viewer",
    API_USER = "api_user",
    SCOUT = "scout"
}
export declare enum Permission {
    MINES_READ = "mines:read",
    MINES_WRITE = "mines:write",
    MINES_DELETE = "mines:delete",
    CONVERGENCE_READ = "convergence:read",
    CONVERGENCE_COMPUTE = "convergence:compute",
    USERS_READ = "users:read",
    USERS_WRITE = "users:write",
    USERS_DELETE = "users:delete",
    API_KEYS_READ = "api_keys:read",
    API_KEYS_CREATE = "api_keys:create",
    API_KEYS_REVOKE = "api_keys:revoke",
    INGESTION_TRIGGER = "ingestion:trigger",
    INGESTION_VIEW = "ingestion:view",
    REPORTS_READ = "reports:read",
    REPORTS_SUBMIT = "reports:submit",
    REPORTS_APPROVE = "reports:approve",
    ANALYTICS_VIEW = "analytics:view",
    ANALYTICS_EXPORT = "analytics:export"
}
export declare const ROLE_PERMISSIONS: Record<Role, Permission[]>;
/**
 * Check if a role has a specific permission
 */
export declare function hasPermission(role: Role, permission: Permission): boolean;
/**
 * Check if a user (with multiple roles) has a permission
 */
export declare function userHasPermission(roles: Role[], permission: Permission): boolean;
/**
 * Get all permissions for a set of roles
 */
export declare function getRolePermissions(roles: Role[]): Permission[];
/**
 * Middleware to require a specific permission
 */
export declare function requirePermission(permission: Permission): (req: any, res: any, next: any) => any;
/**
 * Middleware to require any of multiple permissions (OR logic)
 */
export declare function requireAnyPermission(permissions: Permission[]): (req: any, res: any, next: any) => any;
/**
 * Middleware to require all permissions (AND logic)
 */
export declare function requireAllPermissions(permissions: Permission[]): (req: any, res: any, next: any) => any;
//# sourceMappingURL=rbac.d.ts.map