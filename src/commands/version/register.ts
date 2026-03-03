import { IRegister } from '../../types';

let Package: any = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Package = require('../../info.json');
} catch {
    // If info.json not found, use fallback values
    Package = {
        version: 'unknown',
        description: 'rwr-imba-qq-bot',
        repository: { url: 'unknown' },
        homepage: 'unknown',
        bugs: { url: 'unknown' },
    };
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
