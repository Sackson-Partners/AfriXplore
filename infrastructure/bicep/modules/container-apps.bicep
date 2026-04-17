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
  { name: 'scout-api',          image: 'placeholder',   port: 3000, minReplicas: 1, maxReplicas: 10, cpu: '0.5', memory: '1.0Gi' }
  { name: 'intelligence-api',   image: 'placeholder',   port: 3001, minReplicas: 1, maxReplicas: 10, cpu: '0.5', memory: '1.0Gi' }
  { name: 'msim-api',           image: 'placeholder',   port: 3002, minReplicas: 1, maxReplicas: 5,  cpu: '0.25', memory: '0.5Gi' }
  { name: 'notification',       image: 'placeholder',   port: 3003, minReplicas: 1, maxReplicas: 5,  cpu: '0.25', memory: '0.5Gi' }
  { name: 'payment',            image: 'placeholder',   port: 3004, minReplicas: 1, maxReplicas: 5,  cpu: '0.25', memory: '0.5Gi' }
  { name: 'geo-worker',         image: 'placeholder',   port: 8000, minReplicas: 0, maxReplicas: 3,  cpu: '0.5', memory: '1.0Gi' }
]

resource containerApps 'Microsoft.App/containerApps@2024-03-01' = [for svc in services: {
  name: 'ca-${svc.name}-${environment}'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: svc.name != 'geo-worker' ? {
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

output environmentId string = containerAppsEnv.id
output environmentName string = containerAppsEnv.name
