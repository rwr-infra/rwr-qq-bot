import { GlobalEnv, IRegister, MsgExecCtx } from '../../types';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { TDollSvc } from './services/tdoll.service';
import { TDollSkinSvc } from './services/tdollskin.service';
import { logger } from '../../utils/logger';
import {
    SKIN_RAW_IMAGE_LOADING_MSG,
    SKIN_RAW_IMAGE_TIMEOUT_MS,
    SKIN_RAW_IMAGE_TIMEOUT_MSG,
    TDOLL_SKIN_NOT_FOUND_MSG,
} from './types/constants';
import { buildUserScopedPngName } from '../../utils/cmdreq';
import { cqImageFile } from '../../utils/cqCode';
import { CommandHelper } from './utils/commandHelper';
import { printTDollDetailPng } from './utils/utils';
import { resolveSkinImageUrl } from './canvas/assets';

/** out/ 输出目录名(与 baseCanvas 的 OUTPUT_FOLDER 保持一致)。 */
const OUTPUT_FOLDER = 'out';
/** 皮肤原图缓存子目录(顶层 out/ 清理会跳过子目录, 故此处长效保留)。 */
const SKIN_CACHE_SUBDIR = 'skin_cache';

const pathExists = async (p: string): Promise<boolean> => {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
};

/**
 * 原子写入: 先落临时文件再 rename, 避免并发请求读到写一半的缓存文件。
 * 同目录同卷 rename 在 Linux/Windows 上均为原子操作。
 */
const writeAtomic = async (target: string, buf: Buffer): Promise<void> => {
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    try {
        await fs.writeFile(tmp, buf);
        await fs.rename(tmp, target);
    } catch (error) {
        await fs.unlink(tmp).catch(() => {});
        throw error;
    }
};

/**
 * 生成皮肤原图的内容寻址缓存路径(out/ 相对, 用正斜杠以便拼入 HTTP URL)。
 *
 * 原图内容由 (weaponId, skinId) 唯一决定, 与请求用户无关, 故不再带 QQ 号;
 * 同一张皮肤全局只缓存一份。附加 url 短 hash 用于失效: gfwiki 若更换图片,
 * 地址变化会落到新文件名, 自动重新下载。
 */
const buildSkinCacheRelPath = (
    weaponId: string,
    skinId: string,
    url: string,
): string => {
    const urlHash = crypto
        .createHash('sha1')
        .update(url)
        .digest('hex')
        .slice(0, 8);
    return path.posix.join(
        SKIN_CACHE_SUBDIR,
        `${weaponId}_${skinId}_${urlHash}.png`,
    );
};

/**
 * 注入两个数据源的文件路径。环境变量名(TDOLL_DATA_FILE / TDOLL_SKIN_DATA_FILE)
 * 保持不变，仅把读取从 fetch 时刻的 process.env 前移到 init(env) 注入。
 */
const initTDollServices = async (env: GlobalEnv): Promise<void> => {
    TDollSvc.configure(env.TDOLL_DATA_FILE);
    TDollSkinSvc.configure(env.TDOLL_SKIN_DATA_FILE);
};

const createTDollCommand = (name: string, alias: string): IRegister => {
    const getErrorMessage = () => `参数不正确, 示例:
#${name} M4A1
#${name} random (随机返回)
#${name} m4 ar (查询突击步枪)
#${name} random ar (随机突击步枪)`;

    const exec = async (ctx: any) => {
        try {
            if (!(await CommandHelper.validateParams(ctx, 1, 2))) {
                await ctx.reply(getErrorMessage());
                return;
            }

            const [query, query2 = ''] = CommandHelper.getQueryParams(ctx.params);
            await ctx.reply('正在查询数据并生成, 请稍候...');
            const replyText = (await CommandHelper.getTDoll2Reply(ctx, query, query2)) ?? '';
            await ctx.reply(replyText);
        } catch (error) {
            console.error(`[TDollCommand] Error executing command:`, error);
            await ctx.reply('查询过程中发生错误，请稍后重试');
        }
    };

    return {
        name,
        alias,
        description: '根据枪名查询数据, 支持模糊匹配, 忽略大小写及符号.[10s CD]',
        hint: [
            `按名称查询指定武器数据: #${alias} M4A1`,
            `按名称模糊查询武器数据: #${alias} m4`,
            `随机武器: #${alias} random`,
            `随机 AR 武器: #${alias} random ar`,
        ],
        timesInterval: 10,
        isAdmin: false,
        init: initTDollServices,
        exec
    };
};

export const TDollCommandRegister = createTDollCommand('tdoll', 'td');

const createTDollSkinCommand = (name: string, alias: string): IRegister => {
    /**
     * 单武器全部皮肤网格图(原有行为)。
     */
    const execSkinGrid = async (ctx: any, weaponId: string) => {
        const start = Date.now();
        const [tdollData, tdollSkinData] = await Promise.all([
            TDollSvc.getData(),
            TDollSkinSvc.getData(),
        ]);

        logger.info('Fetched tdoll & tdollSkinData', {
            duration: Date.now() - start,
            tdollCount: tdollData.length,
            skinCount: Object.keys(tdollSkinData).length,
        });

        if (!(weaponId in tdollSkinData)) {
            await ctx.reply(TDOLL_SKIN_NOT_FOUND_MSG);
            return;
        }

        await ctx.reply('正在查询数据并生成, 请稍候...');

        const fileName = buildUserScopedPngName('tdoll_skin', ctx.event);
        await printTDollDetailPng(weaponId, tdollData, tdollSkinData, fileName);

        await ctx.reply(cqImageFile(ctx.env, fileName));
    };

    /**
     * 指定皮肤原图(武器编号 + 皮肤ID)。
     *
     * 原图内容由 (weaponId, skinId) 唯一决定, 与用户无关, 因此按内容寻址
     * 缓存到 out/skin_cache/(见 {@link buildSkinCacheRelPath}), 全局只存一份:
     * - 命中缓存: 直接以本地图片回发, 不发"加载中"、不访问远端;
     * - 未命中: 先发"加载中", 下载远端 gfwiki 原图并原子写入缓存, 再回发。
     * 这样 go-cqhttp 直接从本地拉取、无二次下载等待; 下载超过
     * {@link SKIN_RAW_IMAGE_TIMEOUT_MS} 则改为发送超时提示并附带原链接。
     */
    const execSkinRawImage = async (
        ctx: MsgExecCtx,
        weaponId: string,
        skinId: string
    ) => {
        const tdollSkinData = await TDollSkinSvc.getData();

        const skins = tdollSkinData[weaponId];
        if (!skins) {
            await ctx.reply(TDOLL_SKIN_NOT_FOUND_MSG);
            return;
        }

        const skin = skins.find((s) => s.value === skinId);
        if (!skin) {
            const availableIds = skins
                .map((s) => s.value)
                .filter(Boolean)
                .join(', ');
            await ctx.reply(
                `未找到武器 ${weaponId} 下皮肤ID为 ${skinId} 的皮肤。\n可用皮肤ID: ${availableIds || '无'}`
            );
            return;
        }

        const pic = skin.image?.pic;
        if (!pic) {
            await ctx.reply(`该皮肤(${skin.title})暂无原图数据`);
            return;
        }

        const url = resolveSkinImageUrl(pic);
        const tail = `No.${weaponId} ${skin.title}(皮肤ID:${skin.value}) | 全部皮肤: #${alias} ${weaponId}`;

        // 内容寻址缓存: 命中即直接回图, 跳过"加载中"提示与远端下载。
        const cacheRelPath = buildSkinCacheRelPath(weaponId, skinId, url);
        const cacheAbsPath = path.join(
            process.cwd(),
            OUTPUT_FOLDER,
            cacheRelPath,
        );

        if (await pathExists(cacheAbsPath)) {
            await ctx.reply(`${cqImageFile(ctx.env, cacheRelPath)}\n${tail}`);
            return;
        }

        await ctx.reply(SKIN_RAW_IMAGE_LOADING_MSG);

        try {
            const resp = await fetch(url, {
                signal: AbortSignal.timeout(SKIN_RAW_IMAGE_TIMEOUT_MS),
            });
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }
            const buf = Buffer.from(await resp.arrayBuffer());

            // 仅缓存真正的 PNG: 避免把 gfwiki 软错误页/CDN 拦截页等 2xx 非
            // 图片响应误存为皮肤原图, 进而长达 30 天地返回错误内容。
            // 不匹配则抛错, 由下方 catch 回退为超时提示 + 原链接, 不污染缓存。
            const isPng =
                buf.length >= 4 &&
                buf[0] === 0x89 &&
                buf[1] === 0x50 &&
                buf[2] === 0x4e &&
                buf[3] === 0x47;
            if (!isPng) {
                throw new Error('non-image response');
            }

            await fs.mkdir(path.dirname(cacheAbsPath), { recursive: true });
            await writeAtomic(cacheAbsPath, buf);

            await ctx.reply(`${cqImageFile(ctx.env, cacheRelPath)}\n${tail}`);
        } catch (error) {
            const isTimeout =
                error instanceof Error &&
                (error.name === 'TimeoutError' ||
                    error.name === 'AbortError');
            logger.warn('tdollskin raw image download failed', {
                url,
                weaponId,
                skinId,
                timedOut: isTimeout,
                error,
            });
            await ctx.reply(
                `${SKIN_RAW_IMAGE_TIMEOUT_MSG}\n原链接: ${url}`,
            );
        }
    };

    const exec = async (ctx: any) => {
        try {
            if (!(await CommandHelper.validateParams(ctx, 1, 2))) {
                await ctx.reply(
                    `参数不正确, 示例:\n#${name} 2 (查询该武器全部皮肤)\n#${name} 2 0 (查询指定皮肤原图)`
                );
                return;
            }

            const [weaponId, skinId] = CommandHelper.getQueryParams(ctx.params);

            if (skinId === undefined) {
                await execSkinGrid(ctx, weaponId);
            } else {
                await execSkinRawImage(ctx, weaponId, skinId);
            }
        } catch (error) {
            await CommandHelper.handleError(ctx, error, name);
            logger.error(`${name} command failed`, { error, ctx });
        }
    };

    return {
        name,
        alias,
        description:
            '根据武器编号查询皮肤数据; 追加皮肤ID可查看该皮肤原图.[10s CD]',
        hint: [
            `查询指定 ID 武器皮肤数据: #${name} 2`,
            `查询指定皮肤原图: #${name} 2 0`,
        ],
        timesInterval: 10,
        isAdmin: false,
        init: initTDollServices,
        exec
    };
};

export const TDollSkinCommandRegister = createTDollSkinCommand('tdollskin', 'ts');
