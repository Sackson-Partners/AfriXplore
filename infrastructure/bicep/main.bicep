targetScope = 'resourceGroup'

param environment string = 'staging'
param location string = 'southafricanorth'
param secondaryLocation string = 'francecentral'
param projectName string = 'afrixplore'

module containerRegistry 'modules/container-registry.bicep' = {
  name: 'containerRegistry'
  params: {
    name: 'cr${projectName}${environment}'
    location: location
    environment: environment
  }
}

module keyVault 'modules/key-vault.bicep' = {
  name: 'keyVault'
  params: {
    name: 'kv-${projectName}-${environment}'
    location: location
    environment: environment
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    name: 'st${projectName}${environment}sa'
    cdnProfileName: 'cdn-${projectName}-${environment}'
    location: location
    environment: environment
  }
}

module postgresql 'modules/postgresql.bicep' = {
  name: 'postgresql'
  params: {
    serverName: 'psql-${projectName}-${environment}-saf'
    location: location
    environment: environment
    keyVaultName: keyVault.outputs.name
  }
  dependsOn: [keyVault]
}

module serviceBus 'modules/service-bus.bicep' = {
  name: 'serviceBus'
  params: {
    namespaceName: 'sb-${projectName}-${environment}'
    location: location
    environment: environment
  }
}

module signalR 'modules/signalr.bicep' = {
  name: 'signalR'
  params: {
    name: 'sigr-${projectName}-${environment}'
    location: location
    environment: environment
  }
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    appInsightsName: 'appi-${projectName}-${environment}'
    logAnalyticsName: 'law-${projectName}-${environment}'
    location: location
    environment: environment
  }
}

module containerApps 'modules/container-apps.bicep' = {
  name: 'containerApps'
  params: {
    environmentName: 'cae-${projectName}-${environment}'
    location: location
    environment: environment
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    keyVaultName: keyVault.outputs.name
    containerRegistryName: containerRegistry.outputs.name
  }
  dependsOn: [monitoring, keyVault, containerRegistry]
}

output containerRegistryLoginServer string = containerRegistry.outputs.loginServer
output keyVaultUri string = keyVault.outputs.vaultUri
output postgreSQLFQDN string = postgresql.outputs.fqdn
output logAnalyticsWorkspaceId string = monitoring.outputs.logAnalyticsWorkspaceId
