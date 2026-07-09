import * as fs from 'node:fs/promises';
import { AsyncCacheService } from './asyncCache.service';

/**
 * JSON 文件数据源(带 TTL 缓存)。
 *
 * 相比直接在 fetchData 里读取 process.env，文件路径改为通过 configure() 注入
 * (通常在命令的 init(env) 中调用)。这样：
 * - 数据文件的读取实现集中在一处，tdoll / tdollskin 等命令复用同一套加载逻辑；
 * - 单元测试可直接 configure 一个临时文件，无需改动 process.env。
 *
 * 注意：这里改变的是"如何获取路径"，环境变量本身(如 TDOLL_DATA_FILE)保持不变，
 * 仍由调用方在 init 时从 env 读取后传入。
 */
export class JsonFileCacheService<T> extends AsyncCacheService<T> {
    protected filePath?: string;

    constructor(cacheTimeSeconds: number) {
        super();
        this.cacheTime = cacheTimeSeconds;
    }

    /** 注入数据文件路径。通常在命令 init(env) 时调用。 */
    configure(filePath: string): void {
        this.filePath = filePath;
    }

    protected async readRaw(): Promise<string> {
        if (!this.filePath) {
            throw new Error(
                `${this.constructor.name}: data file path not configured — call configure(path) in the command's init(env)`,
            );
        }
        return fs.readFile(this.filePath, 'utf-8');
    }

    async fetchData(): Promise<T> {
        return JSON.parse(await this.readRaw()) as T;
    }
}
