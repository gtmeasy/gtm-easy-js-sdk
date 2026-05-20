
# PlayInstallReferrerRequest


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
`playInstallReferrer` | string
`properties` | { [key: string]: any; }

## Example

```typescript
import type { PlayInstallReferrerRequest } from '@gtmeasy/growth-api'

// TODO: Update the object below with actual values
const example = {
  "app": null,
  "environment": production,
  "userId": null,
  "anonymousId": null,
  "platform": null,
  "source": null,
  "occurredAt": null,
  "playInstallReferrer": null,
  "properties": null,
} satisfies PlayInstallReferrerRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PlayInstallReferrerRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


