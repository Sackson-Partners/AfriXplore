/**
 * @ain/validation — Shared Zod schemas and Express validation middleware.
 * All request validation is centralised here to avoid duplication across services.
 */

import { z, ZodSchema, ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// ── Validation middleware ─────────────────────────────────────────────────────

type RequestPart = 'body' | 'params' | 'query';

/**
 * Express middleware factory for Zod schema validation.
 * Validates the specified part of the request (body/query/params).
 * Returns RFC 7807 Problem Details on failure.
 * Attaches parsed data back to req[source] on success.
 */
export function validate(schema: ZodSchema, source: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(422).json({
        type: 'https://ain.io/errors/validation',
        title: 'Validation Error',
        status: 422,
        detail: formatZodErrors(result.error).join('; '),
        instance: req.path,
        errors: result.error.errors.map((e) => ({
          field: e.path.join('.') || 'value',
          message: e.message,
          code: e.code,
        })),
      });
      return;
    }
    (req as Request & { validated: unknown }).validated = result.data;
    req[source] = result.data as typeof req[typeof source];
    next();
  };
}

function formatZodErrors(error: ZodError): string[] {
  return error.errors.map((e) => `${e.path.join('.') || 'value'}: ${e.message}`);
}

// ── Primitive schemas ─────────────────────────────────────────────────────────

/** UUID v4 string */
export const UUIDSchema = z.string().uuid('Must be a valid UUID v4');

/** UUID path/query parameter factory */
export const UuidParamSchema = (paramName: string) =>
  z.object({ [paramName]: UUIDSchema });

/** Cursor-based pagination */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

/** Bounding box as four separate query parameters */
export const BboxSchema = z.object({
  minLng: z.coerce.number().min(-180).max(180),
  minLat: z.coerce.number().min(-90).max(90),
  maxLng: z.coerce.number().min(-180).max(180),
  maxLat: z.coerce.number().min(-90).max(90),
}).refine(
  (b) => b.minLng < b.maxLng && b.minLat < b.maxLat,
  { message: 'Bounding box coordinates are inverted: minLng must be < maxLng, minLat < maxLat' }
);

/** ISO 3166-1 alpha-2 country code or full name */
export const CountrySchema = z.string().min(2).max(100);

/** Supported African mineral commodities */
export const CommoditySchema = z.enum([
  'copper', 'gold', 'cobalt', 'lithium', 'tin', 'coltan',
  'graphite', 'manganese', 'uranium', 'platinum', 'chrome',
  'nickel', 'wolframite', 'bauxite', 'pgm', 'diamond', 'other',
]);
export type Commodity = z.infer<typeof CommoditySchema>;

// ── Mine schemas ──────────────────────────────────────────────────────────────

/** POST /mines — create a historical mine record */
export const CreateMineSchema = z.object({
  name: z.string().min(2).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  country: z.string().min(2).max(100),
  commodity: z.array(CommoditySchema).min(1, 'At least one commodity is required'),
  hostRock: z.string().max(200).optional(),
  oreGrade: z.string().max(100).optional(),
  miningPeriod: z
    .string()
    .regex(/^\d{4}(-\d{4})?$/, 'Format: 1920 or 1920-1947')
    .optional(),
  closureReason: z.string().max(500).optional(),
  estimatedDepthM: z.number().min(0).max(5000).optional(),
  archiveSource: z.string().max(200).optional(),
  systemId: UUIDSchema.optional(),
  productionStats: z.record(z.unknown()).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
});

/** PATCH /mines/:id — partial update */
export const UpdateMineSchema = CreateMineSchema.partial();

/** GET /mines query parameters */
export const MineQuerySchema = PaginationSchema.extend({
  country: z.string().max(100).optional(),
  commodity: CommoditySchema.optional(),
  systemId: UUIDSchema.optional(),
  digitisationStatus: z.enum(['draft', 'reviewed', 'published']).optional(),
  search: z.string().max(200).optional(),
  minLng: z.coerce.number().min(-180).max(180).optional(),
  minLat: z.coerce.number().min(-90).max(90).optional(),
  maxLng: z.coerce.number().min(-180).max(180).optional(),
  maxLat: z.coerce.number().min(-90).max(90).optional(),
});

// ── System schemas ────────────────────────────────────────────────────────────

/** POST /systems — create a mineral system */
export const CreateSystemSchema = z.object({
  name: z.string().min(2).max(200),
  type: z.enum([
    'VMS', 'IOCG', 'Orogenic_Gold', 'Pegmatite',
    'Porphyry', 'Sediment_Hosted', 'Layered_Intrusion', 'Other',
  ]),
  country: z.array(z.string().min(2)).min(1),
  commodity: z.array(CommoditySchema).min(1),
  heatSource: z.string().max(200).optional(),
  fluidPathway: z.string().max(200).optional(),
  trapMechanism: z.string().max(200).optional(),
  alterationTypes: z.array(z.string()).optional(),
  ageMa: z.number().positive().optional(),
  prospectivityScore: z.number().min(0).max(100).optional(),
});

export const UpdateSystemSchema = CreateSystemSchema.partial();

// ── Export schemas ────────────────────────────────────────────────────────────

/** GET /export/mines query parameters */
export const ExportQuerySchema = z.object({
  format: z.enum(['geojson', 'csv']),
  country: z.string().max(100).optional(),
  commodity: CommoditySchema.optional(),
  minLng: z.coerce.number().min(-180).max(180).optional(),
  minLat: z.coerce.number().min(-90).max(90).optional(),
  maxLng: z.coerce.number().min(-180).max(180).optional(),
  maxLat: z.coerce.number().min(-90).max(90).optional(),
});

/** Subscriber tier enum */
export const SubscriberTierSchema = z.enum([
  'starter', 'professional', 'enterprise', 'government_dfi',
]);

// ── Re-export zod for convenience ────────────────────────────────────────────
export { z };
export type { ZodSchema };
