param serverName string
param location string
param environment string
param keyVaultName string

@secure()
param administratorPassword string = newGuid()

var administratorLogin = 'afrixploreAdmin'
var skuName = environment == 'production' ? 'Standard_D4s_v3' : 'Standard_B1ms'
var skuTier = environment == 'production' ? 'GeneralPurpose' : 'Burstable'
var storageSizeGB = environment == 'production' ? 128 : 32

resource postgresql 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: serverName
  location: location
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    version: '16'
    storage: {
      storageSizeGB: storageSizeGB
    }
    backup: {
      backupRetentionDays: environment == 'production' ? 35 : 7
      geoRedundantBackup: environment == 'production' ? 'Enabled' : 'Disabled'
    }
    highAvailability: {
      mode: environment == 'production' ? 'ZoneRedundant' : 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
  }
  tags: {
    environment: environment
    project: 'afrixplore'
  }
}

// Allow all Azure services (remove in production, use private endpoint instead)
resource firewallAllowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: postgresql
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource dbPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'postgresql-admin-password'
  properties: {
    value: administratorPassword
  }
}

resource dbConnectionSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'postgresql-connection-string'
  properties: {
    value: 'postgresql://${administratorLogin}:${administratorPassword}@${postgresql.properties.fullyQualifiedDomainName}:5432/afrixplore?sslmode=require'
  }
}

output name string = postgresql.name
output fqdn string = postgresql.properties.fullyQualifiedDomainName
output resourceId string = postgresql.id
