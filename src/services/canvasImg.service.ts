import { ImageLike, loadImageFrom } from './canvasBackend';
import { logger } from '../utils/logger';

/**
 * 图片缓存条目接口
 */
interface CacheEntry {
    image: ImageLike;
    lastAccessed: number;
    accessCount: number;
    persistent: boolean;
}

/**
 * Canvas 图片服务配置
 */
export interface CanvasImgServiceConfig {
    /** 最大缓存数量 */
    maxCacheSize: number;
    /** 缓存过期时间 (毫秒) */
    cacheTTL: number;
    /** 清理间隔 (毫秒) */
    cleanupInterval: number;
    /** 是否启用访问计数 */
    enableAccessTracking: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: CanvasImgServiceConfig = {
    maxCacheSize: 100,
    cacheTTL: 30 * 60 * 1000, // 30分钟
    cleanupInterval: 5 * 60 * 1000, // 5分钟
    enableAccessTracking: true,
};

/**
 * 重构后的 Canvas 图片服务
 * 提供内存管理和缓存清理机制，防止内存泄漏
 */
export class CanvasImgService {
    private static instance: CanvasImgService;
    private cache = new Map<string, CacheEntry>();
    private config: CanvasImgServiceConfig;
    private cleanupTimer: NodeJS.Timeout | null = null;
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        loads: 0,
    };

    private constructor(config: Partial<CanvasImgServiceConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.startCleanupTimer();
        logger.info('[CanvasImgService] Initialized with config:', this.config);
    }

    /**
     * 获取单例实例
     */
    static getInstance(
        config?: Partial<CanvasImgServiceConfig>,
    ): CanvasImgService {
        if (!CanvasImgService.instance) {
            CanvasImgService.instance = new CanvasImgService(config);
        }
        return CanvasImgService.instance;
    }

    /**
     * 重置单例 (主要用于测试)
     */
    static resetInstance(): void {
        if (CanvasImgService.instance) {
            CanvasImgService.instance.dispose();
            CanvasImgService.instance = null as any;
        }
    }

    /**
     * 添加图片到缓存
     */
    async addImg(path: string, persistent = false): Promise<void> {
        if (this.cache.has(path)) {
            logger.debug(`[CanvasImgService] Image already cached: ${path}`);
            if (persistent) {
                const entry = this.cache.get(path);
                if (entry) {
                    entry.persistent = true;
                }
            }
            this.touch(path);
            return;
        }

        await this.loadImage(path, persistent);
    }

    /**
     * 获取图片
     */
    getImg(path: string): ImageLike | undefined {
        const entry = this.cache.get(path);

        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        // 检查是否过期
        if (this.isExpired(entry)) {
            if (entry.persistent) {
                this.touch(path);
                return entry.image;
            }
            logger.debug(`[CanvasImgService] Image expired: ${path}`);
            this.cache.delete(path);
            this.stats.evictions++;
            return undefined;
        }

        this.stats.hits++;
        this.touch(path);
        return entry.image;
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
        };
    }

    /**
     * 手动清理过期缓存
     */
    cleanup(): number {
        let removed = 0;
        const now = Date.now();

        for (const [path, entry] of this.cache.entries()) {
            if (entry.persistent) {
                continue;
            }
            if (now - entry.lastAccessed > this.config.cacheTTL) {
                this.cache.delete(path);
                removed++;
                this.stats.evictions++;
            }
        }

        if (removed > 0) {
            logger.info(
                `[CanvasImgService] Cleaned up ${removed} expired images`,
            );
        }

        return removed;
    }

    /**
     * 清空所有缓存
     */
    clear(): void {
        this.cache.clear();
        logger.info('[CanvasImgService] Cache cleared');
    }

    /**
     * 释放资源
     */
    dispose(): void {
        this.stopCleanupTimer();
        this.clear();
        logger.info('[CanvasImgService] Disposed');
    }

    /**
     * 加载图片
     */
    private async loadImage(path: string, persistent = false): Promise<void> {
        // 检查缓存是否已满，如果满了先清理
        if (this.cache.size >= this.config.maxCacheSize) {
            this.evictLRU();
        }

        try {
            const image = await loadImageFrom(path);

            this.cache.set(path, {
                image,
                lastAccessed: Date.now(),
                accessCount: 1,
                persistent,
            });

            this.stats.loads++;
            logger.debug(`[CanvasImgService] Image loaded: ${path}`);
        } catch (error) {
            logger.error(
                `[CanvasImgService] Failed to load image: ${path}`,
                error,
            );
            throw error;
        }
    }

    /**
     * 更新访问时间
     */
    private touch(path: string): void {
        const entry = this.cache.get(path);
        if (entry) {
            entry.lastAccessed = Date.now();
            entry.accessCount++;
        }
    }

    /**
     * 检查是否过期
     */
    private isExpired(entry: CacheEntry): boolean {
        return Date.now() - entry.lastAccessed > this.config.cacheTTL;
    }

    /**
     * 淘汰最少使用的缓存
     */
    private evictLRU(): void {
        let oldest: { path: string; time: number } | null = null;

        for (const [path, entry] of this.cache.entries()) {
            if (!oldest || entry.lastAccessed < oldest.time) {
                oldest = { path, time: entry.lastAccessed };
            }
        }

        if (oldest) {
            this.cache.delete(oldest.path);
            this.stats.evictions++;
            logger.debug(
                `[CanvasImgService] Evicted LRU image: ${oldest.path}`,
            );
        }
    }

    /**
     * 启动定时清理
     */
    private startCleanupTimer(): void {
        if (this.cleanupTimer) {
            return;
        }

        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);

        // 确保定时器不会阻止进程退出
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
    }

    /**
     * 停止定时清理
     */
    private stopCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
}
