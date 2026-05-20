# AttributionApi

All URIs are relative to *https://www.gtmeasy.com/api/v1/growth*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**attributionAppleSearchAdsPost**](AttributionApi.md#attributionapplesearchadspost) | **POST** /attribution/apple-search-ads | Submit an Apple Search Ads attribution token |
| [**attributionPlayInstallReferrerPost**](AttributionApi.md#attributionplayinstallreferrerpost) | **POST** /attribution/play-install-referrer | Submit a Google Play install referrer string |
| [**attributionWebReferrerPost**](AttributionApi.md#attributionwebreferrerpost) | **POST** /attribution/web-referrer | Submit a web referrer URL + click id |



## attributionAppleSearchAdsPost

> IngestEventResponse attributionAppleSearchAdsPost(xGtmGrowthKey, appleAttributionRequest)

Submit an Apple Search Ads attribution token

### Example

```ts
import {
  Configuration,
  AttributionApi,
} from '@gtmeasy/growth-api';
import type { AttributionAppleSearchAdsPostRequest } from '@gtmeasy/growth-api';

async function example() {
  console.log("🚀 Testing @gtmeasy/growth-api SDK...");
  const api = new AttributionApi();

  const body = {
    // string | SDK write key issued from the GTM Easy dashboard for this app.
    xGtmGrowthKey: wk_live_...,
    // AppleAttributionRequest
    appleAttributionRequest: ...,
  } satisfies AttributionAppleSearchAdsPostRequest;

  try {
    const data = await api.attributionAppleSearchAdsPost(body);
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
| **appleAttributionRequest** | [AppleAttributionRequest](AppleAttributionRequest.md) |  | |

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
| **201** | Attribution resolved or accepted for later resolution. |  -  |
| **400** | Validation failed — see error message. |  -  |
| **401** | Missing or invalid write key. |  -  |
| **503** | Ingest temporarily unavailable. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## attributionPlayInstallReferrerPost

> IngestEventResponse attributionPlayInstallReferrerPost(xGtmGrowthKey, playInstallReferrerRequest)

Submit a Google Play install referrer string

### Example

```ts
import {
  Configuration,
  AttributionApi,
} from '@gtmeasy/growth-api';
import type { AttributionPlayInstallReferrerPostRequest } from '@gtmeasy/growth-api';

async function example() {
  console.log("🚀 Testing @gtmeasy/growth-api SDK...");
  const api = new AttributionApi();

  const body = {
    // string | SDK write key issued from the GTM Easy dashboard for this app.
    xGtmGrowthKey: wk_live_...,
    // PlayInstallReferrerRequest
    playInstallReferrerRequest: ...,
  } satisfies AttributionPlayInstallReferrerPostRequest;

  try {
    const data = await api.attributionPlayInstallReferrerPost(body);
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
| **playInstallReferrerRequest** | [PlayInstallReferrerRequest](PlayInstallReferrerRequest.md) |  | |

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
| **201** | Referrer parsed and persisted. |  -  |
| **400** | Validation failed — see error message. |  -  |
| **401** | Missing or invalid write key. |  -  |
| **503** | Ingest temporarily unavailable. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## attributionWebReferrerPost

> IngestEventResponse attributionWebReferrerPost(xGtmGrowthKey, webReferrerRequest)

Submit a web referrer URL + click id

### Example

```ts
import {
  Configuration,
  AttributionApi,
} from '@gtmeasy/growth-api';
import type { AttributionWebReferrerPostRequest } from '@gtmeasy/growth-api';

async function example() {
  console.log("🚀 Testing @gtmeasy/growth-api SDK...");
  const api = new AttributionApi();

  const body = {
    // string | SDK write key issued from the GTM Easy dashboard for this app.
    xGtmGrowthKey: wk_live_...,
    // WebReferrerRequest
    webReferrerRequest: ...,
  } satisfies AttributionWebReferrerPostRequest;

  try {
    const data = await api.attributionWebReferrerPost(body);
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
| **webReferrerRequest** | [WebReferrerRequest](WebReferrerRequest.md) |  | |

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
| **201** | Web referrer accepted. |  -  |
| **400** | Validation failed — see error message. |  -  |
| **401** | Missing or invalid write key. |  -  |
| **503** | Ingest temporarily unavailable. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

