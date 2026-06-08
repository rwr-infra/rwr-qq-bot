import * as fs from 'node:fs';
import * as path from 'node:path';
import { createCanvas, toPngBuffer } from '../canvasBackend';

import { TDoll2Canvas } from '../../commands/tdoll/canvas/tdoll2Canvas';
import { MapsCanvas } from '../../commands/servers/canvas/mapsCanvas';
import { MapDetailCanvas } from '../../commands/servers/canvas/mapDetailCanvas';
import { PlayersCanvas } from '../../commands/servers/canvas/playersCanvas';
import { ServersCanvas } from '../../commands/servers/canvas/serversCanvas';
import { WhereisCanvas } from '../../commands/servers/canvas/whereisCanvas';
import { ServerOverviewCanvas } from '../../commands/servers/canvas/serverOverviewCanvas';
import { AnalyticsCanvas } from '../../commands/servers/canvas/analyticsCanvas';
import { CheckCanvas } from '../../commands/check/checkCanvas';
import { aggregateOverview } from '../../commands/servers/utils/overview';
import { OUTPUT_FOLDER } from '../../commands/servers/types/constants';

export type ImageScenario = {
    id: string;
    name: string;
    run: () => Promise<string>; // returns absolute PNG path
};

const fixturesDir = path.join(
    process.cwd(),
    'src/services/imageRegression/fixtures',
);

function readJson<T>(relative: string): T {
    const full = path.join(fixturesDir, relative);
    const raw = fs.readFileSync(full, 'utf-8');
    return JSON.parse(raw) as T;
}

function ensureOutDir() {
    const outDir = path.join(process.cwd(), OUTPUT_FOLDER);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    return outDir;
}

async function ensureFixturePng(filePath: string) {
    if (fs.existsSync(filePath)) {
        return;
    }
    const canvas = createCanvas(64, 64);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(8, 8, 48, 48);
    fs.writeFileSync(filePath, toPngBuffer(canvas));
}

export const scenarios: ImageScenario[] = [
    {
        id: 'tdoll-basic',
        name: 'TDoll2 basic render',
        run: async () => {
            const outDir = ensureOutDir();
            const avatarPath = path.join(outDir, 'fixture-tdoll-avatar.png');
            await ensureFixturePng(avatarPath);

            const fileName = `reg-tdoll-${Date.now()}.png`;
            const [tdoll] = readJson<any[]>('tdoll/tdolls.json');
            tdoll.avatar = avatarPath;

            const canvas = new TDoll2Canvas('test', [tdoll], fileName);
            await canvas.loadAllImg();
            const outPath = await canvas.render();
            return path.resolve(outPath);
        },
    },
    {
        id: 'servers-maps-basic',
        name: 'Servers maps basic render',
        run: async () => {
            ensureOutDir();
            const fileName = `reg-maps-${Date.now()}.png`;

            const { servers, maps } = readJson<any>('servers/maps.json');

            const canvas = new MapsCanvas(servers, maps, fileName);
            const outPath = canvas.render();
            return path.resolve(outPath);
        },
    },
    {
        id: 'servers-map-detail-basic',
        name: 'Servers map detail basic render',
        run: async () => {
            ensureOutDir();
            const fileName = `reg-map-detail-${Date.now()}.png`;

            const { map, servers } = readJson<any>('servers/mapDetail.json');

            const canvas = new MapDetailCanvas(map, servers, fileName);
            const outPath = canvas.render();
            return path.resolve(outPath);
        },
    },
    {
        id: 'players-basic',
        name: 'Players basic render',
        run: async () => {
            ensureOutDir();
            const fileName = `reg-players-${Date.now()}.png`;

            const data = readJson<any>('servers/players.json');

            // 让「X分钟前」可复现: 用相对当前时刻的固定偏移(90s → 恒为 2 分钟前)
            const historicalServers = (data.historicalServers ?? []).map(
                (s: any) => ({ ...s, lastSeenAt: Date.now() - 90_000 }),
            );

            const canvas = new PlayersCanvas(
                data.serverList,
                historicalServers,
                fileName,
                new Map(),
                data.moderators,
                data.moderatorBadge,
            );
            const outPath = canvas.render();
            return path.resolve(outPath);
        },
    },
    {
        id: 'servers-list-basic',
        name: 'Servers list basic render',
        run: async () => {
            ensureOutDir();
            const fileName = `reg-servers-${Date.now()}.png`;

            const data = readJson<any>('servers/servers.json');

            // 让「X分钟前」可复现: 用相对当前时刻的固定偏移(90s → 恒为 2 分钟前)
            const historicalServers = (data.historicalServers ?? []).map(
                (s: any) => ({ ...s, lastSeenAt: Date.now() - 90_000 }),
            );

            const canvas = new ServersCanvas(
                data.serverList,
                historicalServers,
                fileName,
                new Map(),
            );
            const outPath = canvas.render();
            return path.resolve(outPath);
        },
    },
    {
        id: 'servers-whereis-basic',
        name: 'Servers whereis basic render',
        run: async () => {
            ensureOutDir();
            const fileName = `reg-whereis-${Date.now()}.png`;

            const data = readJson<any>('servers/whereis.json');

            const canvas = new WhereisCanvas(
                data.matchList,
                data.query,
                data.count,
                fileName,
            );
            const outPath = canvas.render();
            return path.resolve(outPath);
        },
    },
    {
        id: 'servers-overview-basic',
        name: 'Server overview basic render',
        run: async () => {
            ensureOutDir();
            const fileName = `reg-overview-${Date.now()}.png`;

            const data = readJson<any>('servers/overview.json');
            const stats = aggregateOverview(data.serverList);
            const latencyMap = new Map<string, number | null>(data.latencyMap);
            const historicalServers = (data.historicalServers ?? []).map(
                (s: any) => ({ ...s, lastSeenAt: Date.now() - 90_000 }),
            );

            const canvas = new ServerOverviewCanvas(
                stats,
                data.trend,
                fileName,
                new Map(),
                latencyMap,
                historicalServers,
            );
            const outPath = canvas.render();
            return path.resolve(outPath);
        },
    },
    {
        id: 'analytics-basic',
        name: 'Analytics overview basic render',
        run: async () => {
            ensureOutDir();
            const fileName = `reg-analytics-${Date.now()}.png`;

            const view = readJson<any>('servers/analytics.json');

            const canvas = new AnalyticsCanvas(view, fileName);
            const outPath = canvas.render();
            return path.resolve(outPath);
        },
    },
    {
        id: 'check-basic',
        name: 'Check connectivity basic render',
        run: async () => {
            ensureOutDir();
            const fileName = `reg-check-${Date.now()}.png`;

            const report = readJson<any>('check/check.json');

            const canvas = new CheckCanvas(report, fileName);
            const outPath = canvas.render();
            return path.resolve(outPath);
        },
    },
];
