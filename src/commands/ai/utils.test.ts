import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { getQAAIRes, getAIQAMatchRes } from './utils';
import { AI_MODEL_NAME, AI_MODEL_DISPLAY_NAME } from './constants';
import { MsgExecCtx, GlobalEnv } from '../../types';
import { IOpenAIResponse } from './types';
import { AxiosResponse } from 'axios';

vi.mock('axios');
vi.mock('../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

const buildOpenAIResponse = (content: string): AxiosResponse<IOpenAIResponse> =>
    ({
        data: {
            id: 'chatcmpl-123',
            object: 'chat.completion',
            created: 1700000000,
            model: AI_MODEL_NAME,
            choices: [
                {
                    index: 0,
                    message: { role: 'assistant', content },
                    finish_reason: 'stop',
                },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        },
    } as AxiosResponse<IOpenAIResponse>);

const mockCtx = (overrides: Partial<GlobalEnv> = {}): MsgExecCtx =>
    ({
        msg: '',
        params: new Map(),
        env: {
            OPENAI_API_URL: 'https://api.example.com/chat/completions',
            OPENAI_API_KEY: 'test-api-key',
            ...overrides,
        } as GlobalEnv,
        event: { user_id: 12345 } as any,
        reply: vi.fn().mockResolvedValue(undefined),
    } as unknown as MsgExecCtx);

describe('getQAAIRes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return the answer from OpenAI response choices', async () => {
        vi.mocked(axios.post).mockResolvedValue(buildOpenAIResponse('Hello from AI'));

        const result = await getQAAIRes('test query', 'https://api.example.com', 'my-key');

        expect(result).toBe('Hello from AI');
    });

    it('should send POST request with correct model and stream=false', async () => {
        vi.mocked(axios.post).mockResolvedValue(buildOpenAIResponse('response'));

        await getQAAIRes('my query', 'https://api.example.com/chat/completions', 'sk-key');

        expect(axios.post).toHaveBeenCalledWith(
            'https://api.example.com/chat/completions',
            expect.objectContaining({
                model: AI_MODEL_NAME,
                stream: false,
            }),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer sk-key',
                    'Content-Type': 'application/json',
                }),
            }),
        );
    });

    it('should send user role message with the provided query', async () => {
        vi.mocked(axios.post).mockResolvedValue(buildOpenAIResponse('ok'));

        await getQAAIRes('what is rwr?', 'https://api.example.com', 'key');

        const [, body] = vi.mocked(axios.post).mock.calls[0];
        expect((body as any).messages).toEqual([
            { role: 'user', content: 'what is rwr?' },
        ]);
    });

    it('should return 服务端响应失败 when choices array is empty', async () => {
        vi.mocked(axios.post).mockResolvedValue({
            data: {
                choices: [],
                usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            },
        } as AxiosResponse<any>);

        const result = await getQAAIRes('query', 'https://api.example.com', 'key');

        expect(result).toBe('服务端响应失败');
    });

    it('should return 服务端响应失败 when choices is undefined', async () => {
        vi.mocked(axios.post).mockResolvedValue({
            data: {},
        } as AxiosResponse<any>);

        const result = await getQAAIRes('query', 'https://api.example.com', 'key');

        expect(result).toBe('服务端响应失败');
    });

    it('should return 服务端响应失败 when message content is empty string', async () => {
        vi.mocked(axios.post).mockResolvedValue(buildOpenAIResponse(''));

        const result = await getQAAIRes('query', 'https://api.example.com', 'key');

        expect(result).toBe('服务端响应失败');
    });

    it('should return 服务端响应失败 when message content is null', async () => {
        vi.mocked(axios.post).mockResolvedValue({
            data: {
                choices: [{ index: 0, message: { role: 'assistant', content: null }, finish_reason: 'stop' }],
                usage: { prompt_tokens: 1, completion_tokens: 0, total_tokens: 1 },
            },
        } as AxiosResponse<any>);

        const result = await getQAAIRes('query', 'https://api.example.com', 'key');

        expect(result).toBe('服务端响应失败');
    });

    it('should return 服务端响应失败 when axios.post throws an error', async () => {
        vi.mocked(axios.post).mockRejectedValue(new Error('network error'));

        const result = await getQAAIRes('query', 'https://api.example.com', 'key');

        expect(result).toBe('服务端响应失败');
    });

    it('should return 服务端响应失败 when axios.post throws non-Error object', async () => {
        vi.mocked(axios.post).mockRejectedValue('timeout');

        const result = await getQAAIRes('query', 'https://api.example.com', 'key');

        expect(result).toBe('服务端响应失败');
    });

    it('should pass api key as Bearer token in Authorization header', async () => {
        vi.mocked(axios.post).mockResolvedValue(buildOpenAIResponse('answer'));

        await getQAAIRes('query', 'https://api.example.com', 'secret-key-abc');

        const [, , options] = vi.mocked(axios.post).mock.calls[0];
        expect((options as any).headers.Authorization).toBe('Bearer secret-key-abc');
    });
});

describe('getAIQAMatchRes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should prepend AI_MODEL_DISPLAY_NAME to the answer', async () => {
        vi.mocked(axios.post).mockResolvedValue(buildOpenAIResponse('This is the answer'));

        const ctx = mockCtx();
        const result = await getAIQAMatchRes('test query', ctx);

        expect(result).toBe(`${AI_MODEL_DISPLAY_NAME} This is the answer`);
    });

    it('should use OPENAI_API_URL and OPENAI_API_KEY from ctx.env', async () => {
        vi.mocked(axios.post).mockResolvedValue(buildOpenAIResponse('ok'));

        const ctx = mockCtx({
            OPENAI_API_URL: 'https://custom-url.com/v1/chat/completions',
            OPENAI_API_KEY: 'custom-key-xyz',
        });

        await getAIQAMatchRes('hello', ctx);

        expect(axios.post).toHaveBeenCalledWith(
            'https://custom-url.com/v1/chat/completions',
            expect.anything(),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer custom-key-xyz',
                }),
            }),
        );
    });

    it('should return fallback message when API returns empty answer', async () => {
        vi.mocked(axios.post).mockResolvedValue(buildOpenAIResponse(''));

        const ctx = mockCtx();
        const result = await getAIQAMatchRes('query', ctx);

        // getQAAIRes returns '服务端响应失败', getAIQAMatchRes wraps it
        expect(result).toBe(`${AI_MODEL_DISPLAY_NAME} 服务端响应失败`);
    });

    it('should return fallback message on API error', async () => {
        vi.mocked(axios.post).mockRejectedValue(new Error('connect ECONNREFUSED'));

        const ctx = mockCtx();
        const result = await getAIQAMatchRes('query', ctx);

        expect(result).toBe(`${AI_MODEL_DISPLAY_NAME} 服务端响应失败`);
    });

    it('should return 未匹配到 fallback only when getQAAIRes returns falsy (never happens in new code)', async () => {
        // getQAAIRes always returns a non-empty string now, so getAIQAMatchRes
        // should always prepend AI_MODEL_DISPLAY_NAME
        vi.mocked(axios.post).mockResolvedValue(buildOpenAIResponse('some answer'));

        const ctx = mockCtx();
        const result = await getAIQAMatchRes('question', ctx);

        expect(result).toContain(AI_MODEL_DISPLAY_NAME);
    });

    it('should return multiline answer correctly', async () => {
        const multilineAnswer = 'Line 1\nLine 2\nLine 3';
        vi.mocked(axios.post).mockResolvedValue(buildOpenAIResponse(multilineAnswer));

        const ctx = mockCtx();
        const result = await getAIQAMatchRes('query', ctx);

        expect(result).toBe(`${AI_MODEL_DISPLAY_NAME} ${multilineAnswer}`);
    });
});
