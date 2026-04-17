param name string
param location string
param environment string

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: environment == 'production' ? 90 : 7
    enablePurgeProtection: environment == 'production' ? true : null
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
  tags: {
    environment: environment
    project: 'afrixplore'
    managedBy: 'bicep'
  }
}

output name string = keyVault.name
output vaultUri string = keyVault.properties.vaultUri
output keyVaultId string = keyVault.id
