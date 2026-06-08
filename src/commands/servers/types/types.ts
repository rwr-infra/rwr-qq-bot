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

export interface IMapImageConfigItem {
    path: string;
    image: string;
    name?: string;
}

export interface IMapImageConfigFile {
    images: IMapImageConfigItem[];
}

export interface ITrendSummary {
    peak24h: number | null; // analysis_hours.json 最大值
    peak7d: number | null; // analysis.json 最大值
    latest: number | null; // 最近一条记录
    series24h: IAnalysisData[]; // 近24小时逐时在线数序列(用于绘制趋势折线)
}

export interface IServerDetailItem {
    name: string;
    mapName: string;
    players: number;
    maxPlayers: number;
    bots: number;
    serverKey: string; // `${address}:${port}`, 用于查询地图运行时长
}

export interface IServerOverviewStats {
    serverCount: number;
    playersTotal: number;
    capacityTotal: number;
    occupancyRate: number; // 0-1
    botsTotal: number;
    fullCount: number; // current_players >= max_players
    emptyCount: number; // current_players === 0
    serverDetail: IServerDetailItem[]; // 各服务器详情, 按玩家数降序
}

/** 单个服务器的 24h 时序摘要(供统计总览卡片使用) */
export interface IServerAnalyticsSummary {
    serverKey: string;
    serverName: string;
    series: IAnalysisData[]; // 该服务器 24h 逐时序列
    peak: number; // series 最大值
    latest: number | null; // series 末值
    avg: number; // series 均值(四舍五入)
}

/** 统计总览画布视图数据 */
export interface IAnalyticsViewData {
    trend: ITrendSummary; // 全局 24h 序列 + 24h/7日峰值 + 最近值
    series7d: IAnalysisData[]; // 全局 7日逐日序列
    servers: IServerAnalyticsSummary[]; // 各服务器摘要, 按 peak 降序
    lastUpdateTime: number | null; // analysis_server.json 的 lastUpdateTime
    activeCount: number; // 最近一个时刻仍有数据的服务器数
}
