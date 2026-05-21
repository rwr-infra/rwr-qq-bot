import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapsCanvas } from './mapsCanvas';
import { OnlineServerItem, IMapDataItem } from '../types/types';

// Mock canvas backend to avoid loading native renderer.
vi.mock('../../../services/canvasBackend', () => ({
    createCanvas: vi.fn().mockImplementation(() => ({
        getContext: vi.fn().mockReturnValue({
            fillStyle: '',
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
}));

describe('MapsCanvas', () => {
    let mapsCanvas: MapsCanvas;
    const mockServers = [
        {
            map_id: 'test_map',
            current_players: 10,
            max_players: 20,
            // other required fields...
        },
    ] as OnlineServerItem[];
    const mockMaps = [
        {
            id: 'test_map',
            name: 'Test Map',
            // other required fields...
        },
    ] as IMapDataItem[];

    beforeEach(() => {
        mapsCanvas = new MapsCanvas(mockServers, [], mockMaps, 'test.png');
    });

    it('should initialize correctly', () => {
        expect(mapsCanvas).toBeInstanceOf(MapsCanvas);
        expect(mapsCanvas.serverList).toEqual(mockServers);
        expect(mapsCanvas.mapData).toEqual(mockMaps);
        expect(mapsCanvas.fileName).toBe('test.png');
    });

    describe('measureTitle', () => {
        it('should measure title width correctly', () => {
            mapsCanvas.measureTitle();
            // CN word: 7 * (20 * 2) = 280, EN word: 3 * 20 = 60, Padding: 20
            // 360 = 280 + 60 + 20
            expect(mapsCanvas.measureMaxWidth).toBe(360);
            expect(mapsCanvas.totalTitle).toBe('共计 1 项地图数据');
        });
    });

    // describe('measureList', () => {
    //     it('should measure list dimensions correctly', () => {
    //         mapsCanvas.measureList();
    //         expect(mapsCanvas.renderHeight).toBe(160); // 120 base + 40 per line (1 line)
    //         expect(mapsCanvas.contentLines).toBe(1); // Only 1 map in mock data
    //     });
    // });

    // describe('render', () => {
    //     it('should render canvas without errors', () => {
    //         expect(mapsCanvas.render()).not.toThrowError();
    //     });
    // });
});
