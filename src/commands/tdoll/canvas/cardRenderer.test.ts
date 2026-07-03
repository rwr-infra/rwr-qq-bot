import { describe, expect, it } from 'vitest';
import { TDollCategoryEnum } from '../types/enums';
import { ITDollDataItem } from '../types/types';
import {
    TDOLL_CLASS_BADGE,
    buildCardModel,
    computeCardGridLayout,
} from './cardRenderer';

describe('computeCardGridLayout', () => {
    it.concurrent('1-3 items use a single column', () => {
        expect(computeCardGridLayout(1)).toEqual({ cols: 1, rows: 1 });
        expect(computeCardGridLayout(3)).toEqual({ cols: 1, rows: 3 });
    });

    it.concurrent('4+ items use two columns', () => {
        expect(computeCardGridLayout(4)).toEqual({ cols: 2, rows: 2 });
        expect(computeCardGridLayout(5)).toEqual({ cols: 2, rows: 3 });
        expect(computeCardGridLayout(10)).toEqual({ cols: 2, rows: 5 });
    });

    it.concurrent('0 items still reserve one row', () => {
        expect(computeCardGridLayout(0)).toEqual({ cols: 1, rows: 1 });
    });
});

describe('TDOLL_CLASS_BADGE', () => {
    it.concurrent('covers all six tdoll classes', () => {
        for (const cls of Object.values(TDollCategoryEnum)) {
            expect(TDOLL_CLASS_BADGE[cls]).toBeDefined();
            expect(TDOLL_CLASS_BADGE[cls].fg).toMatch(/^#/);
            expect(TDOLL_CLASS_BADGE[cls].bg).toMatch(/^rgba\(/);
        }
    });
});

describe('buildCardModel', () => {
    it.concurrent('maps tdoll fields', () => {
        const tdoll = {
            id: '55',
            nameIngame: 'M4A1',
            type: '突击步枪',
            tdollClass: TDollCategoryEnum.AR,
            mod: '1',
        } as ITDollDataItem;

        expect(buildCardModel(tdoll, 'm4')).toEqual({
            id: '55',
            name: 'M4A1',
            typeText: '突击步枪',
            tdollClass: TDollCategoryEnum.AR,
            isMod: true,
            query: 'm4',
        });
    });
});
