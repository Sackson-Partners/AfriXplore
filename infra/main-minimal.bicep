// AIN Platform - Minimal Production Infrastructure (without Azure OpenAI)
// Deploy core infrastructure first, add AI services later

@description('Environment')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'prod'

@description('Azure region')
param location string = resourceGroup().location

@description('PostgreSQL admin password')
@secure()
param postgresAdminPassword string

@description('Entra tenant ID')
param entraExternalTenantId string

@description('Entra client ID')
param entraClientId string

var acrName = 'cracaindev' // Using existing dev ACR
var kvName = 'kv-ain-${environment}'
var pgServerName = 'psql-ain-${environment}'
var searchName = 'srch-ain-${environment}'
var containerAppEnvName = 'cae-ain-${environment}'
var logWorkspaceName = 'log-ain-${environment}'

// Log Analytics
resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logWorkspaceName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

// PostgreSQL
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: pgServerName
  location: location
  sku: {
    name: 'Standard_D2s_v3'
    tier: 'GeneralPurpose'
  }
  properties: {
    version: '16'
    administratorLogin: 'ainuser'
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 128
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: environment == 'prod' ? 'Enabled' : 'Disabled'
    }
    highAvailability: {
      mode: environment == 'prod' ? 'ZoneRedundant' : 'Disabled'
    }
  }
}

resource ainDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgres
  name: 'ain'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource pgFirewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Container Apps Environment
resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logWorkspace.properties.customerId
        sharedKey: logWorkspace.listKeys().primarySharedKey
      }
    }
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-ain-${environment}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logWorkspace.id
  }
}

// Managed Identity for Container Apps
resource msimApiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-msim-api-${environment}'
  location: location
}

// Grant Key Vault access to managed identity
resource kvSecretsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, msimApiIdentity.id, 'kvsecrets')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: msimApiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Outputs
output containerAppEnvId string = containerAppEnv.id
output keyVaultUri string = keyVault.properties.vaultUri
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output appInsightsConnectionString string = appInsights.properties.ConnectionString
