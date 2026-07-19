"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
const types_js_1 = require("./types.js");
const JWKS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let client = null;
function getJwksClient() {
    if (client)
        return client;
    const tenantId = process.env.AZURE_ENTRA_TENANT_ID;
    if (!tenantId)
        throw new types_js_1.InvalidTokenError('AZURE_ENTRA_TENANT_ID not configured');
    client = (0, jwks_rsa_1.default)({
        jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
        cache: true,
        cacheMaxEntries: 10,
        cacheMaxAge: JWKS_CACHE_TTL_MS,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
    });
    return client;
}
async function getSigningKey(header) {
    if (!header.kid)
        throw new types_js_1.InvalidTokenError('Missing kid in token header');
    const key = await getJwksClient().getSigningKey(header.kid);
    return key.getPublicKey();
}
async function verifyToken(bearerToken) {
    const token = bearerToken.startsWith('Bearer ') ? bearerToken.slice(7) : bearerToken;
    const clientId = process.env.AZURE_ENTRA_CLIENT_ID;
    const tenantId = process.env.AZURE_ENTRA_TENANT_ID;
    if (!clientId || !tenantId) {
        throw new types_js_1.InvalidTokenError('Entra credentials not configured');
    }
    return new Promise((resolve, reject) => {
        jsonwebtoken_1.default.verify(token, (header, callback) => {
            getSigningKey(header)
                .then((key) => callback(null, key))
                .catch((err) => callback(err));
        }, {
            audience: clientId,
            issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
            algorithms: ['RS256'],
        }, (err, decoded) => {
            if (err) {
                if (err.name === 'TokenExpiredError') {
                    reject(new types_js_1.TokenExpiredError());
                }
                else {
                    reject(new types_js_1.InvalidTokenError(err.message));
                }
                return;
            }
            resolve(decoded);
        });
    });
}
//# sourceMappingURL=verify.js.map