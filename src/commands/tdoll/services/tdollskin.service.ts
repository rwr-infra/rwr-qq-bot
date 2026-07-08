import { JsonFileCacheService } from '../../../services/jsonFileCache.service';
import { ITDollSkinDataItem } from '../types/types';

export class TDollSkinService extends JsonFileCacheService<
    Record<string, ITDollSkinDataItem>
> {
    lastRaw = '';
    lastData = {} as Record<string, ITDollSkinDataItem>;

    constructor() {
        super(24 * 60 * 60);
    }

    async fetchData() {
        const raw = await this.readRaw();

        if (raw !== this.lastRaw) {
            this.lastData = JSON.parse(raw) as Record<
                string,
                ITDollSkinDataItem
            >;
            this.lastRaw = raw;
        }

        return this.lastData;
    }
}

export const TDollSkinSvc = new TDollSkinService();
