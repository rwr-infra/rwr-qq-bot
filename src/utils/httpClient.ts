import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface RetryConfig {
    maxRetries?: number;
    retryDelay?: number;
    retryableStatuses?: number[];
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
    maxRetries: 2,
    retryDelay: 1000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
};

export function createHttpClient(
    baseConfig: AxiosRequestConfig,
    retryConfig: RetryConfig = {},
): AxiosInstance {
    const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

    const instance = axios.create(baseConfig);

    instance.interceptors.response.use(
        (response) => response,
        async (error) => {
            const reqConfig = error.config;
            if (!reqConfig) {
                return Promise.reject(error);
            }

            reqConfig.__retryCount = (reqConfig.__retryCount || 0) as number;

            const shouldRetry =
                reqConfig.__retryCount < config.maxRetries &&
                (config.retryableStatuses.includes(error.response?.status) ||
                    !error.response);

            if (shouldRetry) {
                reqConfig.__retryCount += 1;
                const delay =
                    config.retryDelay * Math.pow(2, reqConfig.__retryCount - 1);
                await new Promise((resolve) => setTimeout(resolve, delay));
                return instance(reqConfig);
            }

            return Promise.reject(error);
        },
    );

    return instance;
}
