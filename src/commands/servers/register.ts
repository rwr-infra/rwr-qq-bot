import { logger } from '../../utils/logger';
import { GlobalEnv, MsgExecCtx, IRegister } from '../../types';
import { getStaticHttpPath } from '../../utils/cmdreq';
import {
    printMapPng,
    printPlayersPng,
    printServerListPng,
    printUserInServerListPng,
} from './utils/canvas';
import {
    MAPS_OUTPUT_FILE,
    PLAYERS_OUTPUT_FILE,
    SERVERS_OUTPUT_FILE,
    WHEREIS_OUTPUT_FILE,
} from './types/constants';
import { getUserMatchedList, queryAllServers } from './utils/utils';
import { printChartPng, printHoursChartPng } from './charts/chart';
import { AnalysticsTask } from './tasks/analysticsTask';
import { AnalysticsHoursTask } from './tasks/analyticsHoursTask';
import { parseIgnoreSpace } from '../../utils/cmd';
import { MapsDataService } from './services/mapsData.service';
import { CanvasImgService } from '../../services/canvasImg.service';

// ============================================================================
// 简化的命令工厂函数
// ============================================================================
function createServerCommand(
    config: {
        name: string;
        alias: string;
        description: string;
        hint: string[];
        isAdmin?: boolean;
        timesInterval: number;
    },
    execFn: (ctx: MsgExecCtx) => Promise<void>,
    initFn?: (env: GlobalEnv) => Promise<void>,
): IRegister {
    return {
        ...config,
        isAdmin: config.isAdmin ?? false,
        init: async (env: GlobalEnv) => {
            if (env.OUTPUT_BG_IMG) {
                await CanvasImgService.getInstance().addImg(
                    env.OUTPUT_BG_IMG,
                    true,
                );
            }
            if (initFn) await initFn(env);
        },
        exec: execFn,
    };
}

// 通用的回复生成函数
async function generateServerReply(
    ctx: MsgExecCtx,
    serverList: any[],
    outputFile: string,
): Promise<string> {
    let cqOutput = `[CQ:image,file=${getStaticHttpPath(
        ctx.env,
        outputFile,
    )},cache=0,c=8]`;

    if (serverList.length === 0 && ctx.env.SERVERS_FALLBACK_URL) {
        cqOutput += `\n检测到当前服务器列表为空, 请尝试使用备用查询地址: ${ctx.env.SERVERS_FALLBACK_URL}`;
    }

    return cqOutput;
}

// ============================================================================
// SERVERS COMMAND - 查询服务器列表
// ============================================================================
export const ServersCommandRegister = createServerCommand(
    {
        name: 'servers',
        alias: 's',
        hint: ['查询所有在线的 rwr 服务器列表: #servers'],
        description: '查询所有在线的 rwr 服务器列表.[5s CD]',
        timesInterval: 5,
    },
    async (ctx) => {
        const serverList = await queryAllServers(ctx.env.SERVERS_MATCH_REGEX);
        printServerListPng(serverList, SERVERS_OUTPUT_FILE);
        const reply = await generateServerReply(
            ctx,
            serverList,
            SERVERS_OUTPUT_FILE,
        );
        await ctx.reply(reply);
    },
);

// ============================================================================
// WHEREIS COMMAND - 查询玩家位置
// ============================================================================
export const WhereIsCommandRegister: IRegister = {
    name: 'whereis',
    alias: 'w',
    description: '查询玩家所在的 rwr 服务器, 需要一个参数.[5s CD]',
    hint: ['查询目标玩家所在服务器: #whereis KREEDZT'],
    isAdmin: false,
    timesInterval: 5,
    init: async (env: GlobalEnv): Promise<void> => {
        if (env.OUTPUT_BG_IMG) {
            await CanvasImgService.getInstance().addImg(
                env.OUTPUT_BG_IMG,
                true,
            );
        }
    },
    parseParams: (msg: string) => {
        return parseIgnoreSpace(['#whereis', '#w'], msg);
    },
    exec: async (ctx): Promise<void> => {
        if (ctx.params.size === 0) {
            await ctx.reply('需要一个用户名参数!\n示例: #whereis KREEDZT');
            return;
        }

        let targetName = '';

        ctx.params.forEach((_v, name) => {
            if (!targetName) {
                targetName = name;
            }
        });

        if (!targetName) {
            return;
        }
        const serverList = await queryAllServers(ctx.env.SERVERS_MATCH_REGEX);
        logger.info('> call getUserInServerListDisplay', targetName);

        const userResults = getUserMatchedList(targetName, serverList);

        printUserInServerListPng(
            userResults.results,
            targetName,
            userResults.total,
            WHEREIS_OUTPUT_FILE,
        );

        const reply = await generateServerReply(
            ctx,
            serverList,
            WHEREIS_OUTPUT_FILE,
        );
        await ctx.reply(reply);
    },
};

// ============================================================================
// PLAYERS COMMAND - 查询玩家列表
// ============================================================================
export const PlayersCommandRegister = createServerCommand(
    {
        name: 'players',
        alias: 'p',
        hint: ['查询所有在线的 rwr 玩家列表: #players'],
        description: '查询所有服务器内在线的 rwr 玩家列表.[5s CD]',
        timesInterval: 5,
    },
    async (ctx) => {
        const serverList = await queryAllServers(ctx.env.SERVERS_MATCH_REGEX);
        printPlayersPng(serverList, PLAYERS_OUTPUT_FILE);
        const reply = await generateServerReply(
            ctx,
            serverList,
            PLAYERS_OUTPUT_FILE,
        );
        await ctx.reply(reply);
    },
);

// ============================================================================
// MAPS COMMAND - 查询地图列表
// ============================================================================
export const MapsCommandRegister: IRegister = {
    ...createServerCommand(
        {
            name: 'maps',
            alias: 'm',
            description: '查询所有 rwr 地图列表.[5s CD]',
            hint: ['按地图顺序查询服务器状态列表: #maps'],
            timesInterval: 5,
        },
        async (ctx) => {
            const serverList = await queryAllServers(
                ctx.env.SERVERS_MATCH_REGEX,
            );
            printMapPng(
                serverList,
                MapsDataService.getInst().getData(),
                MAPS_OUTPUT_FILE,
            );
            const reply = await generateServerReply(
                ctx,
                serverList,
                MAPS_OUTPUT_FILE,
            );
            await ctx.reply(reply);
        },
    ),
    init: async (env: GlobalEnv): Promise<void> => {
        MapsDataService.init(env.MAPS_DATA_FILE);
        await MapsDataService.getInst().refresh();
    },
};

// ============================================================================
// ANALYTICS COMMAND - 查询统计信息
// ============================================================================
export const AnalyticsCommandRegister: IRegister = {
    name: 'analytics',
    alias: 'a',
    description:
        '查询服务器统计信息(参数 h 表明查询最近 24 小时的数据, d 表明查询最近 7 天的数据).[15s CD]',
    hint: [
        '按周查询服务器统计信息: #analytics',
        '按小时查询服务器统计信息: #analytics h',
    ],
    isAdmin: false,
    timesInterval: 15,
    exec: async (ctx): Promise<void> => {
        let queryParam = 'd';

        ctx.params.forEach((checked: boolean, inputParam: string) => {
            queryParam = inputParam;
        });

        let path = '';
        switch (queryParam) {
            case 'h': {
                path = await printHoursChartPng();
                break;
            }
            case 'd':
            default: {
                path = await printChartPng();
            }
        }

        await ctx.reply('正在生成统计图, 过程可能需要1分钟, 请稍后...');

        const cqOutput = `[CQ:image,file=${getStaticHttpPath(
            ctx.env,
            path,
        )},cache=0,c=8]`;

        await ctx.reply(cqOutput);
    },
    init: async (env: GlobalEnv): Promise<void> => {
        logger.info('AnalyticsCommandRegister::init()');
        AnalysticsTask.start(env);
        AnalysticsHoursTask.start(env);
    },
};
