import * as fs from 'node:fs/promises';
import * as path from 'path';
import { CronJob } from 'cron';
import { GlobalEnv } from '../../../types';
import { queryAllServers } from '../utils/utils';
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

    static async write(
        serverDataList: Array<{
            serverKey: string;
            serverName: string;
            date: string;
            count: number;
        }>,
    ): Promise<void> {
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

        try {
            const fileContent = await fs.readFile(writeTarget, 'utf-8');
            existingConfig = JSON.parse(fileContent);
        } catch {}

        for (const serverData of serverDataList) {
            let record = existingConfig.records.find(
                (r) => r.serverKey === serverData.serverKey,
            );

            if (!record) {
                record = {
                    serverKey: serverData.serverKey,
                    serverName: serverData.serverName,
                    data: [],
                };
                existingConfig.records.push(record);
            } else {
                record.serverName = serverData.serverName;
            }

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
        }

        existingConfig.lastUpdateTime = Date.now();

        try {
            await fs.mkdir(folderTarget, { recursive: true });
            await fs.writeFile(
                writeTarget,
                JSON.stringify(existingConfig),
                'utf-8',
            );
        } catch (e) {
            logger.error('AnalysticsServerTask write error', e);
        }
    }

    static async updateCount(env: GlobalEnv): Promise<void> {
        logger.info('AnalysticsServerTask::updateCount(): start');
        if (AnalysticsServerTask.isUpdating) {
            return;
        }
        AnalysticsServerTask.isUpdating = true;
        try {
            const serverList = await queryAllServers(env.SERVERS_MATCH_REGEX);
            const date = new Date();
            const dateStr = `${date.getHours()}时`;

            const serverDataList = serverList.map((server) => ({
                serverKey: AnalysticsServerTask.getServerKey(
                    server.address,
                    server.port,
                ),
                serverName: server.name,
                date: dateStr,
                count: server.current_players,
            }));

            logger.info(
                'AnalysticsServerTask updateCount',
                dateStr,
                `${serverDataList.length} servers`,
            );
            await AnalysticsServerTask.write(serverDataList);
        } catch (e) {
            logger.error('AnalysticsServerTask updateCount error', e);
        }

        AnalysticsServerTask.isUpdating = false;
        logger.info('AnalysticsServerTask updateCount:: completed');
    }

    static start(env: GlobalEnv): void {
        logger.info('AnalysticsServerTask::start()');
        if (this.isRunning) {
            return;
        }
        AnalysticsServerTask.updateCount(env);

        AnalysticsServerTask.job = new CronJob(
            AnalysticsServerTask.timesInterval,
            async () => {
                AnalysticsServerTask.isRunning = true;
                await AnalysticsServerTask.updateCount(env);
            },
            null,
            true,
            'Asia/Shanghai',
        );
    }
}
