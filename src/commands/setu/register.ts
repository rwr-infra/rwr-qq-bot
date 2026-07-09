import _ from 'lodash';
import { logger } from "../../utils/logger";
import { IRegister } from "../../types";
import { getImgInfo } from './utils';
import { cqImageUrl } from '../../utils/cqCode';

export const SetuCommandRegister: IRegister = {
    name: 'setu',
    description: '获取随机涩图[30s CD]',
    timesInterval: 30,
    isAdmin: false,
    exec: async (ctx) => {
        const res = await getImgInfo();

        const firstData = res.data[0];

        if (!firstData) {
            await ctx.reply('未找到图片');
            return;
        }

        logger.info('> setu res:', firstData);


        let descText = '';

        descText += `PID: ${firstData.pid}\n`;
        descText += `UID: ${firstData.uid}\n`;
        descText += `标题: ${firstData.title}\n`;
        descText += `作者: ${firstData.author}\n`;
        descText += `图片正在获取中, 请稍后...`;

        await ctx.reply(`${descText}`);

        await ctx.reply(cqImageUrl(firstData.urls.original, { type: 'flash' }));
    }
}
