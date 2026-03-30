import { API_URL } from './constants';
import { NekoRes } from './types';
import { imageApiClient } from '../../services/imageApiClient';

export const getNekoImgs = async () => {
    const data = (await imageApiClient.get(`${API_URL}/v2/neko`))
        .data as NekoRes;

    return data;
};
