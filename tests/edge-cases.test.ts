import { HttpConverter } from '../src/converter';

describe('Edge Cases and Error Handling', () => {
  let converter: HttpConverter;

  beforeEach(() => {
    converter = new HttpConverter();
  });

  describe('Request Edge Cases', () => {
    it('should handle empty headers', () => {
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result.method).toBe('get');
      expect(result.url).toBe('/api/users');
      expect(result.headers).toEqual({});
    });

    it('should handle headers with empty values', () => {
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        'X-Custom-Header:\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result.headers).toEqual({
        'x-custom-header': ''
      });
    });

    it('should handle headers with whitespace', () => {
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        'Content-Type:   application/json  \r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result.headers).toEqual({
        'content-type': 'application/json'
      });
    });

    it('should handle malformed header lines', () => {
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        'Invalid-Header\r\n' +
        'Valid-Header: value\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result.headers).toEqual({
        'valid-header': 'value'
      });
    });

    it('should handle different HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      
      for (const method of methods) {
        const httpBytes = new TextEncoder().encode(
          `${method} /api/users HTTP/1.1\r\n` +
          '\r\n'
        ).buffer as ArrayBuffer;

        const result = converter.httpBytesToAxiosRequest(httpBytes);

        expect(result.method).toBe(method.toLowerCase());
        expect(result.url).toBe('/api/users');
      }
    });

    it('should handle URLs with query parameters', () => {
      const httpBytes = new TextEncoder().encode(
        'GET /api/users?page=1&limit=10 HTTP/1.1\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result.url).toBe('/api/users?page=1&limit=10');
    });

    it('should handle URLs with fragments', () => {
      const httpBytes = new TextEncoder().encode(
        'GET /api/users#section1 HTTP/1.1\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result.url).toBe('/api/users#section1');
    });

    it('should handle body with binary data', () => {
      const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xFF]);
      const httpBytes = new TextEncoder().encode(
        'POST /api/upload HTTP/1.1\r\n' +
        'Content-Length: 5\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      // Combine header and binary body
      const combined = new ArrayBuffer(httpBytes.byteLength + binaryData.length);
      const combinedView = new Uint8Array(combined);
      combinedView.set(new Uint8Array(httpBytes), 0);
      combinedView.set(binaryData, httpBytes.byteLength);

      const result = converter.httpBytesToAxiosRequest(combined);

      expect(result.data).toEqual(binaryData.buffer);
    });

    it('should handle large bodies', () => {
      const largeBody = 'x'.repeat(1024 * 1024); // 1MB
      const httpBytes = new TextEncoder().encode(
        'POST /api/upload HTTP/1.1\r\n' +
        'Content-Length: 1048576\r\n' +
        '\r\n' +
        largeBody
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(new TextDecoder().decode(result.data as ArrayBuffer)).toBe(largeBody);
    });
  });

  describe('Response Edge Cases', () => {
    it('should handle different HTTP status codes', () => {
      const statusCodes = [200, 201, 400, 401, 403, 404, 500, 502, 503];
      
      for (const status of statusCodes) {
        const httpBytes = new TextEncoder().encode(
          `HTTP/1.1 ${status} Status Text\r\n` +
          '\r\n'
        ).buffer as ArrayBuffer;

        const result = converter.httpBytesToAxiosResponse(httpBytes);

        expect(result.status).toBe(status);
        expect(result.statusText).toBe('Status Text');
      }
    });

    it('should handle status text with special characters', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 404 Not Found (Resource Missing)\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(404);
      expect(result.statusText).toBe('Not Found (Resource Missing)');
    });

    it('should handle response with chunked transfer encoding', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Transfer-Encoding: chunked\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      expect(result.headers).toEqual({
        'transfer-encoding': 'chunked'
      });
    });

    it('should handle response with multiple values for same header', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Set-Cookie: session=abc123\r\n' +
        'Set-Cookie: user=john\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosResponse(httpBytes);

      // Note: This implementation takes the last value, but a more sophisticated
      // implementation might handle multiple values differently
      expect(result.headers).toEqual({
        'set-cookie': 'user=john'
      });
    });
  });

  describe('Multipart Edge Cases', () => {
    it('should handle multipart with no fields', () => {
      const boundary = '----WebKitFormBoundaryABC123';
      const multipartBody = `--${boundary}--\r\n`;

      const httpBytes = new TextEncoder().encode(
        'POST /api/upload HTTP/1.1\r\n' +
        `Content-Type: multipart/form-data; boundary=${boundary}\r\n` +
        `Content-Length: ${multipartBody.length}\r\n` +
        '\r\n' +
        multipartBody
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result.data).toBeInstanceOf(FormData);
    });

    it('should handle multipart with empty field values', () => {
      const boundary = '----WebKitFormBoundaryABC123';
      const multipartBody = 
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="empty_field"\r\n' +
        '\r\n' +
        '\r\n' +
        `--${boundary}--\r\n`;

      const httpBytes = new TextEncoder().encode(
        'POST /api/upload HTTP/1.1\r\n' +
        `Content-Type: multipart/form-data; boundary=${boundary}\r\n` +
        `Content-Length: ${multipartBody.length}\r\n` +
        '\r\n' +
        multipartBody
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result.data).toBeInstanceOf(FormData);
    });

    it('should handle multipart with file without content type', () => {
      const boundary = '----WebKitFormBoundaryABC123';
      const multipartBody = 
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n' +
        '\r\n' +
        'File content\r\n' +
        `--${boundary}--\r\n`;

      const httpBytes = new TextEncoder().encode(
        'POST /api/upload HTTP/1.1\r\n' +
        `Content-Type: multipart/form-data; boundary=${boundary}\r\n` +
        `Content-Length: ${multipartBody.length}\r\n` +
        '\r\n' +
        multipartBody
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result.data).toBeInstanceOf(FormData);
    });

    it('should throw error for multipart without boundary', () => {
      const httpBytes = new TextEncoder().encode(
        'POST /api/upload HTTP/1.1\r\n' +
        'Content-Type: multipart/form-data\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      expect(() => {
        converter.httpBytesToAxiosRequest(httpBytes);
      }).toThrow('No boundary found in multipart content type');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for empty input', () => {
      const emptyBytes = new ArrayBuffer(0);

      expect(() => {
        converter.httpBytesToAxiosRequest(emptyBytes);
      }).toThrow('Invalid HTTP request format');
    });

    it('should throw error for malformed request line', () => {
      const malformedBytes = new TextEncoder().encode(
        'GET\r\n' +  // Missing URL and version
        '\r\n'
      ).buffer as ArrayBuffer;

      expect(() => {
        converter.httpBytesToAxiosRequest(malformedBytes);
      }).toThrow('Invalid request line');
    });

    it('should throw error for malformed response line', () => {
      const malformedBytes = new TextEncoder().encode(
        'HTTP/1.1\r\n' +  // Missing status code and text
        '\r\n'
      ).buffer as ArrayBuffer;

      expect(() => {
        converter.httpBytesToAxiosResponse(malformedBytes);
      }).toThrow('Invalid status line');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle many headers efficiently', () => {
      const headers = Array.from({ length: 100 }, (_, i) => 
        `Header-${i}: Value-${i}`
      ).join('\r\n');

      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        headers + '\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(Object.keys(result.headers || {})).toHaveLength(100);
    });

    it('should handle very long URLs', () => {
      const longUrl = '/api/' + 'a'.repeat(1000);
      const httpBytes = new TextEncoder().encode(
        `GET ${longUrl} HTTP/1.1\r\n` +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result.url).toBe(longUrl);
    });

    it('should handle very long header values', () => {
      const longValue = 'x'.repeat(10000);
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        `X-Long-Header: ${longValue}\r\n` +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);

      expect(result.headers?.['x-long-header']).toBe(longValue);
    });
  });
});
