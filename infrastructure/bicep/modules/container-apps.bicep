param environmentName string
param location string
param environment string
param logAnalyticsWorkspaceId string
param keyVaultName string
param containerRegistryName string

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: last(split(logAnalyticsWorkspaceId, '/'))
}

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
  tags: {
    environment: environment
    project: 'afrixplore'
  }
}

var services = [
  { name: 'scout-api',          port: 3000, minReplicas: 1, maxReplicas: 10, cpu: '0.5',  memory: '1.0Gi', externalIngress: true  }
  { name: 'intelligence-api',   port: 3001, minReplicas: 1, maxReplicas: 10, cpu: '0.5',  memory: '1.0Gi', externalIngress: true  }
  { name: 'msim-api',           port: 3004, minReplicas: 1, maxReplicas: 5,  cpu: '0.25', memory: '0.5Gi', externalIngress: true  }
  { name: 'notification',       port: 3002, minReplicas: 1, maxReplicas: 5,  cpu: '0.25', memory: '0.5Gi', externalIngress: false }
  { name: 'payment',            port: 3003, minReplicas: 1, maxReplicas: 5,  cpu: '0.25', memory: '0.5Gi', externalIngress: true  }
  { name: 'ai-inference',       port: 3005, minReplicas: 0, maxReplicas: 5,  cpu: '1.0',  memory: '2.0Gi', externalIngress: false }
  { name: 'geo-worker',         port: 8000, minReplicas: 0, maxReplicas: 3,  cpu: '0.5',  memory: '1.0Gi', externalIngress: false }
]

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Key Vault Secrets User role
var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource containerApps 'Microsoft.App/containerApps@2024-03-01' = [for svc in services: {
  name: 'ca-${svc.name}-${environment}'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: svc.externalIngress ? {
        external: true
        targetPort: svc.port
        transport: 'http'
      } : null
      registries: [
        {
          server: '${containerRegistryName}.azurecr.io'
          identity: 'system'
        }
      ]
      secrets: []
    }
    template: {
      containers: [
        {
          name: svc.name
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json(svc.cpu)
            memory: svc.memory
          }
          env: [
            {
              name: 'NODE_ENV'
              value: environment
            }
            {
              name: 'KEY_VAULT_NAME'
              value: keyVaultName
            }
          ]
        }
      ]
      scale: {
        minReplicas: svc.minReplicas
        maxReplicas: svc.maxReplicas
      }
    }
  }
  tags: {
    environment: environment
    project: 'afrixplore'
    service: svc.name
  }
}]

// Grant each Container App's SystemAssigned identity access to Key Vault secrets
resource kvRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (svc, i) in services: {
  name: guid(keyVault.id, containerApps[i].id, kvSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: containerApps[i].identity.principalId
    principalType: 'ServicePrincipal'
  }
}]

output environmentId string = containerAppsEnv.id
output environmentName string = containerAppsEnv.name
