import * as fs from 'node:fs/promises';
import { AsyncCacheService } from '../../../services/asyncCache.service';
import { ITDollDataItem } from '../types/types';

export class TDollService extends AsyncCacheService<ITDollDataItem[]> {
    cacheTime = 24 * 60 * 60 * 1000;

    async fetchData() {
        const raw = await fs.readFile(
            process.env.TDOLL_DATA_FILE as string,
            'utf-8',
        );
        return JSON.parse(raw) as ITDollDataItem[];
    }
}

export const TDollSvc = new TDollService();
