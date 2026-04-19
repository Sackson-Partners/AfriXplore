import { z, ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ─── Validation middleware factory ──────────────────────────────────────────

type RequestPart = 'body' | 'params' | 'query';

export const validate = (schema: ZodSchema, part: RequestPart = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      res.status(400).json({
        type: 'https://afrixplore.io/errors/validation',
        title: 'Validation Error',
        status: 400,
        errors: formatZodErrors(result.error),
        requestId: req.headers['x-request-id'],
      });
      return;
    }

    req[part] = result.data;
    next();
  };
};

export const validateRequest = (schemas: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allErrors: Record<string, string[]> = {};

    for (const [part, schema] of Object.entries(schemas) as [RequestPart, ZodSchema][]) {
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        allErrors[part] = formatZodErrors(result.error);
      } else {
        req[part] = result.data;
      }
    }

    if (Object.keys(allErrors).length > 0) {
      res.status(400).json({
        type: 'https://afrixplore.io/errors/validation',
        title: 'Validation Error',
        status: 400,
        errors: allErrors,
        requestId: req.headers['x-request-id'],
      });
      return;
    }

    next();
  };
};

const formatZodErrors = (error: ZodError): string[] =>
  error.errors.map((e) => `${e.path.join('.') || 'value'}: ${e.message}`);

// ─── Shared AfriXplore schemas ───────────────────────────────────────────────

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// E.164 African phone number
export const AfricanPhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Must be E.164 format: +[country code][number]')
  .refine((phone) => {
    const africanPrefixes = [
      '+20', '+27', '+212', '+213', '+216', '+218',
      '+220', '+221', '+222', '+223', '+224', '+225', '+226', '+227', '+228',
      '+229', '+230', '+231', '+232', '+233', '+234', '+235', '+236', '+237',
      '+238', '+239', '+240', '+241', '+242', '+243', '+244', '+245', '+246',
      '+247', '+248', '+249', '+250', '+251', '+252', '+253', '+254', '+255',
      '+256', '+257', '+258', '+260', '+261', '+262', '+263', '+264', '+265',
      '+266', '+267', '+268', '+269',
    ];
    return africanPrefixes.some((code) => phone.startsWith(code));
  }, 'Phone number must use an African country code');

// Bounding box: "minLon,minLat,maxLon,maxLat"
export const BboxSchema = z
  .string()
  .regex(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/, 'bbox must be: west,south,east,north')
  .refine((bbox) => {
    const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
    return (
      minLon >= -180 && maxLon <= 180 &&
      minLat >= -90 && maxLat <= 90 &&
      minLon < maxLon && minLat < maxLat
    );
  }, 'bbox coordinates out of range or inverted');

// Positive money amount, max 2 decimal places
export const MoneyAmountSchema = z
  .number()
  .positive('Amount must be positive')
  .max(1_000_000, 'Amount exceeds maximum transaction limit')
  .refine((n) => Math.round(n * 100) === n * 100, 'Amount cannot have more than 2 decimal places');

// Supported African currencies
export const CurrencySchema = z.enum(
  ['GHS', 'NGN', 'KES', 'UGX', 'TZS', 'ZAR', 'XOF', 'XAF', 'ETB', 'RWF', 'MWK', 'ZMW', 'MAD', 'EGP', 'DZD', 'TND'],
  { errorMap: () => ({ message: 'Unsupported currency' }) }
);

// UUID param helper
export const UuidParamSchema = (paramName: string) =>
  z.object({ [paramName]: z.string().uuid(`${paramName} must be a valid UUID`) });

export { z };
