import { GlobalEnv, IRegister } from '../../types';
import { TDollSvc } from './services/tdoll.service';
import { TDollSkinSvc } from './services/tdollskin.service';
import { logger } from '../../utils/logger';
import { TDOLL_SKIN_NOT_FOUND_MSG } from './types/constants';
import { buildUserScopedPngName } from '../../utils/cmdreq';
import { cqImageFile, cqImageUrl } from '../../utils/cqCode';
import { CommandHelper } from './utils/commandHelper';
import { printTDollDetailPng } from './utils/utils';
import { resolveSkinImageUrl } from './canvas/assets';

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
     * 指定皮肤原图(武器编号 + 皮肤ID)。直接发远端 gfwiki 原图,不落地 out/、不走 canvas。
     */
    const execSkinRawImage = async (
        ctx: any,
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

        await ctx.reply(`${cqImageUrl(url)}\n${tail}`);
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
