param name string
param location string
param environment string
param appInsightsName string

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: appInsightsName
}

resource apim 'Microsoft.ApiManagement/service@2023-05-01-preview' = {
  name: name
  location: location
  sku: {
    name: environment == 'production' ? 'Standard' : 'Developer'
    capacity: environment == 'production' ? 2 : 1
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    publisherEmail: 'platform@afrixplore.io'
    publisherName: 'AfriXplore'
    virtualNetworkType: 'None'
    customProperties: {
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls10': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls11': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls10': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls11': 'False'
    }
  }
  tags: {
    environment: environment
    project: 'afrixplore'
    managedBy: 'bicep'
  }
}

resource apimLogger 'Microsoft.ApiManagement/service/loggers@2023-05-01-preview' = {
  name: 'appinsights-logger'
  parent: apim
  properties: {
    loggerType: 'applicationInsights'
    resourceId: appInsights.id
    credentials: {
      instrumentationKey: appInsights.properties.InstrumentationKey
    }
  }
}

resource apimDiagnostics 'Microsoft.ApiManagement/service/diagnostics@2023-05-01-preview' = {
  name: 'applicationinsights'
  parent: apim
  properties: {
    loggerId: apimLogger.id
    alwaysLog: 'allErrors'
    verbosity: 'information'
    sampling: {
      samplingType: 'fixed'
      percentage: environment == 'production' ? 10 : 100
    }
  }
}

output gatewayUrl string = apim.properties.gatewayUrl
output apimName string = apim.name
output apimId string = apim.id
