import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AfriXplore Scout API',
      version: '1.0.0',
      description: 'Scout onboarding, field reports, image upload, and USSD integration',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local' },
      { url: 'https://scout-api-staging.afrixplore.io', description: 'Staging' },
      { url: 'https://scout-api.afrixplore.io', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Azure AD CIAM JWT (ENTRA_SCOUT_CLIENT_ID)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'https://afrixplore.io/errors/unauthorized' },
            status: { type: 'integer', example: 401 },
            detail: { type: 'string' },
          },
        },
        Scout: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            phone: { type: 'string', example: '+233XXXXXXXXX' },
            full_name: { type: 'string', example: 'Kofi Mensah' },
            status: { type: 'string', enum: ['pending', 'active', 'suspended'] },
            country: { type: 'string', example: 'GH' },
            total_earnings_usd: { type: 'number', example: 12.50 },
            quality_score: { type: 'number', example: 87.3 },
            badge_level: { type: 'string', enum: ['bronze', 'silver', 'gold', 'platinum'] },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ['./src/routes/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
