import {
  HttpConverter,
  httpBytesToAxiosRequest,
  axiosRequestToHttpBytes,
  httpBytesToAxiosResponse,
  axiosResponseToHttpBytes
} from '../src/index';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

// Example 1: Using the HttpConverter class
console.log('=== Example 1: Using HttpConverter class ===');

const converter = new HttpConverter({
  maxBodySize: 1024 * 1024, // 1MB
  preserveHeaderCase: false,
  multipartBoundary: '----CustomBoundary123'
});

// Convert raw HTTP request bytes to Axios config
const httpRequestBytes = new TextEncoder().encode(
  'POST /api/users HTTP/1.1\r\n' +
  'Host: example.com\r\n' +
  'Content-Type: application/json\r\n' +
  'Content-Length: 25\r\n' +
  '\r\n' +
  '{"name":"John","age":30}'
).buffer as ArrayBuffer;

const axiosConfig = converter.httpBytesToAxiosRequest(httpRequestBytes);
console.log('Axios Config:', axiosConfig);

// Convert Axios config back to HTTP bytes
const convertedBytes = await converter.axiosRequestToHttpBytes(axiosConfig);
console.log('Converted back to bytes:', new TextDecoder().decode(convertedBytes));

// Example 2: Using convenience functions
console.log('\n=== Example 2: Using convenience functions ===');

const config: AxiosRequestConfig = {
  method: 'GET',
  url: '/api/users',
  headers: {
    'Authorization': 'Bearer token123',
    'Accept': 'application/json'
  }
};

const httpBytes = await axiosRequestToHttpBytes(config);
console.log('HTTP Request:', new TextDecoder().decode(httpBytes));

// Example 3: Handling multipart form data
console.log('\n=== Example 3: Multipart form data ===');

const multipartRequest = new TextEncoder().encode(
  'POST /api/upload HTTP/1.1\r\n' +
  'Host: example.com\r\n' +
  'Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryABC123\r\n' +
  'Content-Length: 200\r\n' +
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
  '----WebKitFormBoundaryABC123--\r\n'
).buffer as ArrayBuffer;

const multipartConfig = httpBytesToAxiosRequest(multipartRequest);
console.log('Multipart Config:', multipartConfig);

// Example 4: Response conversion
console.log('\n=== Example 4: Response conversion ===');

const httpResponseBytes = new TextEncoder().encode(
  'HTTP/1.1 200 OK\r\n' +
  'Content-Type: application/json\r\n' +
  'Cache-Control: no-cache\r\n' +
  'Content-Length: 35\r\n' +
  '\r\n' +
  '{"success":true,"message":"Hello"}'
).buffer as ArrayBuffer;

const axiosResponse = httpBytesToAxiosResponse(httpResponseBytes);
console.log('Axios Response:', axiosResponse);
console.log('Response data type:', typeof axiosResponse.data);
console.log('Response data:', axiosResponse.data); // Now a JavaScript object, not ArrayBuffer

// Example 4.5: Custom transformResponse
console.log('\n=== Example 4.5: Custom transformResponse ===');

const customConverter = new HttpConverter({
  transformResponse: [
    (data) => {
      if (typeof data === 'object' && data.message) {
        data.message = data.message.toUpperCase();
      }
      return data;
    }
  ]
});

const customResponse = customConverter.httpBytesToAxiosResponse(httpResponseBytes);
console.log('Custom transformed response:', customResponse.data); // message: "HELLO"

// Example 5: Custom axios adapter usage
console.log('\n=== Example 5: Custom axios adapter ===');

// This is how you might use it in a custom axios adapter
class CustomHttpAdapter {
  private converter = new HttpConverter();

  async request(config: AxiosRequestConfig): Promise<AxiosResponse> {
    // Convert Axios config to raw HTTP bytes
    const httpBytes = await this.converter.axiosRequestToHttpBytes(config);
    
    // Send the raw HTTP bytes (e.g., via WebSocket, raw TCP, etc.)
    // const responseBytes = await this.sendHttpBytes(httpBytes);
    
    // For demo purposes, we'll create a mock response
    const mockResponseBytes = new TextEncoder().encode(
      'HTTP/1.1 200 OK\r\n' +
      'Content-Type: application/json\r\n' +
      '\r\n' +
      '{"status":"success"}'
    ).buffer as ArrayBuffer;
    
    // Convert response bytes back to Axios response
    return this.converter.httpBytesToAxiosResponse(mockResponseBytes);
  }

  // This would be your actual implementation for sending HTTP bytes
  private async sendHttpBytes(httpBytes: ArrayBuffer): Promise<ArrayBuffer> {
    // Implementation depends on your transport mechanism
    // Could be WebSocket, raw TCP, etc.
    throw new Error('Not implemented');
  }
}

// Example 6: Error handling
console.log('\n=== Example 6: Error handling ===');

try {
  const invalidBytes = new TextEncoder().encode('Invalid HTTP format');
  httpBytesToAxiosRequest(invalidBytes);
} catch (error) {
  console.log('Caught error:', error.message);
}

// Example 7: Options demonstration
console.log('\n=== Example 7: Options demonstration ===');

const converterWithOptions = new HttpConverter({
  preserveHeaderCase: true,
  maxBodySize: 1024 * 1024, // 1MB
  multipartBoundary: '----CustomBoundary'
});

const configWithHeaders = {
  method: 'GET',
  url: '/api/users',
  headers: {
    'User-Agent': 'MyApp/1.0',
    'Accept': 'application/json'
  }
};

const bytesWithOptions = await converterWithOptions.axiosRequestToHttpBytes(configWithHeaders);
console.log('With preserved header case:', new TextDecoder().decode(bytesWithOptions));

