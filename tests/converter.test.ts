import { HttpConverter } from '../src/converter';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

// Helper functions for creating binary data in tests
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

describe('HttpConverter', () => {
  let converter: HttpConverter;

  beforeEach(() => {
    converter = new HttpConverter();
  });

  describe('httpBytesToAxiosRequest', () => {
    it('should convert simple GET request', () => {
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        'Host: example.com\r\n' +
        'User-Agent: Test/1.0\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result).toEqual({
        method: 'get',
        url: '/api/users',
        headers: {
          'host': 'example.com',
          'user-agent': 'Test/1.0'
        },
        data: new ArrayBuffer(0)
      });
    });

    it('should convert POST request with JSON body', () => {
      const body = '{"name":"John","age":30}';
      const httpBytes = new TextEncoder().encode(
        'POST /api/users HTTP/1.1\r\n' +
        'Host: example.com\r\n' +
        'Content-Type: application/json\r\n' +
        'Content-Length: 25\r\n' +
        '\r\n' +
        body
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result.method).toBe('post');
      expect(result.url).toBe('/api/users');
      expect(result.headers).toEqual({
        'host': 'example.com',
        'content-type': 'application/json',
        'content-length': '25'
      });
      expect(new TextDecoder().decode(result.data as ArrayBuffer)).toBe(body);
    });

    it('should convert POST request with form data', () => {
      const body = 'name=John&age=30';
      const httpBytes = new TextEncoder().encode(
        'POST /api/users HTTP/1.1\r\n' +
        'Host: example.com\r\n' +
        'Content-Type: application/x-www-form-urlencoded\r\n' +
        'Content-Length: 15\r\n' +
        '\r\n' +
        body
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result.method).toBe('post');
      expect(result.url).toBe('/api/users');
      expect(result.headers).toEqual({
        'host': 'example.com',
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': '15'
      });
      expect(new TextDecoder().decode(result.data as ArrayBuffer)).toBe(body);
    });

    it('should handle multipart form data', () => {
      const boundary = '----WebKitFormBoundaryABC123';
      const multipartBody = 
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="name"\r\n' +
        '\r\n' +
        'John\r\n' +
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n' +
        'Content-Type: text/plain\r\n' +
        '\r\n' +
        'Hello World\r\n' +
        `--${boundary}--\r\n`;

      const httpBytes = new TextEncoder().encode(
        'POST /api/upload HTTP/1.1\r\n' +
        'Host: example.com\r\n' +
        `Content-Type: multipart/form-data; boundary=${boundary}\r\n` +
        `Content-Length: ${multipartBody.length}\r\n` +
        '\r\n' +
        multipartBody
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result.method).toBe('post');
      expect(result.url).toBe('/api/upload');
      expect(result.headers).toMatchObject({
        'host': 'example.com',
        'content-type': `multipart/form-data; boundary=${boundary}`
      });
      expect(result.data).toBeInstanceOf(FormData);
    });

    it('should throw error for invalid HTTP format', () => {
      const invalidBytes = new TextEncoder().encode('Invalid HTTP').buffer as ArrayBuffer;

      expect(() => {
        converter.httpBytesToAxiosRequest(invalidBytes);
      }).toThrow('Invalid HTTP request format');
    });
  });

  describe('axiosRequestToHttpBytes', () => {
    it('should convert simple GET request', async () => {
      const config: AxiosRequestConfig = {
        method: 'GET',
        url: '/api/users',
        headers: {
          'Host': 'example.com',
          'User-Agent': 'Test/1.0'
        }
      };

      const result = await converter.axiosRequestToHttpBytes(config);
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('GET /api/users HTTP/1.1');
      expect(resultText).toContain('host: example.com');
      expect(resultText).toContain('user-agent: Test/1.0');
    });

    it('should convert POST request with JSON body', async () => {
      const config: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        headers: {
          'Content-Type': 'application/json'
        },
        data: { name: 'John', age: 30 }
      };

      const result = await converter.axiosRequestToHttpBytes(config);
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('POST /api/users HTTP/1.1');
      expect(resultText).toContain('Content-Type: application/json');
      expect(resultText).toContain('{"name":"John","age":30}');
    });

    it('should convert POST request with string body', async () => {
      const config: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: 'Hello World'
      };

      const result = await converter.axiosRequestToHttpBytes(config);
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('POST /api/users HTTP/1.1');
      expect(resultText).toContain('Hello World');
    });

    it('should convert POST request with ArrayBuffer body', async () => {
      const body = new TextEncoder().encode('Binary Data');
      const config: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/upload',
        data: body
      };

      const result = await converter.axiosRequestToHttpBytes(config);
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('POST /api/upload HTTP/1.1');
      expect(resultText).toContain('Binary Data');
    });

    it('should handle FormData', () => {
      const formData = new FormData();
      formData.append('name', 'John');
      formData.append('age', '30');

      const config: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: formData
      };

      const result = converter.axiosRequestToHttpBytes(config);
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('POST /api/users HTTP/1.1');
      expect(resultText).toContain('Content-Type: multipart/form-data');
      expect(resultText).toContain('Content-Disposition: form-data; name="name"');
      expect(resultText).toContain('Content-Disposition: form-data; name="age"');
    });

    it('should use default method GET when not specified', () => {
      const config: AxiosRequestConfig = {
        url: '/api/users'
      };

      const result = converter.axiosRequestToHttpBytes(config);
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('GET /api/users HTTP/1.1');
    });
  });

  describe('httpBytesToAxiosResponse', () => {
    it('should convert simple response', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: application/json\r\n' +
        'Content-Length: 25\r\n' +
        '\r\n' +
        '{"message":"Hello World"}'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      expect(result.statusText).toBe('OK');
      expect(result.headers).toEqual({
        'content-type': 'application/json',
        'content-length': '25'
      });
      expect(result.data).toEqual({ message: 'Hello World' });
    });

    it('should convert response without body', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 204 No Content\r\n' +
        'Server: nginx\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(204);
      expect(result.statusText).toBe('No Content');
      expect(result.headers).toEqual({
        'server': 'nginx'
      });
      expect(result.data).toBeUndefined();
    });

    it('should throw error for invalid HTTP response format', () => {
      const invalidBytes = new TextEncoder().encode('Invalid HTTP Response').buffer as ArrayBuffer;

      expect(() => {
        converter.httpBytesToAxiosResponse(invalidBytes);
      }).toThrow('Invalid HTTP response format');
    });
  });

  describe('axiosResponseToHttpBytes', () => {
    it('should convert simple response', () => {
      const response: AxiosResponse = {
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json'
        },
        data: { message: 'Hello World' },
        config: {} as any,
        request: {}
      };

      const result = converter.axiosResponseToHttpBytes(response);
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('HTTP/1.1 200 OK');
      expect(resultText).toContain('content-type: application/json');
      expect(resultText).toContain('{"message":"Hello World"}');
    });

    it('should convert response with string data', () => {
      const response: AxiosResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'Hello World',
        config: {} as any,
        request: {}
      };

      const result = converter.axiosResponseToHttpBytes(response);
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('HTTP/1.1 200 OK');
      expect(resultText).toContain('Hello World');
    });

    it('should convert response with ArrayBuffer data', () => {
      const data = new TextEncoder().encode('Binary Response');
      const response: AxiosResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: data,
        config: {} as any,
        request: {}
      };

      const result = converter.axiosResponseToHttpBytes(response);
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('HTTP/1.1 200 OK');
      expect(resultText).toContain('Binary Response');
    });

    it('should convert response without data', () => {
      const response: AxiosResponse = {
        status: 204,
        statusText: 'No Content',
        headers: {
          'server': 'nginx'
        },
        data: undefined,
        config: {} as any,
        request: {}
      };

      const result = converter.axiosResponseToHttpBytes(response);
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('HTTP/1.1 204 No Content');
      expect(resultText).toContain('server: nginx');
    });
  });

  describe('options', () => {
    it('should preserve header case when option is set', () => {
      const converterWithCase = new HttpConverter({ preserveHeaderCase: true });
      
      const config: AxiosRequestConfig = {
        method: 'GET',
        url: '/api/users',
        headers: {
          'User-Agent': 'Test/1.0',
          'Accept': 'application/json'
        }
      };

      const result = converterWithCase.axiosRequestToHttpBytes(config);
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('User-Agent: Test/1.0');
      expect(resultText).toContain('Accept: application/json');
    });

    it('should use custom multipart boundary', () => {
      const customBoundary = '----CustomBoundary123';
      const converterWithBoundary = new HttpConverter({ multipartBoundary: customBoundary });
      
      const formData = new FormData();
      formData.append('name', 'John');

      const config: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: formData
      };

      const result = converterWithBoundary.axiosRequestToHttpBytes(config);
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain(`Content-Type: multipart/form-data; boundary=${customBoundary}`);
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain data integrity for request conversion', () => {
      const originalConfig: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token123'
        },
        data: { name: 'John', age: 30 }
      };

      const httpBytes = converter.axiosRequestToHttpBytes(originalConfig);
      const convertedConfig = converter.httpBytesToAxiosRequest(httpBytes);

      expect(convertedConfig.method).toBe(originalConfig.method?.toLowerCase());
      expect(convertedConfig.url).toBe(originalConfig.url);
      expect(convertedConfig.headers).toMatchObject({
        'content-type': 'application/json',
        'authorization': 'Bearer token123'
      });
      expect(new TextDecoder().decode(convertedConfig.data as ArrayBuffer))
        .toBe(JSON.stringify(originalConfig.data));
    });

    it('should maintain data integrity for response conversion', () => {
      const originalResponse: AxiosResponse = {
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-cache'
        },
        data: { success: true, message: 'Success' },
        config: {} as any,
        request: {}
      };

      const httpBytes = converter.axiosResponseToHttpBytes(originalResponse);
      const convertedResponse = converter.httpBytesToAxiosResponse(httpBytes);

      expect(convertedResponse.status).toBe(originalResponse.status);
      expect(convertedResponse.statusText).toBe(originalResponse.statusText);
      expect(convertedResponse.headers).toMatchObject({
        'content-type': 'application/json',
        'cache-control': 'no-cache'
      });
      expect(convertedResponse.data).toEqual(originalResponse.data);
    });
  });

  describe('Content Type Transformations', () => {
    it('should handle application/json content type', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: application/json\r\n' +
        '\r\n' +
        '{"message":"Hello","count":42}'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      expect(result.data).toEqual({
        message: 'Hello',
        count: 42
      });
    });

    it('should handle application/*+json content types', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: application/vnd.api+json\r\n' +
        '\r\n' +
        '{"data":{"type":"user","id":"1"}}'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      expect(result.data).toEqual({
        data: {
          type: 'user',
          id: '1'
        }
      });
    });

    it('should handle text/plain content type', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: text/plain\r\n' +
        '\r\n' +
        'Hello World'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      expect(result.data).toBe('Hello World');
    });

    it('should handle text/html content type', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: text/html\r\n' +
        '\r\n' +
        '<html><body><h1>Hello</h1></body></html>'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      expect(result.data).toBe('<html><body><h1>Hello</h1></body></html>');
    });

    it('should handle application/x-www-form-urlencoded content type', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: application/x-www-form-urlencoded\r\n' +
        '\r\n' +
        'name=John&age=30&city=New+York'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      expect(result.data).toBe('name=John&age=30&city=New+York');
    });

    it('should handle application/xml content type', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: application/xml\r\n' +
        '\r\n' +
        '<?xml version="1.0"?><user><name>John</name><age>30</age></user>'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      expect(result.data).toBe('<?xml version="1.0"?><user><name>John</name><age>30</age></user>');
    });

    it('should handle text/xml content type', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: text/xml\r\n' +
        '\r\n' +
        '<?xml version="1.0"?><user><name>John</name></user>'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      expect(result.data).toBe('<?xml version="1.0"?><user><name>John</name></user>');
    });

    it('should handle application/octet-stream content type', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: application/octet-stream\r\n' +
        '\r\n' +
        'binary-data-here'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      expect(result.data).toBe('binary-data-here');
    });

    it('should handle image/png content type as text', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: image/png\r\n' +
        '\r\n' +
        'fake-png-data'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      expect(result.data).toBe('fake-png-data');
    });

    it('should handle application/javascript content type', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: application/javascript\r\n' +
        '\r\n' +
        'console.log("Hello World");'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      expect(result.data).toBe('console.log("Hello World");');
    });

    it('should handle malformed JSON gracefully', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: application/json\r\n' +
        '\r\n' +
        '{"message":"hello"'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      // Should return raw ArrayBuffer when JSON parsing fails
      expect(result.data).toBeInstanceOf(ArrayBuffer);
    });

    it('should handle PNG image content type as text', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: image/png\r\n' +
        '\r\n' +
        'fake-png-data'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      expect(result.data).toBe('fake-png-data');
    });

    it('should handle application/octet-stream with text data as text', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: application/octet-stream\r\n' +
        '\r\n' +
        'This is text data in octet-stream'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      expect(result.data).toBe('This is text data in octet-stream');
    });
  });

  describe('FormData with File objects', () => {
    it('should handle FormData with File objects correctly', async () => {
      // Simulate the exact scenario from the user's bug report
      const imageData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]); // JPEG header
      const imageFile = new File([imageData], "quill_image.jpg", { type: "image/jpeg" });
      
      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("title", "Untitled");
      formData.append("description", "");
      formData.append("category", "quill_image");
      formData.append("clinic_id", "16643a5b-af6c-402d-b84d-39f244e73995");
      formData.append("filename", "quill_image.jpg");
      formData.append("mime", "image/jpeg");
      formData.append("public", "true");

      const config: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/file/upload',
        data: formData
      };

      const result = await converter.axiosRequestToHttpBytes(config);
      const resultText = new TextDecoder().decode(result);

      // Verify the multipart structure is correct
      expect(resultText).toContain('POST /api/file/upload HTTP/1.1');
      expect(resultText).toContain('Content-Type: multipart/form-data');
      expect(resultText).toContain('Content-Disposition: form-data; name="file"; filename="quill_image.jpg"');
      expect(resultText).toContain('Content-Type: image/jpeg');
      expect(resultText).toContain('Content-Disposition: form-data; name="title"');
      expect(resultText).toContain('Content-Disposition: form-data; name="description"');
      expect(resultText).toContain('Content-Disposition: form-data; name="category"');
      expect(resultText).toContain('Content-Disposition: form-data; name="clinic_id"');
      expect(resultText).toContain('Content-Disposition: form-data; name="filename"');
      expect(resultText).toContain('Content-Disposition: form-data; name="mime"');
      expect(resultText).toContain('Content-Disposition: form-data; name="public"');
      
      // Verify there's only one Content-Type header for multipart/form-data
      const contentTypeMatches = resultText.match(/Content-Type: multipart\/form-data/g);
      expect(contentTypeMatches).toHaveLength(1);
      
      // Verify the file data is actually included (not empty)
      expect(resultText).toContain('\xFF\xD8\xFF\xE0'); // JPEG header bytes
    });
  });
});
