import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    BaseCanvas,
    CanvasFileWriter,
    CanvasSize,
} from './baseCanvas';
import type { Canvas2DContext, CanvasLike } from './canvasBackend';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 具体子类——BaseCanvas 现为抽象模板，测试通过最小实现驱动其生命周期。
 */
class TestCanvas extends BaseCanvas {
    measureCalls = 0;
    paintCalls = 0;
    paintedSize?: CanvasSize;

    constructor(deps?: { fileWriter?: CanvasFileWriter }) {
        super(deps);
    }

    protected measure(): CanvasSize {
        this.measureCalls += 1;
        return { width: 20, height: 20 };
    }

    protected paint(_ctx: Canvas2DContext, size: CanvasSize): number {
        this.paintCalls += 1;
        this.paintedSize = size;
        return 12;
    }

    protected getFileName(): string {
        return 'basecanvas-test.png';
    }
}

describe('BaseCanvas', () => {
    let baseCanvas: TestCanvas;
    let mockCtx: Canvas2DContext;
    let mockCanvas: CanvasLike;

    beforeEach(() => {
        baseCanvas = new TestCanvas();

        mockCtx = {
            fillStyle: '',
            font: '',
            textAlign: 'left',
            fillRect: vi.fn(),
            fillText: vi.fn(),
            measureText: vi.fn().mockReturnValue({ width: 0 }),
        } as any;

        mockCanvas = {
            toBufferSync: vi.fn().mockReturnValue(Buffer.from('test')),
            getContext: vi.fn().mockReturnValue(mockCtx),
        } as any;
    });

    it('should initialize correctly', () => {
        expect(baseCanvas).toBeInstanceOf(BaseCanvas);
        expect(baseCanvas.startTime).toBeUndefined();
        expect(baseCanvas.totalFooter).toBe('');
        expect(baseCanvas.renderStartY).toBe(0);
    });

    describe('calcCanvasTextWidth', () => {
        it('should calculate width for English text', () => {
            const width = baseCanvas.calcCanvasTextWidth('test', 10);
            expect(width).toBe(40);
        });

        it('should calculate width for Chinese text', () => {
            const width = baseCanvas.calcCanvasTextWidth('测试', 10);
            expect(width).toBe(40);
        });

        it('should calculate width for mixed text', () => {
            const width = baseCanvas.calcCanvasTextWidth('test测试', 10);
            expect(width).toBe(80);
        });
    });

    describe('renderFooter', () => {
        it('should render footer text correctly', () => {
            baseCanvas.renderStartY = 100;
            baseCanvas.record();
            baseCanvas.renderFooter(mockCtx);
            expect(baseCanvas.totalFooter).toContain('RWR QQ Bot');
        });
    });

    describe('record', () => {
        it('should record start time', () => {
            baseCanvas.record();
            expect(baseCanvas.startTime).toBeDefined();
        });
    });

    describe('writeFile', () => {
        it('should write file correctly (default fs writer)', () => {
            const fileName = `baseCanvas-test-${Date.now()}.png`;
            const result = baseCanvas.writeFile(mockCanvas, fileName);
            expect(result).toContain(fileName);
            expect(fs.existsSync(result)).toBe(true);
            fs.unlinkSync(result);
        });
    });

    describe('render() template + FileWriter seam', () => {
        it('runs the full lifecycle and delegates writing to the injected writer (no fs)', async () => {
            const writes: Array<{ fileName: string }> = [];
            const fakeWriter: CanvasFileWriter = {
                write: (_canvas, fileName) => {
                    writes.push({ fileName });
                    return `/virtual/out/${fileName}`;
                },
            };
            const canvas = new TestCanvas({ fileWriter: fakeWriter });
            const result = await canvas.render();

            // 返回注入 writer 的路径，且未触盘(默认 fs writer 会写到 out/basecanvas-test.png)
            expect(result).toBe('/virtual/out/basecanvas-test.png');
            expect(writes).toEqual([{ fileName: 'basecanvas-test.png' }]);
            expect(
                fs.existsSync(
                    path.join(process.cwd(), 'out', 'basecanvas-test.png'),
                ),
            ).toBe(false);

            // 模板依次驱动 measure/paint，并把 paint 的返回值写入 renderStartY
            expect(canvas.measureCalls).toBe(1);
            expect(canvas.paintCalls).toBe(1);
            expect(canvas.paintedSize).toEqual({ width: 20, height: 20 });
            expect(canvas.renderStartY).toBe(12);
            expect(canvas.startTime).toBeDefined();
        });

        it('wraps render errors as IMAGE_RENDER_FAILED with scene + fileName', async () => {
            class ThrowingCanvas extends TestCanvas {
                protected paint(): number {
                    throw new Error('boom');
                }
                protected getRenderScene(): string {
                    return 'test:scene';
                }
            }

            const canvas = new ThrowingCanvas({
                fileWriter: { write: () => '/virtual/x.png' },
            });

            await expect(canvas.render()).rejects.toMatchObject({
                code: 'IMAGE_RENDER_FAILED',
                context: {
                    scene: 'test:scene',
                    fileName: 'basecanvas-test.png',
                },
            });
        });
    });
});
