import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AfriXplore MSIM API',
      version: '1.0.0',
      description: 'Mineral Systems Intelligence Model — prospectivity and boundary data',
    },
    servers: [
      { url: 'http://localhost:3004', description: 'Local' },
      { url: 'https://msim-api-staging.afrixplore.io', description: 'Staging' },
      { url: 'https://msim-api.afrixplore.io', description: 'Production' },
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
        MineralSystem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Birimian Greenstone Belt' },
            type: { type: 'string', example: 'orogenic_gold' },
            age_ma: { type: 'number', example: 2100 },
            prospectivity_score: { type: 'number', example: 91.2 },
            known_deposits: { type: 'integer', example: 47 },
            boundary_geojson: { type: 'object', description: 'GeoJSON Polygon/MultiPolygon' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ['./src/routes/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
