import { execFile } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import { logger } from '../../../utils/logger';
import { OnlineServerItem } from '../types/types';

// 逻辑参考 src/commands/check/utils.ts 的 ICMP ping 探测
const PING_TIMEOUT_MS = 3000;
const execFileAsync = promisify(execFile);

const getPingArgs = (host: string, timeoutMs: number): string[] => {
    switch (process.platform) {
        case 'win32':
            return ['-n', '1', '-w', String(timeoutMs), host];
        case 'darwin':
        default:
            return ['-c', '1', host];
    }
};

const parsePingLatency = (stdout: string): number | null => {
    const normalized = stdout.replace(/\s+/g, ' ');
    const patterns = [
        /time[=<]\s*([\d.]+)\s*ms/i,
        /time\s+([\d.]+)\s*ms/i,
        /时间[=<]\s*([\d.]+)\s*ms/i,
        /时间\s*[\=<]\s*([\d.]+)/i,
        /平均\s*=\s*([\d.]+)\s*ms/i,
        /Average\s*=\s*([\d.]+)\s*ms/i,
    ];

    for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (!match) {
            continue;
        }
        const value = Number(match[1]);
        if (Number.isFinite(value)) {
            return Math.round(value);
        }
    }

    if (
        /time[=<]\s*1\s*ms/i.test(normalized) ||
        /时间[=<]\s*1\s*ms/i.test(normalized)
    ) {
        return 1;
    }

    return null;
};

/**
 * ICMP ping 单个主机, 返回延迟毫秒数; 失败/超时返回 null
 * @param host 主机地址
 * @param timeoutMs 超时(毫秒)
 */
export const pingHost = async (
    host: string,
    timeoutMs = PING_TIMEOUT_MS,
): Promise<number | null> => {
    const startedAt = performance.now();
    try {
        const { stdout } = await execFileAsync(
            'ping',
            getPingArgs(host, timeoutMs),
            { timeout: timeoutMs + 1000, windowsHide: true },
        );
        const parsed = parsePingLatency(stdout);
        return parsed ?? Math.round(performance.now() - startedAt);
    } catch (error) {
        logger.error(`[overview] ping failed: ${host}`, error);
        return null;
    }
};

/**
 * 并发 ping 服务器列表, 返回 `${address}:${port}` -> 延迟(ms, 失败为 null) 映射
 * @param serverList 服务器列表
 */
export const pingServers = async (
    serverList: OnlineServerItem[],
): Promise<Map<string, number | null>> => {
    const entries = await Promise.all(
        serverList.map(async (s) => {
            const key = `${s.address}:${s.port}`;
            const latency = await pingHost(s.address);
            return [key, latency] as const;
        }),
    );
    return new Map(entries);
};
