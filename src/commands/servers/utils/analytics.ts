import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../../utils/logger';
import {
    IAnalyticsViewData,
    IServerAnalyticsRecord,
    IServerAnalyticsSummary,
} from '../types/types';
import { ANALYSIS_SERVER_DATA_FILE, OUTPUT_FOLDER } from '../types/constants';
import { readDaysSeries, readTrendSummary } from './overview';

interface IServerAnalyticsFile {
    lastUpdateTime: number;
    records: IServerAnalyticsRecord[];
}

/**
 * 读取各服务器 24h 统计文件(analysis_server.json)
 * 文件缺失 / 解析失败 / 结构异常时返回空配置
 */
const readServerAnalyticsFile = (): IServerAnalyticsFile => {
    const empty: IServerAnalyticsFile = { lastUpdateTime: 0, records: [] };
    const filePath = path.join(
        process.cwd(),
        OUTPUT_FOLDER,
        `./${ANALYSIS_SERVER_DATA_FILE}`,
    );

    if (!fs.existsSync(filePath)) {
        return empty;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content) as IServerAnalyticsFile;
        if (!parsed || !Array.isArray(parsed.records)) {
            return empty;
        }
        return {
            lastUpdateTime: parsed.lastUpdateTime ?? 0,
            records: parsed.records,
        };
    } catch (e) {
        logger.error('> readServerAnalyticsFile error');
        logger.error(e);
        return empty;
    }
};

/**
 * 把单条服务器记录转为时序摘要(peak / latest / avg)
 */
const toSummary = (
    record: IServerAnalyticsRecord,
): IServerAnalyticsSummary => {
    const series = record.data ?? [];
    const counts = series.map((d) => d.count);
    const peak = counts.reduce((acc, cur) => Math.max(acc, cur), 0);
    const latest = series.length > 0 ? series[series.length - 1].count : null;
    const avg =
        counts.length > 0
            ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
            : 0;

    return {
        serverKey: record.serverKey,
        serverName: record.serverName,
        series,
        peak,
        latest,
        avg,
    };
};

/**
 * 读取并聚合各服务器 24h 时序摘要, 过滤空数据, 按 peak 降序
 */
export const readServerAnalyticsSummaries = (): IServerAnalyticsSummary[] => {
    const { records } = readServerAnalyticsFile();

    return records
        .filter((r) => Array.isArray(r.data) && r.data.length > 0)
        .map(toSummary)
        .sort((a, b) => b.peak - a.peak);
};

/**
 * 统计「活跃服务器数」: 以最新时刻(任一服务器序列末值对应的时刻)仍有记录的服务器数。
 * 各服务器 date 标签一致(同由 AnalysticsServerTask 写入), 取出现频次最高的末时刻作为基准。
 */
const countActiveServers = (
    summaries: IServerAnalyticsSummary[],
): number => {
    if (summaries.length === 0) {
        return 0;
    }

    const tallies = new Map<string, number>();
    for (const s of summaries) {
        const last = s.series[s.series.length - 1];
        if (!last) {
            continue;
        }
        tallies.set(last.date, (tallies.get(last.date) ?? 0) + 1);
    }

    let activeCount = 0;
    for (const count of tallies.values()) {
        activeCount = Math.max(activeCount, count);
    }
    return activeCount;
};

/**
 * 组装统计总览画布视图数据
 */
export const buildAnalyticsView = (): IAnalyticsViewData => {
    const { lastUpdateTime } = readServerAnalyticsFile();
    const servers = readServerAnalyticsSummaries();

    return {
        trend: readTrendSummary(),
        series7d: readDaysSeries(),
        servers,
        lastUpdateTime: lastUpdateTime || null,
        activeCount: countActiveServers(servers),
    };
};
