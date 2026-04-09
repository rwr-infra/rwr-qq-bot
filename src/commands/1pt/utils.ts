import { API_URL, RES_URL_PREFIX } from './constants';
import { OnePtRes } from './types';
import { imageApiClient } from '../../services/imageApiClient';

export const getShortInfo = async (url: string) => {
    const data = (
        await imageApiClient.get(`${API_URL}/1pt/addURL.php?url=${url}`)
    ).data as OnePtRes;

    return data;
};

export const getShortUrl = (short: string): string => {
    return `${RES_URL_PREFIX}/${short}`;
};
