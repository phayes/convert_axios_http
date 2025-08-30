export interface HttpRequestBytes {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: ArrayBuffer;
}

export interface HttpResponseBytes {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: ArrayBuffer;
}

export interface MultipartFormData {
  fields: Record<string, string>;
  files: Array<{
    name: string;
    filename: string;
    contentType: string;
    data: ArrayBuffer;
  }>;
}

export interface ParsedHttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: ArrayBuffer;
  multipartData?: MultipartFormData;
}

export interface ParsedHttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: ArrayBuffer;
}

export interface ConverterOptions {
  /**
   * Maximum size of request/response body in bytes
   * @default 10MB
   */
  maxBodySize?: number;
  
  /**
   * Whether to preserve original headers case
   * @default false
   */
  preserveHeaderCase?: boolean;
  
  /**
   * Custom boundary for multipart requests
   * @default auto-generated
   */
  multipartBoundary?: string;
}

export interface ConversionError extends Error {
  code: 'INVALID_HTTP_FORMAT' | 'UNSUPPORTED_METHOD' | 'BODY_TOO_LARGE' | 'INVALID_MULTIPART' | 'INVALID_URL';
  details?: string;
}
