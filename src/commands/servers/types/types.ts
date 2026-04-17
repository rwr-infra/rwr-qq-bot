export interface ResServerItem {
    name: string;
    address: string;
    port: number;
    map_id: string;
    map_name: string;
    bots: number;
    country: string;
    current_players: number;
    timeStamp: number;
    version: string;
    dedicated: boolean;
    mod: number;
    // [AAA, BBB] | AAA
    player?: string[] | string;
    comment: string;
    url: string;
    max_players: number;
    mode: string;
    realm: string;
}

export interface Res {
    result: {
        server: ResServerItem[];
    };
}

export interface OnlineServerItem extends ResServerItem {
    playersCount: number;
}

export interface IAnalysisData {
    date: string;
    count: number;
}

export interface IAnalysisConfig {
    lastUpdateTime: number;
    data: IAnalysisData[];
}

export interface IUserMatchedServerItem {
    user: string;
    server: OnlineServerItem;
}

export interface IMapDataItem {
    name: string;
    id: string;
}

export interface IServerAnalyticsHourlyData {
    date: string;
    count: number;
}

export interface HistoricalServerItem extends OnlineServerItem {
    lastSeenAt: number;
}

export interface IServerAnalyticsRecord {
    serverKey: string;
    serverName: string;
    data: IServerAnalyticsHourlyData[];
}
