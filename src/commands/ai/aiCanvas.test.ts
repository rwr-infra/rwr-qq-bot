import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiCanvas } from './aiCanvas';

// Mock canvas backend to avoid loading native skia renderer
vi.mock('../../services/canvasBackend', () => ({
    createCanvas: vi.fn().mockImplementation(() => ({
        getContext: vi.fn().mockReturnValue({
            fillStyle: '',
            strokeStyle: '',
            font: '',
            textAlign: '',
            textBaseline: '',
            fillRect: vi.fn(),
            fillText: vi.fn(),
            measureText: vi.fn().mockReturnValue({ width: 10 }),
            rect: vi.fn(),
            stroke: vi.fn(),
            drawImage: vi.fn(),
        }),
        toBufferSync: vi.fn().mockReturnValue(Buffer.from('fake-png')),
    })),
    toPngBuffer: vi.fn().mockReturnValue(Buffer.from('fake-png')),
    loadImageFrom: vi.fn().mockResolvedValue({ width: 200, height: 200 }),
}));

// Mock canvas fonts to return deterministic font strings
vi.mock('../../services/canvasFonts', () => ({
    buildCanvasFont: vi.fn().mockImplementation((size: number) => `bold ${size}pt TestFont`),
    CANVAS_FONT_FAMILY: 'TestFont',
    initCanvasFonts: vi.fn(),
}));

// Mock CanvasImgService so renderBgImg is a no-op
vi.mock('../../services/canvasImg.service', () => ({
    CanvasImgService: {
        getInstance: vi.fn().mockReturnValue({
            getImg: vi.fn().mockReturnValue(null),
            addImg: vi.fn().mockResolvedValue(undefined),
        }),
    },
}));

// Mock fs to avoid actual disk writes
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn().mockReturnValue(true),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
    },
    existsSync: vi.fn().mockReturnValue(true),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
}));

describe('AiCanvas', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create an instance with query, content, and fileName', () => {
            const canvas = new AiCanvas('What is RWR?', 'RWR is a game.', 'ai-123.png');
            expect(canvas).toBeInstanceOf(AiCanvas);
        });

        it('should create instance with empty query and content', () => {
            const canvas = new AiCanvas('', '', 'ai-empty.png');
            expect(canvas).toBeInstanceOf(AiCanvas);
        });
    });

    describe('render', () => {
        it('should return a file path string', () => {
            const canvas = new AiCanvas('test query', 'test answer', 'ai-test.png');
            const result = canvas.render();
            expect(typeof result).toBe('string');
            expect(result).toContain('ai-test.png');
        });

        it('should call createCanvas twice (once for measurement, once for rendering)', async () => {
            const { createCanvas } = await import('../../services/canvasBackend');
            const canvas = new AiCanvas('query', 'content', 'ai-file.png');
            canvas.render();
            expect(createCanvas).toHaveBeenCalledTimes(2);
        });

        it('should call fillRect for layout background', async () => {
            const { createCanvas } = await import('../../services/canvasBackend');
            const mockContext = {
                fillStyle: '',
                strokeStyle: '',
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: vi.fn(),
                fillText: vi.fn(),
                measureText: vi.fn().mockReturnValue({ width: 10 }),
                rect: vi.fn(),
                stroke: vi.fn(),
                drawImage: vi.fn(),
            };
            vi.mocked(createCanvas).mockReturnValue({
                getContext: vi.fn().mockReturnValue(mockContext),
                toBufferSync: vi.fn().mockReturnValue(Buffer.from('png')),
            } as any);

            const canvas = new AiCanvas('hi', 'answer text', 'ai-test.png');
            canvas.render();

            expect(mockContext.fillRect).toHaveBeenCalled();
        });

        it('should call fillText with title AI 智能问答', async () => {
            const { createCanvas } = await import('../../services/canvasBackend');
            const fillTextCalls: Array<[string, number, number]> = [];
            const mockContext = {
                fillStyle: '',
                strokeStyle: '',
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: vi.fn(),
                fillText: vi.fn().mockImplementation((text: string, x: number, y: number) => {
                    fillTextCalls.push([text, x, y]);
                }),
                measureText: vi.fn().mockReturnValue({ width: 10 }),
                rect: vi.fn(),
                stroke: vi.fn(),
                drawImage: vi.fn(),
            };
            vi.mocked(createCanvas).mockReturnValue({
                getContext: vi.fn().mockReturnValue(mockContext),
                toBufferSync: vi.fn().mockReturnValue(Buffer.from('png')),
            } as any);

            const canvas = new AiCanvas('my question', 'my answer', 'ai-out.png');
            canvas.render();

            const texts = fillTextCalls.map(([t]) => t);
            expect(texts).toContain('AI 智能问答');
        });

        it('should call fillText with section header [回答内容]', async () => {
            const { createCanvas } = await import('../../services/canvasBackend');
            const fillTextCalls: string[] = [];
            const mockContext = {
                fillStyle: '',
                strokeStyle: '',
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: vi.fn(),
                fillText: vi.fn().mockImplementation((text: string) => {
                    fillTextCalls.push(text);
                }),
                measureText: vi.fn().mockReturnValue({ width: 10 }),
                rect: vi.fn(),
                stroke: vi.fn(),
                drawImage: vi.fn(),
            };
            vi.mocked(createCanvas).mockReturnValue({
                getContext: vi.fn().mockReturnValue(mockContext),
                toBufferSync: vi.fn().mockReturnValue(Buffer.from('png')),
            } as any);

            const canvas = new AiCanvas('question', 'answer', 'ai-out.png');
            canvas.render();

            expect(fillTextCalls).toContain('[回答内容]');
        });

        it('should call stroke() to draw the content border rectangle', async () => {
            const { createCanvas } = await import('../../services/canvasBackend');
            const mockContext = {
                fillStyle: '',
                strokeStyle: '',
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: vi.fn(),
                fillText: vi.fn(),
                measureText: vi.fn().mockReturnValue({ width: 10 }),
                rect: vi.fn(),
                stroke: vi.fn(),
                drawImage: vi.fn(),
            };
            vi.mocked(createCanvas).mockReturnValue({
                getContext: vi.fn().mockReturnValue(mockContext),
                toBufferSync: vi.fn().mockReturnValue(Buffer.from('png')),
            } as any);

            const canvas = new AiCanvas('q', 'a', 'ai-border.png');
            canvas.render();

            expect(mockContext.stroke).toHaveBeenCalled();
            expect(mockContext.rect).toHaveBeenCalled();
        });

        it('should handle multiline content by wrapping at newlines', async () => {
            const { createCanvas } = await import('../../services/canvasBackend');
            const fillTextCalls: string[] = [];
            const mockContext = {
                fillStyle: '',
                strokeStyle: '',
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: vi.fn(),
                fillText: vi.fn().mockImplementation((text: string) => {
                    fillTextCalls.push(text);
                }),
                measureText: vi.fn().mockReturnValue({ width: 10 }),
                rect: vi.fn(),
                stroke: vi.fn(),
                drawImage: vi.fn(),
            };
            vi.mocked(createCanvas).mockReturnValue({
                getContext: vi.fn().mockReturnValue(mockContext),
                toBufferSync: vi.fn().mockReturnValue(Buffer.from('png')),
            } as any);

            const multilineContent = 'First line\nSecond line\nThird line';
            const canvas = new AiCanvas('q', multilineContent, 'ai-multi.png');
            canvas.render();

            // Each line should appear as a fillText call
            expect(fillTextCalls).toContain('First line');
            expect(fillTextCalls).toContain('Second line');
            expect(fillTextCalls).toContain('Third line');
        });

        it('should wrap long content lines when measureText exceeds maxWidth', async () => {
            const { createCanvas } = await import('../../services/canvasBackend');
            // measureText returns width = charCount * 100, triggering wrap
            const mockContext = {
                fillStyle: '',
                strokeStyle: '',
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: vi.fn(),
                fillText: vi.fn(),
                measureText: vi.fn().mockImplementation((text: string) => ({ width: text.length * 100 })),
                rect: vi.fn(),
                stroke: vi.fn(),
                drawImage: vi.fn(),
            };
            vi.mocked(createCanvas).mockReturnValue({
                getContext: vi.fn().mockReturnValue(mockContext),
                toBufferSync: vi.fn().mockReturnValue(Buffer.from('png')),
            } as any);

            // With width per char = 100, maxWidth = 740 (800-40-20), chars per line = 7
            const longContent = 'ABCDEFGHIJKLMNOP'; // 16 chars, should wrap
            const canvas = new AiCanvas('q', longContent, 'ai-wrap.png');
            expect(() => canvas.render()).not.toThrow();
        });

        it('should render query in subtitle with ellipsis when it is short enough', async () => {
            const { createCanvas } = await import('../../services/canvasBackend');
            const fillTextCalls: string[] = [];
            const mockContext = {
                fillStyle: '',
                strokeStyle: '',
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: vi.fn(),
                fillText: vi.fn().mockImplementation((text: string) => {
                    fillTextCalls.push(text);
                }),
                measureText: vi.fn().mockReturnValue({ width: 10 }),
                rect: vi.fn(),
                stroke: vi.fn(),
                drawImage: vi.fn(),
            };
            vi.mocked(createCanvas).mockReturnValue({
                getContext: vi.fn().mockReturnValue(mockContext),
                toBufferSync: vi.fn().mockReturnValue(Buffer.from('png')),
            } as any);

            const canvas = new AiCanvas('short query', 'content', 'ai-subtitle.png');
            canvas.render();

            expect(fillTextCalls).toContain('short query');
        });

        it('should truncate query with ellipsis when measureText exceeds available width', async () => {
            const { createCanvas } = await import('../../services/canvasBackend');
            const fillTextCalls: string[] = [];
            // First call for label returns small width, query returns large width
            let callCount = 0;
            const mockContext = {
                fillStyle: '',
                strokeStyle: '',
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: vi.fn(),
                fillText: vi.fn().mockImplementation((text: string) => {
                    fillTextCalls.push(text);
                }),
                measureText: vi.fn().mockImplementation((text: string) => {
                    // label '用户输入: ' should be small; everything else huge
                    if (text === '用户输入: ') return { width: 50 };
                    if (text.endsWith('...')) return { width: 30 }; // make ellipsis fit
                    return { width: text.length * 200 }; // very wide
                }),
                rect: vi.fn(),
                stroke: vi.fn(),
                drawImage: vi.fn(),
            };
            vi.mocked(createCanvas).mockReturnValue({
                getContext: vi.fn().mockReturnValue(mockContext),
                toBufferSync: vi.fn().mockReturnValue(Buffer.from('png')),
            } as any);

            const canvas = new AiCanvas('a very long query string that should be truncated', 'content', 'ai-ellipsis.png');
            canvas.render();

            const hasEllipsis = fillTextCalls.some((t) => t.endsWith('...'));
            expect(hasEllipsis).toBe(true);
        });

        it('should not throw for empty query and empty content', () => {
            const canvas = new AiCanvas('', '', 'ai-empty.png');
            expect(() => canvas.render()).not.toThrow();
        });

        it('should write file with the provided fileName', () => {
            const canvas = new AiCanvas('q', 'a', 'ai-user456.png');
            const result = canvas.render();
            expect(result).toContain('ai-user456.png');
        });
    });
});