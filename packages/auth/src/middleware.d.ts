import { Request, Response, NextFunction } from 'express';
import { DecodedToken } from './types.js';
declare global {
    namespace Express {
        interface Request {
            user?: DecodedToken;
        }
    }
}
export declare function requireAuth(req: Request, res: Response, next: NextFunction): void;
export declare function requireRole(...roles: string[]): (req: Request, res: Response, next: NextFunction) => void;
export declare function requireTier(...tiers: string[]): (req: Request, res: Response, next: NextFunction) => void;
export declare function requireActiveSubscription(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=middleware.d.ts.map