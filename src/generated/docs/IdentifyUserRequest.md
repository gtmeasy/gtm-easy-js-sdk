
# IdentifyUserRequest


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
`country` | string
`locale` | string
`timezone` | string
`traits` | { [key: string]: any; }

## Example

```typescript
import type { IdentifyUserRequest } from '@gtmeasy/growth-api'

// TODO: Update the object below with actual values
const example = {
  "app": null,
  "environment": production,
  "platform": ios,
  "userId": null,
  "anonymousId": null,
  "deviceId": null,
  "username": john_wayne,
  "email": john@example.com,
  "appVersion": null,
  "buildNumber": null,
  "country": null,
  "locale": null,
  "timezone": null,
  "traits": null,
} satisfies IdentifyUserRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as IdentifyUserRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


