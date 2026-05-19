import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { MapImageService } from './mapImage.service';
import { GlobalEnv } from '../../../types';

const FIXTURE_CONFIG = {
    images: [
        {
            path: 'media/packages/hell_diver/maps/BloodandFlowers_01',
            image: 'map-images/BloodandFlowers_01.png',
            name: 'Blood and Flowers',
        },
        {
            path: 'media/packages/GFL_Castling/maps/map13_2',
            image: 'map-images/map13_2.png',
        },
        {
            path: 'media/packages/rwr/maps/map105',
            image: 'https://example.com/map105.png',
        },
    ],
};

function makeMockEnv(overrides?: Partial<GlobalEnv>): GlobalEnv {
    return {
        PORT: 3000,
        HOSTNAME: 'localhost',
        STATIC_HTTP_PATH: '',
        START_MATCH: '#',
        REMOTE_URL: '',
        LISTEN_GROUP: '',
        SERVERS_MATCH_REGEX: '',
        SERVERS_FALLBACK_URL: '',
        ADMIN_QQ_LIST: [],
        ACTIVE_COMMANDS: [],
        WELCOME_TEMPLATE: '',
        WEBSITE_DATA_FILE: '',
        TDOLL_DATA_FILE: '',
        TDOLL_SKIN_DATA_FILE: '',
        MAPS_DATA_FILE: '',
        QA_DATA_FILE: '',
        OPENAI_API_KEY: '',
        OPENAI_API_URL: '',
        OPENAI_TABLE_NAME: '',
        IMGPROXY_URL: '',
        OUTPUT_BG_IMG: '',
        TOKEN: '',
        MODERATORS: [],
        MODERATOR_BADGE: '',
        ...overrides,
    };
}

describe('MapImageService', () => {
    let tmpDir: string;
    let configPath: string;

    beforeEach(async () => {
        MapImageService.resetInst();
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mapimage-test-'));
        configPath = path.join(tmpDir, 'map_images.json');
        await fs.writeFile(configPath, JSON.stringify(FIXTURE_CONFIG));
    });

    afterEach(async () => {
        MapImageService.resetInst();
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    describe('loadConfig', () => {
        it('should load config and build fullPathMap and shortNameMap', async () => {
            const env = makeMockEnv({ MAP_IMAGE_CONFIG_FILE: configPath });
            const service = MapImageService.getInst();
            await service.init(env);

            expect(
                service.getImageUrl(
                    'media/packages/hell_diver/maps/BloodandFlowers_01',
                ),
            ).toBe(
                'http://localhost:3000/out/map-images/BloodandFlowers_01.png',
            );
            expect(
                service.getImageUrl(
                    'media/packages/GFL_Castling/maps/map13_2',
                ),
            ).toBe('http://localhost:3000/out/map-images/map13_2.png');
        });

        it('should handle missing config file gracefully', async () => {
            const env = makeMockEnv({
                MAP_IMAGE_CONFIG_FILE: '/nonexistent/path.json',
            });
            const service = MapImageService.getInst();
            await service.init(env);

            expect(service.getImageUrl('any-map-id')).toBeUndefined();
        });

        it('should not load config when MAP_IMAGE_CONFIG_FILE is not set', async () => {
            const env = makeMockEnv();
            const service = MapImageService.getInst();
            await service.init(env);

            expect(
                service.getImageUrl(
                    'media/packages/hell_diver/maps/BloodandFlowers_01',
                ),
            ).toBeUndefined();
        });
    });

    describe('getImageUrl', () => {
        it('should match by full path (exact)', async () => {
            const env = makeMockEnv({ MAP_IMAGE_CONFIG_FILE: configPath });
            const service = MapImageService.getInst();
            await service.init(env);

            const url = service.getImageUrl(
                'media/packages/hell_diver/maps/BloodandFlowers_01',
            );
            expect(url).toBe(
                'http://localhost:3000/out/map-images/BloodandFlowers_01.png',
            );
        });

        it('should fall back to short name match', async () => {
            const env = makeMockEnv({ MAP_IMAGE_CONFIG_FILE: configPath });
            const service = MapImageService.getInst();
            await service.init(env);

            const url = service.getImageUrl('BloodandFlowers_01');
            expect(url).toBe(
                'http://localhost:3000/out/map-images/BloodandFlowers_01.png',
            );
        });

        it('should use mapShortId parameter for short name fallback', async () => {
            const env = makeMockEnv({ MAP_IMAGE_CONFIG_FILE: configPath });
            const service = MapImageService.getInst();
            await service.init(env);

            const url = service.getImageUrl(
                'unknown_full_path',
                'BloodandFlowers_01',
            );
            expect(url).toBe(
                'http://localhost:3000/out/map-images/BloodandFlowers_01.png',
            );
        });

        it('should fall back to baseUrl when no config match', async () => {
            const env = makeMockEnv({
                MAP_IMAGE_BASE_URL: 'https://img.example.com/maps/',
            });
            const service = MapImageService.getInst();
            await service.init(env);

            const url = service.getImageUrl('map999');
            expect(url).toBe('https://img.example.com/maps/map999.png');
        });

        it('should return undefined when no match and no baseUrl', async () => {
            const env = makeMockEnv();
            const service = MapImageService.getInst();
            await service.init(env);

            const url = service.getImageUrl('nonexistent');
            expect(url).toBeUndefined();
        });

        it('should prefer full path over short name', async () => {
            const configWithConflict = {
                images: [
                    {
                        path: 'media/packages/A/maps/map105',
                        image: 'https://example.com/A/map105.png',
                    },
                    {
                        path: 'media/packages/B/maps/map105',
                        image: 'https://example.com/B/map105.png',
                    },
                ],
            };
            await fs.writeFile(
                configPath,
                JSON.stringify(configWithConflict),
            );

            const env = makeMockEnv({ MAP_IMAGE_CONFIG_FILE: configPath });
            const service = MapImageService.getInst();
            await service.init(env);

            expect(service.getImageUrl('media/packages/A/maps/map105')).toBe(
                'https://example.com/A/map105.png',
            );
            expect(service.getImageUrl('media/packages/B/maps/map105')).toBe(
                'https://example.com/B/map105.png',
            );

            // Short name match returns the last loaded one (B overwrites A in shortNameMap)
            expect(service.getImageUrl('map105')).toBe(
                'https://example.com/B/map105.png',
            );
        });
    });

    describe('resolveImageUrl', () => {
        it('should resolve relative path via getStaticHttpPath', async () => {
            const env = makeMockEnv({ MAP_IMAGE_CONFIG_FILE: configPath });
            const service = MapImageService.getInst();
            await service.init(env);

            const url = service.getImageUrl(
                'media/packages/hell_diver/maps/BloodandFlowers_01',
            );
            expect(url).toBe(
                'http://localhost:3000/out/map-images/BloodandFlowers_01.png',
            );
        });

        it('should resolve /out/ prefixed path', async () => {
            const config = {
                images: [
                    {
                        path: 'test/map',
                        image: '/out/map-images/test.png',
                    },
                ],
            };
            await fs.writeFile(configPath, JSON.stringify(config));

            const env = makeMockEnv({ MAP_IMAGE_CONFIG_FILE: configPath });
            const service = MapImageService.getInst();
            await service.init(env);

            expect(service.getImageUrl('test/map')).toBe(
                'http://localhost:3000/out/map-images/test.png',
            );
        });

        it('should keep http URLs as-is', async () => {
            const env = makeMockEnv({ MAP_IMAGE_CONFIG_FILE: configPath });
            const service = MapImageService.getInst();
            await service.init(env);

            expect(
                service.getImageUrl('media/packages/rwr/maps/map105'),
            ).toBe('https://example.com/map105.png');
        });

        it('should use STATIC_HTTP_PATH when set', async () => {
            const env = makeMockEnv({
                MAP_IMAGE_CONFIG_FILE: configPath,
                STATIC_HTTP_PATH: 'cdn.example.com:8080',
            });
            const service = MapImageService.getInst();
            await service.init(env);

            expect(
                service.getImageUrl(
                    'media/packages/hell_diver/maps/BloodandFlowers_01',
                ),
            ).toBe(
                'http://cdn.example.com:8080/out/map-images/BloodandFlowers_01.png',
            );
        });
    });

    describe('edge cases', () => {
        it('should return image as-is when env is not set (no init)', () => {
            const service = MapImageService.getInst();
            // No init called, env is undefined
            expect(service.getImageUrl('any-map')).toBeUndefined();
        });

        it('should handle empty images array', async () => {
            const config = { images: [] };
            await fs.writeFile(configPath, JSON.stringify(config));

            const env = makeMockEnv({ MAP_IMAGE_CONFIG_FILE: configPath });
            const service = MapImageService.getInst();
            await service.init(env);

            expect(service.getImageUrl('any-map')).toBeUndefined();
        });

        it('should handle config with only baseUrl fallback', async () => {
            const env = makeMockEnv({
                MAP_IMAGE_BASE_URL: 'https://cdn.example.com/maps/',
            });
            const service = MapImageService.getInst();
            await service.init(env);

            expect(service.getImageUrl('someMap')).toBe(
                'https://cdn.example.com/maps/someMap.png',
            );
        });

        it('should use mapShortId param for baseUrl fallback', async () => {
            const env = makeMockEnv({
                MAP_IMAGE_BASE_URL: 'https://cdn.example.com/maps/',
            });
            const service = MapImageService.getInst();
            await service.init(env);

            expect(
                service.getImageUrl(
                    'media/packages/rwr/maps/someMap',
                    'someMap',
                ),
            ).toBe('https://cdn.example.com/maps/someMap.png');
        });
    });
});
