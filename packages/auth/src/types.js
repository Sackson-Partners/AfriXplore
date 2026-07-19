"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidTokenError = exports.TokenExpiredError = void 0;
class TokenExpiredError extends Error {
    constructor() {
        super('Token has expired');
        this.name = 'TokenExpiredError';
    }
}
exports.TokenExpiredError = TokenExpiredError;
class InvalidTokenError extends Error {
    constructor(detail) {
        super(detail ? `Invalid token: ${detail}` : 'Invalid token');
        this.name = 'InvalidTokenError';
    }
}
exports.InvalidTokenError = InvalidTokenError;
//# sourceMappingURL=types.js.map