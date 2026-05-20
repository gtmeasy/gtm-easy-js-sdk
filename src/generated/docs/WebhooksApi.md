# WebhooksApi

All URIs are relative to *https://www.gtmeasy.com/api/v1/growth*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**webhookAppstorePost**](WebhooksApi.md#webhookappstorepost) | **POST** /webhook/appstore | App Store Server Notifications V2 |
| [**webhookPlaystorePost**](WebhooksApi.md#webhookplaystorepost) | **POST** /webhook/playstore | Google Play Real-time Developer Notifications |



## webhookAppstorePost

> GenericOkResponse webhookAppstorePost(appStoreWebhookRequest)

App Store Server Notifications V2

Apple sends signed payloads here when a subscription state changes (renew, refund, expire, etc).

### Example

```ts
import {
  Configuration,
  WebhooksApi,
} from '@gtmeasy/growth-api';
import type { WebhookAppstorePostRequest } from '@gtmeasy/growth-api';

async function example() {
  console.log("🚀 Testing @gtmeasy/growth-api SDK...");
  const api = new WebhooksApi();

  const body = {
    // AppStoreWebhookRequest
    appStoreWebhookRequest: ...,
  } satisfies WebhookAppstorePostRequest;

  try {
    const data = await api.webhookAppstorePost(body);
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
| **appStoreWebhookRequest** | [AppStoreWebhookRequest](AppStoreWebhookRequest.md) |  | |

### Return type

[**GenericOkResponse**](GenericOkResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Notification accepted. |  -  |
| **400** | Validation failed — see error message. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## webhookPlaystorePost

> GenericOkResponse webhookPlaystorePost(playStoreWebhookRequest)

Google Play Real-time Developer Notifications

Pub/Sub-delivered notifications for Play subscription state changes + voided purchases.

### Example

```ts
import {
  Configuration,
  WebhooksApi,
} from '@gtmeasy/growth-api';
import type { WebhookPlaystorePostRequest } from '@gtmeasy/growth-api';

async function example() {
  console.log("🚀 Testing @gtmeasy/growth-api SDK...");
  const api = new WebhooksApi();

  const body = {
    // PlayStoreWebhookRequest
    playStoreWebhookRequest: ...,
  } satisfies WebhookPlaystorePostRequest;

  try {
    const data = await api.webhookPlaystorePost(body);
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
| **playStoreWebhookRequest** | [PlayStoreWebhookRequest](PlayStoreWebhookRequest.md) |  | |

### Return type

[**GenericOkResponse**](GenericOkResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Notification accepted. |  -  |
| **400** | Validation failed — see error message. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

