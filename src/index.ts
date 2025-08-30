import { AxiosRequestConfig, AxiosResponse } from 'axios';
import FormData from 'form-data';
import { Buffer } from 'buffer';

function parseHeaders(headerStr: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of headerStr.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    headers[key] = value;
  }
  return headers;
}

function parseMultipart(body: Buffer, boundary: string): Record<string, any> {
  const result: Record<string, any> = {};
  const boundaryText = `--${boundary}`;
  const lines = body.toString('binary').split(/\r\n/);
  let i = 0;
  while (i < lines.length) {
    if (lines[i] === boundaryText) {
      i++;
      const headerLines: string[] = [];
      while (i < lines.length && lines[i] !== '') {
        headerLines.push(lines[i]);
        i++;
      }
      i++; // skip empty line
      const contentLines: string[] = [];
      while (i < lines.length && lines[i] !== boundaryText && lines[i] !== boundaryText + '--') {
        contentLines.push(lines[i]);
        i++;
      }
      const headers = parseHeaders(headerLines.join('\r\n'));
      const disposition = headers['content-disposition'];
      if (disposition) {
        const nameMatch = /name="([^"]+)"/.exec(disposition);
        const filenameMatch = /filename="([^"]+)"/.exec(disposition);
        if (nameMatch) {
          const name = nameMatch[1];
          const contentBuffer = Buffer.from(contentLines.join('\r\n'), 'binary');
          if (filenameMatch) {
            result[name] = {
              filename: filenameMatch[1],
              contentType: headers['content-type'] || 'application/octet-stream',
              data: contentBuffer,
            };
          } else {
            result[name] = contentBuffer.toString();
          }
        }
      }
    } else {
      i++;
    }
  }
  return result;
}

export function rawHttpRequestToAxiosRequest(buffer: ArrayBuffer): AxiosRequestConfig<any> {
  const buf = Buffer.from(buffer);
  const reqStr = buf.toString('binary');
  const sepIdx = reqStr.indexOf('\r\n\r\n');
  const headerPart = sepIdx >= 0 ? reqStr.slice(0, sepIdx) : reqStr;
  const bodyPart = sepIdx >= 0 ? reqStr.slice(sepIdx + 4) : '';
  const [requestLine, ...headerLines] = headerPart.split(/\r\n/);
  const [method, url] = requestLine.split(' ');
  const headers = parseHeaders(headerLines.join('\r\n'));
  const contentType = headers['content-type'];
  let data: any = Buffer.from(bodyPart, 'binary');
  if (contentType) {
    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(data.toString());
      } catch {
        // keep as buffer
      }
    } else if (contentType.includes('multipart/form-data')) {
      const boundaryMatch = /boundary=([^;]+)/.exec(contentType);
      if (boundaryMatch) {
        data = parseMultipart(Buffer.from(bodyPart, 'binary'), boundaryMatch[1]);
      }
    }
  }
  return { method: method as any, url, headers, data };
}

export function axiosRequestToRawHttp(config: AxiosRequestConfig): ArrayBuffer {
  const method = (config.method || 'GET').toUpperCase();
  const url = config.url || '/';
  const headers: Record<string, string> = {};
  if (config.headers) {
    for (const [k, v] of Object.entries(config.headers as any)) {
      headers[k.toLowerCase()] = String(v);
    }
  }
  let body: Buffer | undefined;
  if (config.data instanceof FormData) {
    body = config.data.getBuffer();
    Object.assign(headers, config.data.getHeaders());
  } else if (Buffer.isBuffer(config.data)) {
    body = config.data;
  } else if (typeof config.data === 'object' && config.data !== null) {
    body = Buffer.from(JSON.stringify(config.data));
    headers['content-type'] = headers['content-type'] || 'application/json';
  } else if (typeof config.data === 'string') {
    body = Buffer.from(config.data);
  }
  if (body && !headers['content-length']) {
    headers['content-length'] = String(body.length);
  }
  const headerLines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);
  const requestLine = `${method} ${url} HTTP/1.1`;
  const raw = [requestLine, ...headerLines, '', ''].join('\r\n');
  const buffer = body ? Buffer.concat([Buffer.from(raw, 'utf8'), body]) : Buffer.from(raw, 'utf8');
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

export function rawHttpResponseToAxiosResponse(buffer: ArrayBuffer, config?: AxiosRequestConfig): AxiosResponse<any> {
  const buf = Buffer.from(buffer);
  const resStr = buf.toString('binary');
  const sepIdx = resStr.indexOf('\r\n\r\n');
  const headerPart = sepIdx >= 0 ? resStr.slice(0, sepIdx) : resStr;
  const bodyPart = sepIdx >= 0 ? resStr.slice(sepIdx + 4) : '';
  const [statusLine, ...headerLines] = headerPart.split(/\r\n/);
  const [, statusCodeStr, statusText] = statusLine.match(/HTTP\/[0-9\.]+\s+(\d+)\s*(.*)/) || [];
  const status = Number(statusCodeStr || 0);
  const headers = parseHeaders(headerLines.join('\r\n'));
  const contentType = headers['content-type'];
  let data: any = Buffer.from(bodyPart, 'binary');
  if (contentType) {
    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(data.toString());
      } catch {
        // ignore
      }
    } else if (contentType.includes('multipart/form-data')) {
      const boundaryMatch = /boundary=([^;]+)/.exec(contentType);
      if (boundaryMatch) {
        data = parseMultipart(Buffer.from(bodyPart, 'binary'), boundaryMatch[1]);
      }
    }
  }
  return {
    data,
    status,
    statusText: statusText || '',
    headers,
    config: config || {},
    request: undefined,
  } as AxiosResponse;
}

export function axiosResponseToRawHttp(response: AxiosResponse): ArrayBuffer {
  const statusLine = `HTTP/1.1 ${response.status} ${response.statusText || ''}`;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(response.headers || {})) {
    headers[k.toLowerCase()] = String(v);
  }
  let body: Buffer | undefined;
  if (response.data instanceof FormData) {
    body = response.data.getBuffer();
    Object.assign(headers, response.data.getHeaders());
  } else if (Buffer.isBuffer(response.data)) {
    body = response.data;
  } else if (typeof response.data === 'object') {
    body = Buffer.from(JSON.stringify(response.data));
    headers['content-type'] = headers['content-type'] || 'application/json';
  } else if (typeof response.data === 'string') {
    body = Buffer.from(response.data);
  }
  if (body && !headers['content-length']) {
    headers['content-length'] = String(body.length);
  }
  const headerLines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);
  const raw = [statusLine, ...headerLines, '', ''].join('\r\n');
  const buffer = body ? Buffer.concat([Buffer.from(raw, 'utf8'), body]) : Buffer.from(raw, 'utf8');
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

export default {
  rawHttpRequestToAxiosRequest,
  axiosRequestToRawHttp,
  rawHttpResponseToAxiosResponse,
  axiosResponseToRawHttp,
};
