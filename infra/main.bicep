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

// ── Azure Storage Account ─────────────────────────────────────────────────────
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'stain${environment}'
  location: location
  sku: {
    name: environment == 'prod' ? 'Standard_GRS' : 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

// Blob containers for MSIM documents
resource documentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storageAccount.name}/default/documents'
  properties: {
    publicAccess: 'None'
  }
}

resource exportsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storageAccount.name}/default/exports'
  properties: {
    publicAccess: 'None'
  }
}

resource thumbnailsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storageAccount.name}/default/thumbnails'
  properties: {
    publicAccess: 'None'
  }
}

// GeoSwarm documents container
resource geoswarmDocsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storageAccount.name}/default/geoswarm-documents'
  properties: {
    publicAccess: 'None'
  }
}

// Store connection string in Key Vault
resource storageConnStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ain-storage-connection-string'
  properties: {
    value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${az.environment().suffixes.storage}'
  }
}

// ── Azure Service Bus ─────────────────────────────────────────────────────────
resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: 'sb-ain-${environment}'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    minimumTlsVersion: '1.2'
  }
}

// Queue: document-ingestion
resource documentIngestionQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'document-ingestion'
  properties: {
    maxDeliveryCount: 10
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P7D'
  }
}

// Dead letter queue
resource documentIngestionDLQ 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'document-ingestion-deadletter'
  properties: {
    maxDeliveryCount: 1
    defaultMessageTimeToLive: 'P30D'
  }
}

// Topic: archive-document-indexed
resource documentProcessedTopic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'archive-document-indexed'
  properties: {
    defaultMessageTimeToLive: 'P7D'
  }
}

// Subscription for convergence-engine
resource convergenceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: documentProcessedTopic
  name: 'convergence-engine'
  properties: {
    deadLetteringOnMessageExpiration: true
    maxDeliveryCount: 10
  }
}

// Topic: anomaly-detected
resource anomalyDetectedTopic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'anomaly-detected'
  properties: {
    defaultMessageTimeToLive: 'P7D'
  }
}

// Subscription for convergence-engine
resource anomalySubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: anomalyDetectedTopic
  name: 'convergence-engine'
  properties: {
    deadLetteringOnMessageExpiration: true
    maxDeliveryCount: 10
  }
}

// Store Service Bus connection string in Key Vault
resource serviceBusConnStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ain-servicebus-connection-string'
  properties: {
    value: listKeys('${serviceBusNamespace.id}/AuthorizationRules/RootManageSharedAccessKey', serviceBusNamespace.apiVersion).primaryConnectionString
  }
}

// ── Application Insights ──────────────────────────────────────────────────────
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-ain-${environment}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logWorkspace.id
    RetentionInDays: 30
  }
}

// Store instrumentation key and connection string in Key Vault
resource appInsightsKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ain-appinsights-instrumentation-key'
  properties: {
    value: appInsights.properties.InstrumentationKey
  }
}

resource appInsightsConnStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ain-appinsights-connection-string'
  properties: {
    value: appInsights.properties.ConnectionString
  }
}

// ── Azure OpenAI ──────────────────────────────────────────────────────────────
// Note: Deploying to South Africa North region (GPT-4 may have limited availability)
resource openAI 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: 'oai-ain-${environment}'
  location: location // Use same location as resource group
  sku: {
    name: 'S0'
  }
  kind: 'OpenAI'
  properties: {
    customSubDomainName: 'oai-ain-${environment}'
    publicNetworkAccess: 'Enabled'
  }
}

// Deploy GPT-3.5 Turbo (more widely available than GPT-4)
resource gpt35Deployment 'Microsoft.CognitiveServices/accounts/deployments@2023-10-01-preview' = {
  parent: openAI
  name: 'gpt-35-turbo-msim'
  sku: {
    name: 'Standard'
    capacity: 120
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-35-turbo'
      version: '0125'
    }
  }
}

// Deploy text-embedding model
resource embeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-10-01-preview' = {
  parent: openAI
  name: 'text-embedding-msim'
  sku: {
    name: 'Standard'
    capacity: 120
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'text-embedding-ada-002'
      version: '2'
    }
  }
  dependsOn: [gpt35Deployment] // Sequential deployment required
}

// Store OpenAI endpoint and key in Key Vault
resource openAIEndpointSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ain-openai-endpoint'
  properties: {
    value: openAI.properties.endpoint
  }
}

resource openAIKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ain-openai-key'
  properties: {
    value: openAI.listKeys().key1
  }
}

// ── Azure AI Document Intelligence (Form Recognizer) ──────────────────────────
resource documentIntelligence 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: 'di-ain-${environment}'
  location: location
  sku: {
    name: 'S0'
  }
  kind: 'FormRecognizer'
  properties: {
    customSubDomainName: 'di-ain-${environment}'
    publicNetworkAccess: 'Enabled'
  }
}

// Store Document Intelligence endpoint and key in Key Vault
resource docIntelEndpointSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ain-document-intelligence-endpoint'
  properties: {
    value: documentIntelligence.properties.endpoint
  }
}

resource docIntelKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ain-document-intelligence-key'
  properties: {
    value: documentIntelligence.listKeys().key1
  }
}

// ── Azure Maps ────────────────────────────────────────────────────────────────
resource maps 'Microsoft.Maps/accounts@2023-06-01' = {
  name: 'maps-ain-${environment}'
  location: 'global'
  sku: {
    name: 'G2'
  }
  properties: {
    disableLocalAuth: false
  }
}

// Store Azure Maps primary key in Key Vault
resource mapsKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ain-maps-key'
  properties: {
    value: maps.listKeys().primaryKey
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

// Grant msim-api Storage Blob Data Contributor
resource msimStorageBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, msimApiIdentity.id, 'storageblobcontributor')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') // Storage Blob Data Contributor
    principalId: msimApiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant msim-api Service Bus Data Owner
resource msimServiceBusRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBusNamespace.id, msimApiIdentity.id, 'servicebusowner')
  scope: serviceBusNamespace
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '090c5cfd-751d-490a-894a-3ce6f1109419') // Azure Service Bus Data Owner
    principalId: msimApiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant msim-api Cognitive Services OpenAI User
resource msimOpenAIRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openAI.id, msimApiIdentity.id, 'openaiuser')
  scope: openAI
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd') // Cognitive Services OpenAI User
    principalId: msimApiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant msim-api Cognitive Services User (for Document Intelligence)
resource msimDocIntelRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(documentIntelligence.id, msimApiIdentity.id, 'cognitiveuser')
  scope: documentIntelligence
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a97b65f3-24c7-4388-baec-2e87135dc908') // Cognitive Services User
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
    }
    template: {
      containers: [
        {
          name: 'msim-api'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
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
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
            { name: 'AZURE_STORAGE_ACCOUNT_NAME', value: storageAccount.name }
            { name: 'AZURE_OPENAI_ENDPOINT', value: openAI.properties.endpoint }
            { name: 'AZURE_OPENAI_DEPLOYMENT', value: 'gpt-4-msim' }
            { name: 'AZURE_FORM_RECOGNIZER_ENDPOINT', value: documentIntelligence.properties.endpoint }
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
    }
    template: {
      containers: [
        {
          name: 'db-migrate'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          command: ['node', 'services/msim-api/dist/scripts/migrate.js']
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
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

// ── geoswarm-api Container App ────────────────────────────────────────────────
resource geoswarmApiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-geoswarm-api-${environment}'
  location: location
}

resource geoswarmAcrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, geoswarmApiIdentity.id, 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: geoswarmApiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource geoswarmKvRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, geoswarmApiIdentity.id, 'kvsecrets')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: geoswarmApiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant geoswarm-api Storage Blob Data Contributor
resource geoswarmStorageBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, geoswarmApiIdentity.id, 'storageblobcontributor')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') // Storage Blob Data Contributor
    principalId: geoswarmApiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant geoswarm-api Service Bus Data Owner
resource geoswarmServiceBusRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBusNamespace.id, geoswarmApiIdentity.id, 'servicebusowner')
  scope: serviceBusNamespace
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '090c5cfd-751d-490a-894a-3ce6f1109419') // Azure Service Bus Data Owner
    principalId: geoswarmApiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource geoswarmApiApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-geoswarm-api-${environment}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${geoswarmApiIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3003
        transport: 'http'
        corsPolicy: {
          allowedOrigins: ['https://geoswarm-ain-${environment}.azurewebsites.net', 'https://platform-ain-${environment}.azurewebsites.net']
          allowedMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
          allowedHeaders: ['Authorization', 'Content-Type']
        }
      }
    }
    template: {
      containers: [
        {
          name: 'geoswarm-api'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3003' }
            { name: 'AZURE_KEY_VAULT_URL', value: keyVault.properties.vaultUri }
            { name: 'AZURE_ENTRA_TENANT_ID', value: entraExternalTenantId }
            { name: 'AZURE_ENTRA_CLIENT_ID', value: entraClientId }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
            { name: 'AZURE_STORAGE_ACCOUNT_NAME', value: storageAccount.name }
            { name: 'MSIM_API_INTERNAL_URL', value: 'https://ca-msim-api-${environment}.${containerAppEnv.properties.defaultDomain}' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health/live', port: 3003 }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: { path: '/health/ready', port: 3003 }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: environment == 'prod' ? 1 : 0
        maxReplicas: environment == 'prod' ? 5 : 2
        rules: [
          {
            name: 'http-scale'
            http: { metadata: { concurrentRequests: '30' } }
          }
        ]
      }
    }
  }
  dependsOn: [geoswarmAcrPullRole, geoswarmKvRole]
}

// ── convergence-engine Container App ─────────────────────────────────────────
resource convergenceIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-convergence-${environment}'
  location: location
}

resource convergenceAcrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, convergenceIdentity.id, 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: convergenceIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource convergenceKvRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, convergenceIdentity.id, 'kvsecrets')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: convergenceIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant convergence-engine Service Bus Data Owner
resource convergenceServiceBusRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBusNamespace.id, convergenceIdentity.id, 'servicebusowner')
  scope: serviceBusNamespace
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '090c5cfd-751d-490a-894a-3ce6f1109419') // Azure Service Bus Data Owner
    principalId: convergenceIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource convergenceApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-convergence-${environment}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${convergenceIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3005
        transport: 'http'
        corsPolicy: {
          allowedOrigins: ['https://platform-ain-${environment}.azurewebsites.net', 'https://geoswarm-ain-${environment}.azurewebsites.net']
          allowedMethods: ['GET', 'POST', 'OPTIONS']
          allowedHeaders: ['Authorization', 'Content-Type']
        }
      }
    }
    template: {
      containers: [
        {
          name: 'convergence-engine'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'PORT', value: '3005' }
            { name: 'LOG_LEVEL', value: 'info' }
            { name: 'AZURE_KEY_VAULT_URL', value: keyVault.properties.vaultUri }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
            { name: 'MSIM_API_INTERNAL_URL', value: 'https://ca-msim-api-${environment}.${containerAppEnv.properties.defaultDomain}' }
            // DATABASE_URL loaded from Key Vault at startup
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health/live', port: 3005 }
              initialDelaySeconds: 15
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: { path: '/health/ready', port: 3005 }
              initialDelaySeconds: 10
              periodSeconds: 15
            }
          ]
        }
      ]
      scale: {
        minReplicas: environment == 'prod' ? 1 : 0
        maxReplicas: environment == 'prod' ? 5 : 2
        rules: [
          {
            name: 'http-scale'
            http: { metadata: { concurrentRequests: '20' } }
          }
        ]
      }
    }
  }
  dependsOn: [convergenceAcrPullRole, convergenceKvRole]
}

// ── Outputs ───────────────────────────────────────────────────────────────────
output acrLoginServer string = acr.properties.loginServer
output containerAppFqdn string = msimApiApp.properties.configuration.ingress!.fqdn
output geoswarmApiFqdn string = geoswarmApiApp.properties.configuration.ingress!.fqdn
output convergenceFqdn string = convergenceApp.properties.configuration.ingress!.fqdn
output keyVaultUri string = keyVault.properties.vaultUri
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output searchEndpoint string = 'https://${searchName}.search.windows.net'

// New resource outputs
output storageAccountName string = storageAccount.name
output serviceBusNamespace string = serviceBusNamespace.name
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output openAIEndpoint string = openAI.properties.endpoint
output documentIntelligenceEndpoint string = documentIntelligence.properties.endpoint
output mapsAccountName string = maps.name

// Key Vault secret names (for reference)
output keyVaultSecretNames array = [
  'ain-postgresql-connection-string'
  'ain-mapbox-token'
  'ain-storage-connection-string'
  'ain-servicebus-connection-string'
  'ain-appinsights-instrumentation-key'
  'ain-appinsights-connection-string'
  'ain-openai-endpoint'
  'ain-openai-key'
  'ain-document-intelligence-endpoint'
  'ain-document-intelligence-key'
  'ain-maps-key'
]
