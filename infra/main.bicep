// AIN MSIM Platform — Azure Infrastructure
// Deploys: ACR, Container Apps Environment, msim-api Container App,
//          Azure Database for PostgreSQL Flexible Server, Key Vault, AI Search
//
// Usage:
//   az deployment group create \
//     --resource-group rg-ain-dev \
//     --template-file infra/main.bicep \
//     --parameters @infra/parameters.dev.json

@description('Deployment environment (dev | staging | prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Entra External ID tenant ID')
param entraExternalTenantId string

@description('Entra External ID client ID for msim-api')
param entraClientId string

@description('PostgreSQL admin password (stored in Key Vault after provisioning)')
@secure()
param postgresAdminPassword string

@description('Mapbox token for platform-web (stored in Key Vault)')
@secure()
param mapboxToken string = ''

var prefix = 'ain-${environment}'
var acrName = 'cracain${environment}'
var kvName = 'kv-ain-${environment}'
var pgServerName = 'psql-ain-${environment}'
var searchName = 'srch-ain-${environment}'
var containerAppEnvName = 'cae-ain-${environment}'
var logWorkspaceName = 'log-ain-${environment}'

// ── Log Analytics Workspace ───────────────────────────────────────────────────
resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logWorkspaceName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ── Azure Container Registry ──────────────────────────────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: acrName
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

// ── Key Vault ─────────────────────────────────────────────────────────────────
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enabledForDeployment: false
    enabledForTemplateDeployment: false
  }
}

// Store postgres connection string in Key Vault
resource pgConnStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ain-postgresql-connection-string'
  properties: {
    value: 'postgresql://ainuser:${postgresAdminPassword}@${pgServerName}.postgres.database.azure.com/ain?sslmode=require'
  }
}

// Store mapbox token if provided
resource mapboxSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(mapboxToken)) {
  parent: keyVault
  name: 'ain-mapbox-token'
  properties: {
    value: mapboxToken
  }
}

// ── PostgreSQL Flexible Server ────────────────────────────────────────────────
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: pgServerName
  location: location
  sku: {
    name: 'Standard_B2ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: 'ainuser'
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: environment == 'prod' ? 'Enabled' : 'Disabled'
    }
    highAvailability: {
      mode: environment == 'prod' ? 'ZoneRedundant' : 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
  }
}

// Enable PostGIS extension
resource postgresConfig 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = {
  parent: postgres
  name: 'azure.extensions'
  properties: {
    value: 'POSTGIS,POSTGIS_TOPOLOGY,UUID-OSSP'
    source: 'user-override'
  }
}

// Create ain database
resource ainDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgres
  name: 'ain'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Firewall rule — allow Azure services
resource pgFirewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ── AI Search ─────────────────────────────────────────────────────────────────
resource search 'Microsoft.Search/searchServices@2023-11-01' = {
  name: searchName
  location: location
  sku: { name: 'basic' }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
    publicNetworkAccess: 'enabled'
    authOptions: {
      apiKeyOnly: {}
    }
  }
}

// ── Container Apps Environment ────────────────────────────────────────────────
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

// ── User-Assigned Managed Identity for Container Apps ─────────────────────────
resource msimApiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-msim-api-${environment}'
  location: location
}

// Grant identity ACR pull rights
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, msimApiIdentity.id, 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: msimApiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant identity Key Vault Secrets User
resource kvSecretsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, msimApiIdentity.id, 'kvsecrets')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: msimApiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── msim-api Container App ────────────────────────────────────────────────────
resource msimApiApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-msim-api-${environment}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${msimApiIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      activeRevisionsMode: 'Multiple'
      ingress: {
        external: true
        targetPort: 3002
        transport: 'http'
        corsPolicy: {
          allowedOrigins: ['https://admin-ain-${environment}.azurewebsites.net', 'https://platform-ain-${environment}.azurewebsites.net']
          allowedMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
          allowedHeaders: ['Authorization', 'Content-Type']
        }
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: msimApiIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'msim-api'
          image: '${acr.properties.loginServer}/msim-api:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'MSIM_API_PORT', value: '3002' }
            { name: 'AZURE_KEY_VAULT_URL', value: keyVault.properties.vaultUri }
            { name: 'AZURE_ENTRA_TENANT_ID', value: entraExternalTenantId }
            { name: 'AZURE_ENTRA_CLIENT_ID', value: entraClientId }
            { name: 'AZURE_AI_SEARCH_ENDPOINT', value: 'https://${searchName}.search.windows.net' }
            { name: 'AZURE_AI_SEARCH_INDEX_NAME', value: 'mines-index' }
            { name: 'ALLOWED_ORIGINS', value: 'https://admin-ain-${environment}.azurewebsites.net,https://platform-ain-${environment}.azurewebsites.net' }
            // Secrets loaded from Key Vault at runtime via @ain/config
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health/live', port: 3002 }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: { path: '/health/ready', port: 3002 }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: environment == 'prod' ? 2 : 1
        maxReplicas: environment == 'prod' ? 10 : 3
        rules: [
          {
            name: 'http-scale'
            http: { metadata: { concurrentRequests: '50' } }
          }
        ]
      }
    }
  }
  dependsOn: [acrPullRole, kvSecretsRole]
}

// ── DB Migration Job ──────────────────────────────────────────────────────────
resource dbMigrateJob 'Microsoft.App/jobs@2024-03-01' = {
  name: 'ca-db-migrate-${environment}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${msimApiIdentity.id}': {}
    }
  }
  properties: {
    environmentId: containerAppEnv.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 300
      replicaRetryLimit: 1
      registries: [
        {
          server: acr.properties.loginServer
          identity: msimApiIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'db-migrate'
          image: '${acr.properties.loginServer}/msim-api:latest'
          command: ['node', 'services/msim-api/dist/scripts/migrate.js']
          resources: { cpu: json('0.25'), memory: '512Mi' }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'AZURE_KEY_VAULT_URL', value: keyVault.properties.vaultUri }
          ]
        }
      ]
    }
  }
  dependsOn: [acrPullRole, kvSecretsRole]
}

// ── Outputs ───────────────────────────────────────────────────────────────────
output acrLoginServer string = acr.properties.loginServer
output containerAppFqdn string = msimApiApp.properties.configuration.ingress!.fqdn
output keyVaultUri string = keyVault.properties.vaultUri
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output searchEndpoint string = 'https://${searchName}.search.windows.net'
