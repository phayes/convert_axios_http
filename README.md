# Convert Axios ↔ raw HTTP

A TypeScript utility package for converting between raw HTTP bytes and Axios request/response objects. This package provides seamless conversion capabilities for HTTP requests and responses, including support for multipart form data and file uploads.

## Features

- **Bidirectional Conversion**: Convert between raw HTTP bytes and Axios objects in both directions
- **Multipart Support**: Full support for multipart/form-data requests and file uploads
- **TypeScript**: Fully typed with comprehensive TypeScript definitions
- **Configurable**: Customizable options for body size limits, header case preservation, and multipart boundaries
- **Error Handling**: Robust error handling with specific error types
- **Performance**: Optimized for handling large requests and responses

## Installation

```bash
npm install convert-axios-http axios
```

**Note**: This package requires `axios` as a peer dependency. Make sure to install it in your project.

### Node.js Setup

For Node.js environments, you have several options:

#### Option 1: Node.js 18+ with Experimental Web APIs (Recommended)
```bash
node --experimental-global-webcrypto --experimental-fetch your-script.js
```

#### Option 2: Use Polyfills
Install and configure polyfills for older Node.js versions:

```bash
npm install form-data blob-polyfill
```

```javascript
// At the top of your entry file
import 'blob-polyfill';
import FormData from 'form-data';

// Make FormData globally available
global.FormData = FormData;
```

## Quick Start

```typescript
import { HttpConverter } from 'convert-axios-http';

// Create a converter instance
const converter = new HttpConverter();

// Convert raw HTTP request bytes to Axios config
const httpBytes = new TextEncoder().encode(
  'POST /api/users HTTP/1.1\r\n' +
  'Content-Type: application/json\r\n' +
  '\r\n' +
  '{"name":"John","age":30}'
);

const axiosConfig = converter.httpBytesToAxiosRequest(httpBytes);
console.log(axiosConfig);
// Output: { method: 'post', url: '/api/users', headers: {...}, data: {...} }

// Convert Axios config back to HTTP bytes
const convertedBytes = await converter.axiosRequestToHttpBytes(axiosConfig);
```

## API Reference

### HttpConverter Class

The main converter class that handles all HTTP conversions.

#### Constructor

```typescript
new HttpConverter(options?: ConverterOptions)
```

**Options:**
- `maxBodySize?: number` - Maximum size of request/response body in bytes (default: unbounded)
- `preserveHeaderCase?: boolean` - Whether to preserve original headers case (default: false)
- `multipartBoundary?: string` - Custom boundary for multipart requests (default: auto-generated)
- `transformResponse?: Array<(data: any, headers?: Record<string, string>) => any>` - Custom transform functions for response data (similar to axios's transformResponse)

#### Methods

##### `httpBytesToAxiosRequest(httpBytes: ArrayBuffer): AxiosRequestConfig`

Converts raw HTTP request bytes to an Axios request configuration object.

```typescript
const httpBytes = new TextEncoder().encode(
  'GET /api/users HTTP/1.1\r\n' +
  'Host: example.com\r\n' +
  '\r\n'
);

const config = converter.httpBytesToAxiosRequest(httpBytes);
```

##### `axiosRequestToHttpBytes(config: AxiosRequestConfig): Promise<ArrayBuffer>`

Converts an Axios request configuration to raw HTTP request bytes. 

```typescript
const config: AxiosRequestConfig = {
  method: 'POST',
  url: '/api/users',
  headers: { 'Content-Type': 'application/json' },
  data: { name: 'John' }
};

const httpBytes = await converter.axiosRequestToHttpBytes(config);
```

##### `httpBytesToAxiosResponse(httpBytes: ArrayBuffer): AxiosResponse`

Converts raw HTTP response bytes to an Axios response object.

```typescript
const httpBytes = new TextEncoder().encode(
  'HTTP/1.1 200 OK\r\n' +
  'Content-Type: application/json\r\n' +
  '\r\n' +
  '{"message":"Hello"}'
);

const response = converter.httpBytesToAxiosResponse(httpBytes);

// The response.data will be automatically parsed based on content-type:
// - JSON responses are parsed into JavaScript objects
// - Text responses are converted to strings
// - Binary responses remain as ArrayBuffer
console.log(response.data); // { message: "Hello" }
```

##### `axiosResponseToHttpBytes(response: AxiosResponse): ArrayBuffer`

Converts an Axios response object to raw HTTP response bytes.

```typescript
const response: AxiosResponse = {
  status: 200,
  statusText: 'OK',
  headers: { 'content-type': 'application/json' },
  data: { message: 'Hello' },
  config: {} as AxiosRequestConfig,
  request: {}
};

const httpBytes = converter.axiosResponseToHttpBytes(response);
```

### Convenience Functions

For simple one-off conversions, you can use the convenience functions:

```typescript
import {
  httpBytesToAxiosRequest,
  axiosRequestToHttpBytes,
  httpBytesToAxiosResponse,
  axiosResponseToHttpBytes
} from 'convert-axios-http';

// These functions create a temporary converter instance
const config = httpBytesToAxiosRequest(httpBytes);
const bytes = await axiosRequestToHttpBytes(config);
```

## Examples

### Basic Request Conversion

```typescript
import { HttpConverter } from 'convert-axios-http';

const converter = new HttpConverter();

// Raw HTTP request
const httpRequest = 
  'POST /api/users HTTP/1.1\r\n' +
  'Host: example.com\r\n' +
  'Content-Type: application/json\r\n' +
  'Authorization: Bearer token123\r\n' +
  'Content-Length: 25\r\n' +
  '\r\n' +
  '{"name":"John","age":30}';

const httpBytes = new TextEncoder().encode(httpRequest);
const axiosConfig = converter.httpBytesToAxiosRequest(httpBytes);

console.log(axiosConfig);
// {
//   method: 'post',
//   url: '/api/users',
//   headers: {
//     'host': 'example.com',
//     'content-type': 'application/json',
//     'authorization': 'Bearer token123',
//     'content-length': '25'
//   },
//   data: ArrayBuffer { ... }
// }

// Convert back to HTTP bytes
const convertedBytes = await converter.axiosRequestToHttpBytes(axiosConfig);
```

### Response Transformation

The converter automatically applies axios's transformResponse pipeline to response data:

```typescript
// JSON responses are automatically parsed
const jsonResponse = converter.httpBytesToAxiosResponse(jsonBytes);
console.log(jsonResponse.data); // JavaScript object, not string

// Text responses are converted to strings
const textResponse = converter.httpBytesToAxiosResponse(textBytes);
console.log(textResponse.data); // String, not ArrayBuffer

// Binary responses remain as ArrayBuffer
const binaryResponse = converter.httpBytesToAxiosResponse(binaryBytes);
console.log(binaryResponse.data); // ArrayBuffer
```

The converter supports all content types that axios handles by default:

| Content-Type header                 | Default behavior                           |
| ----------------------------------- | ------------------------------------------ |
| `application/json`                  | `JSON.parse` → JavaScript object           |
| `application/*+json`                | `JSON.parse` → JavaScript object           |
| `text/*` (e.g., `text/plain`)       | Returns as plain string                    |
| `application/x-www-form-urlencoded` | Returns as plain string (not auto-parsed)  |
| `application/xml` or `text/xml`     | Returns as plain string (no XML parsing)   |
| `application/octet-stream`          | Returns as raw ArrayBuffer                 |
| Others (e.g., `image/png`, `pdf`)   | Returns as text string if decodable        |

You can also provide custom transform functions:

```typescript
const converter = new HttpConverter({
  transformResponse: [
    (data) => {
      // Custom transformation logic
      if (typeof data === 'object' && data.message) {
        data.message = data.message.toUpperCase();
      }
      return data;
    }
  ]
});

const response = converter.httpBytesToAxiosResponse(httpBytes);
console.log(response.data.message); // "HELLO" (uppercase)
```

### Multipart Form Data

```typescript
const multipartRequest = 
  'POST /api/upload HTTP/1.1\r\n' +
  'Host: example.com\r\n' +
  'Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryABC123\r\n' +
  '\r\n' +
  '----WebKitFormBoundaryABC123\r\n' +
  'Content-Disposition: form-data; name="name"\r\n' +
  '\r\n' +
  'John Doe\r\n' +
  '----WebKitFormBoundaryABC123\r\n' +
  'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n' +
  'Content-Type: text/plain\r\n' +
  '\r\n' +
  'Hello World\r\n' +
  '----WebKitFormBoundaryABC123--\r\n';

const httpBytes = new TextEncoder().encode(multipartRequest);
const config = converter.httpBytesToAxiosRequest(httpBytes);

// config.data will be a FormData object
console.log(config.data instanceof FormData); // true
```

### Custom Axios Adapter

You can use this package as an axios adapter to transform axios requests into raw HTTP Requests, handle them however you'd like (including whatever custom transport you'd like) then transform the result back into an axios response. 

```typescript
import { your_custom_transport_func } from './your_custom_transport_func';
import { HttpConverter } from 'convert-axios-http';
import { AxiosHeaders, RawAxiosRequestHeaders, AxiosRequestHeaders, AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig } from "axios";

let converter = new HttpConverter();

export default (config: AxiosRequestConfig) => {
  return new Promise((resolve, reject) => {
    converter.axiosRequestToHttpBytes(config).then((httpBytes) => {
      your_custom_transport_func(httpBytes).then((responseBytes) => {
        let response = converter.httpBytesToAxiosResponse(responseBytes);

        config.headers = normalizeAxiosRequestHeaders(config.headers);
        response.config = config as InternalAxiosRequestConfig;

        if (response.status < 300) {
          return resolve(response);
        }
        else {
          let err = new AxiosError(
            'Request failed with status code ' + response.status,
            [AxiosError.ERR_BAD_REQUEST, AxiosError.ERR_BAD_RESPONSE][Math.floor(response.status / 100) - 4],
            response.config,
            config,
            response
          );
          return reject(err);
        }
      });
    });
  });
};

// Normalize headers so they’re always AxiosHeaders.
function normalizeAxiosRequestHeaders(
  headers?: RawAxiosRequestHeaders | AxiosHeaders
): AxiosRequestHeaders {
  if (!headers) {
    return new AxiosHeaders(); // empty
  }
  // If it's already an AxiosHeaders, just return as-is
  if (headers instanceof AxiosHeaders) {
    return headers as AxiosRequestHeaders;
  }
  // Otherwise, convert to AxiosHeaders
  return AxiosHeaders.from(headers as any);
}

// Apply the adapter
axios.defaults.adapter = AxiosHttpProxy;
```

### Error Handling

```typescript
import { HttpConverter } from 'convert-axios-http';
import type { ConversionError } from 'convert-axios-http';

const converter = new HttpConverter();

try {
  const invalidBytes = new TextEncoder().encode('Invalid HTTP format');
  converter.httpBytesToAxiosRequest(invalidBytes);
} catch (error) {
  const conversionError = error as ConversionError;
  console.log('Error code:', conversionError.code);
  console.log('Error message:', conversionError.message);
  console.log('Error details:', conversionError.details);
}
```

### Configuration Options

```typescript
const converter = new HttpConverter({
  maxBodySize: 1024 * 1024, // 1MB limit
  preserveHeaderCase: true,  // Keep original header case
  multipartBoundary: '----CustomBoundary123' // Custom boundary
});

// This will preserve header case
const config = {
  method: 'GET',
  url: '/api/users',
  headers: {
    'User-Agent': 'MyApp/1.0',
    'Accept': 'application/json'
  }
};

const httpBytes = await converter.axiosRequestToHttpBytes(config);
// Headers will be preserved as "User-Agent" and "Accept"
```

## Error Types

The package defines specific error types for different failure scenarios:

- `INVALID_HTTP_FORMAT` - Malformed HTTP request/response
- `UNSUPPORTED_METHOD` - HTTP method not supported
- `BODY_TOO_LARGE` - Request/response body exceeds size limit
- `INVALID_MULTIPART` - Invalid multipart form data
- `INVALID_URL` - Invalid URL format

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Building

```bash
# Build the package
npm run build

# Clean build artifacts
npm run clean
```
