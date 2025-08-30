import {
  httpBytesToAxiosRequest,
  axiosRequestToHttpBytes,
  httpBytesToAxiosResponse,
  axiosResponseToHttpBytes,
  HttpConverter
} from '../src/index';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

describe('Convenience Functions', () => {
  describe('httpBytesToAxiosRequest', () => {
    it('should convert HTTP bytes to Axios request config', () => {
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        'Host: example.com\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = httpBytesToAxiosRequest(httpBytes);

      expect(result).toEqual({
        method: 'get',
        url: '/api/users',
        headers: {
          'host': 'example.com'
        },
        data: new ArrayBuffer(0)
      });
    });

    it('should accept converter options', () => {
      const httpBytes = new TextEncoder().encode(
        'GET /api/users HTTP/1.1\r\n' +
        'User-Agent: Test/1.0\r\n' +
        '\r\n'
      ).buffer as ArrayBuffer;

      const result = httpBytesToAxiosRequest(httpBytes, { preserveHeaderCase: true });

      expect(result.headers).toEqual({
        'User-Agent': 'Test/1.0'
      });
    });
  });

  describe('axiosRequestToHttpBytes', () => {
    it('should convert Axios request config to HTTP bytes', () => {
      const config: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        headers: {
          'Content-Type': 'application/json'
        },
        data: { name: 'John' }
      };

      const result = axiosRequestToHttpBytes(config);
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('POST /api/users HTTP/1.1');
      expect(resultText).toContain('Content-Type: application/json');
      expect(resultText).toContain('{"name":"John"}');
    });

    it('should accept converter options', () => {
      const config: AxiosRequestConfig = {
        method: 'GET',
        url: '/api/users',
        headers: {
          'User-Agent': 'Test/1.0'
        }
      };

      const result = axiosRequestToHttpBytes(config, { preserveHeaderCase: true });
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('User-Agent: Test/1.0');
    });
  });

  describe('httpBytesToAxiosResponse', () => {
    it('should convert HTTP bytes to Axios response', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: application/json\r\n' +
        '\r\n' +
        '{"message":"Hello"}'
      ).buffer as ArrayBuffer;

      const result = httpBytesToAxiosResponse(httpBytes);

      expect(result.status).toBe(200);
      expect(result.statusText).toBe('OK');
      expect(result.headers).toEqual({
        'content-type': 'application/json'
      });
      expect(result.data).toEqual({ message: 'Hello' });
    });

    it('should accept converter options', () => {
      const httpBytes = new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: application/json\r\n' +
        '\r\n' +
        '{"message":"Hello"}'
      ).buffer as ArrayBuffer;

      const result = httpBytesToAxiosResponse(httpBytes, { preserveHeaderCase: true });

      expect(result.headers).toEqual({
        'Content-Type': 'application/json'
      });
    });
  });

  describe('axiosResponseToHttpBytes', () => {
    it('should convert Axios response to HTTP bytes', () => {
      const response: AxiosResponse = {
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json'
        },
        data: { message: 'Hello' },
        config: {} as any,
        request: {}
      };

      const result = axiosResponseToHttpBytes(response);
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('HTTP/1.1 200 OK');
      expect(resultText).toContain('content-type: application/json');
      expect(resultText).toContain('{"message":"Hello"}');
    });

    it('should accept converter options', () => {
      const response: AxiosResponse = {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json'
        },
        data: { message: 'Hello' },
        config: {} as any,
        request: {}
      };

      const result = axiosResponseToHttpBytes(response, { preserveHeaderCase: true });
      const resultText = new TextDecoder().decode(result);

      expect(resultText).toContain('Content-Type: application/json');
    });
  });

  describe('Integration with HttpConverter', () => {
    it('should produce same results as HttpConverter instance', () => {
      const converter = new HttpConverter();
      const config: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: { name: 'John' }
      };

      const directResult = converter.axiosRequestToHttpBytes(config);
      const functionResult = axiosRequestToHttpBytes(config);

      expect(functionResult).toEqual(directResult);
    });

    it('should handle options consistently', () => {
      const options = { preserveHeaderCase: true };
      const config: AxiosRequestConfig = {
        method: 'GET',
        url: '/api/users',
        headers: {
          'User-Agent': 'Test/1.0'
        }
      };

      const converter = new HttpConverter(options);
      const directResult = converter.axiosRequestToHttpBytes(config);
      const functionResult = axiosRequestToHttpBytes(config, options);

      expect(functionResult).toEqual(directResult);
    });
  });
});
