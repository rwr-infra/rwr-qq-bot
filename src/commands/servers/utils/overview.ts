import {
    IAnalysisData,
    IServerDetailItem,
    IServerOverviewStats,
    ITrendSummary,
    OnlineServerItem,
} from '../types/types';
import {
    ANALYSIS_DATA_FILE,
    ANALYSIS_HOURS_DATA_FILE,
} from '../types/constants';
import {
    countServersMaxPlayers,
    countTotalPlayers,
    getMapShortName,
} from './utils';
import { readAnalyticsJson } from './analyticsStore';

/**
 * 聚合实时快照统计信息
 * @param serverList 当前匹配的服务器列表
 * @returns 服务器概览统计
 */
export const aggregateOverview = (
    serverList: OnlineServerItem[],
): IServerOverviewStats => {
    const serverCount = serverList.length;
    const playersTotal = countTotalPlayers(serverList);
    const capacityTotal = countServersMaxPlayers(serverList);
    const occupancyRate = capacityTotal > 0 ? playersTotal / capacityTotal : 0;

    let botsTotal = 0;
    let fullCount = 0;
    let emptyCount = 0;

    serverList.forEach((s) => {
        botsTotal += s.bots ?? 0;
        if (s.current_players >= s.max_players && s.max_players > 0) {
            fullCount += 1;
        }
        if (s.current_players === 0) {
            emptyCount += 1;
        }
    });

    const serverDetail: IServerDetailItem[] = serverList
        .map((s) => ({
            name: s.name,
            mapName: getMapShortName(s.map_id),
            players: s.current_players,
            maxPlayers: s.max_players,
            bots: s.bots ?? 0,
            serverKey: `${s.address}:${s.port}`,
        }))
        .sort((a, b) => b.players - a.players);

    return {
        serverCount,
        playersTotal,
        capacityTotal,
        occupancyRate,
        botsTotal,
        fullCount,
        emptyCount,
        serverDetail,
    };
};

/**
 * 读取趋势数据文件(峰值统计), 文件缺失或解析失败时返回 null
 * @param fileName 输出目录下的数据文件名
 * @returns 解析后的统计数组, 失败为 null
 */
const readAnalysisFile = (fileName: string): IAnalysisData[] | null => {
    const parsed = readAnalyticsJson<IAnalysisData[]>(fileName);
    if (!Array.isArray(parsed)) {
        return null;
    }
    return parsed;
};

const maxCount = (data: IAnalysisData[] | null): number | null => {
    if (!data || data.length === 0) {
        return null;
    }
    return data.reduce((acc, cur) => Math.max(acc, cur.count), 0);
};

const latestCount = (data: IAnalysisData[] | null): number | null => {
    if (!data || data.length === 0) {
        return null;
    }
    return data[data.length - 1].count;
};

/**
 * 汇总历史趋势峰值(24小时 / 7日 / 最近值)
 * @returns 趋势摘要, 数据缺失时对应字段为 null
 */
export const readTrendSummary = (): ITrendSummary => {
    const hoursData = readAnalysisFile(ANALYSIS_HOURS_DATA_FILE);
    const daysData = readAnalysisFile(ANALYSIS_DATA_FILE);

    return {
        peak24h: maxCount(hoursData),
        peak7d: maxCount(daysData),
        latest: latestCount(hoursData) ?? latestCount(daysData),
        series24h: hoursData ?? [],
    };
};

/**
 * 读取全局 7日逐日峰值序列(analysis.json), 缺失时返回空数组
 * @returns 7日序列
 */
export const readDaysSeries = (): IAnalysisData[] => {
    return readAnalysisFile(ANALYSIS_DATA_FILE) ?? [];
};
