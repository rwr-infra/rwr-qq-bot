import { GlobalEnv, IRegister } from '../../types';
import { parseIgnoreSpace } from '../../utils/cmd';
import { getStaticHttpPath } from '../../utils/cmdreq';
import { logger } from '../../utils/logger';
import { CanvasImgService } from '../../services/canvasImg.service';
import { HelpCanvas, type HelpCanvasModel } from './canvas/helpCanvas';

/**
 * 帮助命令。作为普通 IRegister 存在——与其它命令共用 msgHandler 的查找/冷却/
 * 执行/日志通道；渲染帮助卡片失败时回退为纯文本。
 */
export const HelpCommandRegister: IRegister = {
    name: 'help',
    alias: 'h',
    description: '查看命令帮助列表, 或某个命令的详情: #help <cmd>',
    hint: ['查看全部命令: #help', '查看某命令详情: #help servers'],
    isAdmin: false,
    parseParams: (msg: string) => parseIgnoreSpace(['#help', '#h'], msg),
    init: async (env: GlobalEnv): Promise<void> => {
        if (env.OUTPUT_BG_IMG) {
            await CanvasImgService.getInstance().addImg(env.OUTPUT_BG_IMG, true);
        }
    },
    exec: async (ctx) => {
        const { env, event } = ctx;
        const isAdminUser = env.ADMIN_QQ_LIST.some((qq) => event.user_id === qq);
        const prefix = env.START_MATCH || '#';
        // 动态导入以打破 registry <-> help 的静态循环依赖
        const { resolveActiveCommands } = await import('../registry');
        const visibleCommands = resolveActiveCommands(env).filter(
            (c) => !c.isAdmin || isAdminUser,
        );

        const query = ctx.params.keys().next().value as string | undefined;
        const outputFile = `help_${event.group_id ? event.group_id : 'private'}_${event.user_id}.png`;

        let model: HelpCanvasModel;
        if (query) {
            const hitCommand = visibleCommands.find(
                (c) => c.name === query || c.alias === query,
            );
            if (hitCommand) {
                model = {
                    mode: 'detail',
                    prefix,
                    name: hitCommand.name,
                    alias: hitCommand.alias,
                    description: hitCommand.description,
                    hints: hitCommand.hint ?? [],
                };
            } else {
                model = { mode: 'not_found', prefix, query };
            }
        } else {
            model = {
                mode: 'list',
                prefix,
                items: visibleCommands.map((c) => ({
                    name: c.name,
                    alias: c.alias,
                    description: c.description,
                })),
            };
        }

        try {
            await new HelpCanvas(model, outputFile).render();
            const cqOutput = `[CQ:image,file=${getStaticHttpPath(
                env,
                outputFile,
            )},cache=0,c=8]`;
            await ctx.reply(cqOutput);
        } catch (err) {
            logger.error('[help] render failed', err);

            let fallbackText = '';
            if (query) {
                const hitCommand = visibleCommands.find(
                    (c) => c.name === query || c.alias === query,
                );
                if (hitCommand) {
                    fallbackText = `${prefix}${hitCommand.name}${hitCommand.alias ? `(${hitCommand.alias})` : ''}: 帮助列表\n\n`;
                    hitCommand.hint?.forEach((h) => {
                        fallbackText += `${h}\n\n`;
                    });
                } else {
                    fallbackText = '未找到对应命令\n';
                }
            } else {
                fallbackText = '帮助列表: \n';
                visibleCommands.forEach((c) => {
                    fallbackText += `${prefix}${c.name}${c.alias ? `(${c.alias})` : ''}: ${c.description}\n\n`;
                });
            }

            await ctx.reply(fallbackText);
        }
    },
};
