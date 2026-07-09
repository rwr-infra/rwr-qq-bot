import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { JsonFileCacheService } from './jsonFileCache.service';

describe('JsonFileCacheService', () => {
    let dir: string;
    let file: string;

    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsoncache-'));
        file = path.join(dir, 'data.json');
        fs.writeFileSync(file, JSON.stringify([{ id: '1' }, { id: '2' }]));
    });

    afterAll(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('reads and parses the configured file (no process.env needed)', async () => {
        const svc = new JsonFileCacheService<Array<{ id: string }>>(3600);
        svc.configure(file);
        const data = await svc.getData();
        expect(data).toEqual([{ id: '1' }, { id: '2' }]);
    });

    it('throws a helpful error when not configured', async () => {
        const svc = new JsonFileCacheService<unknown>(3600);
        await expect(svc.getData()).rejects.toThrow(
            /data file path not configured/,
        );
    });

    it('serves cached data within TTL without re-reading the file', async () => {
        const svc = new JsonFileCacheService<Array<{ id: string }>>(3600);
        svc.configure(file);
        const first = await svc.getData();

        // 改动文件内容；TTL 内应仍返回旧缓存
        fs.writeFileSync(file, JSON.stringify([{ id: '99' }]));
        const second = await svc.getData();
        expect(second).toBe(first);
        expect(second).toEqual([{ id: '1' }, { id: '2' }]);

        // 恢复文件供其它用例
        fs.writeFileSync(file, JSON.stringify([{ id: '1' }, { id: '2' }]));
    });
});
