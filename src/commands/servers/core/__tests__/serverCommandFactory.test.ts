import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    createServerCommand,
    formatServerCount,
    createCQImageTag,
    ServerCommandConfig,
    RenderFunction,
} from '../serverCommandFactory';
import { GlobalEnv, MsgExecCtx } from '../../../../types';

// Mock logger
vi.mock('../../../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

// Mock CanvasImgService
vi.mock('../../../../services/canvasImg.service', () => ({
    CanvasImgService: {
        getInstance: vi.fn().mockReturnValue({
            addImg: vi.fn().mockResolvedValue(undefined),
        }),
    },
}));

describe('serverCommandFactory', () => {
    let mockEnv: GlobalEnv;
    let mockCtx: MsgExecCtx;

    beforeEach(() => {
        mockEnv = {
            OUTPUT_BG_IMG: '/path/to/bg.png',
            SERVERS_FALLBACK_URL: 'https://fallback.example.com',
        } as GlobalEnv;

        mockCtx = {
            env: mockEnv,
            reply: vi.fn().mockResolvedValue(undefined),
            params: new Map(),
        } as unknown as MsgExecCtx;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('createServerCommand', () => {
        it('should create a command with all required properties', () => {
            const config: ServerCommandConfig = {
                name: 'test',
                alias: 't',
                description: 'Test command',
                hint: ['Usage: #test'],
                timesInterval: 5,
                outputFile: 'test.png',
            };

            const renderFn: RenderFunction = async (env) => ({
                fileName: 'test.png',
                serverCount: 10,
            });

            const command = createServerCommand(config, renderFn);

            expect(command.name).toBe('test');
            expect(command.alias).toBe('t');
            expect(command.description).toBe('Test command');
            expect(command.hint).toEqual(['Usage: #test']);
            expect(command.isAdmin).toBe(false);
            expect(command.timesInterval).toBe(5);
        });

        it('should create admin command when isAdmin is true', () => {
            const config: ServerCommandConfig = {
                name: 'admin',
                alias: 'a',
                description: 'Admin command',
                hint: ['Usage: #admin'],
                isAdmin: true,
                timesInterval: 10,
                outputFile: 'admin.png',
            };

            const renderFn: RenderFunction = async (env) => ({
                fileName: 'admin.png',
                serverCount: 0,
            });

            const command = createServerCommand(config, renderFn);

            expect(command.isAdmin).toBe(true);
        });

        it('should initialize canvas background image when OUTPUT_BG_IMG is set', async () => {
            const { CanvasImgService } =
                await import('../../../../services/canvasImg.service');
            const addImgSpy = vi.spyOn(
                CanvasImgService.getInstance(),
                'addImg',
            );

            const config: ServerCommandConfig = {
                name: 'test',
                alias: 't',
                description: 'Test command',
                hint: ['Usage: #test'],
                timesInterval: 5,
                outputFile: 'test.png',
            };

            const renderFn: RenderFunction = async (env) => ({
                fileName: 'test.png',
                serverCount: 10,
            });

            const command = createServerCommand(config, renderFn);
            await command.init(mockEnv);

            expect(addImgSpy).toHaveBeenCalledWith('/path/to/bg.png', true);
        });

        it('should not initialize canvas background when OUTPUT_BG_IMG is not set', async () => {
            const { CanvasImgService } =
                await import('../../../../services/canvasImg.service');
            const addImgSpy = vi.spyOn(
                CanvasImgService.getInstance(),
                'addImg',
            );

            const config: ServerCommandConfig = {
                name: 'test',
                alias: 't',
                description: 'Test command',
                hint: ['Usage: #test'],
                timesInterval: 5,
                outputFile: 'test.png',
            };

            const renderFn: RenderFunction = async (env) => ({
                fileName: 'test.png',
                serverCount: 10,
            });

            const command = createServerCommand(config, renderFn);
            const envWithoutBg = { ...mockEnv };
            delete (envWithoutBg as any).OUTPUT_BG_IMG;

            await command.init(envWithoutBg);

            expect(addImgSpy).not.toHaveBeenCalled();
        });

        it('should execute command and reply with image', async () => {
            const config: ServerCommandConfig = {
                name: 'test',
                alias: 't',
                description: 'Test command',
                hint: ['Usage: #test'],
                timesInterval: 5,
                outputFile: 'test.png',
            };

            const renderFn: RenderFunction = async (env) => ({
                fileName: 'test.png',
                serverCount: 10,
            });

            const command = createServerCommand(config, renderFn);
            await command.exec(mockCtx);

            expect(mockCtx.reply).toHaveBeenCalled();
            const replyCall = (mockCtx.reply as any).mock.calls[0][0];
            expect(replyCall).toContain('[CQ:image');
            expect(replyCall).toContain('test.png');
        });

        it('should add fallback message when server count is 0 and fallback URL is set', async () => {
            const config: ServerCommandConfig = {
                name: 'test',
                alias: 't',
                description: 'Test command',
                hint: ['Usage: #test'],
                timesInterval: 5,
                outputFile: 'test.png',
            };

            const renderFn: RenderFunction = async (env) => ({
                fileName: 'test.png',
                serverCount: 0,
            });

            const command = createServerCommand(config, renderFn);
            await command.exec(mockCtx);

            const replyCall = (mockCtx.reply as any).mock.calls[0][0];
            expect(replyCall).toContain('备用查询地址');
            expect(replyCall).toContain('https://fallback.example.com');
        });

        it('should handle errors during execution', async () => {
            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            const config: ServerCommandConfig = {
                name: 'test',
                alias: 't',
                description: 'Test command',
                hint: ['Usage: #test'],
                timesInterval: 5,
                outputFile: 'test.png',
            };

            const renderFn: RenderFunction = async (env) => {
                throw new Error('Render failed');
            };

            const command = createServerCommand(config, renderFn);

            await expect(command.exec(mockCtx)).rejects.toThrow(
                'Render failed',
            );

            consoleErrorSpy.mockRestore();
        });
    });

    describe('formatServerCount', () => {
        it('should format zero servers', () => {
            expect(formatServerCount(0)).toBe('暂无服务器');
        });

        it('should format single server', () => {
            expect(formatServerCount(1)).toBe('1 个服务器');
        });

        it('should format multiple servers', () => {
            expect(formatServerCount(10)).toBe('10 个服务器');
        });

        it('should format large number of servers', () => {
            expect(formatServerCount(999)).toBe('999 个服务器');
        });
    });

    describe('createCQImageTag', () => {
        it('should create basic CQ image tag', () => {
            const env = {
                STATIC_FILE_BASE_URL: 'http://localhost:3000',
            } as unknown as GlobalEnv;
            const tag = createCQImageTag(env, 'test.png');

            expect(tag).toContain('[CQ:image');
            expect(tag).toContain('file=');
            expect(tag).toContain('test.png');
        });

        it('should include cache and c parameters with defaults', () => {
            const env: GlobalEnv = {} as GlobalEnv;
            const tag = createCQImageTag(env, 'test.png');

            expect(tag).toContain('cache=0');
            expect(tag).toContain('c=8');
        });

        it('should allow custom cache and c parameters', () => {
            const env: GlobalEnv = {} as GlobalEnv;
            const tag = createCQImageTag(env, 'test.png', { cache: 1, c: 3 });

            expect(tag).toContain('cache=1');
            expect(tag).toContain('c=3');
        });

        it('should properly escape file names with special characters', () => {
            const env: GlobalEnv = {} as GlobalEnv;
            const tag = createCQImageTag(env, 'file with spaces & special.png');

            expect(tag).toContain('[CQ:image');
            expect(tag).toContain('file=');
        });
    });
});
