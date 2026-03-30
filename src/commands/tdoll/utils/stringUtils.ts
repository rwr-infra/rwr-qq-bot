export const replacedQueryMatch = (query: string): string => {
    return query
        .toLowerCase()
        .replaceAll('-', '')
        .replaceAll('.', '')
        .replaceAll(' ', '');
};
