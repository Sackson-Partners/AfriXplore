param name string
param location string
param environment string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  sku: {
    name: environment == 'production' ? 'Premium' : 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
  tags: {
    environment: environment
    project: 'afrixplore'
  }
}

output name string = acr.name
output loginServer string = acr.properties.loginServer
output resourceId string = acr.id
