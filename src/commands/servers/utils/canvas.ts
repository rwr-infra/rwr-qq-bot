import * as fs from 'fs';
import {
    HistoricalServerItem,
    IMapDataItem,
    IUserMatchedServerItem,
    OnlineServerItem,
} from '../types/types';
import { ServersCanvas } from '../canvas/serversCanvas';
import { PlayersCanvas } from '../canvas/playersCanvas';
import { WhereisCanvas } from '../canvas/whereisCanvas';
import { MapsCanvas } from '../canvas/mapsCanvas';

const OUTPUT_FOLDER = 'out';

/**
 * Print servers output png
 * @param serverList server list
 * @param fileName output file name
 */
export const printServerListPng = (
    serverList: OnlineServerItem[],
    historicalServers: HistoricalServerItem[],
    fileName: string,
) => {
    if (!fs.existsSync(OUTPUT_FOLDER)) {
        fs.mkdirSync(OUTPUT_FOLDER);
    }

    const outputPath = new ServersCanvas(
        serverList,
        historicalServers,
        fileName,
    ).render();

    return outputPath;
};

/**
 * Print players output png
 * @param serverList server list
 * @param fileName output file name
 * @param moderators moderator player names
 * @param moderatorBadge badge string for moderators
 */
export const printPlayersPng = (
    serverList: OnlineServerItem[],
    fileName: string,
    moderators?: string[],
    moderatorBadge?: string,
): string => {
    if (!fs.existsSync(OUTPUT_FOLDER)) {
        fs.mkdirSync(OUTPUT_FOLDER);
    }

    const outputPath = new PlayersCanvas(
        serverList,
        fileName,
        moderators,
        moderatorBadge,
    ).render();

    return outputPath;
};

/**
 * Print whereis output png
 * @param matchList user in server list(matched)
 * @param query query user name
 * @param count total matched count
 * @param fileName output file name
 */
export const printUserInServerListPng = (
    matchList: IUserMatchedServerItem[],
    query: string,
    count: number,
    fileName: string,
): string => {
    if (!fs.existsSync(OUTPUT_FOLDER)) {
        fs.mkdirSync(OUTPUT_FOLDER);
    }

    const outputPath = new WhereisCanvas(
        matchList,
        query,
        count,
        fileName,
    ).render();

    return outputPath;
};

export const printMapPng = (
    serverList: OnlineServerItem[],
    mapData: IMapDataItem[],
    fileName: string,
): string => {
    if (!fs.existsSync(OUTPUT_FOLDER)) {
        fs.mkdirSync(OUTPUT_FOLDER);
    }

    const outputPath = new MapsCanvas(serverList, mapData, fileName).render();

    return outputPath;
};
