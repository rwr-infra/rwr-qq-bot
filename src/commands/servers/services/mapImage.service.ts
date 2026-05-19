import { logger } from '../../../utils/logger';
import { GlobalEnv } from '../../../types';
import { IMapImageConfigFile } from '../types/types';
import { getStaticHttpPath } from '../../../utils/cmdreq';
import { getMapShortName } from '../utils/utils';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export class MapImageService {
    private static inst: MapImageService | undefined;
    private fullPathMap: Map<string, string> = new Map();
    private shortNameMap: Map<string, string> = new Map();
    private env?: GlobalEnv;
    private baseUrlFallback?: string;

    private constructor() {}

    static getInst(): MapImageService {
        if (!MapImageService.inst) {
            MapImageService.inst = new MapImageService();
        }
        return MapImageService.inst;
    }

    static resetInst() {
        MapImageService.inst = undefined;
    }

    async init(env: GlobalEnv) {
        this.env = env;
        this.baseUrlFallback = env.MAP_IMAGE_BASE_URL;

        if (env.MAP_IMAGE_CONFIG_FILE) {
            await this.loadConfig(env.MAP_IMAGE_CONFIG_FILE);
        }
    }

    private async loadConfig(filePath: string) {
        const resolvedPath = path.resolve(filePath);
        try {
            const raw = await fs.readFile(resolvedPath, 'utf8');
            const config = JSON.parse(raw) as IMapImageConfigFile;
            if (!Array.isArray(config.images)) {
                logger.warn(
                    '[MapImageService] Invalid config: missing "images" array',
                );
                return;
            }
            for (const item of config.images) {
                const resolvedUrl = this.resolveImageUrl(item.image);
                this.fullPathMap.set(item.path, resolvedUrl);
                const shortName = getMapShortName(item.path);
                if (shortName) {
                    this.shortNameMap.set(shortName, resolvedUrl);
                }
            }
            logger.info(
                `[MapImageService] Loaded ${config.images.length} entries`,
            );
        } catch (e) {
            logger.warn(
                `[MapImageService] Failed to load config from "${resolvedPath}":`,
                e,
            );
        }
    }

    private resolveImageUrl(image: string): string {
        if (!this.env) return image;
        if (image.startsWith('/out/')) {
            return getStaticHttpPath(this.env, image.slice(5));
        }
        if (!image.startsWith('http')) {
            return getStaticHttpPath(this.env, image);
        }
        return image;
    }

    getImageUrl(mapId: string, mapShortId?: string): string | undefined {
        const direct = this.fullPathMap.get(mapId);
        if (direct) return direct;

        const shortKey = mapShortId || getMapShortName(mapId);
        const byShort = this.shortNameMap.get(shortKey);
        if (byShort) return byShort;

        if (this.baseUrlFallback && shortKey) {
            return `${this.baseUrlFallback}${shortKey}.png`;
        }

        return undefined;
    }
}
