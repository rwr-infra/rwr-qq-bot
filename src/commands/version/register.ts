import { IRegister } from '../../types';
// @ts-ignore - Rollup json plugin handles this
import Package from '../../info.json';

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
