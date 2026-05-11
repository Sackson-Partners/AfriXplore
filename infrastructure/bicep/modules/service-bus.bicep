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

// ── reports-ingested subscriptions ──────────────────────────────────────────
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

resource aiPipelineSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: topicResources[0]
  name: 'ai-pipeline'
  properties: {
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P7D'
    lockDuration: 'PT5M'
    maxDeliveryCount: 5
  }
}

resource notificationReportsSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: topicResources[0]
  name: 'notification-service'
  properties: {
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P7D'
    lockDuration: 'PT5M'
    maxDeliveryCount: 3
  }
}

// ── anomaly-detected subscriptions ──────────────────────────────────────────
resource notificationAnomalySubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: topicResources[1]
  name: 'notification-service'
  properties: {
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P7D'
    lockDuration: 'PT5M'
    maxDeliveryCount: 5
  }
}

// ── payment-triggered subscriptions ─────────────────────────────────────────
resource paymentSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: topicResources[2]
  name: 'payment-service'
  properties: {
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P7D'
    lockDuration: 'PT5M'
    maxDeliveryCount: 3
  }
}

resource notificationPaymentSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: topicResources[2]
  name: 'notification-service'
  properties: {
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P7D'
    lockDuration: 'PT5M'
    maxDeliveryCount: 3
  }
}

// ── mineral-assessed subscriptions ──────────────────────────────────────────
resource intelligenceDpiSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: topicResources[3]
  name: 'intelligence-dpi'
  properties: {
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P7D'
    lockDuration: 'PT5M'
    maxDeliveryCount: 5
  }
}

output name string = serviceBusNamespace.name
output namespaceFQDN string = '${serviceBusNamespace.name}.servicebus.windows.net'
output resourceId string = serviceBusNamespace.id
