/**
 * GroupCommandCoordinator - 群命令协调器
 *
 * 注意: 这不是一个"缓存"——它从不跨调用缓存 API 结果，只协调并发请求。
 * 核心功能:
 * 1. 群级CD - 基于 groupId:command 的冷却时间（限流）
 * 2. 队列合并 - 处理中的相同参数请求自动合并，多个等待者加入同一队列
 * 3. 批量AT - 由发起者统一回复，一次性AT所有等待的QQ号
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
    /** 请求是否已完成（成功或失败）——用于防止合并进已结束的批次 */
    isCompleted: boolean;
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

export class GroupCommandCoordinator {
    /** 待处理请求映射表: groupId:command:paramsHash -> PendingRequest */
    private pendingRequests = new Map<string, PendingRequest>();

    /** 群级CD映射表: groupId:command -> lastRequestTime */
    private groupCDMap = new Map<string, number>();

    /** 默认CD时间(毫秒) */
    private readonly defaultCD: number;

    /** 等待结果的默认超时时间(毫秒) */
    private readonly requestTimeout: number;

    /** 请求完成后清理 pending 记录的延迟(毫秒) */
    private readonly cleanupDelay: number;

    constructor(options?: {
        defaultCD?: number;
        requestTimeout?: number;
        cleanupDelay?: number;
    }) {
        this.defaultCD = options?.defaultCD ?? 5000;
        this.requestTimeout = options?.requestTimeout ?? 30000;
        this.cleanupDelay = options?.cleanupDelay ?? 60000;
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
        const cooldown = cdMs || this.defaultCD;
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

        // 1. 检查是否有相同参数的请求"正在处理中"
        //    已完成(isCompleted)的记录不再合并——避免加入已回复的批次，
        //    改由后续的 CD 检查决定是冷却还是发起新请求。
        const pending = this.pendingRequests.get(cacheKey);
        if (pending && !pending.isCompleted) {
            // 加入等待队列
            if (!pending.qqList.includes(qqId)) {
                pending.qqList.push(qqId);
                logger.info(
                    `[GroupCommandCoordinator] QQ ${qqId} joined pending request ${cacheKey}, ` +
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
            `[GroupCommandCoordinator] Creating new request ${cacheKey} for QQ ${qqId}`,
        );

        // 执行API调用——requestPromise 即等待者最终 await 的 Promise
        const requestPromise = apiCall()
            .then((result) => {
                const current = this.pendingRequests.get(cacheKey);
                if (current) {
                    current.isCompleted = true;
                }
                return result;
            })
            .catch((error) => {
                const current = this.pendingRequests.get(cacheKey);
                if (current) {
                    current.isCompleted = true;
                }
                throw error;
            })
            .finally(() => {
                // 延迟清理——仅当该 key 仍映射到本次的 pending 时才删除，
                // 避免误删已被新请求覆盖的记录。
                const completed = this.pendingRequests.get(cacheKey);
                setTimeout(() => {
                    if (this.pendingRequests.get(cacheKey) === completed) {
                        this.pendingRequests.delete(cacheKey);
                    }
                }, this.cleanupDelay);
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
        timeoutMs?: number,
    ): Promise<ApiResult> {
        const timeout = timeoutMs ?? this.requestTimeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error('Request timeout'));
            }, timeout);
        });

        return Promise.race([pendingRequest.promise, timeoutPromise]);
    }

    /**
     * 获取等待者列表并清空队列。
     * 仅由发起者在回复前调用一次，返回的列表包含发起者自身。
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
        pending.qqList = [];
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
let groupCommandCoordinatorInstance: GroupCommandCoordinator | null = null;

export function initGroupCommandCoordinator(options?: {
    defaultCD?: number;
    requestTimeout?: number;
    cleanupDelay?: number;
}): GroupCommandCoordinator {
    if (!groupCommandCoordinatorInstance) {
        groupCommandCoordinatorInstance = new GroupCommandCoordinator(options);
    }
    return groupCommandCoordinatorInstance;
}

export function getGroupCommandCoordinator(): GroupCommandCoordinator | null {
    return groupCommandCoordinatorInstance;
}

// 默认导出单例
export const groupCommandCoordinator = new GroupCommandCoordinator();
