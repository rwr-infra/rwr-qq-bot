import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AsyncCacheService } from './asyncCache.service';

describe('AsyncCacheService', () => {
    let service: AsyncCacheService<string>;
    const mockFetchData = vi.fn();

    beforeEach(() => {
        vi.useFakeTimers();
        mockFetchData.mockReset();
        service = new AsyncCacheService<string>();
        service.fetchData = mockFetchData;
    });

    describe('updateCache', () => {
        it('should update cache data and lastUpdatedTime', async () => {
            const testData = 'test data';
            mockFetchData.mockResolvedValue(testData);

            await service.updateCache();

            expect(service.cacheData).toBe(testData);
            expect(service.lastUpdatedTime).toBeDefined();
        });
    });

    describe('updateCheck', () => {
        it('should return true when cache is expired', () => {
            service.cacheTime = 1000 * 60;
            service.lastUpdatedTime = Date.now() - 2 * 60 * 1000;

            expect(service.updateCheck()).toBe(true);
        });

        it('should return false when cache is not expired', () => {
            service.cacheTime = 1000 * 60;
            service.lastUpdatedTime = Date.now() - 30 * 1000;

            expect(service.updateCheck()).toBe(false);
        });

        it('should return true when lastUpdatedTime is undefined', () => {
            service.lastUpdatedTime = undefined;

            expect(service.updateCheck()).toBe(true);
        });
    });

    describe('getData', () => {
        it('should return cached data without fetching when cache is valid', async () => {
            const testData = 'cached data';
            service.cacheData = testData;
            service.cacheTime = 1000 * 60;
            service.lastUpdatedTime = Date.now();

            const result = await service.getData();

            expect(result).toBe(testData);
            expect(mockFetchData).not.toHaveBeenCalled();
        });

        it('should fetch new data when cache is expired', async () => {
            const testData = 'new data';
            mockFetchData.mockResolvedValue(testData);
            service.cacheTime = 1000 * 60;
            service.lastUpdatedTime = Date.now() - 2 * 60 * 1000;

            const result = await service.getData();

            expect(result).toBe(testData);
            expect(mockFetchData).toHaveBeenCalled();
        });
    });
});
