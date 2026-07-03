import { describe, expect, it } from 'vitest';
import { replacedQueryMatch, splitByQueryMatch } from './query';

describe('replacedQueryMatch', () => {
    it.concurrent('normalizes case and separators', () => {
        expect(replacedQueryMatch('S.A.T.8')).toBe('sat8');
        expect(replacedQueryMatch('NTW-20')).toBe('ntw20');
        expect(replacedQueryMatch('M4 A1')).toBe('m4a1');
    });
});

describe('splitByQueryMatch', () => {
    it.concurrent('splits a plain match', () => {
        expect(splitByQueryMatch('M4A1', 'm4')).toEqual({
            before: '',
            match: 'M4',
            after: 'A1',
        });
    });

    it.concurrent('maps match range across separators', () => {
        const res = splitByQueryMatch('NTW-20', 'ntw2');

        expect(res).not.toBeNull();
        expect(res!.before).toBe('');
        expect(res!.match).toBe('NTW-2');
        expect(res!.after).toBe('0');
    });

    it.concurrent('match extends to end of name', () => {
        expect(splitByQueryMatch('M16A1', 'a1')).toEqual({
            before: 'M16',
            match: 'A1',
            after: '',
        });
    });

    it.concurrent('returns null when no match', () => {
        expect(splitByQueryMatch('M4A1', 'zzz')).toBeNull();
    });

    it.concurrent('returns null for random query', () => {
        expect(splitByQueryMatch('M4A1', 'random')).toBeNull();
        expect(splitByQueryMatch('M4A1', 'RANDOM')).toBeNull();
    });

    it.concurrent('returns null for empty inputs', () => {
        expect(splitByQueryMatch('', 'm4')).toBeNull();
        expect(splitByQueryMatch('M4A1', '')).toBeNull();
        expect(splitByQueryMatch('M4A1', '- .')).toBeNull();
    });
});
