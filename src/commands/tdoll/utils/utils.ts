import * as fs from 'fs';
import { ITDollDataItem, ITDollSkinDataItem } from '../types/types';
import {
    TDOLL_CATEGORY_CN_MAPPER,
    TDOLL_CATEGORY_EN_MAPPER,
    TDOLL_RANDOM_KEY,
} from '../types/constants';
import { TDollCategoryEnum } from '../types/enums';
import { TDollListCanvas } from '../canvas/tdollListCanvas';
import { TDollDetailCanvas } from '../canvas/tdollDetailCanvas';

/**
 * Read tdoll data from file
 * @param filePath tdoll data file path
 * @returns tdoll data list
 */
export const readTdollData = (filePath: string): ITDollDataItem[] => {
    const jsonData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(jsonData) as ITDollDataItem[];
};

export { replacedQueryMatch } from './query';

/**
 * Get matched tdoll data
 * @param dataList
 * @param query
 */
export const getMatchedTDollData = (
    dataList: ITDollDataItem[],
    query: string
): ITDollDataItem[] => {
    if (query.toLowerCase() === TDOLL_RANDOM_KEY) {
        const randomIndex = Math.floor(Math.random() * dataList.length);
        const randomData = dataList[randomIndex];
        return [randomData];
    }
    const userInput = query
        .toLowerCase()
        .replaceAll('-', '')
        .replaceAll('.', '');

    return dataList
        .filter((d) => {
            const currentName = d.nameIngame
                .toLowerCase()
                .replaceAll('-', '')
                .replaceAll(' ', '')
                .replaceAll('.', '');

            return currentName.includes(userInput);
        })
        .sort((a, b) => {
            const aName = a.nameIngame
                .toLowerCase()
                .replaceAll('-', '')
                .replaceAll(' ', '')
                .replaceAll('.', '');
            const bName = b.nameIngame
                .toLowerCase()
                .replaceAll('-', '')
                .replaceAll(' ', '')
                .replaceAll('.', '');

            return aName.indexOf(userInput) - bName.indexOf(userInput);
        });
};

/**
 * Get matched tdoll data with category
 * @param dataList
 * @param query
 * @param query2
 * @returns
 */
export const getMatchedTDollDataWithCategory = (
    dataList: ITDollDataItem[],
    query: string,
    query2: string
): ITDollDataItem[] => {
    let new_query = query2;
    let category = findCategoryByQuery(query);

    if (!category) {
        category = findCategoryByQuery(query2);
        new_query = query;
    }

    if (!category) {
        return [];
    }

    const targetData = dataList.filter((d) => d.tdollClass === category);

    return getMatchedTDollData(targetData, new_query);
};

const findCategoryByQuery = (q: string): TDollCategoryEnum | undefined => {
    if (q.toLowerCase() in TDOLL_CATEGORY_EN_MAPPER) {
        return TDOLL_CATEGORY_EN_MAPPER[q.toLowerCase()];
    }

    if (q in TDOLL_CATEGORY_CN_MAPPER) {
        return TDOLL_CATEGORY_CN_MAPPER[q];
    }

    return undefined;
};

/**
 * Read tdoll skin data from file
 * @param filePath tdoll data file path
 * @returns tdoll data list
 */
export const readTdollSkinData = (
    filePath: string
): Record<string, ITDollSkinDataItem> => {
    const jsonData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(jsonData) as Record<string, ITDollSkinDataItem>;
};

export const printTDollListPng = (
    query: string,
    tdolls: ITDollDataItem[],
    fileName: string,
) => new TDollListCanvas(query, tdolls, fileName).render();

export const printTDollDetailPng = (
    query: string,
    tdollData: ITDollDataItem[],
    record: Record<string, ITDollSkinDataItem>,
    fileName: string,
) => new TDollDetailCanvas(query, tdollData, record, fileName).render();
