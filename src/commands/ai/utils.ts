import * as jwt from 'jsonwebtoken';
import { JwtHeader } from 'jsonwebtoken';
import { MsgExecCtx } from '../../types';
import { AI_MODEL_DISPLAY_NAME, AI_MODEL_NAME } from './constants';
import { logger } from '../../utils/logger';
import { AxiosResponse } from 'axios';
import { IDifyAIResponse } from './types';
import { createHttpClient } from '../../utils/httpClient';
import _ from 'lodash';

const AI_TIMEOUT_MS = 30_000;
const aiAxiosInst = createHttpClient(
    { timeout: AI_TIMEOUT_MS },
    { maxRetries: 2 },
);

const genGLMJWT = (apiKey: string): string => {
    const [key, secret] = apiKey.split('.');
    return jwt.sign(
        {
            api_key: key,
        },
        secret,
        {
            algorithm: 'HS256',
            expiresIn: '1h',
            header: {
                sign_type: 'SIGN',
            } as unknown as JwtHeader,
        },
    );
};

const genGLMMessages = (
    query: string,
): Array<{
    role: string;
    content: string;
}> => {
    return [
        {
            role: 'system',
            content:
                '作为一名智能客服, 你善于从知识库中总结提炼并思考知识的关联性, 并需要根据知识库内容用简洁和专业的来回答用户问题。如果无法从中得到答案，请说 “根据已知信息无法回答该问题” 或 “没有提供足够的相关信息”，不允许在答案中添加编造成分，答案请尽量中文，并且回答时末尾告知使用的文档名称。 ',
        },
        {
            role: 'user',
            content: `${query}`,
        },
    ];
};

export const getAIQAMatchRes = async (query: string, ctx: MsgExecCtx) => {
    const res = await getQAAIRes(
        query,
        ctx.env.DIFY_AI_URL,
        ctx.env.DIFY_AI_TOKEN,
        ctx.event.user_id.toString(),
    );

    if (res) {
        return `${res}`;
    }

    return `未匹配到指定问题, 请尝试其他问题或联系管理员更新知识库`;
};

export const getQAAIRes = async (
    query: string,
    url: string,
    token: string,
    user: string,
) => {
    const queryParams = {
        inputs: {},
        query,
        response_mode: 'blocking',
        user,
    };

    logger.info('queryParams:', queryParams);

    try {
        const res = (await aiAxiosInst.post(url, queryParams, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })) as AxiosResponse<IDifyAIResponse>;

        logger.info(`res answer:`, res.data?.answer);

        logger.info(
            `tokens cost:`,
            res.data?.metadata.usage.total_tokens,
            res.data.metadata.usage.total_price,
        );

        const docsOutput = _.uniq(
            res.data.metadata.retriever_resources.map(
                (s) => `《${s.document_name}》`,
            ),
        ).join(', ');

        return res.data.answer
            ? `${res.data.answer}\n\n 引用文档: ${docsOutput}`
            : '服务端响应失败';
    } catch (e) {
        logger.error('call dify.ai error', e);
        return '服务端响应失败';
    }
};
