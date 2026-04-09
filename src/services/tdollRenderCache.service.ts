/**
 * TDollRenderCacheService - TDoll渲染缓存服务
 *
 * 功能:
 * 1. 参数级缓存 - 基于查询参数缓存渲染结果
 * 2. 分层渲染 - 主内容缓存 + 时间戳动态叠加
 * 3. 智能失效 - TTL + LRU 双策略
 */

import { logger } from '../utils/logger';
import * as fs from 'node:fs';
import * as path from 'node:path';
import crypto from 'node:crypto';

export interface TDollCacheEntry {
    /** 缓存键 */
    key: string;
    /** 主内容图片路径（不含时间戳） */
    contentPath: string;
    /** 完整输出路径（含时间戳） */
    outputPath: string;
    /** 缓存创建时间 */
    createTime: number;
    /** 最后访问时间 */
    lastAccessTime: number;
    /** 访问次数 */
    accessCount: number;
    /** 查询参数 */
    params: TDollCacheParams;
}

export interface TDollCacheParams {
    /** 查询字符串 */
    query: string;
    /** 二级查询（如分类） */
    query2?: string;
    /** 人形ID（用于皮肤查询） */
    tdollId?: string;
    /** 命令类型 */
    commandType: 'tdoll' | 'tdollskin';
}

export interface TDollRenderCacheOptions {
    /** 缓存目录 */
    cacheDir: string;
    /** TTL (毫秒), 默认 5 分钟 */
    ttl?: number;
    /** 最大缓存条目数 */
    maxEntries?: number;
    /** 是否启用缓存 */
    enabled?: boolean;
}

export class TDollRenderCacheService {
    private cache = new Map<string, TDollCacheEntry>();
    private options: Required<TDollRenderCacheOptions>;
    private accessOrder: string[] = []; // For LRU

    constructor(options: TDollRenderCacheOptions) {
        this.options = {
            ttl: 5 * 60 * 1000, // 5 minutes
            maxEntries: 50,
            enabled: true,
            ...options,
        };

        // 确保缓存目录存在
        if (!fs.existsSync(this.options.cacheDir)) {
            fs.mkdirSync(this.options.cacheDir, { recursive: true });
        }

        logger.info('[TDollRenderCache] Service initialized', {
            cacheDir: this.options.cacheDir,
            ttl: this.options.ttl,
            maxEntries: this.options.maxEntries,
        });
    }

    /**
     * 生成缓存键
     */
    private generateCacheKey(params: TDollCacheParams): string {
        const keyData = {
            type: params.commandType,
            query: params.query.toLowerCase(),
            q2: params.query2?.toLowerCase() || '',
            id: params.tdollId || '',
        };
        const keyString = JSON.stringify(keyData);
        return crypto.createHash('md5').update(keyString).digest('hex');
    }

    /**
     * 获取缓存文件路径
     */
    private getCacheFilePath(key: string, suffix: string = ''): string {
        const fileName = suffix ? `${key}_${suffix}.png` : `${key}.png`;
        return path.join(this.options.cacheDir, fileName);
    }

    /**
     * 检查缓存是否存在且有效
     */
    get(params: TDollCacheParams): TDollCacheEntry | null {
        if (!this.options.enabled) return null;

        const key = this.generateCacheKey(params);
        const entry = this.cache.get(key);

        if (!entry) {
            logger.debug(`[TDollRenderCache] Cache miss: ${key}`);
            return null;
        }

        // 检查 TTL
        const now = Date.now();
        if (now - entry.createTime > this.options.ttl) {
            logger.info(`[TDollRenderCache] Cache expired: ${key}`);
            this.delete(key);
            return null;
        }

        // 检查文件是否存在
        if (!fs.existsSync(entry.contentPath)) {
            logger.warn(
                `[TDollRenderCache] Cache file missing: ${entry.contentPath}`,
            );
            this.delete(key);
            return null;
        }

        // 更新访问统计
        entry.lastAccessTime = now;
        entry.accessCount++;
        this.updateLRU(key);

        logger.info(
            `[TDollRenderCache] Cache hit: ${key}, hit count: ${entry.accessCount}`,
        );
        return entry;
    }

    /**
     * 设置缓存
     */
    set(
        params: TDollCacheParams,
        contentPath: string,
        outputPath: string,
    ): TDollCacheEntry {
        const key = this.generateCacheKey(params);
        const now = Date.now();

        // 检查是否需要清理
        if (this.cache.size >= this.options.maxEntries) {
            this.evictLRU();
        }

        const entry: TDollCacheEntry = {
            key,
            contentPath,
            outputPath,
            createTime: now,
            lastAccessTime: now,
            accessCount: 1,
            params,
        };

        this.cache.set(key, entry);
        this.accessOrder.push(key);

        logger.info(
            `[TDollRenderCache] Cache set: ${key}, total entries: ${this.cache.size}`,
        );
        return entry;
    }

    /**
     * 删除缓存
     */
    delete(key: string): void {
        const entry = this.cache.get(key);
        if (entry) {
            // 删除缓存文件（保留内容文件供后续使用）
            this.cache.delete(key);
            this.accessOrder = this.accessOrder.filter((k) => k !== key);
            logger.debug(`[TDollRenderCache] Cache deleted: ${key}`);
        }
    }

    /**
     * 更新 LRU 顺序
     */
    private updateLRU(key: string): void {
        this.accessOrder = this.accessOrder.filter((k) => k !== key);
        this.accessOrder.push(key);
    }

    /**
     * 淘汰最久未使用的缓存
     */
    private evictLRU(): void {
        if (this.accessOrder.length === 0) return;

        const oldestKey = this.accessOrder[0];
        const entry = this.cache.get(oldestKey);

        if (entry) {
            // 删除输出文件，但保留内容文件
            if (fs.existsSync(entry.outputPath)) {
                try {
                    fs.unlinkSync(entry.outputPath);
                    logger.debug(
                        `[TDollRenderCache] Evicted output file: ${entry.outputPath}`,
                    );
                } catch (err) {
                    logger.error(
                        `[TDollRenderCache] Failed to delete output file: ${err}`,
                    );
                }
            }
        }

        this.delete(oldestKey);
        logger.info(`[TDollRenderCache] LRU evicted: ${oldestKey}`);
    }

    /**
     * 清理所有过期缓存
     */
    cleanup(): number {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.createTime > this.options.ttl) {
                this.delete(key);
                cleaned++;
            }
        }

        logger.info(
            `[TDollRenderCache] Cleanup completed: ${cleaned} entries removed`,
        );
        return cleaned;
    }

    /**
     * 获取统计信息
     */
    getStats() {
        let totalHits = 0;
        this.cache.forEach((entry) => {
            totalHits += entry.accessCount;
        });

        return {
            totalEntries: this.cache.size,
            maxEntries: this.options.maxEntries,
            hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
            totalHits,
        };
    }

    /**
     * 清空所有缓存
     */
    clear(): void {
        // 删除所有缓存文件
        for (const entry of this.cache.values()) {
            if (fs.existsSync(entry.contentPath)) {
                try {
                    fs.unlinkSync(entry.contentPath);
                } catch (err) {
                    logger.error(
                        `[TDollRenderCache] Failed to delete content file: ${err}`,
                    );
                }
            }
            if (fs.existsSync(entry.outputPath)) {
                try {
                    fs.unlinkSync(entry.outputPath);
                } catch (err) {
                    logger.error(
                        `[TDollRenderCache] Failed to delete output file: ${err}`,
                    );
                }
            }
        }

        this.cache.clear();
        this.accessOrder = [];
        logger.info('[TDollRenderCache] All cache cleared');
    }
}

// 单例实例
let tdollRenderCacheInstance: TDollRenderCacheService | null = null;

export function initTDollRenderCache(
    options: TDollRenderCacheOptions,
): TDollRenderCacheService {
    if (!tdollRenderCacheInstance) {
        tdollRenderCacheInstance = new TDollRenderCacheService(options);
    }
    return tdollRenderCacheInstance;
}

export function getTDollRenderCache(): TDollRenderCacheService | null {
    return tdollRenderCacheInstance;
}
