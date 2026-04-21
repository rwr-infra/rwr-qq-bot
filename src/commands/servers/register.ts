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
import {
    printChartPng,
    printHoursChartPng,
    printServerChartPng,
} from './charts/chart';
import { AnalysticsTask } from './tasks/analysticsTask';
import { AnalysticsHoursTask } from './tasks/analyticsHoursTask';
import { AnalysticsServerTask } from './tasks/analyticsServerTask';
import { parseIgnoreSpace } from '../../utils/cmd';
import { MapsDataService } from './services/mapsData.service';
import { CanvasImgService } from '../../services/canvasImg.service';
import {
    serverCommandCache,
    ApiResult,
} from '../../services/serverCommandCache.service';
import { serverHistoryCache } from '../../services/serverHistoryCache.service';

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

function formatCooldownSeconds(remainingMs?: number): number {
    if (!remainingMs || remainingMs <= 0) {
        return 1;
    }

    return Math.ceil(remainingMs / 1000);
}

async function executeSharedGroupCommand(
    ctx: MsgExecCtx,
    options: {
        command: string;
        params: unknown;
        cdMs: number;
        apiCall: () => Promise<ApiResult>;
        buildReply: (result: ApiResult) => Promise<string>;
        firstRequesterMessage?: string;
        pendingMessage?: string;
        failureMessage?: string;
    },
): Promise<void> {
    const result = await serverCommandCache.executeWithGroupCD(
        ctx.event.group_id,
        options.command,
        options.params,
        ctx.event.user_id,
        options.apiCall,
        { cdMs: options.cdMs },
    );

    if (result.status === 'cooldown') {
        await ctx.reply(
            `本群正在共享冷却该命令，请 ${formatCooldownSeconds(result.remainingMs)} 秒后再试`,
        );
        return;
    }

    if (result.status !== 'processing' || !result.pendingRequest) {
        return;
    }

    if (result.isFirstRequester && options.firstRequesterMessage) {
        await ctx.reply(options.firstRequesterMessage);
    }

    if (result.needWait && !result.isFirstRequester && options.pendingMessage) {
        await ctx.reply(options.pendingMessage);
    }

    try {
        const apiResult = await serverCommandCache.waitForResult(
            result.pendingRequest,
            30000,
        );
        const reply = await options.buildReply(apiResult);
        const allWaiters = serverCommandCache.getAndClearWaiters(
            ctx.event.group_id,
            options.command,
            options.params,
        );

        if (allWaiters.length === 0) {
            return;
        }

        if (allWaiters.length > 1) {
            await ctx.reply(
                serverCommandCache.generateAtMessage(allWaiters, reply),
            );
            return;
        }

        await ctx.reply(reply);
    } catch (error) {
        logger.error(
            `[${options.command}] Shared command execute failed:`,
            error,
        );
        await ctx.reply(options.failureMessage || '请求失败，请稍后重试');
    }
}

// ============================================================================
// SERVERS COMMAND - 查询服务器列表 (使用缓存)
// ============================================================================
export const ServersCommandRegister = createServerCommand(
    {
        name: 'servers',
        alias: 's',
        hint: ['查询所有在线的 rwr 服务器列表: #servers'],
        description: '查询所有在线的 rwr 服务器列表.[10s CD]',
        timesInterval: 10,
    },
    async (ctx) => {
        await executeSharedGroupCommand(ctx, {
            command: 'servers',
            params: {},
            cdMs: 5000,
            apiCall: async (): Promise<ApiResult> => {
                const serverList = await queryAllServers(
                    ctx.env.SERVERS_MATCH_REGEX,
                );
                const historicalServers =
                    serverHistoryCache.getDisappearedServers(serverList);
                printServerListPng(
                    serverList,
                    historicalServers,
                    SERVERS_OUTPUT_FILE,
                );
                return { serverList, outputFile: SERVERS_OUTPUT_FILE };
            },
            buildReply: async (apiResult) =>
                generateServerReply(
                    ctx,
                    apiResult.serverList,
                    apiResult.outputFile,
                ),
            pendingMessage: '请求处理中，请稍后...',
            failureMessage: '请求失败，请稍后重试',
        });
    },
);
// ============================================================================
// WHEREIS COMMAND - 查询玩家位置
// ============================================================================

// ============================================================================
// WHEREIS COMMAND - 查询玩家位置
// ============================================================================
export const WhereIsCommandRegister: IRegister = {
    name: 'whereis',
    alias: 'w',
    description: '查询玩家所在的 rwr 服务器, 需要一个参数.[10s CD]',
    hint: ['查询目标玩家所在服务器: #whereis KREEDZT'],
    isAdmin: false,
    timesInterval: 10,
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
        description: '查询所有服务器内在线的 rwr 玩家列表.[10s CD]',
        timesInterval: 10,
    },
    async (ctx) => {
        await executeSharedGroupCommand(ctx, {
            command: 'players',
            params: {},
            cdMs: 5000,
            apiCall: async (): Promise<ApiResult> => {
                const serverList = await queryAllServers(
                    ctx.env.SERVERS_MATCH_REGEX,
                );
                printPlayersPng(
                    serverList,
                    PLAYERS_OUTPUT_FILE,
                    ctx.env.MODERATORS,
                    ctx.env.MODERATOR_BADGE,
                );
                return { serverList, outputFile: PLAYERS_OUTPUT_FILE };
            },
            buildReply: async (apiResult) =>
                generateServerReply(
                    ctx,
                    apiResult.serverList,
                    apiResult.outputFile,
                ),
            pendingMessage: '请求处理中，请稍后...',
            failureMessage: '请求失败，请稍后重试',
        });
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
            description: '查询所有 rwr 地图列表.[10s CD]',
            hint: ['按地图顺序查询服务器状态列表: #maps'],
            timesInterval: 10,
        },
        async (ctx) => {
            await executeSharedGroupCommand(ctx, {
                command: 'maps',
                params: {},
                cdMs: 5000,
                apiCall: async (): Promise<ApiResult> => {
                    const serverList = await queryAllServers(
                        ctx.env.SERVERS_MATCH_REGEX,
                    );
                    printMapPng(
                        serverList,
                        MapsDataService.getInst().getData(),
                        MAPS_OUTPUT_FILE,
                    );
                    return { serverList, outputFile: MAPS_OUTPUT_FILE };
                },
                buildReply: async (apiResult) =>
                    generateServerReply(
                        ctx,
                        apiResult.serverList,
                        apiResult.outputFile,
                    ),
                pendingMessage: '请求处理中，请稍后...',
                failureMessage: '请求失败，请稍后重试',
            });
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
        await executeSharedGroupCommand(ctx, {
            command: 'analytics',
            params: { queryParam },
            cdMs: 5000,
            apiCall: async (): Promise<ApiResult> => {
                let outputFile = '';
                switch (queryParam) {
                    case 'h': {
                        outputFile = await printHoursChartPng();
                        break;
                    }
                    case 'd':
                    default: {
                        outputFile = await printChartPng();
                    }
                }

                return { serverList: [], outputFile };
            },
            buildReply: async (apiResult) =>
                `[CQ:image,file=${getStaticHttpPath(
                    ctx.env,
                    apiResult.outputFile,
                )},cache=0,c=8]`,
            firstRequesterMessage:
                '正在生成统计图, 过程可能需要1分钟, 请稍后...',
            pendingMessage: '统计图正在生成中，请稍后...',
            failureMessage: '生成统计图失败，请稍后重试',
        });
    },
    init: async (env: GlobalEnv): Promise<void> => {
        logger.info('AnalyticsCommandRegister::init()');
        AnalysticsTask.start(env);
        AnalysticsHoursTask.start(env);
    },
};

// ============================================================================
// SERVER ANALYTICS COMMAND - 查询各服务器统计信息
// ============================================================================
export const ServerAnalyticsCommandRegister: IRegister = {
    name: 'serveranalytics',
    alias: 'sa',
    description:
        '查询各服务器统计信息(最近24小时各服务器在线玩家数据).[15s CD]',
    hint: ['查询各服务器24小时统计信息: #serveranalytics'],
    isAdmin: false,
    timesInterval: 15,
    exec: async (ctx): Promise<void> => {
        await executeSharedGroupCommand(ctx, {
            command: 'serveranalytics',
            params: {},
            cdMs: 5000,
            apiCall: async (): Promise<ApiResult> => ({
                serverList: [],
                outputFile: await printServerChartPng(),
            }),
            buildReply: async (apiResult) =>
                `[CQ:image,file=${getStaticHttpPath(
                    ctx.env,
                    apiResult.outputFile,
                )},cache=0,c=8]`,
            firstRequesterMessage:
                '正在生成各服务器统计图, 过程可能需要1分钟, 请稍后...',
            pendingMessage: '各服务器统计图正在生成中，请稍后...',
            failureMessage:
                '服务器统计数据尚未生成或生成失败，请等待 2-10 分钟后重试（定时任务会持续写入数据）',
        });
    },
    init: async (env: GlobalEnv): Promise<void> => {
        logger.info('ServerAnalyticsCommandRegister::init()');
        AnalysticsServerTask.start(env);
    },
};
