/**
 * Entra External ID Phone OTP flow for Scout authentication.
 * Inline copy of @afrixplore/auth OTP functions — allows standalone Docker build.
 */

export interface OTPInitiateResult {
  continuationToken: string;
  codeLength: number;
  allowedResendInterval: number;
}

export async function initiatePhoneOTP(
  phoneNumber: string,
  scoutTenantId: string,
  scoutClientId: string
): Promise<OTPInitiateResult> {
  const response = await fetch(
    `https://${scoutTenantId}.ciamlogin.com/${scoutTenantId}/oauth2/v2.0/initiate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: scoutClientId,
        challenge_type: 'oob',
        username: phoneNumber,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OTP initiation failed: ${error.error_description}`);
  }

  const data = await response.json();
  return {
    continuationToken: data.continuation_token,
    codeLength: data.code_length || 6,
    allowedResendInterval: data.interval || 60,
  };
}

export interface OTPChallengeResult {
  continuationToken: string;
  bindingMethod: string;
}

export async function challengePhoneOTP(
  continuationToken: string,
  scoutTenantId: string,
  scoutClientId: string
): Promise<OTPChallengeResult> {
  const response = await fetch(
    `https://${scoutTenantId}.ciamlogin.com/${scoutTenantId}/oauth2/v2.0/challenge`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: scoutClientId,
        challenge_type: 'oob',
        continuation_token: continuationToken,
      }),
    }
  );

  const data = await response.json();
  return {
    continuationToken: data.continuation_token,
    bindingMethod: data.binding_method,
  };
}

export interface OTPTokenResult {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
  isNewUser: boolean;
}

export async function verifyPhoneOTP(
  otp: string,
  continuationToken: string,
  scoutTenantId: string,
  scoutClientId: string
): Promise<OTPTokenResult> {
  const response = await fetch(
    `https://${scoutTenantId}.ciamlogin.com/${scoutTenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: scoutClientId,
        continuation_token: continuationToken,
        grant_type: 'continuation_token',
        oob: otp,
        scope: `openid profile offline_access api://${scoutClientId}/scout.access`,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OTP verification failed: ${error.error_description}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    expiresIn: data.expires_in,
    isNewUser: data.is_new_user || false,
  };
}
