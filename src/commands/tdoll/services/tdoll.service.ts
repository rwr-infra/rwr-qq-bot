import { JsonFileCacheService } from '../../../services/jsonFileCache.service';
import { ITDollDataItem } from '../types/types';

export class TDollService extends JsonFileCacheService<ITDollDataItem[]> {
    constructor() {
        super(24 * 60 * 60);
    }
}

export const TDollSvc = new TDollService();
