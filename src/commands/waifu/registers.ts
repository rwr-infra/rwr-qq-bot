import _ from 'lodash';
import { logger } from "../../utils/logger";
import { IRegister } from "../../types";
import { getImgInfo } from './utils';
import { cqImageUrl } from '../../utils/cqCode';

const COMMAND_NAME = 'waifu';

export const WaifuCommandRegister: IRegister = {
    name: COMMAND_NAME,
    description: '获取 Waifu 来源的随机图片[30s CD]',
    timesInterval: 30,
    isAdmin: false,
    exec: async (ctx) => {
        const res = await getImgInfo();

        logger.info(`> ${COMMAND_NAME} res:`, res);

        const firstImg = res.images[0];

        if (!firstImg) {
            await ctx.reply('未找到图片');
        }

        let descText = '';

        descText += `来源: ${firstImg.source}`;
        descText += cqImageUrl(firstImg.url);

        await ctx.reply(descText);
    }
}
