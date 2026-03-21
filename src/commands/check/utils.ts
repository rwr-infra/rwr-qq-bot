import axios from 'axios';
import { execFile } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';

import { queryAllServers } from '../servers/utils/utils';
import { PostgreSQLService } from '../../services/postgresql.service';
import type { GlobalEnv } from '../../types';
import { logger } from '../../utils/logger';
import type { CheckLatencyResult, CheckReport } from './types';

const RWR_SERVER_LIST_URL =
    'http://rwr.runningwithrifles.com/rwr_server_list/get_server_list.php?start=0&size=1&names=1';

const HTTP_TIMEOUT_MS = 5000;
const PING_TIMEOUT_MS = 3000;
const execFileAsync = promisify(execFile);

const formatError = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
        return error.code || error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'unknown error';
};

const anonymizeTarget = (target: string): string => {
    if (!target || target === '-') {
        return target;
    }

    try {
        const url = new URL(target);
        return `${url.protocol}//***`;
    } catch {
        const slashIndex = target.indexOf('/');
        if (slashIndex >= 0) {
            return `${target.slice(0, slashIndex).replace(/[^:/]/g, '*')}${target.slice(slashIndex)}`;
        }

        return target.replace(/[^:.]/g, '*');
    }
};

const createSkippedResult = (
    label: string,
    target: string,
    message: string,
): CheckLatencyResult => ({
    label,
    target,
    status: 'skipped',
    message,
});

const createErrorResult = (
    label: string,
    target: string,
    message: string,
): CheckLatencyResult => ({
    label,
    target,
    status: 'error',
    message,
});

const measureHttpLatency = async (
    label: string,
    target: string,
    request: () => Promise<unknown>,
): Promise<CheckLatencyResult> => {
    const startedAt = performance.now();

    try {
        await request();
        return {
            label,
            target,
            status: 'ok',
            latencyMs: Math.round(performance.now() - startedAt),
        };
    } catch (error) {
        logger.error(`[check] HTTP latency probe failed: ${label}`, error);
        return createErrorResult(label, target, formatError(error));
    }
};

const getPingArgs = (host: string, timeoutMs: number): string[] => {
    switch (process.platform) {
        case 'win32':
            return ['-n', '1', '-w', String(timeoutMs), host];
        case 'darwin':
            return ['-c', '1', host];
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

    if (/time[=<]\s*1\s*ms/i.test(normalized) || /时间[=<]\s*1\s*ms/i.test(normalized)) {
        return 1;
    }

    return null;
};

const measureIcmpPingLatency = async (
    label: string,
    host: string,
    timeoutMs = PING_TIMEOUT_MS,
): Promise<CheckLatencyResult> => {
    const startedAt = performance.now();
    const target = host;

    try {
        const { stdout } = await execFileAsync('ping', getPingArgs(host, timeoutMs), {
            timeout: timeoutMs + 1000,
            windowsHide: true,
        });

        const parsedLatency = parsePingLatency(stdout);
        return {
            label,
            target,
            status: 'ok',
            latencyMs:
                parsedLatency ?? Math.round(performance.now() - startedAt),
        };
    } catch (error) {
        logger.error(`[check] ICMP ping failed: ${label}`, error);
        return createErrorResult(label, target, formatError(error));
    }
};

const measureImageServerLatency = async (
    env: GlobalEnv,
): Promise<CheckLatencyResult> => {
    if (!env.IMGPROXY_URL) {
        return createSkippedResult('图片服务器', '-', '未配置 IMGPROXY_URL');
    }

    return measureHttpLatency(
        '图片服务器',
        anonymizeTarget(env.IMGPROXY_URL),
        async () => {
            await axios.get(env.IMGPROXY_URL, {
                timeout: HTTP_TIMEOUT_MS,
                validateStatus: () => true,
            });
        },
    );
};

const measureDatabaseLatency = async (
    env: GlobalEnv,
): Promise<CheckLatencyResult> => {
    if (!(env.PG_HOST && env.PG_DB && env.PG_USER)) {
        return createSkippedResult('数据库', '-', '未配置 PostgreSQL');
    }

    const rawTarget = `${env.PG_HOST}:${env.PG_PORT || '5432'}/${env.PG_DB}`;
    const target = anonymizeTarget(rawTarget);
    const startedAt = performance.now();

    try {
        await PostgreSQLService.getInst().query('SELECT 1');
        return {
            label: '数据库',
            target,
            status: 'ok',
            latencyMs: Math.round(performance.now() - startedAt),
        };
    } catch (error) {
        logger.error('[check] Database latency probe failed', error);
        return createErrorResult('数据库', target, formatError(error));
    }
};

const measureRwrApiLatency = async (): Promise<CheckLatencyResult> => {
    return measureHttpLatency(
        'RWR API',
        anonymizeTarget(RWR_SERVER_LIST_URL),
        async () => {
            await axios.get(RWR_SERVER_LIST_URL, {
                timeout: HTTP_TIMEOUT_MS,
                responseType: 'text',
                validateStatus: (status) => status >= 200 && status < 500,
            });
        },
    );
};

const measureServersLatency = async (
    env: GlobalEnv,
): Promise<CheckLatencyResult[]> => {
    const servers = await queryAllServers(env.SERVERS_MATCH_REGEX);

    if (servers.length === 0) {
        return [
            createErrorResult(
                '服务器列表',
                '-',
                '未获取到服务器列表或当前过滤后为空',
            ),
        ];
    }

    return Promise.all(
        servers.map(async (server) => {
            const result = await measureIcmpPingLatency(
                server.name,
                server.address,
            );
            return {
                ...result,
                target: `${server.address}:${server.port}`,
            };
        }),
    );
};

export const buildCheckReport = async (env: GlobalEnv): Promise<CheckReport> => {
    const [remoteApi, imageServer, database, servers] = await Promise.all([
        measureRwrApiLatency(),
        measureImageServerLatency(env),
        measureDatabaseLatency(env),
        measureServersLatency(env),
    ]);

    return {
        remoteApi,
        imageServer,
        database,
        servers,
    };
};
