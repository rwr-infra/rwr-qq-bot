import { logger } from '../../utils/logger';
import { GlobalEnv, MsgExecCtx, IRegister } from '../../types';
import { getStaticHttpPath } from '../../utils/cmdreq';
import {
    printAnalyticsPng,
    printMapPng,
    printMapDetailPng,
    printPlayersPng,
    printServerListPng,
    printServerOverviewPng,
    printUserInServerListPng,
} from './utils/canvas';
import {
    ANALYTICS_OVERVIEW_OUTPUT_FILE,
    MAPS_OUTPUT_FILE,
    MAP_DETAIL_OUTPUT_FILE,
    PLAYERS_OUTPUT_FILE,
    SERVERS_OUTPUT_FILE,
    SERVER_OVERVIEW_OUTPUT_FILE,
    WHEREIS_OUTPUT_FILE,
} from './types/constants';
import {
    getUserMatchedList,
    queryAllServers,
    findMapByQuery,
    getServersForMap,
} from './utils/utils';
import { aggregateOverview, readTrendSummary } from './utils/overview';
import { buildAnalyticsView } from './utils/analytics';
import { pingServers } from './utils/ping';
import { AnalysticsTask } from './tasks/analysticsTask';
import { AnalysticsHoursTask } from './tasks/analyticsHoursTask';
import { AnalysticsServerTask } from './tasks/analyticsServerTask';
import { parseIgnoreSpace } from '../../utils/cmd';
import { MapsDataService } from './services/mapsData.service';
import { MapImageService } from './services/mapImage.service';
import { CanvasImgService } from '../../services/canvasImg.service';
import {
    groupCommandCoordinator,
    ApiResult,
} from '../../services/groupCommandCoordinator.service';
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
    const result = await groupCommandCoordinator.executeWithGroupCD(
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

    // 等待者: 已加入合并队列，由发起者统一批量 AT 回复，此处不再各自回复
    // （否则每个等待者都会再发一条，造成重复消息）
    if (!result.isFirstRequester) {
        if (result.needWait && options.pendingMessage) {
            await ctx.reply(options.pendingMessage);
        }
        return;
    }

    // 发起者: 执行请求，完成后统一回复并批量 AT 所有等待者
    if (options.firstRequesterMessage) {
        await ctx.reply(options.firstRequesterMessage);
    }

    const replyToWaiters = async (message: string): Promise<void> => {
        const waiters = groupCommandCoordinator.getAndClearWaiters(
            ctx.event.group_id,
            options.command,
            options.params,
        );
        await ctx.reply(
            waiters.length > 1
                ? groupCommandCoordinator.generateAtMessage(waiters, message)
                : message,
        );
    };

    try {
        const apiResult = await groupCommandCoordinator.waitForResult(
            result.pendingRequest,
        );
        const reply = await options.buildReply(apiResult);
        await replyToWaiters(reply);
    } catch (error) {
        logger.error(
            `[${options.command}] Shared command execute failed:`,
            error,
        );
        await replyToWaiters(options.failureMessage || '请求失败，请稍后重试');
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
                await printServerListPng(
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

        await printUserInServerListPng(
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
                const historicalServers =
                    serverHistoryCache.getDisappearedServers(serverList);
                await printPlayersPng(
                    serverList,
                    historicalServers,
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
            description: '查询所有 rwr 地图列表或指定地图详情.[10s CD]',
            hint: [
                '按地图顺序查询服务器状态列表: #maps',
                '查询指定地图详情: #maps map105',
            ],
            timesInterval: 10,
        },
        async (ctx) => {
            if (ctx.params.size > 0) {
                let query = '';
                ctx.params.forEach((_v, k) => {
                    if (!query) query = k;
                });

                const mapData = MapsDataService.getInst().getData();
                const result = findMapByQuery(query, mapData);

                if (result.type === 'none') {
                    await ctx.reply(
                        `未找到与"${query}"匹配的地图，请检查输入`,
                    );
                    return;
                }

                if (result.type === 'fuzzy') {
                    const candidates = result.maps
                        .slice(0, 10)
                        .map((m) => `  - ${m.name} (${m.id})`)
                        .join('\n');
                    await ctx.reply(
                        `找到多个匹配的地图，请缩小范围：\n${candidates}`,
                    );
                    return;
                }

                const serverList = await queryAllServers(
                    ctx.env.SERVERS_MATCH_REGEX,
                );
                const servers = getServersForMap(result.map.id, serverList);

                await printMapDetailPng(
                    result.map,
                    servers,
                    MAP_DETAIL_OUTPUT_FILE,
                );

                const mapImageService = MapImageService.getInst();
                const sampleServer = servers[0];
                const mapImageUrl = mapImageService.getImageUrl(
                    sampleServer?.map_id ?? result.map.id,
                    result.map.id,
                );

                let reply = `[CQ:image,file=${getStaticHttpPath(ctx.env, MAP_DETAIL_OUTPUT_FILE)},cache=0,c=8]`;

                if (mapImageUrl) {
                    reply += `\n[CQ:image,file=${mapImageUrl},cache=0,c=8]`;
                }

                await ctx.reply(reply);
                return;
            }

            await executeSharedGroupCommand(ctx, {
                command: 'maps',
                params: {},
                cdMs: 5000,
                apiCall: async (): Promise<ApiResult> => {
                    const serverList = await queryAllServers(
                        ctx.env.SERVERS_MATCH_REGEX,
                    );
                    await printMapPng(
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
    parseParams: (msg: string) => parseIgnoreSpace(['#maps', '#m'], msg),
    init: async (env: GlobalEnv): Promise<void> => {
        MapsDataService.init(env.MAPS_DATA_FILE);
        await MapsDataService.getInst().refresh();
        await MapImageService.getInst().init(env);
    },
};

// ============================================================================
// ANALYTICS COMMAND - 查询统计信息
// ============================================================================
export const AnalyticsCommandRegister: IRegister = {
    name: 'analytics',
    alias: 'a',
    description:
        '查询服务器统计总览(全局24h/7日在线趋势 + 各服务器维度峰值排行与24h趋势, 一图呈现).[15s CD]',
    hint: ['查询服务器统计总览: #analytics'],
    isAdmin: false,
    timesInterval: 15,
    exec: async (ctx): Promise<void> => {
        await executeSharedGroupCommand(ctx, {
            command: 'analytics',
            params: {},
            cdMs: 5000,
            apiCall: async (): Promise<ApiResult> => {
                const view = buildAnalyticsView();
                await printAnalyticsPng(
                    view,
                    ANALYTICS_OVERVIEW_OUTPUT_FILE,
                );
                return { serverList: [], outputFile: ANALYTICS_OVERVIEW_OUTPUT_FILE };
            },
            buildReply: async (apiResult) =>
                `[CQ:image,file=${getStaticHttpPath(
                    ctx.env,
                    apiResult.outputFile,
                )},cache=0,c=8]`,
            firstRequesterMessage: '正在生成统计总览, 请稍后...',
            pendingMessage: '统计总览正在生成中，请稍后...',
            failureMessage: '生成统计总览失败，请稍后重试',
        });
    },
    init: async (env: GlobalEnv): Promise<void> => {
        logger.info('AnalyticsCommandRegister::init()');
        // 统计总览依赖以下任务持续写入(均为幂等启动)
        AnalysticsTask.start(env);
        AnalysticsHoursTask.start(env);
        AnalysticsServerTask.start(env);
    },
};

// ============================================================================
// OVERVIEW COMMAND - 服务器状态总览(实时快照 + 历史趋势 一图概览)
// ============================================================================
export const ServerOverviewCommandRegister = createServerCommand(
    {
        name: 'overview',
        alias: 'o',
        hint: ['查询服务器状态总览(规模/占用/各服务器地图·Bots·运行时长/离线): #overview'],
        description:
            '查询服务器状态总览(实时规模、占用率、各服务器地图·Bots·运行时长、历史峰值、近期离线).[15s CD]',
        timesInterval: 15,
    },
    async (ctx) => {
        await executeSharedGroupCommand(ctx, {
            command: 'overview',
            params: {},
            cdMs: 5000,
            apiCall: async (): Promise<ApiResult> => {
                const serverList = await queryAllServers(
                    ctx.env.SERVERS_MATCH_REGEX,
                );
                const historicalServers =
                    serverHistoryCache.getDisappearedServers(serverList);
                const stats = aggregateOverview(serverList);
                const trend = readTrendSummary();
                const latencyMap = await pingServers(serverList);
                await printServerOverviewPng(
                    stats,
                    trend,
                    serverList,
                    latencyMap,
                    SERVER_OVERVIEW_OUTPUT_FILE,
                    historicalServers,
                );
                return {
                    serverList,
                    outputFile: SERVER_OVERVIEW_OUTPUT_FILE,
                };
            },
            buildReply: async (apiResult) =>
                generateServerReply(
                    ctx,
                    apiResult.serverList,
                    apiResult.outputFile,
                ),
            firstRequesterMessage:
                '正在生成状态总览(含服务器延迟检测), 请稍后...',
            pendingMessage: '状态总览生成中，请稍后...',
            failureMessage: '生成状态总览失败，请稍后重试',
        });
    },
    async (env: GlobalEnv): Promise<void> => {
        logger.info('ServerOverviewCommandRegister::init()');
        // 历史峰值趋势依赖以下任务持续写入(均为幂等启动)
        AnalysticsTask.start(env);
        AnalysticsHoursTask.start(env);
    },
);
