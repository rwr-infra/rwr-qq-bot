import { describe, expect, it, vi } from 'vitest';
import { TDollCategoryEnum } from '../types/enums';
import { ITDollDataItem, ITDollSkinDataItem } from '../types/types';

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
        loadImageFrom: vi.fn().mockResolvedValue({ width: 150, height: 150 }),
        toPngBuffer: vi
            .fn()
            .mockImplementation((canvas: any) => canvas.toBufferSync('png')),
    };
});

import { TDollDetailCanvas } from './tdollDetailCanvas';

const MOCK_TDOLL = {
    id: '1',
    nameIngame: 'M1873',
    type: '手枪',
    tdollClass: TDollCategoryEnum.HG,
    mod: '0',
    avatar: 'https://example.com/1.png',
} as ITDollDataItem;

const MOCK_RECORD: Record<string, ITDollSkinDataItem> = {
    '1': [
        {
            index: 0,
            title: '默认立绘',
            value: '0',
            image: {
                anime: '',
                line: '',
                name: '默认立绘',
                pic: 'https://example.com/skin-0.png',
                pic_d: '',
                pic_d_h: '',
                pic_h: '',
            },
        },
        {
            index: 1,
            title: '心智升级',
            value: 'mod',
            image: {
                anime: '',
                line: '',
                name: '心智升级',
                pic: 'https://example.com/skin-mod.png',
                pic_d: '',
                pic_d_h: '',
                pic_h: '',
            },
        },
    ],
};

describe('TDollDetailCanvas', () => {
    it('renders data card + skin grid and writes the given file name', async () => {
        const fileName = `test_tdoll_detail_${process.pid}.png`;

        const outputPath = await new TDollDetailCanvas(
            '1',
            [MOCK_TDOLL],
            MOCK_RECORD,
            fileName,
        ).render();

        expect(outputPath.endsWith(fileName)).toBe(true);
    });

    it('renders a degraded card when tdoll data is missing', async () => {
        const fileName = `test_tdoll_detail_degraded_${process.pid}.png`;

        const outputPath = await new TDollDetailCanvas(
            '999',
            [],
            { '999': MOCK_RECORD['1'] },
            fileName,
        ).render();

        expect(outputPath.endsWith(fileName)).toBe(true);
    });

    it('renders empty-skin hint when record has no entry', async () => {
        const fileName = `test_tdoll_detail_empty_${process.pid}.png`;

        const outputPath = await new TDollDetailCanvas(
            '1',
            [MOCK_TDOLL],
            {},
            fileName,
        ).render();

        expect(outputPath.endsWith(fileName)).toBe(true);
    });
});
