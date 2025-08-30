import { HttpConverter } from '../src/converter';

describe('Configuration Options', () => {
  describe('maxBodySize Configuration', () => {
    it('should handle unbounded maxBodySize by default', () => {
      const converter = new HttpConverter();
      
      // Test that large bodies are handled without size restrictions
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

    it('should accept explicit maxBodySize value', () => {
      const maxSize = 1024 * 1024; // 1MB
      const converter = new HttpConverter({ maxBodySize: maxSize });
      
      // Test that bodies within the limit are handled
      const body = 'x'.repeat(512 * 1024); // 512KB
      const httpBytes = new TextEncoder().encode(
        'POST /api/upload HTTP/1.1\r\n' +
        'Content-Length: 524288\r\n' +
        '\r\n' +
        body
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);
      expect(new TextDecoder().decode(result.data as ArrayBuffer)).toBe(body);
    });

    it('should accept explicit undefined maxBodySize', () => {
      const converter = new HttpConverter({ maxBodySize: undefined });
      
      // Test that large bodies are still handled
      const largeBody = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const httpBytes = new TextEncoder().encode(
        'POST /api/upload HTTP/1.1\r\n' +
        'Content-Length: 2097152\r\n' +
        '\r\n' +
        largeBody
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);
      expect(new TextDecoder().decode(result.data as ArrayBuffer)).toBe(largeBody);
    });

    it('should accept zero maxBodySize', () => {
      const converter = new HttpConverter({ maxBodySize: 0 });
      
      // Test that empty bodies are handled
      const httpBytes = new TextEncoder().encode(
        'GET /api/test HTTP/1.1\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);
      expect(result.data).toEqual(new ArrayBuffer(0));
    });

    it('should accept large maxBodySize values', () => {
      const largeSize = 100 * 1024 * 1024; // 100MB
      const converter = new HttpConverter({ maxBodySize: largeSize });
      
      // Test that large bodies within the limit are handled
      const body = 'x'.repeat(50 * 1024 * 1024); // 50MB
      const httpBytes = new TextEncoder().encode(
        'POST /api/upload HTTP/1.1\r\n' +
        'Content-Length: 52428800\r\n' +
        '\r\n' +
        body
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);
      expect(new TextDecoder().decode(result.data as ArrayBuffer)).toBe(body);
    });
  });

  describe('preserveHeaderCase Configuration', () => {
    it('should have preserveHeaderCase false by default', () => {
      const converter = new HttpConverter();
      
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        'User-Agent: Test/1.0\r\n' +
        'Accept: application/json\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);
      
      // Headers should be lowercase by default
      expect(result.headers).toEqual({
        'user-agent': 'Test/1.0',
        'accept': 'application/json'
      });
    });

    it('should accept explicit preserveHeaderCase true', () => {
      const converter = new HttpConverter({ preserveHeaderCase: true });
      
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        'User-Agent: Test/1.0\r\n' +
        'Accept: application/json\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);
      
      // Headers should preserve original case
      expect(result.headers).toEqual({
        'User-Agent': 'Test/1.0',
        'Accept': 'application/json'
      });
    });

    it('should accept explicit preserveHeaderCase false', () => {
      const converter = new HttpConverter({ preserveHeaderCase: false });
      
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        'User-Agent: Test/1.0\r\n' +
        'Accept: application/json\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);
      
      // Headers should be lowercase
      expect(result.headers).toEqual({
        'user-agent': 'Test/1.0',
        'accept': 'application/json'
      });
    });
  });

  describe('multipartBoundary Configuration', () => {
    it('should auto-generate multipartBoundary by default', () => {
      const converter = new HttpConverter();
      
      const formData = new FormData();
      formData.append('name', 'John');
      formData.append('file', new Blob(['Hello World'], { type: 'text/plain' }), 'test.txt');
      
      const config = {
        method: 'POST',
        url: '/api/upload',
        data: formData
      };

      const httpBytes = converter.axiosRequestToHttpBytes(config);
      const httpText = new TextDecoder().decode(httpBytes);
      
      // Should contain a boundary
      expect(httpText).toMatch(/boundary=----WebKitFormBoundary/);
    });

    it('should accept explicit multipartBoundary', () => {
      const customBoundary = '----CustomBoundary123';
      const converter = new HttpConverter({ multipartBoundary: customBoundary });
      
      const formData = new FormData();
      formData.append('name', 'John');
      
      const config = {
        method: 'POST',
        url: '/api/upload',
        data: formData
      };

      const httpBytes = converter.axiosRequestToHttpBytes(config);
      const httpText = new TextDecoder().decode(httpBytes);
      
      // Should contain the custom boundary
      expect(httpText).toContain(`boundary=${customBoundary}`);
    });

    it('should generate different boundaries for different instances', () => {
      const converter1 = new HttpConverter();
      const converter2 = new HttpConverter();
      
      const formData = new FormData();
      formData.append('test', 'value');
      
      const config = {
        method: 'POST',
        url: '/api/upload',
        data: formData
      };

      const httpBytes1 = converter1.axiosRequestToHttpBytes(config);
      const httpBytes2 = converter2.axiosRequestToHttpBytes(config);
      
      const httpText1 = new TextDecoder().decode(httpBytes1);
      const httpText2 = new TextDecoder().decode(httpBytes2);
      
      // Extract boundaries
      const boundary1 = httpText1.match(/boundary=(----WebKitFormBoundary[^\r\n]+)/)?.[1];
      const boundary2 = httpText2.match(/boundary=(----WebKitFormBoundary[^\r\n]+)/)?.[1];
      
      expect(boundary1).toBeDefined();
      expect(boundary2).toBeDefined();
      expect(boundary1).not.toBe(boundary2);
    });
  });

  describe('Combined Configuration Options', () => {
    it('should handle all options together', () => {
      const options = {
        maxBodySize: 5 * 1024 * 1024, // 5MB
        preserveHeaderCase: true,
        multipartBoundary: '----TestBoundary'
      };
      
      const converter = new HttpConverter(options);
      
      // Test preserveHeaderCase
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        'User-Agent: Test/1.0\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);
      expect(result.headers).toEqual({
        'User-Agent': 'Test/1.0'
      });
      
      // Test multipartBoundary
      const formData = new FormData();
      formData.append('test', 'value');
      
      const config = {
        method: 'POST',
        url: '/api/upload',
        data: formData
      };

      const multipartBytes = converter.axiosRequestToHttpBytes(config);
      const multipartText = new TextDecoder().decode(multipartBytes);
      expect(multipartText).toContain('boundary=----TestBoundary');
    });

    it('should handle partial options', () => {
      const converter = new HttpConverter({ 
        maxBodySize: 1024,
        preserveHeaderCase: true 
      });
      
      // Test that preserveHeaderCase works
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        'User-Agent: Test/1.0\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);
      expect(result.headers).toEqual({
        'User-Agent': 'Test/1.0'
      });
      
      // Test that multipartBoundary is auto-generated
      const formData = new FormData();
      formData.append('test', 'value');
      
      const config = {
        method: 'POST',
        url: '/api/upload',
        data: formData
      };

      const multipartBytes = converter.axiosRequestToHttpBytes(config);
      const multipartText = new TextDecoder().decode(multipartBytes);
      expect(multipartText).toMatch(/boundary=----WebKitFormBoundary/);
    });

    it('should handle empty options object', () => {
      const converter = new HttpConverter({});
      
      // Test default behavior
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        'User-Agent: Test/1.0\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);
      expect(result.headers).toEqual({
        'user-agent': 'Test/1.0'
      });
    });

    it('should handle undefined options', () => {
      const converter = new HttpConverter();
      
      // Test default behavior
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        'User-Agent: Test/1.0\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = converter.httpBytesToAxiosRequest(httpBytes);
      expect(result.headers).toEqual({
        'user-agent': 'Test/1.0'
      });
    });
  });

  describe('Configuration Persistence', () => {
    it('should maintain configuration across multiple operations', () => {
      const converter = new HttpConverter({ 
        maxBodySize: 2048,
        preserveHeaderCase: true,
        multipartBoundary: '----PersistentBoundary'
      });

      // Test preserveHeaderCase
      const httpBytes1 = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        'User-Agent: Test/1.0\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result1 = converter.httpBytesToAxiosRequest(httpBytes1);
      expect(result1.headers).toEqual({
        'User-Agent': 'Test/1.0'
      });

      // Test multipartBoundary
      const formData = new FormData();
      formData.append('test', 'value');
      
      const config = {
        method: 'POST',
        url: '/api/upload',
        data: formData
      };

      const multipartBytes = converter.axiosRequestToHttpBytes(config);
      const multipartText = new TextDecoder().decode(multipartBytes);
      expect(multipartText).toContain('boundary=----PersistentBoundary');

      // Test that configuration persists
      const httpBytes2 = new TextEncoder().encode(
        'GET /api/other HTTP/1.1\r\n' +
        'Accept: application/json\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result2 = converter.httpBytesToAxiosRequest(httpBytes2);
      expect(result2.headers).toEqual({
        'Accept': 'application/json'
      });
    });
  });
});
