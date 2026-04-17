import { Configuration } from '@azure/msal-node';

export function msalNodeConfig(tenantId: string, clientId: string, clientSecret: string): Configuration {
  return {
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  };
}
