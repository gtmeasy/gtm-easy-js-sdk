# MetaApi

All URIs are relative to *https://www.gtmeasy.com/api/v1/growth*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**healthGet**](MetaApi.md#healthget) | **GET** /health | Health probe |



## healthGet

> HealthResponse healthGet()

Health probe

### Example

```ts
import {
  Configuration,
  MetaApi,
} from '@gtmeasy/growth-api';
import type { HealthGetRequest } from '@gtmeasy/growth-api';

async function example() {
  console.log("🚀 Testing @gtmeasy/growth-api SDK...");
  const api = new MetaApi();

  try {
    const data = await api.healthGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**HealthResponse**](HealthResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Service healthy. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

