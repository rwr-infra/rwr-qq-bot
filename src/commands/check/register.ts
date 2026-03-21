import { CanvasImgService } from '../../services/canvasImg.service';
import type { GlobalEnv, IRegister } from '../../types';
import { getStaticHttpPath } from '../../utils/cmdreq';
import { logger } from '../../utils/logger';
import { CheckCanvas } from './checkCanvas';
import { buildCheckReport } from './utils';

export const CheckCommandRegister: IRegister = {
    name: 'check',
    alias: 'c',
    description: '检查 bot 与外部服务及服务器列表的网络连通性.[60s CD]',
    hint: ['检查 bot 网络连通性状态: #check'],
    isAdmin: false,
    timesInterval: 60,
    init: async (env: GlobalEnv): Promise<void> => {
        if (env.OUTPUT_BG_IMG) {
            await CanvasImgService.getInstance().addImg(env.OUTPUT_BG_IMG, true);
        }
    },
    exec: async (ctx): Promise<void> => {
        const outputFile = `check_${ctx.event.group_id ?? 'private'}_${ctx.event.user_id}.png`;

        try {
            const report = await buildCheckReport(ctx.env);
            new CheckCanvas(report, outputFile).render();

            await ctx.reply(
                `[CQ:image,file=${getStaticHttpPath(ctx.env, outputFile)},cache=0,c=8]`,
            );
        } catch (error) {
            logger.error('[check] command failed', error);
            await ctx.reply('连通性检查失败，请稍后重试');
        }
    },
};
