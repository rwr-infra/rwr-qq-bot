import { describe, expect, it } from 'vitest';
import { ITDollSkinDataItem } from '../types/types';
import {
    SKIN_CELL_H,
    SKIN_GRID_GAP,
    buildSkinGridItems,
    measureSkinGridHeight,
} from './skinGridRenderer';

const buildSkin = (index: number, withImage = true) => ({
    index,
    title: `skin-${index}`,
    value: String(index),
    ...(withImage
        ? {
              image: {
                  anime: '',
                  line: '',
                  name: `skin-${index}`,
                  pic: `/images/skin-${index}.png`,
                  pic_d: '',
                  pic_d_h: '',
                  pic_h: '',
              },
          }
        : {}),
});

describe('buildSkinGridItems', () => {
    it.concurrent('maps complete items with seq = index + 1', () => {
        const skins: ITDollSkinDataItem = [buildSkin(0), buildSkin(1)];

        expect(buildSkinGridItems(skins)).toEqual([
            {
                seq: 1,
                title: 'skin-0',
                value: '0',
                pic: '/images/skin-0.png',
            },
            {
                seq: 2,
                title: 'skin-1',
                value: '1',
                pic: '/images/skin-1.png',
            },
        ]);
    });

    it.concurrent('filters items without image', () => {
        const skins: ITDollSkinDataItem = [buildSkin(0, false), buildSkin(1)];

        expect(buildSkinGridItems(skins).map((s) => s.value)).toEqual(['1']);
    });

    it.concurrent('empty/undefined input returns []', () => {
        expect(buildSkinGridItems(undefined)).toEqual([]);
        expect(buildSkinGridItems([])).toEqual([]);
    });
});

describe('measureSkinGridHeight', () => {
    it.concurrent('0 items reserve the empty hint row', () => {
        expect(measureSkinGridHeight(0)).toBe(40);
    });

    it.concurrent('1-3 items are one row', () => {
        expect(measureSkinGridHeight(1)).toBe(SKIN_CELL_H);
        expect(measureSkinGridHeight(3)).toBe(SKIN_CELL_H);
    });

    it.concurrent('4 items wrap to two rows', () => {
        expect(measureSkinGridHeight(4)).toBe(
            SKIN_CELL_H * 2 + SKIN_GRID_GAP,
        );
    });
});
