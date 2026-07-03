import { TDOLL_RANDOM_KEY } from '../types/constants';

/**
 * 查询匹配用的字符串归一化: 忽略大小写与 '-'、'.'、空格
 */
export const replacedQueryMatch = (query: string): string => {
    return query
        .toLowerCase()
        .replaceAll('-', '')
        .replaceAll('.', '')
        .replaceAll(' ', '');
};

export interface QueryMatchSegments {
    before: string;
    match: string;
    after: string;
}

/**
 * 按归一化后的查询词把名称拆成 前段/命中段/后段, 供渲染高亮。
 * 无法命中(或 random 查询)返回 null。
 */
export const splitByQueryMatch = (
    name: string,
    query: string,
): QueryMatchSegments | null => {
    if (!name || !query || query.toLowerCase() === TDOLL_RANDOM_KEY) {
        return null;
    }

    const processedName = replacedQueryMatch(name);
    const processedQuery = replacedQueryMatch(query);
    if (!processedQuery) {
        return null;
    }

    const queryIndex = processedName.indexOf(processedQuery);
    if (queryIndex === -1) {
        return null;
    }

    // 把归一化后的命中区间映射回原始名称的下标(跳过 '-'、'.'、空格)
    let matchStartIndex = 0;
    let matchEndIndex = 0;
    let currentProcessedIndex = 0;

    for (let i = 0; i < name.length; i++) {
        if (currentProcessedIndex === queryIndex) {
            matchStartIndex = i;
        }
        if (currentProcessedIndex === queryIndex + processedQuery.length) {
            matchEndIndex = i;
            break;
        }
        if (!/[-. ]/.test(name[i])) {
            currentProcessedIndex++;
        }
    }

    if (matchEndIndex === 0) {
        matchEndIndex = name.length;
    }

    return {
        before: name.substring(0, matchStartIndex),
        match: name.substring(matchStartIndex, matchEndIndex),
        after: name.substring(matchEndIndex),
    };
};
