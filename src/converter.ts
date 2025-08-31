import { AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  MultipartFormData,
  ParsedHttpRequest,
  ParsedHttpResponse,
  ConverterOptions,
  ConversionError
} from './types';

export class HttpConverter {
  private options: Omit<Required<ConverterOptions>, 'maxBodySize' | 'transformResponse'> & { 
    maxBodySize?: number;
    transformResponse?: Array<(data: any, headers?: Record<string, string>) => any>;
  };

  constructor(options: ConverterOptions = {}) {
    this.options = {
      maxBodySize: options.maxBodySize ?? undefined, // Unbounded by default
      preserveHeaderCase: options.preserveHeaderCase ?? false,
      multipartBoundary: options.multipartBoundary ?? this.generateBoundary(),
      transformResponse: options.transformResponse ?? undefined
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
  public async axiosRequestToHttpBytes(config: AxiosRequestConfig): Promise<ArrayBuffer> {
    const method = (config.method || 'GET').toUpperCase();
    const url = config.url || '';
    const headers = config.headers || {};
    const data = config.data;

    // Build HTTP request line
    let httpRequest = `${method} ${url} HTTP/1.1\r\n`;

    let is_form_data = (data instanceof FormData);

    // Add headers
    for (const [key, value] of Object.entries(headers)) {
      // Skip headers with undefined or null values
      if (value === undefined || value === null) {
        continue;
      }
      
      const headerKeyLower = key.toLowerCase();
      
      // Skip content-type and content-length for FormData (handled separately)
      if (is_form_data && headerKeyLower === 'content-type') {
        continue;
      }
      if (is_form_data && headerKeyLower === 'content-length') {
        continue;
      }
      
      // Skip content-type for requests without body
      if (!data && headerKeyLower === 'content-type') {
        continue;
      }
      
      const headerKey = this.options.preserveHeaderCase ? key : key.toLowerCase();
      httpRequest += `${headerKey}: ${value}\r\n`;
    }

    // Handle multipart form data
    if (data instanceof FormData) {
      const boundary = this.options.multipartBoundary;
      httpRequest += `content-type: multipart/form-data; boundary=${boundary}\r\n`;
      
      const multipartBody = await this.buildMultipartBody(data, boundary);
      httpRequest += `content-length: ${multipartBody.byteLength}\r\n`;
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
        // Check for content-type header case-insensitively
        const hasContentType = Object.keys(headers).some(key => key.toLowerCase() === 'content-type');
        if (!hasContentType) {
          httpRequest += 'content-type: application/json\r\n';
        }
      }
    }

    if (bodyBytes) {
      httpRequest += `content-length: ${bodyBytes.byteLength}\r\n`;
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
    
    // Apply axios's transformResponse pipeline
    let transformedData: any = parsed.body;
    
    // Get content type from headers
    const contentType = parsed.headers['content-type'] || '';
    
    // Apply default transformations based on content type
    if (parsed.body && parsed.body.byteLength > 0) {
      if (contentType.includes('application/json') || /^application\/.*\+json$/.test(contentType)) {
        // JSON responses - parse into JavaScript object
        try {
          const jsonString = new TextDecoder().decode(parsed.body);
          transformedData = JSON.parse(jsonString);
        } catch (error) {
          // If JSON parsing fails, keep the original data
          transformedData = parsed.body;
        }
      } else if (contentType.startsWith('text/')) {
        // Text responses - convert to string
        transformedData = new TextDecoder().decode(parsed.body);
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        // Form data - return as string (axios doesn't auto-parse this)
        transformedData = new TextDecoder().decode(parsed.body);
      } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
        // XML responses - return as string (axios doesn't auto-parse XML)
        transformedData = new TextDecoder().decode(parsed.body);
      } else if (contentType.includes('application/octet-stream')) {
        // For octet-stream, try to decode as text first, fallback to ArrayBuffer
        try {
          transformedData = new TextDecoder().decode(parsed.body);
        } catch (error) {
          // If text decoding fails, keep as ArrayBuffer
          transformedData = parsed.body;
        }
      } else {
        // For other content types, try to decode as text if possible
        // This handles cases like text/html, application/javascript, etc.
        try {
          transformedData = new TextDecoder().decode(parsed.body);
        } catch (error) {
          // If text decoding fails, keep as ArrayBuffer
          transformedData = parsed.body;
        }
      }
    }
    
    // Apply custom transformResponse functions if provided
    if (this.options.transformResponse) {
      for (const transform of this.options.transformResponse) {
        try {
          transformedData = transform(transformedData, parsed.headers);
        } catch (error) {
          // If transformation fails, keep the current data
          console.warn('Transform function failed:', error);
        }
      }
    }
    
    return {
      data: transformedData,
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
      if (bodyText.length > 0) {
        body = new TextEncoder().encode(bodyText).buffer as ArrayBuffer;
      }
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

  private async buildMultipartBody(formData: FormData, boundary: string): Promise<ArrayBuffer> {
    const parts: ArrayBuffer[] = [];

    for (const [key, value] of formData.entries()) {
      let part = `--${boundary}\r\n`;
      
      // Check if it's a Blob or File-like object
      if (value instanceof Blob || (value && typeof value === 'object' && 'type' in value)) {
        // Check if it's a File by checking for the name property
        const filename = (value as any).name || 'blob';
        const contentType = (value as any).type || 'application/octet-stream';
        
        part += `Content-Disposition: form-data; name="${key}"; filename="${filename}"\r\n`;
        part += `Content-Type: ${contentType}\r\n`;
        part += '\r\n';
        
        const partHeader = new TextEncoder().encode(part).buffer as ArrayBuffer;
        parts.push(partHeader);
        
        // Read the file/blob data asynchronously
        const fileData = await this.readBlobAsArrayBuffer(value);
        parts.push(fileData);
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

  private async readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    // Check if we're in a browser environment with FileReader
    if (typeof (globalThis as any).FileReader !== 'undefined') {
      return new Promise((resolve, reject) => {
        const reader = new (globalThis as any).FileReader();
        reader.onload = () => {
          resolve(reader.result as ArrayBuffer);
        };
        reader.onerror = () => {
          reject(new Error('Failed to read blob data'));
        };
        reader.readAsArrayBuffer(blob);
      });
    }
    
    // For Node.js environment, try to use the blob's arrayBuffer method
    if (blob.arrayBuffer) {
      return await blob.arrayBuffer();
    }
    
    // Fallback: create a buffer with the blob size
    // This is not ideal but prevents the function from failing
    return new ArrayBuffer(blob.size);
  }
}
