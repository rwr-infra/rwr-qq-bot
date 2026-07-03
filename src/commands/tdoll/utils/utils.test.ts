import { describe, expect, it } from 'vitest';
import { ITDollDataItem } from '../types/types';
import { getMatchedTDollData, getMatchedTDollDataWithCategory } from './utils';
import { TDollCategoryEnum } from '../types/enums';

const MOCK_DATA: ITDollDataItem[] = [
    {
        tileEffect1Time: '18%',
        skill1: '',
        tileEffect1: '伤害',
        baseEva: '48',
        tdollClass: TDollCategoryEnum.AR,
        timeStamp: '1463702400',
        productionTime: '03:35:00',
        nameIngame: 'M4A1',
        baseAcc: '48',
        baseRate: '79',
        mod: '1',
        baseArmor: '0',
        baseAtk: '46',
        url: '/w/M4A1',
        type: '突击步枪',
        avatar: 'https://www.gfwiki.org/images/3/38/Icon_No.55.png',
        baseHp: '110',
        tileEffect2: '暴击率',
        tilesAffect: '突击步枪',
        obtainMethod: '可随主线剧情进度获得',
        tiles: '0,1,1,0,2,1,0,1,1',
        rarity: '4',
        id: '55',
        tileEffect2Time: '30%',
        modtileEffect1Time: '20%',
        modEva: '50',
        avatarMod: 'https://www.gfwiki.org/images/a/a7/Icon_No.55_Mod.png',
        modAcc: '50',
        modRate: '80',
        modAtk: '48',
        modArmor: '0',
        modRarity: '5',
        tilesAffectMod: '突击步枪',
        modHp: '113',
        modtileEffect2Time: '20%',
        tilesMod: '0,1,1,0,2,1,0,1,1',
    },
    {
        tileEffect1Time: '10%',
        skill1: '',
        tileEffect1: '伤害',
        baseEva: '44',
        tdollClass: TDollCategoryEnum.AR,
        timeStamp: '1463702400',
        productionTime: '03:35:00',
        nameIngame: 'M16A1',
        baseAcc: '46',
        baseRate: '75',
        mod: '0',
        baseArmor: '0',
        baseAtk: '47',
        url: '/w/M16A1',
        type: '突击步枪',
        avatar: 'https://www.gfwiki.org/images/0/0d/Icon_No.54.png',
        baseHp: '121',
        tileEffect2: '回避',
        tilesAffect: '冲锋枪',
        obtainMethod: '可随主线剧情进度获得',
        tiles: '0,1,1,0,2,0,0,1,1',
        rarity: '4',
        id: '54',
        tileEffect2Time: '12%',
    },
    {
        tileEffect1Time: '18%',
        skill1: '',
        tileEffect1: '技能冷却速度',
        baseEva: '29',
        tdollClass: TDollCategoryEnum.RF,
        timeStamp: '1463702400',
        productionTime: '04:45:00',
        nameIngame: 'NTW-20',
        baseAcc: '75',
        baseRate: '30',
        mod: '1',
        baseArmor: '0',
        baseAtk: '165',
        url: '/w/NTW-20',
        type: '步枪',
        avatar: 'https://www.gfwiki.org/images/2/2e/Icon_No.53.png',
        baseHp: '93',
        tileEffect2: '',
        tilesAffect: '手枪',
        obtainMethod:
            '可通过常规制造获取/可通过重型制造获取/可在通常战役中救援获得',
        tiles: '0,0,0,0,2,1,0,0,0',
        rarity: '5',
        id: '53',
        tileEffect2Time: '',
        modtileEffect1Time: '20%',
        modEva: '31',
        avatarMod: 'https://www.gfwiki.org/images/8/80/Icon_No.53_Mod.png',
        modAcc: '78',
        modRate: '31',
        modAtk: '170',
        modArmor: '0',
        modRarity: '6',
        tilesAffectMod: '手枪',
        modHp: '95',
        modtileEffect2Time: '',
        tilesMod: '0,0,1,0,2,1,0,0,0',
    },
];

describe('tdoll: getMatchedTDollData', () => {
    it.concurrent('query not found', () => {
        expect(getMatchedTDollData(MOCK_DATA, 'MMMM')).toEqual([]);
    });

    it.concurrent('exact match', () => {
        const res = getMatchedTDollData(MOCK_DATA, 'M16A1');

        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('54');
    });

    it.concurrent('ignore case', () => {
        const res = getMatchedTDollData(MOCK_DATA, 'm4a1');

        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('55');
    });

    it.concurrent('ignore "-"', () => {
        const res = getMatchedTDollData(MOCK_DATA, 'ntw20');

        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('53');
    });

    it.concurrent('fuzzy match multiple, sorted by match position', () => {
        const res = getMatchedTDollData(MOCK_DATA, 'M');

        expect(res.map((d) => d.id)).toEqual(['55', '54']);
    });

    it.concurrent('random key returns exactly one item', () => {
        const res = getMatchedTDollData(MOCK_DATA, 'random');

        expect(res).toHaveLength(1);
        expect(MOCK_DATA).toContainEqual(res[0]);
    });
});

describe('tdoll: getMatchedTDollDataWithCategory', () => {
    it.concurrent('category in first param', () => {
        const res = getMatchedTDollDataWithCategory(MOCK_DATA, 'AR', 'm4');

        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('55');
    });

    it.concurrent('category in second param (switched)', () => {
        const res = getMatchedTDollDataWithCategory(MOCK_DATA, 'm4', 'AR');

        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('55');
    });

    it.concurrent('chinese category', () => {
        const res = getMatchedTDollDataWithCategory(
            MOCK_DATA,
            '突击步枪',
            'm4',
        );

        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('55');
    });

    it.concurrent('category filters other classes', () => {
        const res = getMatchedTDollDataWithCategory(MOCK_DATA, 'AR', 'M');

        expect(res.map((d) => d.id)).toEqual(['55', '54']);
    });

    it.concurrent('invalid category returns empty', () => {
        expect(getMatchedTDollDataWithCategory(MOCK_DATA, 'AX', 'm4')).toEqual(
            [],
        );
    });

    it.concurrent('no match within category returns empty', () => {
        expect(
            getMatchedTDollDataWithCategory(MOCK_DATA, 'AR', 'm11111'),
        ).toEqual([]);
    });
});
