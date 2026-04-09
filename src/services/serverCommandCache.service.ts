/**
 * ServerCommandCacheService - 服务器命令缓存服务（简化版）
 *
 * 核心功能:
 * 1. 群级CD - 基于 groupId:command 的冷却时间
 * 2. 队列合并 - 相同参数请求自动合并，多个等待者加入队列
 * 3. 批量AT - 响应时自动AT所有等待的QQ号
 * 4. 竞态安全 - 使用Promise和Map确保并发安全
 */

import { logger } from '../utils/logger';

export interface PendingRequest {
    /** 群ID */
    groupId: number;
    /** 命令名称 */
    command: string;
    /** 参数哈希值 */
    paramsHash: string;
    /** 等待结果的QQ号列表 */
    qqList: number[];
    /** 底层API请求的Promise */
    promise: Promise<ApiResult>;
    /** 请求开始时间 */
    startTime: number;
    /** 请求是否已完成 */
    isCompleted: boolean;
    /** 请求结果 */
    result?: ApiResult;
    /** 错误信息 */
    error?: Error;
}

export interface ApiResult {
    /** 服务器列表 */
    serverList: any[];
    /** 输出文件路径 */
    outputFile: string;
    /** 额外数据 */
    extraData?: any;
}

export interface ExecuteResult {
    /** 状态 */
    status: 'processing' | 'completed' | 'cooldown' | 'error';
    /** 是否需要等待 */
    needWait: boolean;
    /** 是否是第一个发起者 */
    isFirstRequester: boolean;
    /** 等待的请求对象 */
    pendingRequest?: PendingRequest;
    /** 错误信息 */
    error?: string;
    /** 结果（仅当status为completed时） */
    result?: ApiResult;
    /** 剩余冷却时间(毫秒) */
    remainingMs?: number;
}

export class ServerCommandCacheService {
    /** 待处理请求映射表: groupId:command:paramsHash -> PendingRequest */
    private pendingRequests = new Map<string, PendingRequest>();

    /** 群级CD映射表: groupId:command -> lastRequestTime */
    private groupCDMap = new Map<string, number>();

    /** 默认CD时间(毫秒) */
    private readonly DEFAULT_CD: number = 5000;

    /** 请求超时时间(毫秒) */
    private readonly REQUEST_TIMEOUT: number = 30000;

    constructor(options?: { defaultCD?: number; requestTimeout?: number }) {
        this.DEFAULT_CD = options?.defaultCD ?? 5000;
        this.REQUEST_TIMEOUT = options?.requestTimeout ?? 30000;
    }

    /**
     * 生成缓存键
     */
    private generateCacheKey(
        groupId: number,
        command: string,
        params: any,
    ): string {
        const paramsHash = this.hashParams(params);
        return `${groupId}:${command}:${paramsHash}`;
    }

    /**
     * 生成CD键
     */
    private generateCDKey(groupId: number, command: string): string {
        return `${groupId}:${command}`;
    }

    /**
     * 参数哈希
     */
    private hashParams(params: any): string {
        if (params === null || params === undefined) {
            return 'null';
        }
        if (typeof params === 'string') {
            return params;
        }
        try {
            return JSON.stringify(params);
        } catch {
            return String(params);
        }
    }

    /**
     * 检查CD
     */
    private checkCD(
        groupId: number,
        command: string,
        cdMs?: number,
    ): { isValid: boolean; remainingMs: number } {
        const cdKey = this.generateCDKey(groupId, command);
        const lastTime = this.groupCDMap.get(cdKey) || 0;
        const now = Date.now();
        const cooldown = cdMs || this.DEFAULT_CD;
        const elapsed = now - lastTime;

        if (elapsed >= cooldown) {
            return { isValid: true, remainingMs: 0 };
        }

        return {
            isValid: false,
            remainingMs: cooldown - elapsed,
        };
    }

    /**
     * 更新CD时间
     */
    private updateCD(groupId: number, command: string): void {
        const cdKey = this.generateCDKey(groupId, command);
        this.groupCDMap.set(cdKey, Date.now());
    }

    /**
     * 执行带群级CD和队列合并的请求
     */
    async executeWithGroupCD(
        groupId: number,
        command: string,
        params: any,
        qqId: number,
        apiCall: () => Promise<ApiResult>,
        options?: {
            cdMs?: number;
            skipCDCheck?: boolean;
        },
    ): Promise<ExecuteResult> {
        const cacheKey = this.generateCacheKey(groupId, command, params);
        const now = Date.now();

        // 1. 检查是否有相同参数的请求正在处理
        const pending = this.pendingRequests.get(cacheKey);
        if (pending) {
            // 加入等待队列
            if (!pending.qqList.includes(qqId)) {
                pending.qqList.push(qqId);
                logger.info(
                    `[ServerCommandCache] QQ ${qqId} joined pending request ${cacheKey}, ` +
                        `total waiters: ${pending.qqList.length}`,
                );
            }

            return {
                status: 'processing',
                needWait: true,
                isFirstRequester: false,
                pendingRequest: pending,
            };
        }

        // 2. 检查CD
        if (!options?.skipCDCheck) {
            const cdResult = this.checkCD(groupId, command, options?.cdMs);
            if (!cdResult.isValid) {
                return {
                    status: 'cooldown',
                    needWait: false,
                    isFirstRequester: false,
                    remainingMs: cdResult.remainingMs,
                };
            }
        }

        // 3. 更新CD时间
        this.updateCD(groupId, command);

        // 4. 创建新的请求
        logger.info(
            `[ServerCommandCache] Creating new request ${cacheKey} for QQ ${qqId}`,
        );

        let resolveFn: (value: ApiResult) => void;
        let rejectFn: (reason: any) => void;

        const promise = new Promise<ApiResult>((resolve, reject) => {
            resolveFn = resolve;
            rejectFn = reject;
        });

        // 执行API调用
        const requestPromise = apiCall()
            .then((result) => {
                const pending = this.pendingRequests.get(cacheKey);
                if (pending) {
                    pending.isCompleted = true;
                    pending.result = result;
                }
                resolveFn(result);
                return result;
            })
            .catch((error) => {
                const pending = this.pendingRequests.get(cacheKey);
                if (pending) {
                    pending.isCompleted = true;
                    pending.error = error;
                }
                rejectFn(error);
                throw error;
            })
            .finally(() => {
                this.pendingRequests.delete(cacheKey);
            });

        const newPending: PendingRequest = {
            groupId,
            command: command,
            paramsHash: this.hashParams(params),
            qqList: [qqId],
            promise: requestPromise,
            startTime: now,
            isCompleted: false,
        };

        this.pendingRequests.set(cacheKey, newPending);

        return {
            status: 'processing',
            needWait: false,
            isFirstRequester: true,
            pendingRequest: newPending,
        };
    }

    /**
     * 等待请求完成并获取结果
     */
    async waitForResult(
        pendingRequest: PendingRequest,
        timeoutMs: number = 30000,
    ): Promise<ApiResult> {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error('Request timeout'));
            }, timeoutMs);
        });

        return Promise.race([pendingRequest.promise, timeoutPromise]);
    }

    /**
     * 获取等待者列表并清理
     */
    getAndClearWaiters(
        groupId: number,
        command: string,
        params: any,
    ): number[] {
        const cacheKey = this.generateCacheKey(groupId, command, params);
        const pending = this.pendingRequests.get(cacheKey);
        if (!pending) return [];

        const waiters = [...pending.qqList];
        // 清理，保留第一个(发起者)
        pending.qqList = pending.qqList.length > 0 ? [pending.qqList[0]] : [];
        return waiters;
    }

    /**
     * 生成批量AT消息
     */
    generateAtMessage(qqList: number[], message: string): string {
        const atList = qqList.map((qq) => `[CQ:at,qq=${qq}]`).join(' ');
        return `${atList}\n${message}`;
    }

    /**
     * 获取统计信息
     */
    getStats(): {
        pendingCount: number;
        groupCDCount: number;
    } {
        return {
            pendingCount: this.pendingRequests.size,
            groupCDCount: this.groupCDMap.size,
        };
    }
}

// 单例实例
let serverCommandCacheInstance: ServerCommandCacheService | null = null;

export function initServerCommandCache(options?: {
    defaultCD?: number;
    requestTimeout?: number;
}): ServerCommandCacheService {
    if (!serverCommandCacheInstance) {
        serverCommandCacheInstance = new ServerCommandCacheService(options);
    }
    return serverCommandCacheInstance;
}

export function getServerCommandCache(): ServerCommandCacheService | null {
    return serverCommandCacheInstance;
}

// 默认导出单例
export const serverCommandCache = new ServerCommandCacheService();
