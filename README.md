# convert_axios_http

A TypeScript utility that converts between raw HTTP messages and axios request/response objects.

## Features

- Convert a raw HTTP request (ArrayBuffer of bytes) into an axios request object.
- Convert an axios request object into raw HTTP bytes.
- Convert a raw HTTP response (ArrayBuffer of bytes) into an axios response object.
- Convert an axios response object into raw HTTP bytes.

Supports multipart forms and basic file uploads in both directions.

## Installation

```bash
npm install convert_axios_http
```

## Usage

### Converting requests

```ts
import {
  rawHttpRequestToAxiosRequest,
  axiosRequestToRawHttp,
} from 'convert_axios_http';

const raw = axiosRequestToRawHttp({ method: 'get', url: '/' });
const req = rawHttpRequestToAxiosRequest(raw);
```

### Converting responses

```ts
import {
  rawHttpResponseToAxiosResponse,
  axiosResponseToRawHttp,
} from 'convert_axios_http';

const rawRes = axiosResponseToRawHttp({
  data: { ok: true },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
});
const res = rawHttpResponseToAxiosResponse(rawRes);
```

## Running tests

```bash
npm test
```

