
# WebReferrerRequest


## Properties

Name | Type
------------ | -------------
`app` | string
`environment` | string
`userId` | string
`anonymousId` | string
`platform` | string
`source` | string
`occurredAt` | Date
`webReferrer` | string
`clickId` | string
`properties` | { [key: string]: any; }

## Example

```typescript
import type { WebReferrerRequest } from '@gtmeasy/growth-api'

// TODO: Update the object below with actual values
const example = {
  "app": null,
  "environment": production,
  "userId": null,
  "anonymousId": null,
  "platform": ios,
  "source": null,
  "occurredAt": null,
  "webReferrer": null,
  "clickId": null,
  "properties": null,
} satisfies WebReferrerRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as WebReferrerRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


