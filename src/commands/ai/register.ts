import { IRegister } from '../../types';
import { parseIgnoreSpace } from '../../utils/cmd';
import { getStaticHttpPath } from '../../utils/cmdreq';
import { getAIQAMatchRes } from './utils';
import { AiCanvas } from './aiCanvas';

export const AiCommandRegister: IRegister = {
    name: 'ai',
    description: '使用AI模型与知识库内容进行智能问答[120s CD]',
    hint: ['例: #ai 列举出 key=gkw_m4a1.weapon 的武器数据'],
    timesInterval: 120,
    isAdmin: false,
    parseParams: (msg: string) => {
        return parseIgnoreSpace(['#ai'], msg);
    },
    exec: async (ctx) => {
        let query: string = '';

        ctx.params.forEach((checked, inputParam) => {
            if (!query) {
                query = inputParam;
            }
        });

        if (!ctx.env.OPENAI_API_KEY || !ctx.env.OPENAI_API_URL) {
            await ctx.reply('未配置 OPENAI_API_KEY 或 OPENAI_API_URL, 无法使用AI模型进行智能问答');
            return;
        }

        await ctx.reply('正在通过大语言模型查询中, 请耐心等待...');

        const answer = await getAIQAMatchRes(query, ctx);

        if (answer.includes('服务端响应失败') || answer.includes('未匹配到')) {
            await ctx.reply(answer);
            return;
        }

        const fileName = `ai-${ctx.event.user_id}.png`;
        const canvas = new AiCanvas(query, answer, fileName);
        canvas.render();

        const replyText = `[CQ:image,file=${getStaticHttpPath(ctx.env, fileName)},cache=0,c=8]`;
        await ctx.reply(replyText);
    },
};
