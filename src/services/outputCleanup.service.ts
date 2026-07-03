import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { logger } from '../utils/logger';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * 清理输出目录中过期的 PNG 产物。
 * 只处理 dir 顶层的 .png 文件, 子目录(如 out/image-regression)不受影响。
 */
export const cleanOutputDirOnce = async (
    dir: string = path.join(process.cwd(), 'out'),
    ttlMs: number = DEFAULT_TTL_MS,
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

let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * 启动输出目录定时清理: 启动时立即执行一次, 之后每 6 小时执行一次。
 */
export const startOutputCleanupTask = (): void => {
    if (cleanupTimer) {
        return;
    }

    const run = async () => {
        try {
            const { scanned, deleted } = await cleanOutputDirOnce();
            logger.info(
                `[outputCleanup] scanned=${scanned}, deleted=${deleted}`,
            );
        } catch (error) {
            logger.error('[outputCleanup] cleanup task failed', error);
        }
    };

    void run();
    cleanupTimer = setInterval(run, CLEANUP_INTERVAL_MS);
    cleanupTimer.unref();
};
