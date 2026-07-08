// Azure App Service deployment for AIN Platform APIs

@description('Environment name (staging or production)')
param environment string = 'staging'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Database connection string')
@secure()
param databaseConnectionString string

@description('JWT secret')
@secure()
param jwtSecret string

var appServicePlanName = 'asp-ain-platform-${environment}'
var webAppNamePrefix = 'app-ain-platform'

// App Service Plan (Linux-based)
resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: environment == 'production' ? 'P1v3' : 'B1'
    tier: environment == 'production' ? 'Premium' : 'Basic'
    capacity: environment == 'production' ? 2 : 1
  }
  kind: 'linux'
  properties: {
    reserved: true // Required for Linux
  }
}

// MSIM API App Service
resource msimApiWebApp 'Microsoft.Web/sites@2022-03-01' = {
  name: '${webAppNamePrefix}-msim-api-${environment}'
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appSettings: [
        {
          name: 'NODE_ENV'
          value: environment
        }
        {
          name: 'DATABASE_URL'
          value: databaseConnectionString
        }
        {
          name: 'JWT_SECRET'
          value: jwtSecret
        }
        {
          name: 'LOG_LEVEL'
          value: 'info'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '20-lts'
        }
      ]
      cors: {
        allowedOrigins: environment == 'production' ? [
          'https://ain-platform.com'
          'https://admin.ain-platform.com'
        ] : [
          'https://staging.ain-platform.com'
          'http://localhost:3000'
        ]
        supportCredentials: true
      }
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      alwaysOn: true
      http20Enabled: true
    }
    httpsOnly: true
  }
}

// Auto-scaling rules for production
resource autoScaleSettings 'Microsoft.Insights/autoscalesettings@2022-10-01' = if (environment == 'production') {
  name: '${appServicePlanName}-autoscale'
  location: location
  properties: {
    enabled: true
    targetResourceUri: appServicePlan.id
    profiles: [
      {
        name: 'Auto scale based on CPU'
        capacity: {
          minimum: '2'
          maximum: '10'
          default: '2'
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 70
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'LessThan'
              threshold: 30
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT10M'
            }
          }
        ]
      }
    ]
  }
}

// Application Insights for monitoring
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-ain-platform-${environment}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: environment == 'production' ? 90 : 30
  }
}

// Log Analytics Workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'log-ain-platform-${environment}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: environment == 'production' ? 90 : 30
  }
}

// Outputs
output msimApiUrl string = 'https://${msimApiWebApp.properties.defaultHostName}'
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id
