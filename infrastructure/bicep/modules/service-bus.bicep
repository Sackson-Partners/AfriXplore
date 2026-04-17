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
    enablePartitioning: false
    maxSizeInMegabytes: 1024
    requiresDuplicateDetection: false
    supportOrdering: false
  }
}]

// Subscription: geospatial-worker listens to reports-ingested
resource geoWorkerSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: topicResources[0]
  name: 'geospatial-worker'
  properties: {
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P7D'
    lockDuration: 'PT5M'
    maxDeliveryCount: 5
  }
}

// Subscription: notification-service listens to anomaly-detected
resource notificationSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: topicResources[1]
  name: 'notification-service'
  properties: {
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P7D'
    lockDuration: 'PT5M'
    maxDeliveryCount: 5
  }
}

// Subscription: payment-service listens to payment-triggered
resource paymentSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: topicResources[2]
  name: 'payment-service'
  properties: {
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P7D'
    lockDuration: 'PT5M'
    maxDeliveryCount: 3
    requiresSession: true
  }
}

output name string = serviceBusNamespace.name
output namespaceFQDN string = '${serviceBusNamespace.name}.servicebus.windows.net'
output resourceId string = serviceBusNamespace.id
