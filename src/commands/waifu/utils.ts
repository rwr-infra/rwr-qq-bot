import { API_URL } from './constants';
import { WaifuRes } from './types';
import { imageApiClient } from '../../services/imageApiClient';

export const getImgInfo = async () => {
    const data = (await imageApiClient.get(`${API_URL}/random`))
        .data as WaifuRes;

    return data;
};
