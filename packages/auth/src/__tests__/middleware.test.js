"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const middleware_1 = require("../middleware");
// Mock @ain/config feature flags
jest.mock('@ain/config', () => ({
    featureFlags: {
        bypassAuth: jest.fn(() => false),
    },
}));
// Mock verify module
jest.mock('../verify', () => ({
    verifyToken: jest.fn(),
    InvalidTokenError: class InvalidTokenError extends Error {
        constructor(message) {
            super(message);
            this.name = 'InvalidTokenError';
        }
    },
    TokenExpiredError: class TokenExpiredError extends Error {
        constructor(message) {
            super(message);
            this.name = 'TokenExpiredError';
        }
    },
}));
const verify_1 = require("../verify");
const config_1 = require("@ain/config");
const mockVerifyToken = verify_1.verifyToken;
const mockBypassAuth = config_1.featureFlags.bypassAuth;
describe('requireAuth middleware', () => {
    let req;
    let res;
    let next;
    let jsonMock;
    let statusMock;
    beforeEach(() => {
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        req = {
            headers: {},
        };
        res = {
            status: statusMock,
        };
        next = jest.fn();
        jest.clearAllMocks();
        mockBypassAuth.mockReturnValue(false);
    });
    it('should bypass auth when feature flag is enabled', () => {
        mockBypassAuth.mockReturnValue(true);
        (0, middleware_1.requireAuth)(req, res, next);
        expect(req.user).toEqual({ sub: 'dev', roles: ['admin'], email: 'dev@local' });
        expect(next).toHaveBeenCalledWith();
        expect(mockVerifyToken).not.toHaveBeenCalled();
    });
    it('should return 401 when Authorization header is missing', () => {
        (0, middleware_1.requireAuth)(req, res, next);
        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
            type: 'https://ain.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authorization header is required',
        });
        expect(next).not.toHaveBeenCalled();
    });
    it('should set req.user and call next when token is valid', async () => {
        const mockToken = {
            sub: 'user-123',
            roles: ['subscriber'],
            email: 'user@example.com',
            extension_tier: 'pro',
            extension_subscription_active: true,
        };
        req.headers = { authorization: 'Bearer valid-token' };
        mockVerifyToken.mockResolvedValue(mockToken);
        (0, middleware_1.requireAuth)(req, res, next);
        // Wait for promise to resolve
        await new Promise(process.nextTick);
        expect(mockVerifyToken).toHaveBeenCalledWith('Bearer valid-token');
        expect(req.user).toEqual(mockToken);
        expect(next).toHaveBeenCalledWith();
    });
    it('should return 401 when token is expired', async () => {
        req.headers = { authorization: 'Bearer expired-token' };
        mockVerifyToken.mockRejectedValue(new verify_1.TokenExpiredError('Token expired'));
        (0, middleware_1.requireAuth)(req, res, next);
        await new Promise(process.nextTick);
        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
            type: 'https://ain.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Token has expired',
        });
    });
    it('should return 401 when token is invalid', async () => {
        req.headers = { authorization: 'Bearer invalid-token' };
        mockVerifyToken.mockRejectedValue(new verify_1.InvalidTokenError('Invalid signature'));
        (0, middleware_1.requireAuth)(req, res, next);
        await new Promise(process.nextTick);
        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
            type: 'https://ain.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Invalid signature',
        });
    });
    it('should return 401 for generic authentication errors', async () => {
        req.headers = { authorization: 'Bearer token' };
        mockVerifyToken.mockRejectedValue(new Error('Network error'));
        (0, middleware_1.requireAuth)(req, res, next);
        await new Promise(process.nextTick);
        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
            type: 'https://ain.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication failed',
        });
    });
});
describe('requireRole middleware', () => {
    let req;
    let res;
    let next;
    let jsonMock;
    let statusMock;
    beforeEach(() => {
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        req = {
            user: {
                sub: 'user-123',
                roles: ['subscriber'],
                email: 'user@example.com',
            },
        };
        res = {
            status: statusMock,
        };
        next = jest.fn();
        jest.clearAllMocks();
    });
    it('should call next when user has required role', () => {
        const middleware = (0, middleware_1.requireRole)('subscriber');
        middleware(req, res, next);
        expect(next).toHaveBeenCalledWith();
        expect(statusMock).not.toHaveBeenCalled();
    });
    it('should call next when user has one of multiple required roles', () => {
        const middleware = (0, middleware_1.requireRole)('admin', 'subscriber');
        middleware(req, res, next);
        expect(next).toHaveBeenCalledWith();
    });
    it('should return 403 when user lacks required role', () => {
        const middleware = (0, middleware_1.requireRole)('admin');
        middleware(req, res, next);
        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
            type: 'https://ain.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'Requires one of roles: admin',
        });
        expect(next).not.toHaveBeenCalled();
    });
    it('should return 403 when user has no roles', () => {
        req.user = { sub: 'user-123', roles: [], email: 'user@example.com' };
        const middleware = (0, middleware_1.requireRole)('subscriber');
        middleware(req, res, next);
        expect(statusMock).toHaveBeenCalledWith(403);
    });
    it('should return 403 when req.user is undefined', () => {
        req.user = undefined;
        const middleware = (0, middleware_1.requireRole)('subscriber');
        middleware(req, res, next);
        expect(statusMock).toHaveBeenCalledWith(403);
    });
});
describe('requireTier middleware', () => {
    let req;
    let res;
    let next;
    let jsonMock;
    let statusMock;
    beforeEach(() => {
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        req = {
            user: {
                sub: 'user-123',
                roles: ['subscriber'],
                email: 'user@example.com',
                extension_tier: 'pro',
            },
        };
        res = {
            status: statusMock,
        };
        next = jest.fn();
        jest.clearAllMocks();
        mockBypassAuth.mockReturnValue(false);
    });
    it('should bypass tier check when auth bypass is enabled', () => {
        mockBypassAuth.mockReturnValue(true);
        const middleware = (0, middleware_1.requireTier)('enterprise');
        middleware(req, res, next);
        expect(next).toHaveBeenCalledWith();
        expect(statusMock).not.toHaveBeenCalled();
    });
    it('should call next when user has required tier', () => {
        const middleware = (0, middleware_1.requireTier)('pro');
        middleware(req, res, next);
        expect(next).toHaveBeenCalledWith();
    });
    it('should call next when user has one of multiple required tiers', () => {
        const middleware = (0, middleware_1.requireTier)('pro', 'enterprise');
        middleware(req, res, next);
        expect(next).toHaveBeenCalledWith();
    });
    it('should return 403 when user lacks required tier', () => {
        const middleware = (0, middleware_1.requireTier)('enterprise');
        middleware(req, res, next);
        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
            type: 'https://ain.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'Requires subscription tier: enterprise',
        });
    });
    it('should return 403 when user has no tier', () => {
        req.user = { sub: 'user-123', roles: ['subscriber'], email: 'user@example.com' };
        const middleware = (0, middleware_1.requireTier)('pro');
        middleware(req, res, next);
        expect(statusMock).toHaveBeenCalledWith(403);
    });
});
//# sourceMappingURL=middleware.test.js.map