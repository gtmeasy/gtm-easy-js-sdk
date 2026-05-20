# SkanApi

All URIs are relative to *https://www.gtmeasy.com/api/v1/growth*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**skanPostbackPost**](SkanApi.md#skanpostbackpost) | **POST** /skan/postback | SKAdNetwork postback receiver |



## skanPostbackPost

> HealthResponse skanPostbackPost(skanPostbackRequest)

SKAdNetwork postback receiver

Apple sends signed postbacks here when a SKAN install attribution wins. Body is verified against Apple\&#39;s published JWKS before persistence.

### Example

```ts
import {
  Configuration,
  SkanApi,
} from '@gtmeasy/growth-api';
import type { SkanPostbackPostRequest } from '@gtmeasy/growth-api';

async function example() {
  console.log("🚀 Testing @gtmeasy/growth-api SDK...");
  const api = new SkanApi();

  const body = {
    // SkanPostbackRequest
    skanPostbackRequest: ...,
  } satisfies SkanPostbackPostRequest;

  try {
    const data = await api.skanPostbackPost(body);
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
| **skanPostbackRequest** | [SkanPostbackRequest](SkanPostbackRequest.md) |  | |

### Return type

[**HealthResponse**](HealthResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **202** | Postback accepted. |  -  |
| **400** | Validation failed — see error message. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

