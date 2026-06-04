# AcquisitionApi

All URIs are relative to *https://www.gtmeasy.com/api/v1/growth*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**downloadsPost**](AcquisitionApi.md#downloadspost) | **POST** /downloads | Record an app download / first open |
| [**registrationsPost**](AcquisitionApi.md#registrationspost) | **POST** /registrations | Record a new app user registration |



## downloadsPost

> DownloadResponse downloadsPost(xGtmGrowthKey, downloadRequest)

Record an app download / first open

Records an &#x60;acquisition.app_download&#x60; event and fires the configured Discord notification (unless the IP is Apple/Google review infrastructure).

### Example

```ts
import {
  Configuration,
  AcquisitionApi,
} from '@gtmeasy/growth-api';
import type { DownloadsPostRequest } from '@gtmeasy/growth-api';

async function example() {
  console.log("🚀 Testing @gtmeasy/growth-api SDK...");
  const api = new AcquisitionApi();

  const body = {
    // string | SDK write key issued from the GTM Easy dashboard for this app.
    xGtmGrowthKey: wk_live_...,
    // DownloadRequest
    downloadRequest: ...,
  } satisfies DownloadsPostRequest;

  try {
    const data = await api.downloadsPost(body);
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
| **downloadRequest** | [DownloadRequest](DownloadRequest.md) |  | |

### Return type

[**DownloadResponse**](DownloadResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Download recorded. |  -  |
| **400** | Validation failed — see error message. |  -  |
| **401** | Missing or invalid write key. |  -  |
| **503** | Ingest temporarily unavailable. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## registrationsPost

> RegistrationResponse registrationsPost(xGtmGrowthKey, registrationRequest)

Record a new app user registration

Identifies the user (upserts traits + People geo from Cloudflare) AND records an &#x60;acquisition.user_registered&#x60; event, then fires the configured Discord notification (unless the IP is Apple/Google review infrastructure).

### Example

```ts
import {
  Configuration,
  AcquisitionApi,
} from '@gtmeasy/growth-api';
import type { RegistrationsPostRequest } from '@gtmeasy/growth-api';

async function example() {
  console.log("🚀 Testing @gtmeasy/growth-api SDK...");
  const api = new AcquisitionApi();

  const body = {
    // string | SDK write key issued from the GTM Easy dashboard for this app.
    xGtmGrowthKey: wk_live_...,
    // RegistrationRequest
    registrationRequest: ...,
  } satisfies RegistrationsPostRequest;

  try {
    const data = await api.registrationsPost(body);
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
| **registrationRequest** | [RegistrationRequest](RegistrationRequest.md) |  | |

### Return type

[**RegistrationResponse**](RegistrationResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Registration recorded. |  -  |
| **400** | Validation failed — see error message. |  -  |
| **401** | Missing or invalid write key. |  -  |
| **503** | Ingest temporarily unavailable. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

