/**
 * MTN MoMo config validation tests.
 *
 * Because MTN_MOMO_BASE_URL and MTN_MOMO_TARGET_ENV are module-level constants
 * (evaluated once at import time), each test uses jest.isolateModules() +
 * dynamic require() so env vars are read fresh per scenario.
 */

const SANDBOX_URL = 'https://sandbox.momodeveloper.mtn.com';
const PRODUCTION_URL = 'https://proxy.momoapi.mtn.com';

function loadMomo() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../config/momo') as {
    validateMomoConfig: () => void;
    MTN_MOMO_BASE_URL: string;
    MTN_MOMO_TARGET_ENV: string;
  };
}

beforeEach(() => {
  jest.resetModules();
  delete process.env.MTN_MOMO_BASE_URL;
  delete process.env.MTN_MOMO_TARGET_ENVIRONMENT;
});

afterEach(() => {
  delete process.env.NODE_ENV;
  delete process.env.MTN_MOMO_BASE_URL;
  delete process.env.MTN_MOMO_TARGET_ENVIRONMENT;
});

describe('validateMomoConfig — production guards', () => {
  it('throws when sandbox URL is still set in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.MTN_MOMO_BASE_URL = SANDBOX_URL;

    jest.isolateModules(() => {
      const { validateMomoConfig } = loadMomo();
      expect(() => validateMomoConfig()).toThrow(
        'MTN_MOMO_BASE_URL must be set to the production endpoint in production'
      );
    });
  });

  it('throws when TARGET_ENVIRONMENT is "sandbox" in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.MTN_MOMO_BASE_URL = PRODUCTION_URL;
    process.env.MTN_MOMO_TARGET_ENVIRONMENT = 'sandbox';

    jest.isolateModules(() => {
      const { validateMomoConfig } = loadMomo();
      expect(() => validateMomoConfig()).toThrow(
        'MTN_MOMO_TARGET_ENVIRONMENT must not be "sandbox" in production'
      );
    });
  });

  it('passes with a production URL and non-sandbox TARGET_ENVIRONMENT in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.MTN_MOMO_BASE_URL = PRODUCTION_URL;
    process.env.MTN_MOMO_TARGET_ENVIRONMENT = 'mtnzambia';

    jest.isolateModules(() => {
      const { validateMomoConfig } = loadMomo();
      expect(() => validateMomoConfig()).not.toThrow();
    });
  });
});

describe('validateMomoConfig — non-production', () => {
  it('passes in development even with sandbox URL (default)', () => {
    process.env.NODE_ENV = 'development';
    // No overrides — module defaults to sandbox URL

    jest.isolateModules(() => {
      const { validateMomoConfig } = loadMomo();
      expect(() => validateMomoConfig()).not.toThrow();
    });
  });

  it('passes in test environment with sandbox URL', () => {
    process.env.NODE_ENV = 'test';
    process.env.MTN_MOMO_BASE_URL = SANDBOX_URL;

    jest.isolateModules(() => {
      const { validateMomoConfig } = loadMomo();
      expect(() => validateMomoConfig()).not.toThrow();
    });
  });
});

describe('MTN_MOMO_BASE_URL constant', () => {
  it('defaults to sandbox URL when env var is absent', () => {
    process.env.NODE_ENV = 'development';

    jest.isolateModules(() => {
      const { MTN_MOMO_BASE_URL } = loadMomo();
      expect(MTN_MOMO_BASE_URL).toBe(SANDBOX_URL);
    });
  });

  it('uses env var when set', () => {
    process.env.MTN_MOMO_BASE_URL = PRODUCTION_URL;

    jest.isolateModules(() => {
      const { MTN_MOMO_BASE_URL } = loadMomo();
      expect(MTN_MOMO_BASE_URL).toBe(PRODUCTION_URL);
    });
  });
});

describe('MTN_MOMO_TARGET_ENV constant', () => {
  it('defaults to "sandbox" in development', () => {
    process.env.NODE_ENV = 'development';

    jest.isolateModules(() => {
      const { MTN_MOMO_TARGET_ENV } = loadMomo();
      expect(MTN_MOMO_TARGET_ENV).toBe('sandbox');
    });
  });

  it('defaults to "mtnzambia" in production when env var is absent', () => {
    process.env.NODE_ENV = 'production';

    jest.isolateModules(() => {
      const { MTN_MOMO_TARGET_ENV } = loadMomo();
      expect(MTN_MOMO_TARGET_ENV).toBe('mtnzambia');
    });
  });

  it('uses MTN_MOMO_TARGET_ENVIRONMENT env var when set', () => {
    process.env.NODE_ENV = 'production';
    process.env.MTN_MOMO_TARGET_ENVIRONMENT = 'mtnghana';

    jest.isolateModules(() => {
      const { MTN_MOMO_TARGET_ENV } = loadMomo();
      expect(MTN_MOMO_TARGET_ENV).toBe('mtnghana');
    });
  });
});
