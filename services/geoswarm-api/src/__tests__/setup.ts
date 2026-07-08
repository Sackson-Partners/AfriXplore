// Test setup and global mocks

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DEV_BYPASS_AUTH = 'false';
