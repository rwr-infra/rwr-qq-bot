import { describe, it, expect } from 'vitest';
import { cqImageFile, cqImageUrl } from './cqCode';
import { GlobalEnv } from '../types';

const envWithStatic = { STATIC_HTTP_PATH: 'cdn.example.com' } as GlobalEnv;
const envWithHost = {
    HOSTNAME: 'bot.local',
    PORT: 3000,
} as unknown as GlobalEnv;

describe('cqImageFile', () => {
    it('encodes a local file via STATIC_HTTP_PATH with default cache=0,c=8', () => {
        expect(cqImageFile(envWithStatic, 'a.png')).toBe(
            '[CQ:image,file=http://cdn.example.com/out/a.png,cache=0,c=8]',
        );
    });

    it('falls back to HOSTNAME:PORT when STATIC_HTTP_PATH is unset', () => {
        expect(cqImageFile(envWithHost, 'b.png')).toBe(
            '[CQ:image,file=http://bot.local:3000/out/b.png,cache=0,c=8]',
        );
    });

    it('honours custom options', () => {
        expect(cqImageFile(envWithStatic, 'c.png', {})).toBe(
            '[CQ:image,file=http://cdn.example.com/out/c.png]',
        );
    });
});

describe('cqImageUrl', () => {
    it('is bare by default', () => {
        expect(cqImageUrl('http://x/y.png')).toBe(
            '[CQ:image,file=http://x/y.png]',
        );
    });

    it('appends cache and c', () => {
        expect(cqImageUrl('http://x/y.png', { cache: 0, c: 8 })).toBe(
            '[CQ:image,file=http://x/y.png,cache=0,c=8]',
        );
    });

    it('supports flash type', () => {
        expect(cqImageUrl('http://x/y.png', { type: 'flash' })).toBe(
            '[CQ:image,file=http://x/y.png,type=flash]',
        );
    });
});
