import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { cleanOutputDirOnce } from './outputCleanup.service';

const TTL_MS = 60 * 60 * 1000;

const createTempDir = () =>
    fs.mkdtempSync(path.join(os.tmpdir(), 'output-cleanup-test-'));

const touchWithMtime = (filePath: string, mtimeMs: number) => {
    fs.writeFileSync(filePath, 'stub');
    const time = new Date(mtimeMs);
    fs.utimesSync(filePath, time, time);
};

describe('outputCleanup.service', () => {
    it('deletes only expired top-level png files', async () => {
        const dir = createTempDir();
        const expiredMtime = Date.now() - TTL_MS * 2;

        touchWithMtime(path.join(dir, 'old.png'), expiredMtime);
        touchWithMtime(path.join(dir, 'fresh.png'), Date.now());
        touchWithMtime(path.join(dir, 'old.txt'), expiredMtime);

        const subDir = path.join(dir, 'image-regression');
        fs.mkdirSync(subDir);
        touchWithMtime(path.join(subDir, 'old.png'), expiredMtime);

        const result = await cleanOutputDirOnce(dir, TTL_MS);

        expect(result.scanned).toBe(2);
        expect(result.deleted).toBe(1);
        expect(fs.existsSync(path.join(dir, 'old.png'))).toBe(false);
        expect(fs.existsSync(path.join(dir, 'fresh.png'))).toBe(true);
        expect(fs.existsSync(path.join(dir, 'old.txt'))).toBe(true);
        expect(fs.existsSync(path.join(subDir, 'old.png'))).toBe(true);

        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('returns zero counts for a missing directory', async () => {
        const result = await cleanOutputDirOnce(
            path.join(os.tmpdir(), 'not-exist-dir-for-cleanup-test'),
            TTL_MS,
        );

        expect(result).toEqual({ scanned: 0, deleted: 0 });
    });
});
