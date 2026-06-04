
# SubmitSurveyRequest


## Properties

Name | Type
------------ | -------------
`app` | string
`environment` | string
`platform` | string
`userId` | string
`anonymousId` | string
`deviceId` | string
`surveyId` | string
`surveyVersion` | string
`surveyName` | string
`submissionId` | string
`status` | string
`appVersion` | string
`locale` | string
`country` | string
`occurredAt` | Date
`responses` | [Array&lt;SurveyResponseAnswer&gt;](SurveyResponseAnswer.md)
`properties` | { [key: string]: any; }
`metadata` | { [key: string]: any; }

## Example

```typescript
import type { SubmitSurveyRequest } from '@gtmeasy/growth-api'

// TODO: Update the object below with actual values
const example = {
  "app": screenkite-ios,
  "environment": production,
  "platform": ios,
  "userId": null,
  "anonymousId": null,
  "deviceId": null,
  "surveyId": onboarding_v1,
  "surveyVersion": null,
  "surveyName": null,
  "submissionId": null,
  "status": null,
  "appVersion": null,
  "locale": null,
  "country": null,
  "occurredAt": null,
  "responses": null,
  "properties": null,
  "metadata": null,
} satisfies SubmitSurveyRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SubmitSurveyRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


