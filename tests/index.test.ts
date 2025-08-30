import { describe, it, expect } from 'vitest';
import FormData from 'form-data';
import { Buffer } from 'buffer';
import {
  rawHttpRequestToAxiosRequest,
  axiosRequestToRawHttp,
  rawHttpResponseToAxiosResponse,
  axiosResponseToRawHttp,
} from '../src';
import type { AxiosResponse } from 'axios';

function toArrayBuffer(str: string): ArrayBuffer {
  const buf = Buffer.from(str, 'utf8');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('rawHttpRequestToAxiosRequest', () => {
  it('parses simple GET request', () => {
    const raw = toArrayBuffer('GET /path HTTP/1.1\r\nhost: example.com\r\n\r\n');
    const req = rawHttpRequestToAxiosRequest(raw);
    expect(req.method).toBe('GET');
    expect(req.url).toBe('/path');
    expect(req.headers?.host).toBe('example.com');
  });

  it('parses JSON body', () => {
    const raw = toArrayBuffer(
      'POST /json HTTP/1.1\r\nContent-Type: application/json\r\n\r\n{"a":1}',
    );
    const req = rawHttpRequestToAxiosRequest(raw);
    expect(req.method).toBe('POST');
    expect(req.url).toBe('/json');
    expect(req.data).toEqual({ a: 1 });
  });

  it('parses multipart form data', () => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const rawStr =
      `POST /upload HTTP/1.1\r\n` +
      `content-type: multipart/form-data; boundary=${boundary}\r\n\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="field1"\r\n\r\nvalue1\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="file1"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n` +
      `--${boundary}--\r\n`;
    const req = rawHttpRequestToAxiosRequest(toArrayBuffer(rawStr));
    expect(req.method).toBe('POST');
    const data: any = req.data;
    expect(data.field1).toBe('value1');
    expect(data.file1.filename).toBe('test.txt');
    expect(data.file1.data.toString()).toBe('hello');
  });

  it('handles plain text body', () => {
    const raw = toArrayBuffer(
      'POST /echo HTTP/1.1\r\nContent-Type: text/plain\r\n\r\nhello',
    );
    const req = rawHttpRequestToAxiosRequest(raw);
    expect(req.method).toBe('POST');
    expect(Buffer.isBuffer(req.data)).toBe(true);
    expect((req.data as Buffer).toString()).toBe('hello');
  });

  it('returns buffer when JSON is invalid', () => {
    const raw = toArrayBuffer(
      'POST /bad HTTP/1.1\r\nContent-Type: application/json\r\n\r\n{oops',
    );
    const req = rawHttpRequestToAxiosRequest(raw);
    expect(Buffer.isBuffer(req.data)).toBe(true);
  });

  it('preserves query string in URL', () => {
    const raw = toArrayBuffer(
      'GET /search?q=test HTTP/1.1\r\nHost: example.com\r\n\r\n',
    );
    const req = rawHttpRequestToAxiosRequest(raw);
    expect(req.url).toBe('/search?q=test');
  });

  it('returns buffer when content-type missing', () => {
    const raw = toArrayBuffer(
      'POST /bin HTTP/1.1\r\nContent-Length: 4\r\n\r\nDATA',
    );
    const req = rawHttpRequestToAxiosRequest(raw);
    expect(Buffer.isBuffer(req.data)).toBe(true);
    expect((req.data as Buffer).toString()).toBe('DATA');
  });
});

describe('axiosRequestToRawHttp', () => {
  it('builds JSON request', () => {
    const raw = axiosRequestToRawHttp({
      method: 'post',
      url: '/test',
      headers: { host: 'example.com' },
      data: { a: 1 },
    });
    const str = Buffer.from(raw).toString();
    expect(str).toContain('POST /test HTTP/1.1');
    expect(str.toLowerCase()).toContain('content-type: application/json');
    expect(str).toContain('\r\n\r\n{"a":1}');
  });

  it('adds content-length header', () => {
    const raw = axiosRequestToRawHttp({
      method: 'post',
      url: '/len',
      data: 'hi',
    });
    const str = Buffer.from(raw).toString();
    expect(str.toLowerCase()).toContain('content-length: 2');
  });

  it('preserves explicit content-type for object data', () => {
    const raw = axiosRequestToRawHttp({
      method: 'post',
      url: '/custom',
      headers: { 'Content-Type': 'text/custom' },
      data: { a: 1 },
    });
    const str = Buffer.from(raw).toString();
    expect(str.toLowerCase()).toContain('content-type: text/custom');
  });

  it('includes query string in request line', () => {
    const raw = axiosRequestToRawHttp({
      method: 'get',
      url: '/path?x=1',
    });
    const str = Buffer.from(raw).toString();
    expect(str.startsWith('GET /path?x=1 HTTP/1.1')).toBe(true);
  });

  it('includes host header when provided', () => {
    const raw = axiosRequestToRawHttp({
      method: 'get',
      url: '/',
      headers: { Host: 'example.com' },
    });
    const str = Buffer.from(raw).toString();
    expect(str.toLowerCase()).toContain('\r\nhost: example.com\r\n');
  });

  it('does not override provided content-length', () => {
    const raw = axiosRequestToRawHttp({
      method: 'post',
      url: '/size',
      headers: { 'Content-Length': '10' },
      data: 'hello',
    });
    const str = Buffer.from(raw).toString();
    expect(str.toLowerCase()).toContain('content-length: 10');
  });

  it('serializes Buffer data', () => {
    const raw = axiosRequestToRawHttp({
      method: 'post',
      url: '/buf',
      data: Buffer.from('buff'),
    });
    const str = Buffer.from(raw).toString();
    expect(str.toLowerCase()).toContain('content-length: 4');
    expect(str).toContain('\r\n\r\nbuff');
  });
});

describe('rawHttpResponseToAxiosResponse', () => {
  it('parses JSON response', () => {
    const raw = toArrayBuffer('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"b":2}');
    const res = rawHttpResponseToAxiosResponse(raw);
    expect(res.status).toBe(200);
    expect((res.data as any).b).toBe(2);
  });

  it('parses plain text response', () => {
    const raw = toArrayBuffer(
      'HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\n\r\nnope',
    );
    const res = rawHttpResponseToAxiosResponse(raw);
    expect(res.status).toBe(404);
    expect(Buffer.isBuffer(res.data)).toBe(true);
    expect((res.data as Buffer).toString()).toBe('nope');
  });

  it('parses multipart response', () => {
    const boundary = '----b';
    const rawStr =
      `HTTP/1.1 200 OK\r\n` +
      `Content-Type: multipart/form-data; boundary=${boundary}\r\n\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n` +
      `--${boundary}--\r\n`;
    const res = rawHttpResponseToAxiosResponse(toArrayBuffer(rawStr));
    expect(res.status).toBe(200);
    const data: any = res.data;
    expect(data.field).toBe('value');
  });

  it('returns buffer when JSON response is invalid', () => {
    const raw = toArrayBuffer(
      'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{bad',
    );
    const res = rawHttpResponseToAxiosResponse(raw);
    expect(Buffer.isBuffer(res.data)).toBe(true);
  });

  it('handles empty body without content-type', () => {
    const raw = toArrayBuffer('HTTP/1.1 204 No Content\r\n\r\n');
    const res = rawHttpResponseToAxiosResponse(raw);
    expect(res.status).toBe(204);
    expect(Buffer.isBuffer(res.data)).toBe(true);
    expect((res.data as Buffer).length).toBe(0);
  });
});

describe('axiosResponseToRawHttp', () => {
  it('builds response', () => {
    const response: AxiosResponse = {
      data: { c: 3 },
      status: 201,
      statusText: 'Created',
      headers: {},
      config: {},
    } as AxiosResponse;
    const raw = axiosResponseToRawHttp(response);
    const str = Buffer.from(raw).toString();
    expect(str).toContain('HTTP/1.1 201 Created');
    expect(str.toLowerCase()).toContain('content-type: application/json');
    expect(str).toContain('\r\n\r\n{"c":3}');
  });

  it('sets content-length for text body', () => {
    const response: AxiosResponse = {
      data: 'hi',
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as AxiosResponse;
    const raw = axiosResponseToRawHttp(response);
    const str = Buffer.from(raw).toString();
    expect(str.toLowerCase()).toContain('content-length: 2');
    expect(str).toContain('\r\n\r\nhi');
  });

  it('preserves provided content-type header', () => {
    const response: AxiosResponse = {
      data: { a: 1 },
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'text/custom' },
      config: {},
    } as AxiosResponse;
    const raw = axiosResponseToRawHttp(response);
    const str = Buffer.from(raw).toString();
    expect(str.toLowerCase()).toContain('content-type: text/custom');
  });

  it('does not override explicit content-length', () => {
    const response: AxiosResponse = {
      data: 'hello',
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Length': '10' },
      config: {},
    } as AxiosResponse;
    const raw = axiosResponseToRawHttp(response);
    const str = Buffer.from(raw).toString();
    expect(str.toLowerCase()).toContain('content-length: 10');
  });

  it('serializes buffer data without adding content-type', () => {
    const response: AxiosResponse = {
      data: Buffer.from('bin'),
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as AxiosResponse;
    const raw = axiosResponseToRawHttp(response);
    const str = Buffer.from(raw).toString();
    expect(str.toLowerCase()).toContain('content-length: 3');
    expect(str.toLowerCase()).not.toContain('content-type:');
    expect(str).toContain('\r\n\r\nbin');
  });
});

describe('round trip form-data', () => {
  it('converts FormData to raw and back', () => {
    const fd = new FormData();
    fd.append('field', 'value');
    fd.append('file', Buffer.from('content'), { filename: 'file.txt' });
    const raw = axiosRequestToRawHttp({ method: 'post', url: '/up', data: fd });
    const parsed = rawHttpRequestToAxiosRequest(raw);
    const data: any = parsed.data;
    expect(data.field).toBe('value');
    expect(data.file.filename).toBe('file.txt');
    expect(data.file.data.toString()).toBe('content');
  });
});

describe('round trip response', () => {
  it('converts response to raw and back', () => {
    const response: AxiosResponse = {
      data: { msg: 'ok' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as AxiosResponse;
    const raw = axiosResponseToRawHttp(response);
    const parsed = rawHttpResponseToAxiosResponse(raw);
    expect(parsed.status).toBe(200);
    expect((parsed.data as any).msg).toBe('ok');
  });
});
