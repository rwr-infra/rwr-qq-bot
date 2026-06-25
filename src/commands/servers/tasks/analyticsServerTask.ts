import * as fs from 'fs';
import * as path from 'path';
import { CronJob } from 'cron';
import { GlobalEnv } from '../../../types';
import { queryAllServers } from '../utils/utils';
import { serverHistoryCache } from '../../../services/serverHistoryCache.service';
import { logger } from '../../../utils/logger';
import {
    IServerAnalyticsRecord,
    IServerAnalyticsHourlyData,
} from '../types/types';
import { ANALYSIS_SERVER_DATA_FILE, OUTPUT_FOLDER } from '../types/constants';

export interface IServerAnalyticsConfig {
    lastUpdateTime: number;
    records: IServerAnalyticsRecord[];
}

export class AnalysticsServerTask {
    static readonly timesInterval = '0 */2 * * * *';
    static job: null | CronJob = null;

    static isRunning = false;
    static isUpdating = false;

    static getServerKey(address: string, port: number): string {
        return `${address}:${port}`;
    }

    static write(
        serverDataList: Array<{
            serverKey: string;
            serverName: string;
            date: string;
            dayDate: string;
            count: number;
        }>,
    ) {
        const folderTarget = path.join(process.cwd(), OUTPUT_FOLDER);
        const writeTarget = path.join(
            folderTarget,
            `./${ANALYSIS_SERVER_DATA_FILE}`,
        );
        logger.info('AnalysticsServerTask::write() target:', writeTarget);

        let existingConfig: IServerAnalyticsConfig = {
            lastUpdateTime: Date.now(),
            records: [],
        };

        if (fs.existsSync(writeTarget)) {
            const fileContent = fs.readFileSync(writeTarget, 'utf-8');
            existingConfig = JSON.parse(fileContent) as IServerAnalyticsConfig;
        }

        if (!fs.existsSync(folderTarget)) {
            fs.mkdirSync(folderTarget);
        }

        for (const serverData of serverDataList) {
            let record = existingConfig.records.find(
                (r) => r.serverKey === serverData.serverKey,
            );

            if (!record) {
                record = {
                    serverKey: serverData.serverKey,
                    serverName: serverData.serverName,
                    data: [],
                    daysData: [],
                };
                existingConfig.records.push(record);
            } else {
                // 如果服务器已存在，更新为最新的服务器名称
                record.serverName = serverData.serverName;
                // 兼容旧文件: 补齐 daysData 字段
                if (!record.daysData) {
                    record.daysData = [];
                }
            }

            // 24h 逐时序列(date="H时", 最多 24 条)
            const lastData =
                record.data.length > 0
                    ? record.data[record.data.length - 1]
                    : null;

            const hourlyData: IServerAnalyticsHourlyData = {
                date: serverData.date,
                count: serverData.count,
            };

            if (lastData && lastData.date === serverData.date) {
                if (lastData.count < serverData.count) {
                    lastData.count = serverData.count;
                }
            } else if (record.data.length === 24) {
                record.data = [...record.data.slice(1), hourlyData];
            } else {
                record.data.push(hourlyData);
            }

            // 近7日逐日序列(date="M/D", 同日取 max, 最多 7 条)
            const daysData = record.daysData as IServerAnalyticsHourlyData[];
            const todayData = daysData.find(
                (d) => d.date === serverData.dayDate,
            );
            if (todayData) {
                if (todayData.count < serverData.count) {
                    todayData.count = serverData.count;
                }
            } else {
                daysData.push({
                    date: serverData.dayDate,
                    count: serverData.count,
                });
                if (daysData.length > 7) {
                    daysData.shift();
                }
            }
        }

        existingConfig.lastUpdateTime = Date.now();

        try {
            fs.writeFileSync(
                writeTarget,
                JSON.stringify(existingConfig),
                'utf-8',
            );
        } catch (e: any) {
            logger.error('AnalysticsServerTask write error', e);
        }
    }

    static async updateCount(env: GlobalEnv) {
        logger.info('AnalysticsServerTask::updateCount(): start');
        if (AnalysticsServerTask.isUpdating) {
            return;
        }
        AnalysticsServerTask.isUpdating = true;
        try {
            const serverList = await queryAllServers(env.SERVERS_MATCH_REGEX);
            serverHistoryCache.updateSnapshot(serverList);
            const date = new Date();
            const dateStr = `${date.getHours()}时`;
            const dayDateStr = `${date.getMonth() + 1}/${date.getDate()}`;

            const serverDataList = serverList.map((server) => ({
                serverKey: AnalysticsServerTask.getServerKey(
                    server.address,
                    server.port,
                ),
                serverName: server.name,
                date: dateStr,
                dayDate: dayDateStr,
                count: server.current_players,
            }));

            logger.info(
                'AnalysticsServerTask updateCount',
                dateStr,
                `${serverDataList.length} servers`,
            );
            AnalysticsServerTask.write(serverDataList);
        } catch (e) {
            logger.error('AnalysticsServerTask updateCount error', e);
        }

        AnalysticsServerTask.isUpdating = false;
        logger.info('AnalysticsServerTask updateCount:: completed');
    }

    static start(env: GlobalEnv) {
        logger.info('AnalysticsServerTask::start()');
        if (this.isRunning) {
            return;
        }
        AnalysticsServerTask.updateCount(env);

        AnalysticsServerTask.job = new CronJob(
            AnalysticsServerTask.timesInterval,
            () => {
                AnalysticsServerTask.isRunning = true;
                AnalysticsServerTask.updateCount(env);
            },
            null,
            true,
            'Asia/Shanghai',
        );
    }
}
