import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapsCanvas } from './mapsCanvas';
import { OnlineServerItem, IMapDataItem } from '../types/types';

// Mock canvas backend to avoid loading native renderer.
const makeCtx = () => ({
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 100 }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    rect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
});

vi.mock('../../../services/canvasBackend', () => ({
    createCanvas: vi.fn().mockImplementation(() => ({
        getContext: vi.fn().mockImplementation(() => makeCtx()),
    })),
    toPngBuffer: vi.fn().mockReturnValue(Buffer.from('test')),
    loadImageFrom: vi.fn().mockResolvedValue({ width: 200, height: 200 }),
}));

describe('MapsCanvas', () => {
    let mapsCanvas: MapsCanvas;
    const mockServers = [
        {
            name: 'Alpha',
            address: '10.0.0.1',
            port: 1234,
            map_id: 'maps/test_map',
            current_players: 10,
            max_players: 20,
        },
    ] as OnlineServerItem[];
    const mockMaps = [
        { id: 'test_map', name: 'Test Map' },
        { id: 'idle_map', name: 'Idle Map' },
    ] as IMapDataItem[];

    beforeEach(() => {
        mapsCanvas = new MapsCanvas(mockServers, mockMaps, 'test.png');
    });

    it('should initialize correctly', () => {
        expect(mapsCanvas).toBeInstanceOf(MapsCanvas);
        expect(mapsCanvas.serverList).toEqual(mockServers);
        expect(mapsCanvas.mapData).toEqual(mockMaps);
        expect(mapsCanvas.fileName).toBe('test.png');
    });

    it('should render without throwing and produce positive dimensions', () => {
        const outPath = mapsCanvas.render();
        expect(outPath).toContain('test.png');
        // 一张活跃地图卡片 + 一张空闲地图 chip → 宽高均应为正
        expect(mapsCanvas.renderWidth).toBeGreaterThan(0);
        expect(mapsCanvas.renderHeight).toBeGreaterThan(0);
    });

    it('should render with empty data without throwing', () => {
        const empty = new MapsCanvas([], [], 'empty.png');
        expect(() => empty.render()).not.toThrow();
    });
});
