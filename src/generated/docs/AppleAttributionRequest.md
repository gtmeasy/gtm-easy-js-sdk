
# AppleAttributionRequest


## Properties

Name | Type
------------ | -------------
`app` | string
`environment` | string
`userId` | string
`anonymousId` | string
`deviceId` | string
`platform` | string
`appVersion` | string
`buildNumber` | string
`source` | string
`country` | string
`locale` | string
`timezone` | string
`occurredAt` | Date
`properties` | { [key: string]: any; }
`appleAttributionToken` | string

## Example

```typescript
import type { AppleAttributionRequest } from '@gtmeasy/growth-api'

// TODO: Update the object below with actual values
const example = {
  "app": null,
  "environment": production,
  "userId": null,
  "anonymousId": null,
  "deviceId": null,
  "platform": ios,
  "appVersion": null,
  "buildNumber": null,
  "source": null,
  "country": null,
  "locale": null,
  "timezone": null,
  "occurredAt": null,
  "properties": null,
  "appleAttributionToken": null,
} satisfies AppleAttributionRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AppleAttributionRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


