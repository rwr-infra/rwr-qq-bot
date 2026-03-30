import * as fs from 'node:fs/promises';
import { AsyncCacheService } from '../../../services/asyncCache.service';
import { ITDollSkinDataItem } from '../types/types';

export class TDollSkinService extends AsyncCacheService<
    Record<string, ITDollSkinDataItem>
> {
    cacheTime = 24 * 60 * 60 * 1000;

    lastRaw = '';
    lastData = {} as Record<string, ITDollSkinDataItem>;

    async fetchData() {
        const raw = await fs.readFile(
            process.env.TDOLL_SKIN_DATA_FILE as string,
            'utf-8',
        );

        if (raw !== this.lastRaw) {
            const nextData = JSON.parse(raw) as Record<
                string,
                ITDollSkinDataItem
            >;
            this.lastRaw = raw;
            this.lastData = nextData;
        }

        return this.lastData;
    }
}

export const TDollSkinSvc = new TDollSkinService();
