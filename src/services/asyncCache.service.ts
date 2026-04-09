export class AsyncCacheService<T> {
    cacheData?: T;

    cacheTime: number = 5 * 60 * 1000;
    lastUpdatedTime?: number;

    async fetchData(): Promise<T> {
        return {} as T;
    }

    async updateCache() {
        this.cacheData = await this.fetchData();
        this.lastUpdatedTime = Date.now();
    }

    updateCheck(): boolean {
        if (!this.lastUpdatedTime) {
            return true;
        }

        const now = Date.now();
        return now - this.lastUpdatedTime >= this.cacheTime;
    }

    async getData() {
        if (this.updateCheck()) {
            await this.updateCache();
        }

        return this.cacheData!;
    }
}
