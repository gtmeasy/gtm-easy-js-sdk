
# DownloadRequest


## Properties

Name | Type
------------ | -------------
`app` | string
`environment` | string
`platform` | string
`userId` | string
`anonymousId` | string
`deviceId` | string
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

## Example

```typescript
import type { DownloadRequest } from '@gtmeasy/growth-api'

// TODO: Update the object below with actual values
const example = {
  "app": screenkite-mac,
  "environment": production,
  "platform": ios,
  "userId": null,
  "anonymousId": null,
  "deviceId": null,
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
} satisfies DownloadRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DownloadRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


