import { describe, expect, it } from 'vitest';
import { OnlineServerItem, IMapDataItem } from '../types/types';
import {
    getServerInfoDisplaySectionText,
    getCountColor,
    isServerMatchRegex,
    getMapShortName,
    getUserMatchedList,
    getWhereisHeaderSectionText,
    getWhereisFooterSectionText,
    getPlayersInServer,
    findMapByQuery,
    getServersForMap,
    buildMapDetailReply,
} from './utils';

const MOCK_CT_SERVER_ITEM: OnlineServerItem = {
    name: '[Castling][Storm-7 LV4]',
    address: '221.220.172.215',
    port: 21006,
    map_id: 'media/packages/GFL_Castling/maps/map13_2',
    map_name: '',
    bots: 47,
    country: 'China',
    current_players: 19,
    version: '1.96.1',
    dedicated: true,
    mod: 1,
    player: [
        'RUMI CIVAN',
        'ASTA',
        'MR. QUIEN',
        'RYIA',
        'XZBWZ',
        'BLCOD',
        'AR.',
        'AILE ROZY',
        'D_TAIL',
        'M4SOPMOD',
        'MOYUII',
        'ZZH',
        'LEOCM',
        'SHENYANGKS',
        'ICEYKEY',
        'EAVTA',
        'JON XUE',
        'BORE',
        'EINS',
        'A1',
        'A2',
        'A3',
        'A4',
        'A5',
        'A6',
        'A7',
        'A8',
        'A9',
    ],
    comment:
        'Read server rules in our discord: discord.gg/wwUM3kYmRC, QQ Group: 706234535',
    url: 'https://castling.fandom.com/wiki/Castling_Wiki',
    max_players: 20,
    mode: 'Castling',
    realm: '',
    playersCount: 19,
    timeStamp: 1634176800,
};

describe('isServerMatchRegex', () => {
    it.concurrent('should return true if regex is empty', () => {
        expect(isServerMatchRegex('', MOCK_CT_SERVER_ITEM)).toBe(true);
    });

    it.concurrent('should return true if regex is empty', () => {
        expect(
            isServerMatchRegex(
                `^\\[Castling](\\[Global])?\\[[\\w!\\?]+(-\\d)?\\s(LV\\d|FOV)]`,
                MOCK_CT_SERVER_ITEM
            )
        ).toBe(true);
    });
});

describe('getServerInfoDisplaySectionText', () => {
    it.concurrent('formatted data', () => {
        const res = getServerInfoDisplaySectionText(MOCK_CT_SERVER_ITEM);

        expect(res.serverSection).toBe('[Castling][Storm-7 LV4]: ');
        expect(res.playersSection).toBe('19/20');
        expect(res.mapSection).toBe(' (map13_2)');
    });
});

describe('getServerPlayersCountColor', () => {
    it.concurrent('100%', () => {
        expect(getCountColor(20, 20)).toBe('#ef4444');
    });

    it.concurrent('80%', () => {
        expect(getCountColor(16, 20)).toBe('#f97316');
    });

    it.concurrent('60%', () => {
        expect(getCountColor(12, 20)).toBe('#22c55e');
    });

    it.concurrent('0%', () => {
        expect(getCountColor(0, 20)).toBe('#9ca3af');
    });

    it.concurrent('-1', () => {
        expect(getCountColor(-1, 20)).toBe('#ef4444');
    });
});

describe('getUserMatchedList', () => {
    it.concurrent('no match', () => {
        const res = getUserMatchedList('ABCDEFG', [MOCK_CT_SERVER_ITEM]);

        expect(res.results.length).toBe(0);
        expect(res.total).toBe(0);
    });

    it.concurrent('match, limited', () => {
        const res = getUserMatchedList('AR', [MOCK_CT_SERVER_ITEM]);

        expect(res.results.length).toBe(1);
        expect(res.total).toBe(1);
    });
});

describe('get map name', () => {
    it.concurrent('should return last map path', () => {
        expect(getMapShortName(MOCK_CT_SERVER_ITEM.map_id)).toBe('map13_2');
    });

    it.concurrent('empty data, should return empty string', () => {
        expect(getMapShortName('')).toBe('');
    });

    it.concurrent('/data/maps/ should return empty string', () => {
        expect(getMapShortName('/data/maps/')).toBe('');
    });

    it.concurrent('invalid split, should return full path', () => {
        expect(getMapShortName('media\\packages\\GFL_Castling\\maps\\')).toBe(
            'media\\packages\\GFL_Castling\\maps\\'
        );
    });
});

describe('getWhereisHeaderSectionText', () => {
    it.concurrent('query AAA, total 2', () => {
        const res = getWhereisHeaderSectionText('AAA');

        expect(res.staticSection).toBe('查询 ');
        expect(res.userSection).toBe('AAA');
        expect(res.staticSection2).toBe(' 所在服务器结果:\n');
    });

    it.concurrent('query B', () => {
        const res = getWhereisHeaderSectionText('B');

        expect(res.staticSection).toBe('查询 ');
        expect(res.userSection).toBe('B');
        expect(res.staticSection2).toBe(' 所在服务器结果:\n');
    });

    it.concurrent('query empty', () => {
        const res = getWhereisHeaderSectionText('');

        expect(res.staticSection).toBe('查询 ');
        expect(res.userSection).toBe('');
        expect(res.staticSection2).toBe(' 所在服务器结果:\n');
    });
});

describe('getWhereisFooterSectionText', () => {
    it.concurrent('count 0', () => {
        expect(getWhereisFooterSectionText(0)).toBe('未查询到结果');
    });

    it.concurrent('count 2', () => {
        expect(getWhereisFooterSectionText(2)).toBe(
            '共计 2 位玩家结果'
        );
    });

    it.concurrent('count 999', () => {
        expect(getWhereisFooterSectionText(999)).toBe(
            '共计 999 位玩家结果'
        );
    });
});

describe('getPlayersInServer', () => {
    it.concurrent('should return empty', () => {
        expect(
            getPlayersInServer({
                ...MOCK_CT_SERVER_ITEM,
                player: [],
            })
        ).toEqual([]);

        expect(
            getPlayersInServer({
                ...MOCK_CT_SERVER_ITEM,
                player: undefined,
            })
        ).toEqual([]);
    });

    it.concurrent('should return players', () => {
        expect(getPlayersInServer(MOCK_CT_SERVER_ITEM)).toEqual([
            'RUMI CIVAN',
            'ASTA',
            'MR. QUIEN',
            'RYIA',
            'XZBWZ',
            'BLCOD',
            'AR.',
            'AILE ROZY',
            'D_TAIL',
            'M4SOPMOD',
            'MOYUII',
            'ZZH',
            'LEOCM',
            'SHENYANGKS',
            'ICEYKEY',
            'EAVTA',
            'JON XUE',
            'BORE',
            'EINS',
            'A1',
            'A2',
            'A3',
            'A4',
            'A5',
            'A6',
            'A7',
            'A8',
            'A9',
        ]);
    });
});

const MOCK_MAP_DATA: IMapDataItem[] = [
    { id: 'map105', name: 'Sunset Beach' },
    { id: 'map13_2', name: 'Castling Storm' },
    { id: 'test_map', name: 'Test Arena' },
    { id: 'urban_01', name: 'Urban Warfare' },
    { id: 'urban_02', name: 'Urban Night' },
];

describe('findMapByQuery', () => {
    it.concurrent('exact match by id', () => {
        const result = findMapByQuery('map105', MOCK_MAP_DATA);
        expect(result.type).toBe('exact');
        if (result.type === 'exact') {
            expect(result.map.id).toBe('map105');
        }
    });

    it.concurrent('exact match by name', () => {
        const result = findMapByQuery('Sunset Beach', MOCK_MAP_DATA);
        expect(result.type).toBe('exact');
        if (result.type === 'exact') {
            expect(result.map.id).toBe('map105');
        }
    });

    it.concurrent('fuzzy match single result upgrades to exact', () => {
        const result = findMapByQuery('test', MOCK_MAP_DATA);
        expect(result.type).toBe('exact');
        if (result.type === 'exact') {
            expect(result.map.id).toBe('test_map');
        }
    });

    it.concurrent('fuzzy match multiple results', () => {
        const result = findMapByQuery('urban', MOCK_MAP_DATA);
        expect(result.type).toBe('fuzzy');
        if (result.type === 'fuzzy') {
            expect(result.maps.length).toBe(2);
        }
    });

    it.concurrent('no match', () => {
        const result = findMapByQuery('nonexistent', MOCK_MAP_DATA);
        expect(result.type).toBe('none');
    });

    it.concurrent('case insensitive', () => {
        const result = findMapByQuery('MAP105', MOCK_MAP_DATA);
        expect(result.type).toBe('exact');
        if (result.type === 'exact') {
            expect(result.map.id).toBe('map105');
        }
    });

    it.concurrent('case insensitive name', () => {
        const result = findMapByQuery('sunset beach', MOCK_MAP_DATA);
        expect(result.type).toBe('exact');
        if (result.type === 'exact') {
            expect(result.map.id).toBe('map105');
        }
    });
});

describe('getServersForMap', () => {
    const mockServers: OnlineServerItem[] = [
        {
            ...MOCK_CT_SERVER_ITEM,
            name: 'Server A',
            map_id: 'media/packages/GFL_Castling/maps/map13_2',
            current_players: 5,
            max_players: 20,
        },
        {
            ...MOCK_CT_SERVER_ITEM,
            name: 'Server B',
            map_id: 'media/packages/GFL_Castling/maps/map13_2',
            current_players: 15,
            max_players: 32,
        },
        {
            ...MOCK_CT_SERVER_ITEM,
            name: 'Server C',
            map_id: 'media/packages/other/maps/map105',
            current_players: 10,
            max_players: 20,
        },
    ];

    it.concurrent('returns matching servers sorted by players desc', () => {
        const result = getServersForMap('map13_2', mockServers);
        expect(result.length).toBe(2);
        expect(result[0].name).toBe('Server B');
        expect(result[1].name).toBe('Server A');
    });

    it.concurrent('returns empty for no match', () => {
        const result = getServersForMap('nonexistent', mockServers);
        expect(result.length).toBe(0);
    });
});

describe('buildMapDetailReply', () => {
    const mockMap: IMapDataItem = { id: 'map105', name: 'Sunset Beach' };

    it.concurrent('with servers and image URL', () => {
        const servers: OnlineServerItem[] = [
            {
                ...MOCK_CT_SERVER_ITEM,
                name: 'Server A',
                current_players: 10,
                max_players: 20,
            },
        ];
        const reply = buildMapDetailReply(
            mockMap,
            servers,
            'http://example.com/map105.png',
        );
        expect(reply).toContain('📍 地图: Sunset Beach (map105)');
        expect(reply).toContain('Server A  | 10/20 玩家 | 在线');
        expect(reply).toContain('共 1 个服务器正在运行此地图');
        expect(reply).toContain('[CQ:image,file=http://example.com/map105.png');
    });

    it.concurrent('with no servers and no image URL', () => {
        const reply = buildMapDetailReply(mockMap, []);
        expect(reply).toContain('📍 地图: Sunset Beach (map105)');
        expect(reply).toContain('当前没有服务器正在运行此地图');
        expect(reply).toContain('共 0 个服务器正在运行此地图');
        expect(reply).not.toContain('[CQ:image');
    });

    it.concurrent('full server shows 已满', () => {
        const servers: OnlineServerItem[] = [
            {
                ...MOCK_CT_SERVER_ITEM,
                name: 'Full Server',
                current_players: 20,
                max_players: 20,
            },
        ];
        const reply = buildMapDetailReply(mockMap, servers);
        expect(reply).toContain('Full Server  | 20/20 玩家 | 已满');
    });
});
