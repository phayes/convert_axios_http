import { AxiosRequestConfig, AxiosResponse } from 'axios';
export declare function rawHttpRequestToAxiosRequest(buffer: ArrayBuffer): AxiosRequestConfig<any>;
export declare function axiosRequestToRawHttp(config: AxiosRequestConfig): ArrayBuffer;
export declare function rawHttpResponseToAxiosResponse(buffer: ArrayBuffer, config?: AxiosRequestConfig): AxiosResponse<any>;
export declare function axiosResponseToRawHttp(response: AxiosResponse): ArrayBuffer;
declare const _default: {
    rawHttpRequestToAxiosRequest: typeof rawHttpRequestToAxiosRequest;
    axiosRequestToRawHttp: typeof axiosRequestToRawHttp;
    rawHttpResponseToAxiosResponse: typeof rawHttpResponseToAxiosResponse;
    axiosResponseToRawHttp: typeof axiosResponseToRawHttp;
};
export default _default;
