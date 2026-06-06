import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import { OnlineServerItem } from '../types/types';
import { aggregateOverview, readTrendSummary } from './overview';

vi.mock('fs', async () => {
    const actual = await vi.importActual<typeof import('fs')>('fs');
    return {
        ...actual,
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
    };
});

const makeServer = (
    overrides: Partial<OnlineServerItem> = {},
): OnlineServerItem => ({
    name: 'server',
    address: '1.1.1.1',
    port: 1000,
    map_id: 'media/packages/x/maps/map1',
    map_name: '',
    bots: 0,
    country: 'China',
    current_players: 0,
    timeStamp: 0,
    version: '1.0',
    dedicated: true,
    mod: 1,
    comment: '',
    url: '',
    max_players: 20,
    mode: 'Coop',
    realm: '',
    playersCount: 0,
    ...overrides,
});

describe('aggregateOverview', () => {
    it('computes core KPI from snapshot', () => {
        const servers = [
            makeServer({ current_players: 20, max_players: 20, bots: 10 }), // 满员
            makeServer({ current_players: 5, max_players: 20, bots: 3 }),
            makeServer({ current_players: 0, max_players: 20, bots: 0 }), // 空
        ];

        const stats = aggregateOverview(servers);

        expect(stats.serverCount).toBe(3);
        expect(stats.playersTotal).toBe(25);
        expect(stats.capacityTotal).toBe(60);
        expect(stats.botsTotal).toBe(13);
        expect(stats.fullCount).toBe(1);
        expect(stats.emptyCount).toBe(1);
        expect(stats.occupancyRate).toBeCloseTo(25 / 60);
    });

    it('handles empty server list without dividing by zero', () => {
        const stats = aggregateOverview([]);
        expect(stats.serverCount).toBe(0);
        expect(stats.occupancyRate).toBe(0);
        expect(stats.serverDetail).toEqual([]);
    });

    it('builds per-server detail (map/bots/key) sorted by players desc', () => {
        const servers = [
            makeServer({
                name: 'Low',
                address: '2.2.2.2',
                port: 2000,
                map_id: 'media/packages/x/maps/mapB',
                bots: 4,
                current_players: 3,
            }),
            makeServer({
                name: 'High',
                address: '3.3.3.3',
                port: 3000,
                map_id: 'media/packages/x/maps/mapA',
                bots: 9,
                current_players: 15,
            }),
        ];

        const stats = aggregateOverview(servers);

        expect(stats.serverDetail.map((d) => d.name)).toEqual(['High', 'Low']);
        expect(stats.serverDetail[0]).toMatchObject({
            name: 'High',
            mapName: 'mapA',
            players: 15,
            maxPlayers: 20,
            bots: 9,
            serverKey: '3.3.3.3:3000',
        });
    });
});

describe('readTrendSummary', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns null fields when data files are missing', () => {
        (fs.existsSync as any).mockReturnValue(false);

        const trend = readTrendSummary();

        expect(trend).toEqual({
            peak24h: null,
            peak7d: null,
            latest: null,
            series24h: [],
        });
    });

    it('returns peaks and latest when files exist', () => {
        (fs.existsSync as any).mockReturnValue(true);
        (fs.readFileSync as any).mockImplementation((p: any) => {
            const file = String(p);
            if (file.includes('analysis_hours.json')) {
                return JSON.stringify([
                    { date: '10:00', count: 30 },
                    { date: '11:00', count: 55 },
                    { date: '12:00', count: 42 },
                ]);
            }
            if (file.includes('analysis.json')) {
                return JSON.stringify([
                    { date: '6/1', count: 80 },
                    { date: '6/2', count: 120 },
                ]);
            }
            return '[]';
        });

        const trend = readTrendSummary();

        expect(trend.peak24h).toBe(55);
        expect(trend.peak7d).toBe(120);
        expect(trend.latest).toBe(42); // analysis_hours 最后一条
        expect(trend.series24h).toHaveLength(3); // 近24h逐时序列
        expect(trend.series24h[1]).toEqual({ date: '11:00', count: 55 });
    });
});
