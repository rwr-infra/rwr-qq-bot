import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiCommandRegister } from './register';
import { MsgExecCtx, GlobalEnv } from '../../types';

// Mock utility that parses command parameters
vi.mock('../../utils/cmd', () => ({
    parseIgnoreSpace: vi.fn().mockImplementation((_prefixes: string[], msg: string) => {
        const map = new Map<string, boolean>();
        const stripped = msg.replace('#ai', '').trim();
        if (stripped) {
            map.set(stripped, true);
        }
        return map;
    }),
}));

// Mock getStaticHttpPath to return a predictable URL
vi.mock('../../utils/cmdreq', () => ({
    getStaticHttpPath: vi.fn().mockImplementation((_env: GlobalEnv, fileName: string) => {
        return `http://localhost:3000/out/${fileName}`;
    }),
}));

// Mock AI utility to avoid real HTTP calls
vi.mock('./utils', () => ({
    getAIQAMatchRes: vi.fn(),
}));

// Mock AiCanvas so we don't render real images
vi.mock('./aiCanvas', () => ({
    AiCanvas: vi.fn().mockImplementation(() => ({
        render: vi.fn().mockReturnValue('/out/ai-123.png'),
    })),
}));

// Convenience factory for a mock MsgExecCtx
const buildCtx = (
    query: string,
    envOverrides: Partial<GlobalEnv> = {},
): MsgExecCtx => {
    const params = new Map<string, boolean>();
    if (query) {
        params.set(query, true);
    }

    return {
        msg: `#ai ${query}`,
        params,
        env: {
            OPENAI_API_KEY: 'test-key',
            OPENAI_API_URL: 'https://api.example.com/chat/completions',
            HOSTNAME: 'localhost',
            PORT: 3000,
            ...envOverrides,
        } as GlobalEnv,
        event: { user_id: 123 } as any,
        reply: vi.fn().mockResolvedValue(undefined),
    } as unknown as MsgExecCtx;
};

describe('AiCommandRegister', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('register metadata', () => {
        it('should have name "ai"', () => {
            expect(AiCommandRegister.name).toBe('ai');
        });

        it('should not be admin-only', () => {
            expect(AiCommandRegister.isAdmin).toBe(false);
        });

        it('should have a timesInterval', () => {
            expect(AiCommandRegister.timesInterval).toBeGreaterThan(0);
        });

        it('should have a description', () => {
            expect(AiCommandRegister.description).toBeTruthy();
        });

        it('should have parseParams function', () => {
            expect(typeof AiCommandRegister.parseParams).toBe('function');
        });

        it('parseParams should call parseIgnoreSpace with #ai prefix', async () => {
            const { parseIgnoreSpace } = await import('../../utils/cmd');
            AiCommandRegister.parseParams!('#ai hello world');
            expect(parseIgnoreSpace).toHaveBeenCalledWith(['#ai'], '#ai hello world');
        });
    });

    describe('exec - missing environment variables', () => {
        it('should reply with error when OPENAI_API_KEY is missing', async () => {
            const ctx = buildCtx('test query', { OPENAI_API_KEY: '' as any });
            await AiCommandRegister.exec(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('OPENAI_API_KEY'),
            );
        });

        it('should reply with error when OPENAI_API_URL is missing', async () => {
            const ctx = buildCtx('test query', { OPENAI_API_URL: '' as any });
            await AiCommandRegister.exec(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('OPENAI_API_URL'),
            );
        });

        it('should not call getAIQAMatchRes when env vars are missing', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            const ctx = buildCtx('test', { OPENAI_API_KEY: '' as any });
            await AiCommandRegister.exec(ctx);

            expect(getAIQAMatchRes).not.toHaveBeenCalled();
        });

        it('should return early when env vars are missing (reply called only once)', async () => {
            const ctx = buildCtx('test', { OPENAI_API_URL: '' as any });
            await AiCommandRegister.exec(ctx);

            expect(ctx.reply).toHaveBeenCalledTimes(1);
        });
    });

    describe('exec - waiting reply', () => {
        it('should send a waiting message before querying', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            vi.mocked(getAIQAMatchRes).mockResolvedValue('[RWR-Agent] some answer');

            const ctx = buildCtx('my question');
            await AiCommandRegister.exec(ctx);

            const calls = vi.mocked(ctx.reply).mock.calls;
            const waitingCall = calls.find(([msg]) =>
                msg.includes('正在通过大语言模型查询中'),
            );
            expect(waitingCall).toBeDefined();
        });
    });

    describe('exec - successful answer', () => {
        it('should render AiCanvas and reply with CQ image tag on success', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            vi.mocked(getAIQAMatchRes).mockResolvedValue('[RWR-Agent] Great answer here');

            const ctx = buildCtx('what is rwr');
            await AiCommandRegister.exec(ctx);

            const replyCalls = vi.mocked(ctx.reply).mock.calls.map(([msg]) => msg);
            const imagReply = replyCalls.find((msg) => msg.includes('[CQ:image'));
            expect(imagReply).toBeDefined();
            expect(imagReply).toContain('cache=0');
            expect(imagReply).toContain('c=8');
        });

        it('should include user_id in the image fileName', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            const { AiCanvas } = await import('./aiCanvas');
            vi.mocked(getAIQAMatchRes).mockResolvedValue('[RWR-Agent] some answer');

            const ctx = buildCtx('question');
            ctx.event.user_id = 99999;
            await AiCommandRegister.exec(ctx);

            expect(AiCanvas).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                'ai-99999.png',
            );
        });

        it('should call AiCanvas.render() on successful answer', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            const { AiCanvas } = await import('./aiCanvas');

            const mockRender = vi.fn().mockReturnValue('/out/ai-123.png');
            vi.mocked(AiCanvas).mockImplementation(() => ({ render: mockRender }) as any);
            vi.mocked(getAIQAMatchRes).mockResolvedValue('[RWR-Agent] valid answer');

            const ctx = buildCtx('hi');
            await AiCommandRegister.exec(ctx);

            expect(mockRender).toHaveBeenCalledTimes(1);
        });

        it('should pass query and answer to AiCanvas constructor', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            const { AiCanvas } = await import('./aiCanvas');
            vi.mocked(getAIQAMatchRes).mockResolvedValue('[RWR-Agent] the AI answer');

            const ctx = buildCtx('my specific query');
            await AiCommandRegister.exec(ctx);

            expect(AiCanvas).toHaveBeenCalledWith(
                'my specific query',
                '[RWR-Agent] the AI answer',
                expect.any(String),
            );
        });

        it('should use getStaticHttpPath in the reply image tag', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            const { getStaticHttpPath } = await import('../../utils/cmdreq');
            vi.mocked(getAIQAMatchRes).mockResolvedValue('[RWR-Agent] ok');
            vi.mocked(getStaticHttpPath).mockReturnValue('http://mocked/out/ai-123.png');

            const ctx = buildCtx('q');
            await AiCommandRegister.exec(ctx);

            const replyCalls = vi.mocked(ctx.reply).mock.calls.map(([msg]) => msg);
            const imageReply = replyCalls.find((msg) => msg.includes('[CQ:image'));
            expect(imageReply).toContain('http://mocked/out/ai-123.png');
        });
    });

    describe('exec - error answers', () => {
        it('should reply directly when answer contains 服务端响应失败', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            vi.mocked(getAIQAMatchRes).mockResolvedValue('服务端响应失败');

            const ctx = buildCtx('query');
            await AiCommandRegister.exec(ctx);

            const replyCalls = vi.mocked(ctx.reply).mock.calls.map(([msg]) => msg);
            expect(replyCalls).toContain('服务端响应失败');
        });

        it('should reply directly when answer contains 未匹配到', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            vi.mocked(getAIQAMatchRes).mockResolvedValue(
                '未匹配到指定问题, 请尝试其他问题或联系管理员更新知识库',
            );

            const ctx = buildCtx('query');
            await AiCommandRegister.exec(ctx);

            const replyCalls = vi.mocked(ctx.reply).mock.calls.map(([msg]) => msg);
            expect(replyCalls).toContain(
                '未匹配到指定问题, 请尝试其他问题或联系管理员更新知识库',
            );
        });

        it('should not render AiCanvas when answer indicates failure', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            const { AiCanvas } = await import('./aiCanvas');
            vi.mocked(getAIQAMatchRes).mockResolvedValue('服务端响应失败');

            const ctx = buildCtx('query');
            await AiCommandRegister.exec(ctx);

            expect(AiCanvas).not.toHaveBeenCalled();
        });

        it('should not render AiCanvas when answer contains 未匹配到', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            const { AiCanvas } = await import('./aiCanvas');
            vi.mocked(getAIQAMatchRes).mockResolvedValue('未匹配到 something');

            const ctx = buildCtx('query');
            await AiCommandRegister.exec(ctx);

            expect(AiCanvas).not.toHaveBeenCalled();
        });

        it('should return early after direct reply on failure (no CQ image tag)', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            vi.mocked(getAIQAMatchRes).mockResolvedValue('服务端响应失败');

            const ctx = buildCtx('q');
            await AiCommandRegister.exec(ctx);

            const replyCalls = vi.mocked(ctx.reply).mock.calls.map(([msg]) => msg);
            const imageReply = replyCalls.find((msg) => msg.includes('[CQ:image'));
            expect(imageReply).toBeUndefined();
        });
    });

    describe('exec - query extraction', () => {
        it('should extract query from ctx.params', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            vi.mocked(getAIQAMatchRes).mockResolvedValue('[RWR-Agent] ok');

            const ctx = buildCtx('extracted query');
            await AiCommandRegister.exec(ctx);

            expect(getAIQAMatchRes).toHaveBeenCalledWith('extracted query', ctx);
        });

        it('should use first key from params as query', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            vi.mocked(getAIQAMatchRes).mockResolvedValue('[RWR-Agent] answer');

            const ctx = buildCtx('first param');
            // Ensure only one param
            ctx.params.clear();
            ctx.params.set('first param', true);
            ctx.params.set('second param', true);

            await AiCommandRegister.exec(ctx);

            // The first iterated key should be used
            expect(getAIQAMatchRes).toHaveBeenCalledWith('first param', ctx);
        });

        it('should handle empty params map gracefully', async () => {
            const { getAIQAMatchRes } = await import('./utils');
            vi.mocked(getAIQAMatchRes).mockResolvedValue('[RWR-Agent] answer');

            const ctx = buildCtx('');
            ctx.params.clear();

            await AiCommandRegister.exec(ctx);

            // Should still call getAIQAMatchRes with empty string query
            expect(getAIQAMatchRes).toHaveBeenCalledWith('', ctx);
        });
    });
});