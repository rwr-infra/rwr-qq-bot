import { createHttpClient } from '../utils/httpClient';

const IMAGE_API_TIMEOUT = 10_000;
const IMAGE_API_MAX_RETRIES = 2;

export const imageApiClient = createHttpClient(
    { timeout: IMAGE_API_TIMEOUT },
    { maxRetries: IMAGE_API_MAX_RETRIES },
);

imageApiClient.defaults.headers.post['Content-Type'] = 'application/json';
