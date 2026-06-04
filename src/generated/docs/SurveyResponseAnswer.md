
# SurveyResponseAnswer


## Properties

Name | Type
------------ | -------------
`questionId` | string
`type` | string
`questionText` | string
`position` | number
`choices` | Array&lt;string&gt;
`choiceLabels` | Array&lt;string&gt;
`number` | number
`text` | string
`bool` | boolean
`skipped` | boolean
`metadata` | { [key: string]: any; }

## Example

```typescript
import type { SurveyResponseAnswer } from '@gtmeasy/growth-api'

// TODO: Update the object below with actual values
const example = {
  "questionId": source,
  "type": single_choice,
  "questionText": null,
  "position": null,
  "choices": null,
  "choiceLabels": null,
  "number": null,
  "text": null,
  "bool": null,
  "skipped": null,
  "metadata": null,
} satisfies SurveyResponseAnswer

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SurveyResponseAnswer
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


