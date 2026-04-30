import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AfriXplore Intelligence API',
      version: '1.0.0',
      description: 'Mineral anomaly clusters, exploration targets, and geospatial intelligence',
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Local' },
      { url: 'https://intelligence-api-staging.afrixplore.io', description: 'Staging' },
      { url: 'https://intelligence-api.afrixplore.io', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Microsoft Entra ID JWT (audience: ENTRA_CLIENT_ID)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'https://afrixplore.io/errors/unauthorized' },
            status: { type: 'integer', example: 401 },
            detail: { type: 'string', example: 'jwt expired' },
          },
        },
        AnomalyCluster: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            centroid: { type: 'object', description: 'GeoJSON Point' },
            dominant_mineral: { type: 'string', example: 'gold' },
            report_count: { type: 'integer', example: 12 },
            dpi_score: { type: 'number', example: 78.5 },
            country: { type: 'string', example: 'GH' },
            last_updated: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ['./src/routes/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
