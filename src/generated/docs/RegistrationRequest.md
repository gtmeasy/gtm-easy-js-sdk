
# RegistrationRequest


## Properties

Name | Type
------------ | -------------
`app` | string
`environment` | string
`platform` | string
`userId` | string
`anonymousId` | string
`deviceId` | string
`username` | string
`email` | string
`appVersion` | string
`buildNumber` | string
`source` | string
`country` | string
`locale` | string
`timezone` | string
`attributionProvider` | string
`attributionId` | string
`occurredAt` | Date
`traits` | { [key: string]: any; }
`properties` | { [key: string]: any; }

## Example

```typescript
import type { RegistrationRequest } from '@gtmeasy/growth-api'

// TODO: Update the object below with actual values
const example = {
  "app": screenkite-ios,
  "environment": production,
  "platform": ios,
  "userId": null,
  "anonymousId": null,
  "deviceId": null,
  "username": null,
  "email": null,
  "appVersion": null,
  "buildNumber": null,
  "source": null,
  "country": null,
  "locale": null,
  "timezone": null,
  "attributionProvider": null,
  "attributionId": null,
  "occurredAt": null,
  "traits": null,
  "properties": null,
} satisfies RegistrationRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RegistrationRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


