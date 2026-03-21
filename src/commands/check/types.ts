export type CheckLatencyStatus = 'ok' | 'error' | 'skipped';

export interface CheckLatencyResult {
    label: string;
    target: string;
    status: CheckLatencyStatus;
    latencyMs?: number;
    message?: string;
}

export interface CheckReport {
    remoteApi: CheckLatencyResult;
    imageServer: CheckLatencyResult;
    database: CheckLatencyResult;
    servers: CheckLatencyResult[];
}
