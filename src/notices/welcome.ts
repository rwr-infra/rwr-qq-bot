import * as fs from 'fs';
import { NoticeExecCtx } from '../types';

let template = '';

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

    if (!template) {
        const templateFileName = ctx.env.WELCOME_TEMPLATE;
        const content = fs.readFileSync(templateFileName, 'utf-8');
        template = content;
    }
    await ctx.reply(template);
};
