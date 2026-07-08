import { Request, Response, NextFunction } from 'express';
import validator from 'validator';

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';

  // Escape HTML entities
  return validator.escape(input.trim());
}

/**
 * Validate and sanitize email
 */
export function validateEmail(email: string): { valid: boolean; sanitized: string } {
  const trimmed = email.trim().toLowerCase();
  return {
    valid: validator.isEmail(trimmed),
    sanitized: validator.normalizeEmail(trimmed) || trimmed,
  };
}

/**
 * Validate UUID
 */
export function validateUUID(id: string): boolean {
  return validator.isUUID(id);
}

/**
 * Validate coordinate
 */
export function validateCoordinate(coord: number, type: 'lat' | 'lon'): boolean {
  if (typeof coord !== 'number' || isNaN(coord)) return false;

  if (type === 'lat') {
    return coord >= -90 && coord <= 90;
  } else {
    return coord >= -180 && coord <= 180;
  }
}

/**
 * Validate pagination parameters
 */
export function validatePagination(params: { page?: any; page_size?: any }): {
  page: number;
  pageSize: number;
  errors: string[];
} {
  const errors: string[] = [];
  let page = 1;
  let pageSize = 20;

  if (params.page !== undefined) {
    const parsedPage = parseInt(params.page, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      errors.push('Page must be a positive integer');
    } else if (parsedPage > 10000) {
      errors.push('Page number too large (max: 10000)');
    } else {
      page = parsedPage;
    }
  }

  if (params.page_size !== undefined) {
    const parsedSize = parseInt(params.page_size, 10);
    if (isNaN(parsedSize) || parsedSize < 1) {
      errors.push('Page size must be a positive integer');
    } else if (parsedSize > 200) {
      errors.push('Page size too large (max: 200)');
    } else {
      pageSize = parsedSize;
    }
  }

  return { page, pageSize, errors };
}

/**
 * SQL injection prevention - validate table/column names
 */
export function validateSQLIdentifier(identifier: string): boolean {
  // Only allow alphanumeric and underscore
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
}

/**
 * Middleware to validate request body against schema
 */
export function validateBody(schema: {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'uuid';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    enum?: any[];
  };
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      // Check required
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      // Skip validation if not required and not provided
      if (!rules.required && (value === undefined || value === null)) {
        continue;
      }

      // Type validation
      switch (rules.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`${field} must be a string`);
          } else {
            if (rules.minLength && value.length < rules.minLength) {
              errors.push(`${field} must be at least ${rules.minLength} characters`);
            }
            if (rules.maxLength && value.length > rules.maxLength) {
              errors.push(`${field} must be at most ${rules.maxLength} characters`);
            }
            // Sanitize string
            req.body[field] = sanitizeString(value);
          }
          break;

        case 'email':
          const emailValidation = validateEmail(value);
          if (!emailValidation.valid) {
            errors.push(`${field} must be a valid email`);
          } else {
            req.body[field] = emailValidation.sanitized;
          }
          break;

        case 'uuid':
          if (!validateUUID(value)) {
            errors.push(`${field} must be a valid UUID`);
          }
          break;

        case 'number':
          const num = Number(value);
          if (isNaN(num)) {
            errors.push(`${field} must be a number`);
          } else {
            if (rules.min !== undefined && num < rules.min) {
              errors.push(`${field} must be at least ${rules.min}`);
            }
            if (rules.max !== undefined && num > rules.max) {
              errors.push(`${field} must be at most ${rules.max}`);
            }
            req.body[field] = num;
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`${field} must be a boolean`);
          }
          break;

        case 'array':
          if (!Array.isArray(value)) {
            errors.push(`${field} must be an array`);
          }
          break;

        case 'object':
          if (typeof value !== 'object' || Array.isArray(value)) {
            errors.push(`${field} must be an object`);
          }
          break;
      }

      // Enum validation
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }

    next();
  };
}

/**
 * Validate query parameters
 */
export function validateQuery(schema: { [key: string]: any }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.query[field];

      if (rules.required && !value) {
        errors.push(`${field} is required`);
        continue;
      }

      if (!value) continue;

      // Type-specific validation
      if (rules.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`${field} must be a number`);
        }
      }

      if (rules.type === 'uuid' && !validateUUID(value as string)) {
        errors.push(`${field} must be a valid UUID`);
      }

      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: errors,
      });
    }

    next();
  };
}
