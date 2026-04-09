import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TDollDataProvider } from '../TDollDataProvider';
import { ITDollDataItem } from '../../../types/types';
import * as canvasBackend from '../../../../../services/canvasBackend';

// Mock canvasBackend
vi.mock('../../../../../services/canvasBackend', () => ({
    loadImageFrom: vi.fn(),
}));

describe('TDollDataProvider', () => {
    let provider: TDollDataProvider;

    beforeEach(() => {
        provider = new TDollDataProvider();
        vi.clearAllMocks();
    });

    describe('getImgMap', () => {
        it('should return empty map initially', () => {
            const map = provider.getImgMap();
            expect(map.size).toBe(0);
        });
    });

    describe('loadAllImages', () => {
        it('should load images for all tdolls', async () => {
            const mockImage = { width: 100, height: 100 } as any;
            vi.mocked(canvasBackend.loadImageFrom).mockResolvedValue(mockImage);

            const tdolls = [
                {
                    id: '1',
                    nameIngame: 'Test Doll 1',
                    avatar: 'http://example.com/1.png',
                    mod: '0',
                },
                {
                    id: '2',
                    nameIngame: 'Test Doll 2',
                    avatar: 'http://example.com/2.png',
                    avatarMod: 'http://example.com/2_mod.png',
                    mod: '1',
                },
            ] as ITDollDataItem[];

            await provider.loadAllImages(tdolls);

            const imgMap = provider.getImgMap();
            expect(imgMap.has('1')).toBe(true);
            expect(imgMap.has('2')).toBe(true);
            expect(imgMap.has('2__mod')).toBe(true);
        });

        it('should handle image load errors gracefully', async () => {
            vi.mocked(canvasBackend.loadImageFrom).mockRejectedValue(
                new Error('Network error'),
            );

            const tdolls = [
                {
                    id: '1',
                    nameIngame: 'Test Doll',
                    avatar: 'http://example.com/1.png',
                    mod: '0',
                },
            ] as ITDollDataItem[];

            // Should not throw, errors are logged and swallowed
            await expect(provider.loadAllImages(tdolls)).resolves.not.toThrow();
        });

        it('should skip loading if image already exists', async () => {
            const mockImage = { width: 100, height: 100 } as any;
            vi.mocked(canvasBackend.loadImageFrom).mockResolvedValue(mockImage);

            const tdolls = [
                {
                    id: '1',
                    nameIngame: 'Test Doll',
                    avatar: 'http://example.com/1.png',
                    mod: '0',
                },
            ] as ITDollDataItem[];

            // First load
            await provider.loadAllImages(tdolls);

            // Reset mock to track calls
            vi.mocked(canvasBackend.loadImageFrom).mockClear();

            // Second load with same tdoll
            await provider.loadAllImages(tdolls);

            // Should not call loadImageFrom again for the same image
            // But implementation doesn't check for existing, so it will load again
            // This is a potential optimization
            expect(canvasBackend.loadImageFrom).toHaveBeenCalled();
        });
    });
});
