import { logger } from '../utils/logger';
import type {
    OnlineServerItem,
    HistoricalServerItem,
} from '../commands/servers/types/types';

const HISTORY_TTL_MS = 5 * 60 * 1000;

interface SnapshotEntry {
    server: OnlineServerItem;
    lastSeenAt: number;
}

interface MapStartEntry {
    mapId: string;
    startedAt: number;
}

class ServerHistoryCacheService {
    private snapshots = new Map<string, SnapshotEntry>();
    private mapStartTimes = new Map<string, MapStartEntry>();

    private getServerKey(address: string, port: number): string {
        return `${address}:${port}`;
    }

    updateSnapshot(currentList: OnlineServerItem[]): void {
        const now = Date.now();

        for (const server of currentList) {
            const key = this.getServerKey(server.address, server.port);
            const existing = this.snapshots.get(key);
            if (existing) {
                existing.server = server;
                existing.lastSeenAt = now;
            } else {
                this.snapshots.set(key, {
                    server,
                    lastSeenAt: now,
                });
            }

            const mapEntry = this.mapStartTimes.get(key);
            if (!mapEntry || mapEntry.mapId !== server.map_id) {
                this.mapStartTimes.set(key, {
                    mapId: server.map_id,
                    startedAt: now,
                });
            }
        }

        this.evictExpired(now);
    }

    getDisappearedServers(
        currentList: OnlineServerItem[],
    ): HistoricalServerItem[] {
        const now = Date.now();
        const currentKeys = new Set(
            currentList.map((s) => this.getServerKey(s.address, s.port)),
        );

        const result: HistoricalServerItem[] = [];

        for (const [key, entry] of this.snapshots) {
            if (currentKeys.has(key)) {
                continue;
            }

            const elapsed = now - entry.lastSeenAt;
            if (elapsed > HISTORY_TTL_MS) {
                continue;
            }

            result.push({
                ...entry.server,
                lastSeenAt: entry.lastSeenAt,
            });
        }

        return result.sort((a, b) => a.lastSeenAt - b.lastSeenAt);
    }

    private evictExpired(now: number): void {
        for (const [key, entry] of this.snapshots) {
            if (now - entry.lastSeenAt > HISTORY_TTL_MS) {
                this.snapshots.delete(key);
                this.mapStartTimes.delete(key);
            }
        }
    }

    getMapStartedAt(address: string, port: number): number | null {
        const key = this.getServerKey(address, port);
        const entry = this.mapStartTimes.get(key);
        return entry ? entry.startedAt : null;
    }

    getStats(): { snapshotCount: number } {
        return { snapshotCount: this.snapshots.size };
    }
}

export const serverHistoryCache = new ServerHistoryCacheService();
