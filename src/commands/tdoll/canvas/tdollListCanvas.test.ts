import { describe, expect, it, vi } from 'vitest';
import { TDollCategoryEnum } from '../types/enums';
import { ITDollDataItem } from '../types/types';

// Mock canvas backend to avoid loading native renderer.
vi.mock('../../../services/canvasBackend', () => {
    const buildContext = () => ({
        fillStyle: '',
        strokeStyle: '',
        font: '',
        textAlign: 'left',
        textBaseline: 'top',
        fillRect: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 50 }),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        clip: vi.fn(),
        drawImage: vi.fn(),
    });

    return {
        createCanvas: vi.fn().mockImplementation(() => ({
            getContext: vi.fn().mockImplementation(buildContext),
            toBufferSync: vi.fn().mockReturnValue(Buffer.from('test')),
        })),
        loadImageFrom: vi.fn().mockResolvedValue({ width: 48, height: 48 }),
        toPngBuffer: vi
            .fn()
            .mockImplementation((canvas: any) => canvas.toBufferSync('png')),
    };
});

import { TDollListCanvas } from './tdollListCanvas';

const buildTdoll = (id: string, name: string): ITDollDataItem =>
    ({
        id,
        nameIngame: name,
        type: '突击步枪',
        tdollClass: TDollCategoryEnum.AR,
        mod: '0',
        avatar: `https://example.com/${id}.png`,
    }) as ITDollDataItem;

describe('TDollListCanvas', () => {
    it('renders a single-column list and writes the given file name', async () => {
        const fileName = `test_tdoll_list_single_${process.pid}.png`;
        const canvas = new TDollListCanvas(
            'm4',
            [buildTdoll('55', 'M4A1')],
            fileName,
        );

        const outputPath = await canvas.render();

        expect(outputPath.endsWith(fileName)).toBe(true);
    });

    it('renders a two-column list without throwing', async () => {
        const tdolls = ['1', '2', '3', '4', '5'].map((id) =>
            buildTdoll(id, `Doll-${id}`),
        );
        const fileName = `test_tdoll_list_double_${process.pid}.png`;

        const outputPath = await new TDollListCanvas(
            'doll',
            tdolls,
            fileName,
        ).render();

        expect(outputPath.endsWith(fileName)).toBe(true);
    });

    it('renders a large list beyond the old 10-item cap without throwing', async () => {
        const tdolls = Array.from({ length: 23 }, (_, i) =>
            buildTdoll(String(i), `Doll-${i}`),
        );
        const fileName = `test_tdoll_list_large_${process.pid}.png`;

        const outputPath = await new TDollListCanvas(
            'doll',
            tdolls,
            fileName,
        ).render();

        expect(outputPath.endsWith(fileName)).toBe(true);
    });
});
