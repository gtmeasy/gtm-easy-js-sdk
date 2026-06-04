# SurveysApi

All URIs are relative to *https://www.gtmeasy.com/api/v1/growth*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**surveysPost**](SurveysApi.md#surveyspost) | **POST** /surveys | Submit an onboarding-survey response |



## surveysPost

> SubmitSurveyResponse surveysPost(xGtmGrowthKey, submitSurveyRequest)

Submit an onboarding-survey response

Persists flexible onboarding-survey answers (one stored row per question, no 240-char truncation). A &#x60;survey.completed&#x60;/&#x60;survey.dismissed&#x60; lifecycle event is also recorded for the journey timeline + connector fan-out (&#x60;partial&#x60; submissions emit no event). Idempotent on &#x60;submissionId&#x60;.

### Example

```ts
import {
  Configuration,
  SurveysApi,
} from '@gtmeasy/growth-api';
import type { SurveysPostRequest } from '@gtmeasy/growth-api';

async function example() {
  console.log("🚀 Testing @gtmeasy/growth-api SDK...");
  const api = new SurveysApi();

  const body = {
    // string | SDK write key issued from the GTM Easy dashboard for this app.
    xGtmGrowthKey: wk_live_...,
    // SubmitSurveyRequest
    submitSurveyRequest: ...,
  } satisfies SurveysPostRequest;

  try {
    const data = await api.surveysPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **xGtmGrowthKey** | `string` | SDK write key issued from the GTM Easy dashboard for this app. | [Defaults to `undefined`] |
| **submitSurveyRequest** | [SubmitSurveyRequest](SubmitSurveyRequest.md) |  | |

### Return type

[**SubmitSurveyResponse**](SubmitSurveyResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Survey response accepted. |  -  |
| **400** | Validation failed — see error message. |  -  |
| **401** | Missing or invalid write key. |  -  |
| **503** | Ingest temporarily unavailable. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

