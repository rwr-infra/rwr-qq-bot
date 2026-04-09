import type { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { GlobalEnv } from '../types';
import { createHttpClient } from '../utils/httpClient';

export class RemoteService {
    axiosInst: AxiosInstance;
    static selfInst: RemoteService;

    constructor(remoteUrl: string, token: string) {
        logger.info('Remote service init with:', remoteUrl);
        this.axiosInst = createHttpClient(
            {
                baseURL: remoteUrl,
                timeout: 10 * 1000,
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
            { maxRetries: 2 },
        );

        this.axiosInst.defaults.headers.post['Content-Type'] =
            'application/json';

        this.axiosInst.interceptors.request.use((config) => {
            const queryUrl = config.url;
            const queryParams = config.params;

            const data = config.data;

            logger.info('> request:', queryUrl, data);
            return config;
        });

        this.axiosInst.interceptors.response.use((config) => {
            const resData = config.data;
            logger.info('> response:', resData);
            return config;
        });
    }

    static init(env: GlobalEnv) {
        if (!RemoteService.selfInst) {
            RemoteService.selfInst = new RemoteService(
                env.REMOTE_URL,
                env.TOKEN,
            );
        }
    }

    static getInst() {
        return RemoteService.selfInst;
    }

    async sendPrivateMsg(params: {
        user_id: number;
        message: any;
        // default: false
        auto_escape?: boolean;
    }) {
        try {
            await this.axiosInst.post('/send_private_msg', params);
        } catch (e) {
            logger.error('sendPrivateMsg error:', e);
        }
    }

    async sendGroupMsg(params: { group_id: number; message: any }) {
        try {
            await this.axiosInst.post('/send_group_msg', params);
        } catch (e) {
            logger.error('sendGroupMsg error:', e);
        }
    }

    async sendMsg(params: { user_id: number; group_id: number; message: any }) {
        try {
            await this.axiosInst.post('/send_msg', params);
        } catch (e) {
            logger.error('sendMsg error:', e);
        }
    }
}
