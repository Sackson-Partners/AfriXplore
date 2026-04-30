import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AfriXplore Payment Service',
      version: '1.0.0',
      description: 'Scout finder-fee disbursements via Stripe, MTN MoMo, M-Pesa, and Flutterwave',
    },
    servers: [
      { url: 'http://localhost:3003', description: 'Local' },
      { url: 'https://payment-service-staging.afrixplore.io', description: 'Staging' },
      { url: 'https://payment-service.afrixplore.io', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Microsoft Entra ID JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            status: { type: 'integer' },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['finder_fee', 'bonus', 'adjustment'] },
            amount_usd: { type: 'number', example: 5.00 },
            provider: { type: 'string', example: 'mtn_momo' },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
            initiated_at: { type: 'string', format: 'date-time' },
            completed_at: { type: 'string', format: 'date-time', nullable: true },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ['./src/routes/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
