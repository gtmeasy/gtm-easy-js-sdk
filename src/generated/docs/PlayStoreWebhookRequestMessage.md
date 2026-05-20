
# PlayStoreWebhookRequestMessage


## Properties

Name | Type
------------ | -------------
`data` | string
`attributes` | { [key: string]: string; }
`messageId` | string
`publishTime` | string

## Example

```typescript
import type { PlayStoreWebhookRequestMessage } from '@gtmeasy/growth-api'

// TODO: Update the object below with actual values
const example = {
  "data": null,
  "attributes": null,
  "messageId": null,
  "publishTime": null,
} satisfies PlayStoreWebhookRequestMessage

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PlayStoreWebhookRequestMessage
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


