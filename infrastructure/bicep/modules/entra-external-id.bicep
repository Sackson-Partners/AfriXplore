// NOTE: Entra External ID tenant is provisioned via Azure Portal
// This module registers the app registrations and API permissions
// The tenant itself: ain-scouts.ciamlogin.com (scouts)
//                    ain-platform.ciamlogin.com (B2B)

targetScope = 'subscription'

param environment string
param scoutTenantDomain string = 'afrixplore-scouts'
param platformTenantDomain string = 'afrixplore-platform'

// Scout App Registration
resource scoutAppRegistration 'Microsoft.Graph/applications@v1.0' = {
  displayName: 'AfriXplore Scout App - ${environment}'
  signInAudience: 'AzureADandPersonalMicrosoftAccount'
  publicClient: {
    redirectUris: [
      'msauth://io.afrixplore.scout/callback'
      'exp://localhost:8081'
      'io.afrixplore.scout://auth'
    ]
  }
  requiredResourceAccess: [
    {
      resourceAppId: '00000003-0000-0000-c000-000000000000'
      resourceAccess: [
        {
          id: 'e1fe6dd8-ba31-4d61-89e7-88639da4683d'
          type: 'Scope'
        }
      ]
    }
  ]
  optionalClaims: {
    accessToken: [
      {
        name: 'phone_number'
        essential: true
      }
      {
        name: 'country'
        essential: false
      }
    ]
  }
}

// B2B Platform App Registration
resource platformAppRegistration 'Microsoft.Graph/applications@v1.0' = {
  displayName: 'AfriXplore Platform - ${environment}'
  signInAudience: 'AzureADMultipleOrgs'
  web: {
    redirectUris: [
      'https://platform.afrixplore.io/auth/callback'
      'https://staging.platform.afrixplore.io/auth/callback'
      'http://localhost:3005/auth/callback'
    ]
    implicitGrantSettings: {
      enableAccessTokenIssuance: false
      enableIdTokenIssuance: true
    }
  }
  api: {
    oauth2PermissionScopes: [
      {
        id: '12345678-0000-0000-0000-000000000001'
        adminConsentDescription: 'Access AfriXplore intelligence data'
        adminConsentDisplayName: 'Access AfriXplore API'
        userConsentDescription: 'Access AfriXplore intelligence data'
        userConsentDisplayName: 'Access AfriXplore API'
        isEnabled: true
        type: 'User'
        value: 'access_as_user'
      }
    ]
  }
}
