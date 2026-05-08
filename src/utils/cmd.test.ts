import { describe, it, expect } from 'vitest';
import { getCommandParams, getFirstCommand, parseIgnoreSpace } from './cmd';

describe('global utils', () => {
    describe.concurrent('getFirstCommand', () => {
        it.concurrent('empty string', () => {
            const res = getFirstCommand('');

            expect(res).toBe('');
        });

        it.concurrent('normal command', () => {
            const res = getFirstCommand('#a');

            expect(res).toBe('a');
        });

        it.concurrent('multiple command', () => {
            const res = getFirstCommand('#a #b');

            expect(res).toBe('a');
        });
    });

    describe.concurrent('getCommandParams', () => {
        it.concurrent('#a h = h', () => {
            const res = getCommandParams('#a h');

            const arr = Array.from(res);

            expect(arr).toEqual([['h', true]]);
        });

        it.concurrent('#a h d -> h,d', () => {
            const res = getCommandParams('#a h d');

            const arr = Array.from(res);

            expect(arr).toEqual([
                ['h', true],
                ['d', true],
            ]);
        });

        it.concurrent('default params', () => {
            const res = getCommandParams('#a', {
                d: true,
            });

            const arr = Array.from(res);

            expect(arr).toEqual([['d', true]]);
        });

        it.concurrent('default params with other params', () => {
            const res = getCommandParams('#a h', {
                d: true,
            });

            const arr = Array.from(res);

            expect(arr).toEqual([
                ['d', true],
                ['h', true],
            ]);
        });

        it.concurrent('default params with override', () => {
            const res = getCommandParams('#a d', {
                d: true,
            });

            const arr = Array.from(res);

            expect(arr).toEqual([['d', true]]);
        });
    });

    describe.concurrent('ignoreSpaceParse', () => {
        it.concurrent('empty cmdList', () => {
            const res = parseIgnoreSpace([], '#w');

            expect(res.size).toBe(1);
            expect(res.get('#w')).toBe(true);
        });

        it.concurrent('error cmdList', () => {
            const res = parseIgnoreSpace(['#w'], '#h');

            expect(res.size).toBe(1);
            expect(res.get('#h')).toBe(true);
        });

        it.concurrent('empty params', () => {
            const res = parseIgnoreSpace(['#w'], '#w');

            expect(res.size).toBe(0);
        });

        it.concurrent('1 param', () => {
            const res = parseIgnoreSpace(['#w'], '#w KREEDZT');

            expect(res.size).toBe(1);
            expect(res.get('KREEDZT')).toBe(true);
        });

        it.concurrent('param with 1 space', () => {
            const res = parseIgnoreSpace(['#w'], '#w KREEDZT 123');

            expect(res.size).toBe(1);
            expect(res.get('KREEDZT 123')).toBe(true);
        });

        it.concurrent('param with multiple space', () => {
            const res = parseIgnoreSpace(['#w'], '#w KREEDZT 123 456');

            expect(res.size).toBe(1);
            expect(res.get('KREEDZT 123 456')).toBe(true);
        });

        it.concurrent('case-insensitive cmd stripping', () => {
            const res = parseIgnoreSpace(['#ai'], '#AI 你好');

            expect(res.size).toBe(1);
            expect(res.get('你好')).toBe(true);
        });
    });
});
