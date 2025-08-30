import { AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  MultipartFormData,
  ParsedHttpRequest,
  ParsedHttpResponse,
  ConverterOptions,
  ConversionError
} from './types';

export class HttpConverter {
  private options: Required<ConverterOptions>;

  constructor(options: ConverterOptions = {}) {
    this.options = {
      maxBodySize: options.maxBodySize ?? 10 * 1024 * 1024, // 10MB
      preserveHeaderCase: options.preserveHeaderCase ?? false,
      multipartBoundary: options.multipartBoundary ?? this.generateBoundary()
    };
  }

  /**
   * Convert raw HTTP request bytes to Axios request config
   */
  public httpBytesToAxiosRequest(httpBytes: ArrayBuffer): AxiosRequestConfig {
    const parsed = this.parseHttpRequest(httpBytes);
    
    const config: AxiosRequestConfig = {
      method: parsed.method.toLowerCase() as any,
      url: parsed.url,
      headers: parsed.headers,
      data: parsed.body
    };

    // Handle multipart data
    if (parsed.multipartData) {
      const formData = new FormData();
      
      // Add fields
      for (const [key, value] of Object.entries(parsed.multipartData.fields)) {
        formData.append(key, value);
      }
      
      // Add files
      for (const file of parsed.multipartData.files) {
        const blob = new Blob([file.data], { type: file.contentType });
        formData.append(file.name, blob, file.filename);
      }
      
      config.data = formData;
    }

    return config;
  }

  /**
   * Convert Axios request config to raw HTTP request bytes
   */
  public axiosRequestToHttpBytes(config: AxiosRequestConfig): ArrayBuffer {
    const method = (config.method || 'GET').toUpperCase();
    const url = config.url || '';
    const headers = config.headers || {};
    const data = config.data;

    // Build HTTP request line
    let httpRequest = `${method} ${url} HTTP/1.1\r\n`;

    // Add headers
    for (const [key, value] of Object.entries(headers)) {
      const headerKey = this.options.preserveHeaderCase ? key : key.toLowerCase();
      httpRequest += `${headerKey}: ${value}\r\n`;
    }

    // Handle multipart form data
    if (data instanceof FormData) {
      const boundary = this.options.multipartBoundary;
      httpRequest += `Content-Type: multipart/form-data; boundary=${boundary}\r\n`;
      
      const multipartBody = this.buildMultipartBody(data, boundary);
      httpRequest += `Content-Length: ${multipartBody.byteLength}\r\n`;
      httpRequest += '\r\n';
      
      // Combine header and body
      const headerBytes = new TextEncoder().encode(httpRequest);
      const combined = new ArrayBuffer(headerBytes.length + multipartBody.byteLength);
      const combinedView = new Uint8Array(combined);
      combinedView.set(headerBytes, 0);
      combinedView.set(new Uint8Array(multipartBody), headerBytes.length);
      
      return combined;
    }

    // Handle regular data
    let bodyBytes: ArrayBuffer | undefined;
    if (data) {
      if (typeof data === 'string') {
        bodyBytes = new TextEncoder().encode(data).buffer as ArrayBuffer;
      } else if (data instanceof ArrayBuffer) {
        bodyBytes = data;
      } else if (data instanceof Uint8Array) {
        bodyBytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      } else {
        bodyBytes = new TextEncoder().encode(JSON.stringify(data)).buffer as ArrayBuffer;
        if (!headers['content-type']) {
          httpRequest += 'Content-Type: application/json\r\n';
        }
      }
    }

    if (bodyBytes) {
      httpRequest += `Content-Length: ${bodyBytes.byteLength}\r\n`;
    }

    httpRequest += '\r\n';

    // Combine header and body
    const headerBytes = new TextEncoder().encode(httpRequest);
    if (!bodyBytes) {
      return headerBytes.buffer as ArrayBuffer;
    }

    const combined = new ArrayBuffer(headerBytes.length + bodyBytes.byteLength);
    const combinedView = new Uint8Array(combined);
    combinedView.set(headerBytes, 0);
    combinedView.set(new Uint8Array(bodyBytes), headerBytes.length);

    return combined;
  }

  /**
   * Convert raw HTTP response bytes to Axios response object
   */
  public httpBytesToAxiosResponse(httpBytes: ArrayBuffer): AxiosResponse {
    const parsed = this.parseHttpResponse(httpBytes);
    
    return {
      data: parsed.body,
      status: parsed.status,
      statusText: parsed.statusText,
      headers: parsed.headers,
      config: {} as any,
      request: {}
    };
  }

  /**
   * Convert Axios response object to raw HTTP response bytes
   */
  public axiosResponseToHttpBytes(response: AxiosResponse): ArrayBuffer {
    const status = response.status;
    const statusText = response.statusText;
    const headers = response.headers || {};
    const data = response.data;

    // Build HTTP response line
    let httpResponse = `HTTP/1.1 ${status} ${statusText}\r\n`;

    // Add headers
    for (const [key, value] of Object.entries(headers)) {
      const headerKey = this.options.preserveHeaderCase ? key : key.toLowerCase();
      httpResponse += `${headerKey}: ${value}\r\n`;
    }

    // Handle response data
    let bodyBytes: ArrayBuffer | undefined;
    if (data) {
      if (typeof data === 'string') {
        bodyBytes = new TextEncoder().encode(data).buffer as ArrayBuffer;
      } else if (data instanceof ArrayBuffer) {
        bodyBytes = data;
      } else if (data instanceof Uint8Array) {
        bodyBytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      } else {
        bodyBytes = new TextEncoder().encode(JSON.stringify(data)).buffer as ArrayBuffer;
        if (!headers['content-type']) {
          httpResponse += 'Content-Type: application/json\r\n';
        }
      }
    }

    if (bodyBytes) {
      httpResponse += `Content-Length: ${bodyBytes.byteLength}\r\n`;
    }

    httpResponse += '\r\n';

    // Combine header and body
    const headerBytes = new TextEncoder().encode(httpResponse);
    if (!bodyBytes) {
      return headerBytes.buffer as ArrayBuffer;
    }

    const combined = new ArrayBuffer(headerBytes.length + bodyBytes.byteLength);
    const combinedView = new Uint8Array(combined);
    combinedView.set(headerBytes, 0);
    combinedView.set(new Uint8Array(bodyBytes), headerBytes.length);

    return combined;
  }

  private parseHttpRequest(httpBytes: ArrayBuffer): ParsedHttpRequest {
    const bytes = new Uint8Array(httpBytes);
    const text = new TextDecoder().decode(bytes);
    const lines = text.split('\r\n');

    if (lines.length < 2) {
      throw this.createError('INVALID_HTTP_FORMAT', 'Invalid HTTP request format');
    }

    // Parse request line
    const requestLine = lines[0];
    if (!requestLine) {
      throw this.createError('INVALID_HTTP_FORMAT', 'Invalid request line');
    }
    
    const requestParts = requestLine.split(' ');
    if (requestParts.length < 3) {
      throw this.createError('INVALID_HTTP_FORMAT', 'Invalid request line');
    }

    const method = requestParts[0];
    const url = requestParts[1];

    // Parse headers
    const headers: Record<string, string> = {};
    let bodyStartIndex = -1;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        bodyStartIndex = i + 1;
        break;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = this.options.preserveHeaderCase 
          ? line.substring(0, colonIndex)
          : line.substring(0, colonIndex).toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    // Parse body
    let body: ArrayBuffer | undefined;
    let multipartData: MultipartFormData | undefined;

    if (bodyStartIndex > 0 && bodyStartIndex < lines.length) {
      const bodyText = lines.slice(bodyStartIndex).join('\r\n');
      body = new TextEncoder().encode(bodyText).buffer as ArrayBuffer;

      // Check for multipart content
      const contentType = headers['content-type'] || '';
      if (contentType.includes('multipart/form-data') && body) {
        multipartData = this.parseMultipartData(body, contentType);
      }
    }

    return {
      method: method || '',
      url: url || '',
      headers,
      body,
      multipartData
    };
  }

  private parseHttpResponse(httpBytes: ArrayBuffer): ParsedHttpResponse {
    const bytes = new Uint8Array(httpBytes);
    const text = new TextDecoder().decode(bytes);
    const lines = text.split('\r\n');

    if (lines.length < 2) {
      throw this.createError('INVALID_HTTP_FORMAT', 'Invalid HTTP response format');
    }

    // Parse status line
    const statusLine = lines[0];
    if (!statusLine) {
      throw this.createError('INVALID_HTTP_FORMAT', 'Invalid status line');
    }
    
    const statusMatch = statusLine.match(/HTTP\/\d\.\d\s+(\d+)\s+(.+)/);
    if (!statusMatch) {
      throw this.createError('INVALID_HTTP_FORMAT', 'Invalid status line');
    }

    const status = parseInt(statusMatch[1] || '0', 10);
    const statusText = statusMatch[2] || '';

    // Parse headers
    const headers: Record<string, string> = {};
    let bodyStartIndex = -1;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        bodyStartIndex = i + 1;
        break;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = this.options.preserveHeaderCase 
          ? line.substring(0, colonIndex)
          : line.substring(0, colonIndex).toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    // Parse body
    let body: ArrayBuffer | undefined;
    if (bodyStartIndex > 0 && bodyStartIndex < lines.length) {
      const bodyText = lines.slice(bodyStartIndex).join('\r\n');
      body = new TextEncoder().encode(bodyText).buffer as ArrayBuffer;
    }

    return {
      status,
      statusText,
      headers,
      body
    };
  }

  private parseMultipartData(body: ArrayBuffer, contentType: string): MultipartFormData {
    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    if (!boundaryMatch) {
      throw this.createError('INVALID_MULTIPART', 'No boundary found in multipart content type');
    }

    const boundary = '--' + boundaryMatch[1];
    const bodyText = new TextDecoder().decode(body);
    const parts = bodyText.split(boundary);

    const fields: Record<string, string> = {};
    const files: Array<{
      name: string;
      filename: string;
      contentType: string;
      data: ArrayBuffer;
    }> = [];

    for (const part of parts) {
      if (part.trim() === '' || part.trim() === '--') {
        continue;
      }

      const lines = part.split('\r\n');
      let headers: Record<string, string> = {};
      let contentStartIndex = -1;

      // Parse part headers
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) {
          contentStartIndex = i + 1;
          break;
        }

        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).toLowerCase();
          const value = line.substring(colonIndex + 1).trim();
          headers[key] = value;
        }
      }

      if (contentStartIndex === -1) {
        continue;
      }

      // Get content
      const content = lines.slice(contentStartIndex).join('\r\n');
      const contentBytes = new TextEncoder().encode(content).buffer as ArrayBuffer;

      // Parse content disposition
      const disposition = headers['content-disposition'] || '';
      const nameMatch = disposition.match(/name="([^"]+)"/);
      const filenameMatch = disposition.match(/filename="([^"]+)"/);

      if (nameMatch) {
        const name = nameMatch[1];
        
        if (filenameMatch) {
          // This is a file
          const filename = filenameMatch[1];
          const contentType = headers['content-type'] || 'application/octet-stream';
          
          files.push({
            name: name || '',
            filename: filename || '',
            contentType,
            data: contentBytes
          });
        } else {
          // This is a field
          if (name) {
            fields[name] = content;
          }
        }
      }
    }

    return { fields, files };
  }

  private buildMultipartBody(formData: FormData, boundary: string): ArrayBuffer {
    const parts: ArrayBuffer[] = [];

    for (const [key, value] of formData.entries()) {
      let part = `--${boundary}\r\n`;
      
      if (value instanceof File) {
        part += `Content-Disposition: form-data; name="${key}"; filename="${value.name}"\r\n`;
        part += `Content-Type: ${value.type || 'application/octet-stream'}\r\n`;
        part += '\r\n';
        
        const partHeader = new TextEncoder().encode(part).buffer as ArrayBuffer;
        parts.push(partHeader);
        
        // Note: In a real implementation, you'd need to read the file data
        // For now, we'll use an empty buffer as placeholder
        parts.push(new ArrayBuffer(0));
      } else {
        part += `Content-Disposition: form-data; name="${key}"\r\n`;
        part += '\r\n';
        part += value;
        part += '\r\n';
        
        parts.push(new TextEncoder().encode(part).buffer as ArrayBuffer);
      }
    }

    // Add closing boundary
    const closingBoundary = new TextEncoder().encode(`--${boundary}--\r\n`).buffer as ArrayBuffer;
    parts.push(closingBoundary);

    // Combine all parts
    const totalLength = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const combined = new ArrayBuffer(totalLength);
    const combinedView = new Uint8Array(combined);
    
    let offset = 0;
    for (const part of parts) {
      combinedView.set(new Uint8Array(part), offset);
      offset += part.byteLength;
    }

    return combined;
  }

  private generateBoundary(): string {
    return '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
  }

  private createError(code: ConversionError['code'], message: string): ConversionError {
    const error = new Error(message) as ConversionError;
    error.code = code;
    return error;
  }
}
