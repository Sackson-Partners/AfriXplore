param namespaceName string
param location string
param environment string

var skuName = environment == 'production' ? 'Premium' : 'Standard'

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: namespaceName
  location: location
  sku: {
    name: skuName
    tier: skuName
  }
  properties: {}
  tags: {
    environment: environment
    project: 'afrixplore'
  }
}

var topics = [
  'reports-ingested'
  'anomaly-detected'
  'payment-triggered'
  'mineral-assessed'
  'subscription-changed'
  'field-dispatched'
  'ml-training-ready'
]

resource topicResources 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = [for topic in topics: {
  parent: serviceBusNamespace
  name: topic
  properties: {
    defaultMessageTimeToLive: 'P14D'
    enableBatchedOperations: true
    maxSizeInMegabytes: 1024
  }
}]

// NOTE: Topic subscriptions are intentionally excluded from Bicep.
// Azure does not allow updating immutable subscription properties (requiresSession,
// requiresDuplicateDetection) once created. Subscriptions are created once via
// the ensure-sb-subscriptions step in the deploy workflow and left untouched.

output name string = serviceBusNamespace.name
output namespaceFQDN string = '${serviceBusNamespace.name}.servicebus.windows.net'
output resourceId string = serviceBusNamespace.id
