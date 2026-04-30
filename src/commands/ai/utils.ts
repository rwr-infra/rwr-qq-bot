import { MsgExecCtx } from '../../types';
import { AI_MODEL_DISPLAY_NAME, AI_MODEL_NAME } from './constants';
import { logger } from '../../utils/logger';
import axios, { AxiosResponse } from 'axios';
import { IOpenAIResponse } from './types';

const genUserMessage = (
    query: string
): Array<{
    role: string;
    content: string;
}> => {
    return [
        {
            role: 'user',
            content: `${query}`,
        },
    ];
};

export const getAIQAMatchRes = async (query: string, ctx: MsgExecCtx) => {
    const res = await getQAAIRes(
        query,
        ctx.env.OPENAI_API_URL,
        ctx.env.OPENAI_API_KEY
    );

    if (res) {
        return `${AI_MODEL_DISPLAY_NAME} ${res}`;
    }

    return `未匹配到指定问题, 请尝试其他问题或联系管理员更新知识库`;
};

export const getQAAIRes = async (
    query: string,
    url: string,
    apiKey: string
) => {
    const queryParams = {
        model: AI_MODEL_NAME,
        messages: genUserMessage(query),
        stream: false,
    };

    logger.info('queryParams:', queryParams);

    try {
        const res = (await axios.post(url, queryParams, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        })) as AxiosResponse<IOpenAIResponse>;

        const answer = res.data?.choices?.[0]?.message?.content;

        logger.info(`res answer:`, answer);

        logger.info(
            `tokens cost:`,
            res.data?.usage?.total_tokens
        );

        return answer || '服务端响应失败';
    } catch (e) {
        logger.error('call openai compatible api error', e);
        return '服务端响应失败';
    }
};
