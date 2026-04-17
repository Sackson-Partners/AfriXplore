param name string
param location string
param environment string

resource signalRService 'Microsoft.SignalRService/signalR@2023-02-01' = {
  name: name
  location: location
  sku: {
    name: environment == 'production' ? 'Standard_S1' : 'Free_F1'
    tier: environment == 'production' ? 'Standard' : 'Free'
    capacity: environment == 'production' ? 2 : 1
  }
  properties: {
    features: [
      {
        flag: 'ServiceMode'
        value: 'Default'
      }
      {
        flag: 'EnableConnectivityLogs'
        value: 'True'
      }
    ]
    cors: {
      allowedOrigins: environment == 'production'
        ? ['https://platform.afrixplore.io', 'https://admin.afrixplore.io']
        : ['*']
    }
    tls: {
      clientCertEnabled: false
    }
  }
  tags: {
    environment: environment
    project: 'afrixplore'
    managedBy: 'bicep'
  }
}

output name string = signalRService.name
output signalRId string = signalRService.id
output hostname string = signalRService.properties.hostName
