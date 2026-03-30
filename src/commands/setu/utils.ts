import { API_URL } from './constants';
import { SetuRes } from './types';
import { imageApiClient } from '../../services/imageApiClient';

export const getImgInfo = async () => {
    const data = (
        await imageApiClient.post(API_URL, {
            r18: 0,
        })
    ).data as SetuRes;

    return data;
};
