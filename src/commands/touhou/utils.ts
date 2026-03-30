import { API_URL } from './constants';
import { TouhouRes } from './types';
import { imageApiClient } from '../../services/imageApiClient';

export const getImgInfo = async () => {
    const data = (await imageApiClient.get(`${API_URL}?type=json&proxy=0`))
        .data as TouhouRes;

    return data;
};
