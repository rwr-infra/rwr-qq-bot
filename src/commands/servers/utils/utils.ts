import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import type { Nullable } from '../../../types';
import { logger } from '../../../utils/logger';
import { createHttpClient } from '../../../utils/httpClient';
import type {
    Res,
    ResServerItem,
    OnlineServerItem,
    IUserMatchedServerItem,
    IMapDataItem,
} from '../types/types';
import * as fs from 'node:fs/promises';

const SERVER_API_URL = 'http://rwr.runningwithrifles.com/rwr_server_list';

const axiosInst = createHttpClient({ timeout: 8 * 1000 }, { maxRetries: 2 });

export const CN_REGEX = new RegExp('[\u4E00-\u9FA5]');

/**
 * Get players list string array
 * @param server server item
 * @returns player list
 */
const getCorrectPlayersList = (server: ResServerItem): string[] => {
    if (!server.player) {
        return [];
    }

    const playersArray = Array.isArray(server.player)
        ? server.player
        : [server.player];

    // force to string array
    return playersArray.map((p) => p.toString());
};

/**
 * Send Http Request, get server list xml raw string
 * @param params query params
 * @returns server list raw xml string
 */
const queryServersRaw = async (params: {
    start: number;
    size: number;
    names: 1 | 0;
}) => {
    const queryParams = {
        start: params.start ?? 0,
        size: params.size ?? 20,
        names: params.names ?? 1,
    };

    const url = `${SERVER_API_URL}/get_server_list.php?start=${queryParams.start}&size=${queryParams.size}&names=${queryParams.names}`;

    const res = await axiosInst.get(url, {
        responseType: 'text',
    });
    return res.data;
};

/**
 * Parse xml raw string to server list
 * @param resString server list raw xml string
 * @returns parsed server list
 */
export const parseServerListFromString = (
    resString: string,
): OnlineServerItem[] => {
    const parser = new XMLParser();
    const res = parser.parse(resString) as Res;

    return res.result.server.map((s) => ({
        ...s,
        playersCount: getCorrectPlayersList(s).length,
    }));
};

/**
 * Get Joinable steam open url
 * @param server serverItem
 * @returns joinable steam open url
 */
export const getJoinServerUrl = (server: OnlineServerItem): string => {
    const str = `steam://rungameid/270150//server_address=${server.address}%20server_port=${server.port}`;
    return str;
};

export const getServersHeaderDisplaySectionText = (
    serverList: OnlineServerItem[],
): {
    serversTotalSection: string;
    playersTotalStaticSection: string;
    playersCountSection: string;
} => {
    const serversTotalSection = `在线服务器数: ${serverList.length}, `;
    const playersTotalStaticSection = `在线玩家数: `;
    const playersCountSection = `${countTotalPlayers(
        serverList,
    )} / ${countServersMaxPlayers(serverList)}`;

    return {
        serversTotalSection,
        playersTotalStaticSection,
        playersCountSection,
    };
};

/**
 * Get formatted server display section text(server name, players, map)
 * @param server
 */
export const getServerInfoDisplaySectionText = (
    server: OnlineServerItem,
): {
    serverSection: string;
    playersSection: string;
    mapSection: string;
} => {
    const mapId = server.map_id;

    const mapPathArr = mapId.split('/');

    const mapName = mapPathArr[mapPathArr.length - 1];

    const serverSection = `${server.name}: `;
    const playersSection = `${server.current_players}/${server.max_players}`;
    const mapSection = ` (${mapName})`;

    return {
        serverSection,
        playersSection,
        mapSection,
    };
};

/**
 * Get server or players count color(100% red, 80% orange, 60% green)
 * @param current filled
 * @param max capacity
 */
export const getCountColor = (current: number, max: number): string => {
    // 100% or -N
    if (current === max || current < 0) {
        return '#ef4444';
    }

    // 80%
    if (current >= max * 0.8) {
        return '#f97316';
    }

    // 0%
    if (current === 0) {
        return '#9ca3af';
    }

    return '#22c55e';
};

/**
 * Get total players count
 * @param servers all server list
 * @returns total players count
 */
export const countTotalPlayers = (servers: OnlineServerItem[]): number => {
    let total = 0;
    servers.forEach((s) => {
        total += s.current_players;
    });

    return total;
};

/**
 * Check server name match env regex
 */
export const isServerMatchRegex = (
    regexStr: string,
    server: OnlineServerItem,
): boolean => {
    if (!regexStr) {
        return true;
    }

    const regex = new RegExp(regexStr);
    return regex.test(server.name);
};

/**
 * Send Http request, get all server list with matchRegex filter
 * @param matchRegex server name match regex
 * @returns all server list
 */
export const queryAllServers = async (
    matchRegex: string,
): Promise<OnlineServerItem[]> => {
    let start = 0;
    const size = 100;

    const totalServerList: OnlineServerItem[] = [];

    try {
        while (true) {
            const resString = await queryServersRaw({
                start,
                size,
                names: 1,
            });

            const parsed = parseServerListFromString(resString);
            totalServerList.push(...parsed);

            if (parsed.length < size) {
                break;
            }

            start += size;
        }

        if (matchRegex) {
            return totalServerList.filter((s) => {
                return isServerMatchRegex(matchRegex, s);
            });
        }
    } catch (error) {
        logger.error('> queryAllServers error');
        logger.error(error);
    }

    return totalServerList;
};

export const countServersMaxPlayers = (servers: OnlineServerItem[]): number => {
    return servers.reduce((acc, s) => {
        acc += s.max_players;
        return acc;
    }, 0);
};

/**
 * Get match query params server text
 * @param servers all server list
 * @param params query params
 * @returns match query params server list
 */
export const getQueryFilterServerList = (
    servers: OnlineServerItem[],
    params: {
        country: Nullable<string>;
    },
): OnlineServerItem[] => {
    const { country } = params;

    return servers.filter((s) => {
        if (country) {
            const inputCountry = country.toUpperCase();
            return s.country.toLocaleUpperCase().includes(inputCountry);
        }

        return true;
    });
};

/**
 * Get map last path as name
 * @param mapId map path
 */
export const getMapShortName = (mapId: string): string => {
    const mapPathArr = mapId.split('/');

    return mapPathArr[mapPathArr.length - 1];
};

/**
 * Get formatted combined user & server info to display text
 * @param user user name
 * @param server server info
 * @returns formatted display text
 */
const getUserInfoInServerDisplayText = (
    user: string,
    server: OnlineServerItem,
): string => {
    const mapName = getMapShortName(server.map_id);

    const infoText = `${user} 正在游玩 ${server.name}: ${
        server.current_players + '/' + server.max_players
    } (${mapName})\n`;

    return infoText;
};

/**
 * Get formatted user in server display section text(user + server)
 * @param data
 */
export const getUserMatchedServerDisplaySectionText = (
    data: IUserMatchedServerItem,
) => {
    const userSection = data.user;
    const staticSection = ` 正在游玩 ${data.server.name}: `;
    const serverCount = `${data.server.current_players}/${data.server.max_players}`;
    const mapSection = ` (${getMapShortName(data.server.map_id)})\n`;

    return {
        userSection,
        staticSection,
        serverCount,
        mapSection,
    };
};

/**
 * Get user matched list(matched server)
 * @param user user name
 * @param serverList all server list
 * @returns user matched server list
 */
export const getUserMatchedList = (
    user: string,
    serverList: OnlineServerItem[],
): {
    results: IUserMatchedServerItem[];
    total: number;
} => {
    let count = 0;

    const results: IUserMatchedServerItem[] = [];

    serverList.forEach((s) => {
        const playersList = getCorrectPlayersList(s);

        playersList.forEach((player) => {
            if (player.toUpperCase().includes(user.toUpperCase())) {
                count += 1;

                results.push({
                    user: player,
                    server: s,
                });
            }
        });
    });

    return {
        results,
        total: count,
    };
};

/**
 * Get canvas render text width before render
 * @param text str
 * @param base base font width
 * @returns calc width
 */
export const calcCanvasTextWidth = (text: string, base: number): number => {
    let countWidth = 0;
    for (let i = 0; i < text.length; ++i) {
        if (CN_REGEX.test(text[i])) {
            countWidth += base * 2;
        } else {
            countWidth += base;
        }
    }

    return countWidth;
};

/**
 * Get #whereis cmd canvas render header section text
 * @param user query user
 */
export const getWhereisHeaderSectionText = (
    user: string,
): {
    staticSection: string;
    userSection: string;
    staticSection2: string;
} => {
    const staticSection = `查询 `;
    const userSection = user;
    const staticSection2 = ` 所在服务器结果:\n`;

    return {
        staticSection,
        userSection,
        staticSection2,
    };
};

export const getWhereisFooterSectionText = (count: number) => {
    if (count === 0) {
        return `未查询到结果`;
    }

    return `共计 ${count} 位玩家结果`;
};

export const readMapData = async (
    mapDataFile: string,
): Promise<IMapDataItem[]> => {
    try {
        const data = await fs.readFile(mapDataFile, 'utf8');
        const mapData = JSON.parse(data) as IMapDataItem[];
        return mapData;
    } catch (e) {
        logger.error('> readMapData error');
        logger.error(e);
        return [];
    }
};

export const getMapTextInCanvas = (m: IMapDataItem) => {
    return `${m.id}: ${m.name}`;
};

/**
 * Get correct players in server
 * @param server server item
 * @returns players name list
 */
export const getPlayersInServer = (server: OnlineServerItem): string[] => {
    let playersArr: string[] = [];
    if (typeof server.player === 'string') {
        playersArr.push(server.player);
    } else if (Array.isArray(server.player)) {
        playersArr = server.player;
    }

    return playersArr;
};
