import * as fs from 'fs';
import { NoticeExecCtx } from '../types';
import { logger } from '../utils/logger';
import { getStaticHttpPath } from '../utils/cmdreq';
import { CanvasImgService } from '../services/canvasImg.service';
import { HelpCanvas } from '../commands/help/canvas/helpCanvas';

let template = '';
let commandList: Array<{
    name: string;
    alias?: string;
    description: string;
}> | null = null;

const shouldHandleWelcome = (ctx: NoticeExecCtx): boolean => {
    const listenGroup = Number(ctx.env.LISTEN_GROUP);
    if (!Number.isNaN(listenGroup) && ctx.event.group_id !== listenGroup) {
        return false;
    }

    return true;
};

export const welcomeNewMember = async (ctx: NoticeExecCtx) => {
    if (!shouldHandleWelcome(ctx)) {
        return;
    }

    const templateFileName = ctx.env.WELCOME_TEMPLATE;
    if (!templateFileName) {
        logger.warn(
            '[welcome] WELCOME_TEMPLATE env var not set, skipping welcome',
        );
        return;
    }

    if (!template) {
        const content = fs.readFileSync(templateFileName, 'utf-8');
        template = content;
    }

    const hasImagePlaceholder = template.includes('{{WELCOME_IMAGE}}');
    if (hasImagePlaceholder) {
        const outputFile = `welcome_${ctx.event.group_id}_${ctx.event.user_id}.png`;
        try {
            if (!commandList) {
                const { initCommands } = await import('../commands');
                const commands = await initCommands(ctx.env);
                commandList = commands
                    .filter((c) => !c.isAdmin)
                    .map((c) => ({
                        name: c.name,
                        alias: c.alias,
                        description: c.description,
                    }));
            }

            if (ctx.env.OUTPUT_BG_IMG) {
                await CanvasImgService.getInstance().addImg(
                    ctx.env.OUTPUT_BG_IMG,
                    true,
                );
            }

            await new HelpCanvas(
                {
                    mode: 'welcome',
                    title: '欢迎入群',
                    subtitle: '群机器人主要用法如下',
                    prefix: ctx.env.START_MATCH || '#',
                    items: commandList,
                },
                outputFile,
            ).render();

            const cqImage = `[CQ:image,file=${getStaticHttpPath(ctx.env, outputFile)},cache=0,c=8]`;
            const finalMsg = template.replace('{{WELCOME_IMAGE}}', cqImage);
            await ctx.reply(finalMsg);
        } catch (err) {
            logger.error('[welcome] render failed', err);
            await ctx.reply(template.replace('{{WELCOME_IMAGE}}', ''));
        }
    } else {
        await ctx.reply(template);
    }
};
