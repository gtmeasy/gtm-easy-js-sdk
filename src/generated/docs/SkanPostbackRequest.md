
# SkanPostbackRequest


## Properties

Name | Type
------------ | -------------
`version` | string
`ad_network_id` | string
`campaign_id` | number
`source_identifier` | string
`transaction_id` | string
`app_id` | number
`attribution_signature` | string
`redownload` | boolean
`source_app_id` | number
`fidelity_type` | number
`conversion_value` | number
`coarse_conversion_value` | string
`did_win` | boolean
`postback_sequence_index` | number

## Example

```typescript
import type { SkanPostbackRequest } from '@gtmeasy/growth-api'

// TODO: Update the object below with actual values
const example = {
  "version": 4.0,
  "ad_network_id": null,
  "campaign_id": null,
  "source_identifier": null,
  "transaction_id": null,
  "app_id": null,
  "attribution_signature": null,
  "redownload": null,
  "source_app_id": null,
  "fidelity_type": null,
  "conversion_value": null,
  "coarse_conversion_value": null,
  "did_win": null,
  "postback_sequence_index": null,
} satisfies SkanPostbackRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SkanPostbackRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


