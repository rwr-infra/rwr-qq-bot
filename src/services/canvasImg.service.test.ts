import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasImgService } from './canvasImg.service';

vi.mock('./canvasBackend', () => ({
    loadImageFrom: vi.fn().mockResolvedValue({
        width: 1920,
        height: 1080,
    }),
}));

describe('CanvasImgService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        CanvasImgService.resetInstance();
    });

    afterEach(() => {
        CanvasImgService.resetInstance();
        vi.useRealTimers();
    });

    it('keeps persistent image after ttl', async () => {
        const service = CanvasImgService.getInstance({
            cacheTTL: 100,
            cleanupInterval: 50,
        });

        await service.addImg('/tmp/bg.png', true);
        vi.advanceTimersByTime(10_000);

        expect(service.getImg('/tmp/bg.png')).toBeDefined();
    });

    it('expires non-persistent image after ttl', async () => {
        const service = CanvasImgService.getInstance({
            cacheTTL: 100,
            cleanupInterval: 50,
        });

        await service.addImg('/tmp/normal.png');
        vi.advanceTimersByTime(10_000);

        expect(service.getImg('/tmp/normal.png')).toBeUndefined();
    });
});
