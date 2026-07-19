"use strict";
/**
 * Role-Based Access Control (RBAC) implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = exports.Permission = exports.Role = void 0;
exports.hasPermission = hasPermission;
exports.userHasPermission = userHasPermission;
exports.getRolePermissions = getRolePermissions;
exports.requirePermission = requirePermission;
exports.requireAnyPermission = requireAnyPermission;
exports.requireAllPermissions = requireAllPermissions;
var Role;
(function (Role) {
    Role["ADMIN"] = "admin";
    Role["ANALYST"] = "analyst";
    Role["VIEWER"] = "viewer";
    Role["API_USER"] = "api_user";
    Role["SCOUT"] = "scout";
})(Role || (exports.Role = Role = {}));
var Permission;
(function (Permission) {
    // Mine permissions
    Permission["MINES_READ"] = "mines:read";
    Permission["MINES_WRITE"] = "mines:write";
    Permission["MINES_DELETE"] = "mines:delete";
    // Convergence permissions
    Permission["CONVERGENCE_READ"] = "convergence:read";
    Permission["CONVERGENCE_COMPUTE"] = "convergence:compute";
    // User management
    Permission["USERS_READ"] = "users:read";
    Permission["USERS_WRITE"] = "users:write";
    Permission["USERS_DELETE"] = "users:delete";
    // API keys
    Permission["API_KEYS_READ"] = "api_keys:read";
    Permission["API_KEYS_CREATE"] = "api_keys:create";
    Permission["API_KEYS_REVOKE"] = "api_keys:revoke";
    // Data ingestion
    Permission["INGESTION_TRIGGER"] = "ingestion:trigger";
    Permission["INGESTION_VIEW"] = "ingestion:view";
    // Scout reports
    Permission["REPORTS_READ"] = "reports:read";
    Permission["REPORTS_SUBMIT"] = "reports:submit";
    Permission["REPORTS_APPROVE"] = "reports:approve";
    // Analytics
    Permission["ANALYTICS_VIEW"] = "analytics:view";
    Permission["ANALYTICS_EXPORT"] = "analytics:export";
})(Permission || (exports.Permission = Permission = {}));
exports.ROLE_PERMISSIONS = {
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
function hasPermission(role, permission) {
    const permissions = exports.ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
}
/**
 * Check if a user (with multiple roles) has a permission
 */
function userHasPermission(roles, permission) {
    return roles.some((role) => hasPermission(role, permission));
}
/**
 * Get all permissions for a set of roles
 */
function getRolePermissions(roles) {
    const allPermissions = new Set();
    roles.forEach((role) => {
        const permissions = exports.ROLE_PERMISSIONS[role] || [];
        permissions.forEach((perm) => allPermissions.add(perm));
    });
    return Array.from(allPermissions);
}
/**
 * Middleware to require a specific permission
 */
function requirePermission(permission) {
    return (req, res, next) => {
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
function requireAnyPermission(permissions) {
    return (req, res, next) => {
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
function requireAllPermissions(permissions) {
    return (req, res, next) => {
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
//# sourceMappingURL=rbac.js.map