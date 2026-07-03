import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { TDOLL_URL_PREFIX } from '../types/constants';
import { getModAvatarKey, resolveSkinImageUrl } from './assets';

describe('resolveSkinImageUrl', () => {
    it.concurrent('keeps full urls', () => {
        expect(
            resolveSkinImageUrl('https://www.gfwiki.org/images/a.png'),
        ).toBe('https://www.gfwiki.org/images/a.png');
        expect(resolveSkinImageUrl('http://example.com/a.png')).toBe(
            'http://example.com/a.png',
        );
        expect(resolveSkinImageUrl('data:image/png;base64,xxx')).toBe(
            'data:image/png;base64,xxx',
        );
    });

    it.concurrent('keeps existing local absolute paths (fixtures)', () => {
        const tmpFile = path.join(
            os.tmpdir(),
            `resolve-skin-url-test-${process.pid}.png`,
        );
        fs.writeFileSync(tmpFile, 'stub');

        expect(resolveSkinImageUrl(tmpFile)).toBe(tmpFile);

        fs.unlinkSync(tmpFile);
    });

    it.concurrent('prefixes wiki relative paths', () => {
        expect(resolveSkinImageUrl('/images/7/7f/Pic_M1873_HD.png')).toBe(
            `${TDOLL_URL_PREFIX}/images/7/7f/Pic_M1873_HD.png`,
        );
    });

    it.concurrent('passes through empty value', () => {
        expect(resolveSkinImageUrl('')).toBe('');
    });
});

describe('getModAvatarKey', () => {
    it.concurrent('follows the legacy key convention', () => {
        expect(getModAvatarKey('55')).toBe('55__mod');
    });
});
