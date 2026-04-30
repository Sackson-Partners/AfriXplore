/**
 * MTN MoMo API configuration.
 *
 * MTN provides separate hostnames for sandbox and production environments.
 * Set MTN_MOMO_BASE_URL to the production endpoint before go-live.
 * The sandbox default is intentionally blocked in production to prevent
 * accidental test transactions reaching sandbox when live keys are in use.
 */

const SANDBOX_URL = 'https://sandbox.momodeveloper.mtn.com';

export const MTN_MOMO_BASE_URL = process.env.MTN_MOMO_BASE_URL ?? SANDBOX_URL;

export const MTN_MOMO_TARGET_ENV =
  process.env.MTN_MOMO_TARGET_ENVIRONMENT ??
  (process.env.NODE_ENV === 'production' ? 'mtnzambia' : 'sandbox');

/**
 * Call once at startup. Throws if running in production with the sandbox URL
 * still configured — prevents live disbursements hitting the sandbox endpoint.
 */
export function validateMomoConfig(): void {
  if (process.env.NODE_ENV === 'production' && MTN_MOMO_BASE_URL === SANDBOX_URL) {
    throw new Error(
      'MTN_MOMO_BASE_URL must be set to the production endpoint in production. ' +
      'Refusing to start with sandbox URL in production environment.'
    );
  }

  if (process.env.NODE_ENV === 'production' && MTN_MOMO_TARGET_ENV === 'sandbox') {
    throw new Error(
      'MTN_MOMO_TARGET_ENVIRONMENT must not be "sandbox" in production. ' +
      'Set it to the correct MTN production environment (e.g. "mtnzambia").'
    );
  }
}
