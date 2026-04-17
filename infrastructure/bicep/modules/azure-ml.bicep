param workspaceName string
param location string
param environment string
param storageAccountId string
param keyVaultId string
param appInsightsId string
param containerRegistryId string

resource mlWorkspace 'Microsoft.MachineLearningServices/workspaces@2024-01-01-preview' = {
  name: workspaceName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
  properties: {
    friendlyName: 'AfriXplore ML Workspace - ${environment}'
    description: 'Mineral identification model training and deployment'
    storageAccount: storageAccountId
    keyVault: keyVaultId
    applicationInsights: appInsightsId
    containerRegistry: containerRegistryId
    publicNetworkAccess: 'Enabled'
    v1LegacyMode: false
  }
  tags: {
    environment: environment
    project: 'afrixplore'
    managedBy: 'bicep'
  }
}

resource trainingCluster 'Microsoft.MachineLearningServices/workspaces/computes@2024-01-01-preview' = {
  name: 'mineral-id-training'
  parent: mlWorkspace
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    computeType: 'AmlCompute'
    properties: {
      vmSize: environment == 'production' ? 'Standard_NC6s_v3' : 'Standard_DS3_v2'
      vmPriority: 'LowPriority'
      scaleSettings: {
        minNodeCount: 0
        maxNodeCount: environment == 'production' ? 4 : 2
        nodeIdleTimeBeforeScaleDown: 'PT120S'
      }
      remoteLoginPortPublicAccess: 'Disabled'
      enableNodePublicIp: false
    }
  }
}

resource customVisionTraining 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: 'cv-afrixplore-training-${environment}'
  location: location
  kind: 'CustomVision.Training'
  sku: {
    name: environment == 'production' ? 'S0' : 'F0'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    customSubDomainName: 'afrixplore-cv-training-${environment}'
  }
  tags: {
    environment: environment
    project: 'afrixplore'
  }
}

resource customVisionPrediction 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: 'cv-afrixplore-prediction-${environment}'
  location: location
  kind: 'CustomVision.Prediction'
  sku: {
    name: environment == 'production' ? 'S0' : 'F0'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    customSubDomainName: 'afrixplore-cv-prediction-${environment}'
  }
  tags: {
    environment: environment
    project: 'afrixplore'
  }
}

resource speechService 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: 'speech-afrixplore-${environment}'
  location: location
  kind: 'SpeechServices'
  sku: {
    name: environment == 'production' ? 'S0' : 'F0'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    customSubDomainName: 'afrixplore-speech-${environment}'
  }
}

resource documentIntelligence 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: 'docint-afrixplore-${environment}'
  location: location
  kind: 'FormRecognizer'
  sku: {
    name: environment == 'production' ? 'S0' : 'F0'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    customSubDomainName: 'afrixplore-docint-${environment}'
  }
}

resource openAI 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: 'openai-afrixplore-${environment}'
  location: 'eastus'
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    customSubDomainName: 'afrixplore-openai-${environment}'
  }
}

resource gpt4oDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-10-01-preview' = {
  name: 'gpt-4o'
  parent: openAI
  sku: {
    name: 'Standard'
    capacity: 30
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o'
      version: '2024-05-13'
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
}

resource keyVaultRef 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: last(split(keyVaultId, '/'))
}

resource cvTrainingKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: 'custom-vision-training-key'
  parent: keyVaultRef
  properties: {
    value: customVisionTraining.listKeys().key1
  }
}

resource cvPredictionKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: 'custom-vision-prediction-key'
  parent: keyVaultRef
  properties: {
    value: customVisionPrediction.listKeys().key1
  }
}

resource speechKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: 'speech-service-key'
  parent: keyVaultRef
  properties: {
    value: speechService.listKeys().key1
  }
}

resource openAIKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: 'openai-key'
  parent: keyVaultRef
  properties: {
    value: openAI.listKeys().key1
  }
}

output mlWorkspaceId string = mlWorkspace.id
output mlWorkspaceName string = mlWorkspace.name
output customVisionTrainingEndpoint string = customVisionTraining.properties.endpoint
output customVisionPredictionEndpoint string = customVisionPrediction.properties.endpoint
output speechEndpoint string = speechService.properties.endpoint
output openAIEndpoint string = openAI.properties.endpoint
output documentIntelligenceEndpoint string = documentIntelligence.properties.endpoint
