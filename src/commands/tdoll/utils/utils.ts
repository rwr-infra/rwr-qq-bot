import * as fs from 'fs';
import { ITDollDataItem, ITDollSkinDataItem } from '../types/types';
import {
    TDOLL_CATEGORY_CN_MAPPER,
    TDOLL_CATEGORY_EN_MAPPER,
    TDOLL_OUTPUT_FOLDER,
    TDOLL_RANDOM_KEY,
    TDOLL_SKIN_NOT_FOUND,
    TDOLL_SKIN_NOT_FOUND_MSG,
    TDOLL_URL_PREFIX,
} from '../types/constants';
import { resizeImg } from '../../../utils/imgproxy';
import { TDollCategoryEnum } from '../types/enums';
import { replacedQueryMatch } from './stringUtils';
import { TDoll2Canvas } from '../canvas/tdoll2Canvas';
import { TDollSkin2Canvas } from '../canvas/tdollSkin2Canvas';

/**
 * Read tdoll data from file
 * @param filePath tdoll data file path
 * @returns tdoll data list
 */
export const readTdollData = (filePath: string): ITDollDataItem[] => {
    const jsonData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(jsonData) as ITDollDataItem[];
};

/**
 * Get tdollData formatted message
 * @param tdoll tdoll data
 */
export const formatTDollData = (tdoll: ITDollDataItem) => {
    let res = '';

    const avatarUrl = resizeImg(tdoll.avatar, 40, 40);

    res += `No.${tdoll.id} ${tdoll.nameIngame}${
        tdoll.mod === '1' ? '(mod)' : ''
    } ${tdoll.type}\n[CQ:image,file=${avatarUrl},cache=0]`;

    if (tdoll.mod === '1' && tdoll.avatarMod) {
        const modAvatarUrl = resizeImg(tdoll.avatarMod, 40, 40);
        res += `[CQ:image,file=${modAvatarUrl},cache=0]`;
    }

    return res;
};

export const getTDollDataEndText = (count: number) => {
    return `\n(共${count}项)最多展示 10 项结果`;
};

export const getRandomTDollData = (dataList: ITDollDataItem[]): string => {
    const randomIndex = Math.floor(Math.random() * dataList.length);
    const randomData = dataList[randomIndex];
    return formatTDollData(randomData);
};

/**
 * Get matched tdoll data
 * @param dataList
 * @param query
 */
export const getMatchedTDollData = (
    dataList: ITDollDataItem[],
    query: string,
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
    query2: string,
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

/**
 * Get tdoll data response with 1 query param
 * @param dataList
 * @param query
 */
export const getTDollDataRes = (
    dataList: ITDollDataItem[],
    query: string,
): string => {
    if (query.toLowerCase() === TDOLL_RANDOM_KEY) {
        return getRandomTDollData(dataList);
    }
    const targetData = getMatchedTDollData(dataList, query);

    const slicedData = targetData.slice(0, 10);

    if (slicedData.length === 0) {
        return `未找到指定枪名, 请检查输入是否有误!`;
    }

    const allFormattedData = slicedData
        .map((tdoll) => formatTDollData(tdoll))
        .join('\n');

    const endText = getTDollDataEndText(targetData.length);

    return allFormattedData + endText;
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
 * Get tdoll data response with 2 query params
 * @param dataList
 * @param query
 */
export const getTDollDataWithCategoryRes = (
    dataList: ITDollDataItem[],
    query: string,
    query2: string,
): string => {
    let new_query = query2;
    let category = findCategoryByQuery(query);

    if (!category) {
        category = findCategoryByQuery(query2);
        new_query = query;
    }

    if (!category) {
        return '未找到指定枪种分类, 请检查输入是否有误!';
    }

    const targetData = dataList.filter((d) => d.tdollClass === category);

    return getTDollDataRes(targetData, new_query);
};

export const formatTDollSkinData = (
    query: string,
    dollData: ITDollDataItem[],
    skin: ITDollSkinDataItem,
): string => {
    const targetTDoll = dollData.find((d) => d.id === query);
    if (!targetTDoll) {
        return TDOLL_SKIN_NOT_FOUND;
    }

    let imageMsg = '';
    const avatarUrl = resizeImg(targetTDoll.avatar, 40, 40);
    imageMsg += `[CQ:image,file=${avatarUrl},cache=0]`;

    let res = `No.${query} ${targetTDoll.nameIngame || ''} \n${imageMsg}\n`;

    skin.forEach((item) => {
        res += `${item.index + 1}. ${item.title} ID:${item.value}\n`;
        if (item.image) {
            const imageUrl = item.image.pic.includes(TDOLL_URL_PREFIX)
                ? item.image.pic
                : `${TDOLL_URL_PREFIX}${item.image.pic}`;
            res += `[CQ:image,file=${resizeImg(imageUrl, 150, 150)},cache=0]\n`;
        }
    });

    return res;
};

/**
 * Read tdoll skin data from file
 * @param filePath tdoll data file path
 * @returns tdoll data list
 */
export const readTdollSkinData = (
    filePath: string,
): Record<string, ITDollSkinDataItem> => {
    const jsonData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(jsonData) as Record<string, ITDollSkinDataItem>;
};

export const getTDollSkinReplyText = (
    query: string,
    tdollData: ITDollDataItem[],
    record: Record<string, ITDollSkinDataItem>,
) => {
    if (!(query in record)) {
        return TDOLL_SKIN_NOT_FOUND_MSG;
    }

    const skin = record[query];

    return formatTDollSkinData(query, tdollData, skin);
};

export const printTDoll2Png = async (
    query: string,
    tdollData: ITDollDataItem[],
    fileName: string,
) => {
    if (!fs.existsSync(TDOLL_OUTPUT_FOLDER)) {
        fs.mkdirSync(TDOLL_OUTPUT_FOLDER);
    }

    const outputPath = await new TDoll2Canvas(
        query,
        tdollData,
        fileName,
    ).render();

    return outputPath;
};

export const printTDollSkin2Png = async (
    query: string,
    tdollData: ITDollDataItem[],
    record: Record<string, ITDollSkinDataItem>,
    fileName: string,
) => {
    if (!fs.existsSync(TDOLL_OUTPUT_FOLDER)) {
        fs.mkdirSync(TDOLL_OUTPUT_FOLDER);
    }

    const outputPath = await new TDollSkin2Canvas(
        query,
        tdollData,
        record,
        fileName,
    ).render();

    return outputPath;
};
