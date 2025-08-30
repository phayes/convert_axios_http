export { HttpConverter } from './converter';
export type {
  HttpRequestBytes,
  HttpResponseBytes,
  MultipartFormData,
  ParsedHttpRequest,
  ParsedHttpResponse,
  ConverterOptions,
  ConversionError
} from './types';

// Convenience functions for common use cases
import { HttpConverter } from './converter';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ConverterOptions } from './types';

/**
 * Convert raw HTTP request bytes to Axios request config
 */
export function httpBytesToAxiosRequest(
  httpBytes: ArrayBuffer,
  options?: ConverterOptions
): AxiosRequestConfig {
  const converter = new HttpConverter(options);
  return converter.httpBytesToAxiosRequest(httpBytes);
}

/**
 * Convert Axios request config to raw HTTP request bytes
 */
export async function axiosRequestToHttpBytes(
  config: AxiosRequestConfig,
  options?: ConverterOptions
): Promise<ArrayBuffer> {
  const converter = new HttpConverter(options);
  return await converter.axiosRequestToHttpBytes(config);
}

/**
 * Convert raw HTTP response bytes to Axios response object
 */
export function httpBytesToAxiosResponse(
  httpBytes: ArrayBuffer,
  options?: ConverterOptions
): AxiosResponse {
  const converter = new HttpConverter(options);
  return converter.httpBytesToAxiosResponse(httpBytes);
}

/**
 * Convert Axios response object to raw HTTP response bytes
 */
export function axiosResponseToHttpBytes(
  response: AxiosResponse,
  options?: ConverterOptions
): ArrayBuffer {
  const converter = new HttpConverter(options);
  return converter.axiosResponseToHttpBytes(response);
}
