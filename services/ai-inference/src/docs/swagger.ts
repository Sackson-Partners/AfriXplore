import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AfriXplore AI Inference Service',
      version: '1.0.0',
      description: 'Azure Custom Vision mineral identification — health and inference status',
    },
    servers: [
      { url: 'http://localhost:3005', description: 'Local' },
      { url: 'https://ai-inference-staging.afrixplore.io', description: 'Staging' },
    ],
    components: {
      schemas: {
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            service: { type: 'string', example: 'ai-inference' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  apis: ['./src/index.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
