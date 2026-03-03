import { IRegister } from '../../types';

let Package: any;

const isVitest =
    typeof process !== 'undefined' && process.env.VITEST === 'true';

if (isVitest) {
    // Vitest test environment - use mock data directly
    Package = {
        version: '0.2.5',
        description: '适用于 RWR 服务器数据查询的 QQ 机器人',
        repository: { url: 'https://github.com/Kreedzt/rwr-imba-qq-bot.git' },
        homepage:
            'https://github.com/Kreedzt/rwr-imba-qq-bot/blob/master/README.md',
        bugs: { url: 'https://github.com/Kreedzt/rwr-imba-qq-bot/issues' },
    };
} else {
    // Production build - let Rollup json plugin handle the import
    // @ts-ignore - Rollup json plugin handles this
    Package = require('../../info.json');
}

export const VersionCommandRegister: IRegister = {
    name: 'version',
    alias: 'v',
    description: '查询机器人版本信息',
    isAdmin: true,
    exec: async (ctx) => {
        let outputStr = `当前版本: ${Package.version}\n`;
        outputStr += `${Package.description}\n`;
        outputStr += `源码地址: ${Package.repository.url}\n`;
        outputStr += `项目主页: ${Package.homepage}\n`;
        outputStr += `Bug 上报: ${Package.bugs.url}`;

        await ctx.reply(outputStr);
    },
};
