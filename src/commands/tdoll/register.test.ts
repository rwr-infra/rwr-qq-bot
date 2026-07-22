import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GlobalEnv, MessageEvent, MsgExecCtx } from '../../types';

// Mock fs so the success path does not touch disk; capture calls instead.
// 默认全部走"缓存未命中"路径: access 拒绝, 写入相关均成功。
vi.mock('node:fs/promises', () => ({
    access: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
}));

import { access, mkdir, rename, writeFile } from 'node:fs/promises';
import { TDollSkinSvc } from './services/tdollskin.service';
import {
    SKIN_RAW_IMAGE_LOADING_MSG,
    SKIN_RAW_IMAGE_TIMEOUT_MSG,
} from './types/constants';
import { TDollSkinCommandRegister } from './register';

/**
 * Build a minimal MsgExecCtx whose params encode `tdollskin <args...>`.
 * env/event are cast from partials — cqImageFile only reads HOSTNAME/PORT,
 * buildUserScopedPngName only reads group_id/user_id.
 */
const buildCtx = (args: string[]): { ctx: MsgExecCtx; replies: string[] } => {
    const replies: string[] = [];
    const params = new Map<string, boolean>();
    for (const a of args) params.set(a, true);

    const ctx = {
        msg: `#ts ${args.join(' ')}`,
        params,
        env: { HOSTNAME: 'localhost', PORT: 3000 } as unknown as GlobalEnv,
        event: {
            group_id: 123,
            user_id: 456,
        } as unknown as MessageEvent,
        reply: async (m: string) => {
            replies.push(m);
        },
    } as unknown as MsgExecCtx;

    return { ctx, replies };
};

const seedSkinData = (pic = '/images/7/7f/Pic_Test_HD.png') => {
    vi.spyOn(TDollSkinSvc, 'getData').mockResolvedValue({
        '2': [
            {
                index: 0,
                title: '测试皮肤',
                value: '0',
                image: { anime: '', line: '', name: '', pic, pic_d: '', pic_d_h: '', pic_h: '' },
            },
        ],
    });
};

/** 重置 fs 各 mock 到"缓存未命中 + 写入成功"默认状态。 */
const resetFsMocks = () => {
    vi.mocked(access)
        .mockReset()
        .mockRejectedValue(
            Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
        );
    vi.mocked(mkdir).mockReset().mockResolvedValue(undefined);
    vi.mocked(writeFile).mockReset().mockResolvedValue(undefined);
    vi.mocked(rename).mockReset().mockResolvedValue(undefined);
};

describe('tdollskin <weaponId> <skinId> — raw image loading flow', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        // vi.mock factory fns are not touched by restoreAllMocks — reset explicitly.
        resetFsMocks();
    });

    it('sends the loading hint before the image on success', async () => {
        seedSkinData();
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
                    status: 200,
                }),
            );
        vi.stubGlobal('fetch', fetchMock);

        const { ctx, replies } = buildCtx(['2', '0']);
        await TDollSkinCommandRegister.exec(ctx);

        // Loading hint first, then the local PNG CQ image with tail.
        expect(replies).toHaveLength(2);
        expect(replies[0]).toBe(SKIN_RAW_IMAGE_LOADING_MSG);
        expect(replies[1]).toContain('[CQ:image,file=http://localhost:3000/out/');
        expect(replies[1]).toContain('No.2 测试皮肤(皮肤ID:0)');

        // Image was actually downloaded and landed under out/ (atomic write:
        // writeFile 落临时文件, rename 落地最终缓存)。
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledTimes(1);
        expect(rename).toHaveBeenCalledTimes(1);
    });

    it('serves the cached image without loading hint or download on cache hit', async () => {
        seedSkinData();
        // 缓存命中: access 解析即视为文件已存在。
        vi.mocked(access).mockResolvedValue(undefined);
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const { ctx, replies } = buildCtx(['2', '0']);
        await TDollSkinCommandRegister.exec(ctx);

        // 单条回复: 本地图片 + 尾注, 无"加载中", 不访问远端。
        expect(replies).toHaveLength(1);
        expect(replies[0]).toContain(
            '[CQ:image,file=http://localhost:3000/out/skin_cache/',
        );
        expect(replies[0]).toContain('No.2 测试皮肤(皮肤ID:0)');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(writeFile).not.toHaveBeenCalled();
    });

    it('writes the cache to a content-addressed path (no user/group id)', async () => {
        seedSkinData();
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
                    status: 200,
                }),
            ),
        );

        const { ctx } = buildCtx(['2', '0']);
        await TDollSkinCommandRegister.exec(ctx);

        // writeAtomic 先写临时文件: 路径应位于 skin_cache 下、按 weaponId_skinId_hash 寻址,
        // 且不再使用旧的 tdoll_skin_raw 用户作用域命名。
        expect(writeFile).toHaveBeenCalledTimes(1);
        const target = vi.mocked(writeFile).mock.calls[0][0] as string;
        expect(target).toContain('skin_cache');
        expect(target).toMatch(/[\\/]2_0_[0-9a-f]{8}\.png/);
        expect(target).not.toContain('tdoll_skin_raw');
    });

    it('replies with the timeout message when the download times out', async () => {
        seedSkinData();
        const abortErr = new DOMException('signal timed out', 'TimeoutError');
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr));

        const { ctx, replies } = buildCtx(['2', '0']);
        await TDollSkinCommandRegister.exec(ctx);

        expect(replies).toHaveLength(2);
        expect(replies[0]).toBe(SKIN_RAW_IMAGE_LOADING_MSG);
        expect(replies[1]).toContain(SKIN_RAW_IMAGE_TIMEOUT_MSG);
        expect(replies[1]).toContain('原链接: https://www.gfwiki.org');
        // Timed out — must not have written any file.
        expect(writeFile).not.toHaveBeenCalled();
    });

    it('replies with the timeout message on a non-ok HTTP status', async () => {
        seedSkinData();
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(new Response(null, { status: 502 })),
        );

        const { ctx, replies } = buildCtx(['2', '0']);
        await TDollSkinCommandRegister.exec(ctx);

        expect(replies).toHaveLength(2);
        expect(replies[0]).toBe(SKIN_RAW_IMAGE_LOADING_MSG);
        expect(replies[1]).toContain(SKIN_RAW_IMAGE_TIMEOUT_MSG);
        expect(writeFile).not.toHaveBeenCalled();
    });

    it('does not cache a 2xx non-image body and falls back to the timeout message', async () => {
        seedSkinData();
        // gfwiki 软错误页/CDN 拦截页: HTTP 200 但 body 是 HTML, 非 PNG。
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response('<html><body>error</body></html>', {
                    status: 200,
                    headers: { 'content-type': 'text/html' },
                }),
            ),
        );

        const { ctx, replies } = buildCtx(['2', '0']);
        await TDollSkinCommandRegister.exec(ctx);

        // 非 PNG 响应不得写入缓存, 回退为超时提示 + 原链接。
        expect(replies).toHaveLength(2);
        expect(replies[0]).toBe(SKIN_RAW_IMAGE_LOADING_MSG);
        expect(replies[1]).toContain(SKIN_RAW_IMAGE_TIMEOUT_MSG);
        expect(replies[1]).toContain('原链接: https://www.gfwiki.org');
        expect(writeFile).not.toHaveBeenCalled();
    });

    it('reports missing skin id before attempting any download', async () => {
        seedSkinData();
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const { ctx, replies } = buildCtx(['2', '999']);
        await TDollSkinCommandRegister.exec(ctx);

        // No loading hint, no fetch — validation message only.
        expect(replies).toHaveLength(1);
        expect(replies[0]).toContain('未找到武器 2 下皮肤ID为 999');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
