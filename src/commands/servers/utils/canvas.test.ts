import * as fs from 'fs';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    printMapPng,
    printPlayersPng,
    printServerListPng,
    printUserInServerListPng,
} from './canvas';
import {
    IMapDataItem,
    IUserMatchedServerItem,
    OnlineServerItem,
} from '../types/types';

vi.mock('../../../services/canvasBackend', () => ({
    createCanvas: vi.fn().mockImplementation(() => ({
        getContext: vi.fn().mockReturnValue({
            fillStyle: '',
            font: '',
            textAlign: 'left',
            textBaseline: 'top',
            fillRect: vi.fn(),
            fillText: vi.fn(),
            measureText: vi.fn().mockReturnValue({ width: 100 }),
            strokeStyle: '',
            rect: vi.fn(),
            stroke: vi.fn(),
            drawImage: vi.fn(),
        }),
        toBufferSync: vi.fn().mockReturnValue(Buffer.from('test')),
    })),
    loadImageFrom: vi.fn().mockResolvedValue({ width: 200, height: 200 }),
    toPngBuffer: vi.fn().mockReturnValue(Buffer.from('test')),
}));

const outputDir = path.join(process.cwd(), 'out');

const server: OnlineServerItem = {
    name: 'test-server',
    address: '127.0.0.1',
    port: 19132,
    map_id: 'mp_test',
    map_name: 'Test Map',
    bots: 0,
    country: 'CN',
    current_players: 12,
    timeStamp: Date.now(),
    version: '1.0.0',
    dedicated: true,
    mod: 0,
    player: ['alice', 'bob'],
    comment: '',
    url: '',
    max_players: 64,
    mode: 'pvp',
    realm: 'test',
    playersCount: 12,
};

const servers: OnlineServerItem[] = [server];
const maps: IMapDataItem[] = [{ id: 'mp_test', name: 'Test Map' }];
const matched: IUserMatchedServerItem[] = [{ user: 'alice', server }];

const cleanupFile = (fileName: string): void => {
    const filePath = path.join(outputDir, fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
};

afterEach(() => {
    cleanupFile('servers-test.png');
    cleanupFile('players-test.png');
    cleanupFile('maps-test.png');
    cleanupFile('whereis-test.png');
});

describe('servers canvas print utilities', () => {
    it('prints server list png', () => {
        const fileName = 'servers-test.png';
        const outputPath = printServerListPng(servers, fileName);
        expect(outputPath.endsWith(path.join('out', fileName))).toBe(true);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('prints players png', () => {
        const fileName = 'players-test.png';
        const outputPath = printPlayersPng(servers, fileName);
        expect(outputPath.endsWith(path.join('out', fileName))).toBe(true);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('prints maps png', () => {
        const fileName = 'maps-test.png';
        const outputPath = printMapPng(servers, maps, fileName);
        expect(outputPath.endsWith(path.join('out', fileName))).toBe(true);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('prints whereis png', () => {
        const fileName = 'whereis-test.png';
        const outputPath = printUserInServerListPng(
            matched,
            'alice',
            1,
            fileName,
        );
        expect(outputPath.endsWith(path.join('out', fileName))).toBe(true);
        expect(fs.existsSync(outputPath)).toBe(true);
    });
});
