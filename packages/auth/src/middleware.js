"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
exports.requireTier = requireTier;
exports.requireActiveSubscription = requireActiveSubscription;
const verify_js_1 = require("./verify.js");
const types_js_1 = require("./types.js");
const config_1 = require("@ain/config");
function unauthorized(res, detail) {
    res.status(401).json({
        type: 'https://ain.example.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail,
    });
}
function forbidden(res, detail) {
    res.status(403).json({
        type: 'https://ain.example.com/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail,
    });
}
function requireAuth(req, res, next) {
    // Dev bypass: Use feature flags module for safe auth bypass in local development
    if (config_1.featureFlags.bypassAuth()) {
        req.user = { sub: 'dev', roles: ['admin'], email: 'dev@local' };
        next();
        return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        unauthorized(res, 'Authorization header is required');
        return;
    }
    (0, verify_js_1.verifyToken)(authHeader)
        .then((decoded) => {
        req.user = decoded;
        next();
    })
        .catch((err) => {
        if (err instanceof types_js_1.TokenExpiredError) {
            unauthorized(res, 'Token has expired');
        }
        else if (err instanceof types_js_1.InvalidTokenError) {
            unauthorized(res, err.message);
        }
        else {
            unauthorized(res, 'Authentication failed');
        }
    });
}
function requireRole(...roles) {
    return (req, res, next) => {
        const userRoles = req.user?.roles ?? [];
        const hasRole = roles.some((r) => userRoles.includes(r));
        if (!hasRole) {
            forbidden(res, `Requires one of roles: ${roles.join(', ')}`);
            return;
        }
        next();
    };
}
function requireTier(...tiers) {
    return (req, res, next) => {
        if (config_1.featureFlags.bypassAuth()) {
            next();
            return;
        }
        const tier = req.user?.extension_tier;
        if (!tier || !tiers.includes(tier)) {
            forbidden(res, `Requires subscription tier: ${tiers.join(' or ')}`);
            return;
        }
        next();
    };
}
function requireActiveSubscription(req, res, next) {
    if (!req.user?.extension_subscription_active) {
        forbidden(res, 'An active subscription is required');
        return;
    }
    next();
}
//# sourceMappingURL=middleware.js.map