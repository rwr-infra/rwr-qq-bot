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
