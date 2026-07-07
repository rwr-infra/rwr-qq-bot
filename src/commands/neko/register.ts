import _ from 'lodash';
import { logger } from "../../utils/logger";
import { IRegister } from "../../types";
import { getNekoImgs } from './utils';
import { cqImageUrl } from '../../utils/cqCode';

const COMMAND_NAME = 'neko';

export const NekoCommandRegister: IRegister = {
    name: COMMAND_NAME,
    description: '获取 Neko 来源的随机图片[30s CD]',
    timesInterval: 30,
    isAdmin: false,
    exec: async (ctx) => {
        const res = await getNekoImgs();

        logger.info(`> ${COMMAND_NAME} res:`, res);

        const firstImg = res.results[0];

        if (!firstImg) {
            await ctx.reply('未找到图片');
        }

        let descText = '';
        descText += `作者: ${firstImg.artist_name}\n`;
        descText += `来源: ${firstImg.source_url}\n`;
        descText += cqImageUrl(firstImg.url);

        await ctx.reply(descText);
    }
}
