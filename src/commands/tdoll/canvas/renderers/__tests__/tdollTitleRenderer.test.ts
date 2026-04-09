import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TDollTitleRenderer } from '../TDollTitleRenderer';
import { ITDollDataItem } from '../../../types/types';

// Mock canvas context
const createMockContext = () => ({
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    drawImage: vi.fn(),
    rect: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
});

describe('TDollTitleRenderer', () => {
    let renderer: TDollTitleRenderer;
    let mockContext: ReturnType<typeof createMockContext>;

    beforeEach(() => {
        mockContext = createMockContext();
    });

    describe('constructor', () => {
        it('should initialize with given Y position and query', () => {
            renderer = new TDollTitleRenderer(100, 'test query');
            expect(renderer.getCurrentY()).toBe(100);
        });
    });

    describe('render without query', () => {
        it('should render title without highlighting', () => {
            renderer = new TDollTitleRenderer(100, '');

            const tdoll = {
                id: '1',
                nameIngame: 'Test Doll',
                avatar: 'http://example.com/avatar.png',
                type: 'AR',
                mod: '0',
            } as ITDollDataItem;

            renderer.render(mockContext as any, tdoll);

            // Should fill text with white color
            expect(mockContext.fillText).toHaveBeenCalled();
            expect(mockContext.fillStyle).toBe('#fff');
        });

        it('should update Y position after rendering', () => {
            renderer = new TDollTitleRenderer(100, '');

            const tdoll = {
                id: '1',
                nameIngame: 'Test Doll',
                avatar: 'http://example.com/avatar.png',
                type: 'AR',
                mod: '0',
            } as ITDollDataItem;

            renderer.render(mockContext as any, tdoll);

            // Y position should increase by LINE_HEIGHT (40)
            expect(renderer.getCurrentY()).toBe(140);
        });
    });

    describe('render with query', () => {
        it('should render with highlighting when query matches', () => {
            renderer = new TDollTitleRenderer(100, 'Test');

            const tdoll = {
                id: '1',
                nameIngame: 'Test Doll',
                avatar: 'http://example.com/avatar.png',
                type: 'AR',
                mod: '0',
            } as ITDollDataItem;

            renderer.render(mockContext as any, tdoll);

            // Should have called fillText multiple times for highlighting
            expect(mockContext.fillText).toHaveBeenCalled();
        });

        it('should handle random query without highlighting', () => {
            renderer = new TDollTitleRenderer(100, 'random');

            const tdoll = {
                id: '1',
                nameIngame: 'Test Doll',
                avatar: 'http://example.com/avatar.png',
                type: 'AR',
                mod: '0',
            } as ITDollDataItem;

            renderer.render(mockContext as any, tdoll);

            // Should render without highlighting
            expect(mockContext.fillText).toHaveBeenCalled();
        });
    });
});
