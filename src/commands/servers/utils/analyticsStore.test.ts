import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import {
    readAnalyticsJson,
    writeAnalyticsJson,
    resolveAnalyticsFilePath,
} from './analyticsStore';

const fileName = `analytics-store-test-${process.pid}.json`;

describe('analyticsStore', () => {
    afterAll(() => {
        const p = resolveAnalyticsFilePath(fileName);
        if (fs.existsSync(p)) {
            fs.unlinkSync(p);
        }
    });

    it('returns null for a missing file', () => {
        expect(
            readAnalyticsJson(`does-not-exist-${process.pid}.json`),
        ).toBeNull();
    });

    it('write then read roundtrips (creating out/ if needed)', () => {
        const data = [
            { date: '1/1', count: 5 },
            { date: '1/2', count: 9 },
        ];
        writeAnalyticsJson(fileName, data);
        expect(fs.existsSync(resolveAnalyticsFilePath(fileName))).toBe(true);
        expect(readAnalyticsJson(fileName)).toEqual(data);
    });

    it('returns null on malformed json', () => {
        fs.writeFileSync(resolveAnalyticsFilePath(fileName), '{not valid json');
        expect(readAnalyticsJson(fileName)).toBeNull();
    });
});
