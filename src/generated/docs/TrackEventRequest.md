
# TrackEventRequest


## Properties

Name | Type
------------ | -------------
`app` | string
`environment` | string
`platform` | string
`userId` | string
`anonymousId` | string
`deviceId` | string
`eventName` | string
`appVersion` | string
`buildNumber` | string
`source` | string
`country` | string
`locale` | string
`timezone` | string
`attributionProvider` | string
`attributionId` | string
`occurredAt` | Date
`properties` | { [key: string]: any; }
`metricValue` | number
`metricLabel` | string

## Example

```typescript
import type { TrackEventRequest } from '@gtmeasy/growth-api'

// TODO: Update the object below with actual values
const example = {
  "app": twilar,
  "environment": production,
  "platform": ios,
  "userId": null,
  "anonymousId": null,
  "deviceId": null,
  "eventName": paywall.opened,
  "appVersion": null,
  "buildNumber": null,
  "source": null,
  "country": null,
  "locale": null,
  "timezone": null,
  "attributionProvider": null,
  "attributionId": null,
  "occurredAt": null,
  "properties": null,
  "metricValue": null,
  "metricLabel": null,
} satisfies TrackEventRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as TrackEventRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


