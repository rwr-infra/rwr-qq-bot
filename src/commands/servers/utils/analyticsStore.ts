import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../../utils/logger';
import { OUTPUT_FOLDER } from '../types/constants';

/**
 * 统计数据文件的磁盘读写接缝(seam)。
 *
 * 之前 3 个写入任务(analytics / analyticsHours / analyticsServer)和 2 个读取
 * 侧(overview / analytics)各自拼 `cwd/out/<file>` 路径、各自建目录、各自 read/
 * parse/write，共 5 处重复。这里集中拥有"输出目录下的 JSON 文件如何读写",
 * 各任务只保留自己的合并(ring-buffer / peak-merge)逻辑。
 */

export const resolveAnalyticsFilePath = (fileName: string): string =>
    path.join(process.cwd(), OUTPUT_FOLDER, `./${fileName}`);

/** 读取输出目录下的 JSON 数据文件；文件缺失或解析失败返回 null。 */
export const readAnalyticsJson = <T>(fileName: string): T | null => {
    const filePath = resolveAnalyticsFilePath(fileName);

    if (!fs.existsSync(filePath)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch (e) {
        logger.error('> readAnalyticsJson error', fileName);
        logger.error(e);
        return null;
    }
};

/** 写入输出目录下的 JSON 数据文件(自动建目录)；失败仅记录日志，不抛出。 */
export const writeAnalyticsJson = (fileName: string, data: unknown): void => {
    const folderTarget = path.join(process.cwd(), OUTPUT_FOLDER);
    const writeTarget = resolveAnalyticsFilePath(fileName);

    try {
        if (!fs.existsSync(folderTarget)) {
            fs.mkdirSync(folderTarget, { recursive: true });
        }
        fs.writeFileSync(writeTarget, JSON.stringify(data), 'utf-8');
    } catch (e) {
        logger.error('> writeAnalyticsJson error', fileName);
        logger.error(e);
    }
};
