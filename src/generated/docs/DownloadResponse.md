
# DownloadResponse


## Properties

Name | Type
------------ | -------------
`event` | [RegistrationResponseEvent](RegistrationResponseEvent.md)
`warnings` | Array&lt;string&gt;

## Example

```typescript
import type { DownloadResponse } from '@gtmeasy/growth-api'

// TODO: Update the object below with actual values
const example = {
  "event": null,
  "warnings": null,
} satisfies DownloadResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DownloadResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


