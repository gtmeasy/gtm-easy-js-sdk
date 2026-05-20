# UsersApi

All URIs are relative to *https://www.gtmeasy.com/api/v1/growth*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**usersPost**](UsersApi.md#userspost) | **POST** /users | Identify a user / upsert traits |



## usersPost

> IngestUserResponse usersPost(xGtmGrowthKey, identifyUserRequest)

Identify a user / upsert traits

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '@gtmeasy/growth-api';
import type { UsersPostRequest } from '@gtmeasy/growth-api';

async function example() {
  console.log("🚀 Testing @gtmeasy/growth-api SDK...");
  const api = new UsersApi();

  const body = {
    // string | SDK write key issued from the GTM Easy dashboard for this app.
    xGtmGrowthKey: wk_live_...,
    // IdentifyUserRequest
    identifyUserRequest: ...,
  } satisfies UsersPostRequest;

  try {
    const data = await api.usersPost(body);
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
| **identifyUserRequest** | [IdentifyUserRequest](IdentifyUserRequest.md) |  | |

### Return type

[**IngestUserResponse**](IngestUserResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | User upserted. |  -  |
| **400** | Validation failed — see error message. |  -  |
| **401** | Missing or invalid write key. |  -  |
| **503** | Ingest temporarily unavailable. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

