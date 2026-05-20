# EventsApi

All URIs are relative to *https://www.gtmeasy.com/api/v1/growth*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**eventsPost**](EventsApi.md#eventspost) | **POST** /events | Record a tracked event |



## eventsPost

> IngestEventResponse eventsPost(xGtmGrowthKey, trackEventRequest)

Record a tracked event

Persists a single event and fans out to configured connectors (Meta CAPI, Google Ads, TikTok Events, PostHog, Sentry, Statsig). Idempotent on &#x60;(app, eventName, occurredAt, identityHash)&#x60;.

### Example

```ts
import {
  Configuration,
  EventsApi,
} from '@gtmeasy/growth-api';
import type { EventsPostRequest } from '@gtmeasy/growth-api';

async function example() {
  console.log("🚀 Testing @gtmeasy/growth-api SDK...");
  const api = new EventsApi();

  const body = {
    // string | SDK write key issued from the GTM Easy dashboard for this app.
    xGtmGrowthKey: wk_live_...,
    // TrackEventRequest
    trackEventRequest: ...,
  } satisfies EventsPostRequest;

  try {
    const data = await api.eventsPost(body);
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
| **trackEventRequest** | [TrackEventRequest](TrackEventRequest.md) |  | |

### Return type

[**IngestEventResponse**](IngestEventResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Event accepted and queued for fan-out. |  -  |
| **400** | Validation failed — see error message. |  -  |
| **401** | Missing or invalid write key. |  -  |
| **503** | Ingest temporarily unavailable. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

