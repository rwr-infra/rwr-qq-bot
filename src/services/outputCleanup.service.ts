import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { logger } from '../utils/logger';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** 皮肤原图缓存子目录名(与 tdoll 命令写入路径保持一致)。 */
const SKIN_CACHE_SUBDIR = 'skin_cache';
/** 皮肤原图缓存 TTL: 远比顶层产物长, 保留长效命中。 */
const SKIN_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 扫描指定目录下过期的顶层 PNG 并删除。仅处理该目录直接的 .png 文件,
 * 不递归子目录。
 */
const cleanPngDir = async (
    dir: string,
    ttlMs: number,
): Promise<{ scanned: number; deleted: number }> => {
    const result = { scanned: 0, deleted: 0 };

    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        // 目录不存在等情况直接跳过
        return result;
    }

    const expireBefore = Date.now() - ttlMs;

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.png')) {
            continue;
        }

        result.scanned += 1;
        const filePath = path.join(dir, entry.name);

        try {
            const stat = await fs.stat(filePath);
            if (stat.mtimeMs < expireBefore) {
                await fs.unlink(filePath);
                result.deleted += 1;
            }
        } catch (error) {
            logger.error('[outputCleanup] Failed to clean file', {
                filePath,
                error,
            });
        }
    }

    return result;
};

/**
 * 清理输出目录中过期的 PNG 产物。
 * 只处理 dir 顶层的 .png 文件, 子目录(如 out/image-regression)不受影响。
 */
export const cleanOutputDirOnce = async (
    dir: string = path.join(process.cwd(), 'out'),
    ttlMs: number = DEFAULT_TTL_MS,
): Promise<{ scanned: number; deleted: number }> => cleanPngDir(dir, ttlMs);

/**
 * 清理皮肤原图缓存子目录(out/skin_cache)中过期的 PNG。
 * 顶层清理会跳过子目录, 故单独按更长 TTL 处理, 避免缓存无限增长。
 */
export const cleanSkinCacheOnce = async (
    dir: string = path.join(process.cwd(), 'out', SKIN_CACHE_SUBDIR),
    ttlMs: number = SKIN_CACHE_TTL_MS,
): Promise<{ scanned: number; deleted: number }> => cleanPngDir(dir, ttlMs);

let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * 启动输出目录定时清理: 启动时立即执行一次, 之后每 6 小时执行一次。
 * 同时按 30 天 TTL 清理皮肤原图缓存子目录。
 */
export const startOutputCleanupTask = (): void => {
    if (cleanupTimer) {
        return;
    }

    const run = async () => {
        try {
            const out = await cleanOutputDirOnce();
            const skin = await cleanSkinCacheOnce();
            logger.info(
                `[outputCleanup] out scanned=${out.scanned}, deleted=${out.deleted}; skinCache scanned=${skin.scanned}, deleted=${skin.deleted}`,
            );
        } catch (error) {
            logger.error('[outputCleanup] cleanup task failed', error);
        }
    };

    void run();
    cleanupTimer = setInterval(run, CLEANUP_INTERVAL_MS);
    cleanupTimer.unref();
};
