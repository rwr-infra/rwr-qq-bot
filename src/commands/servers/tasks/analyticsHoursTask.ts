import * as fs from 'node:fs/promises';
import * as path from 'path';
import { CronJob } from 'cron';
import { GlobalEnv } from '../../../types';
import { countTotalPlayers, queryAllServers } from '../utils/utils';
import { logger } from '../../../utils/logger';
import { IAnalysisData } from '../types/types';
import { ANALYSIS_HOURS_DATA_FILE, OUTPUT_FOLDER } from '../types/constants';

export class AnalysticsHoursTask {
    static readonly timesInterval = '0 */2 * * * *';
    static job: null | CronJob = null;

    static isRunning = false;
    static isUpdating = false;

    static async write(data: IAnalysisData): Promise<void> {
        const folderTarget = path.join(process.cwd(), OUTPUT_FOLDER);
        const writeTarget = path.join(
            folderTarget,
            `./${ANALYSIS_HOURS_DATA_FILE}`,
        );
        logger.info('AnalysticsHoursTask::write() target:', writeTarget);

        let recordValue: IAnalysisData[] = [];

        try {
            const content = await fs.readFile(writeTarget, 'utf-8');
            recordValue = JSON.parse(content);
        } catch {}

        let newRecordValue = recordValue;
        const lastValue =
            recordValue.length === 0
                ? null
                : recordValue[recordValue.length - 1];

        if (lastValue && lastValue.date === data.date) {
            if (lastValue.count < data.count) {
                newRecordValue = [...recordValue.slice(0, -1), data];
            }
        } else if (recordValue.length === 24) {
            newRecordValue = [...recordValue.slice(1), data];
        } else {
            newRecordValue = [...recordValue, data];
        }

        try {
            await fs.mkdir(folderTarget, { recursive: true });
            await fs.writeFile(
                writeTarget,
                JSON.stringify(newRecordValue),
                'utf-8',
            );
        } catch (e) {
            logger.error('AnalysticsHoursTask write error', e);
        }
    }

    static async updateCount(env: GlobalEnv): Promise<void> {
        logger.info('AnalysticsHoursTask::updateCount(): start');
        if (AnalysticsHoursTask.isUpdating) {
            return;
        }
        AnalysticsHoursTask.isUpdating = true;
        try {
            const serverList = await queryAllServers(env.SERVERS_MATCH_REGEX);
            const playersCount = countTotalPlayers(serverList);

            const date = new Date();
            const dateStr = `${date.getHours()}时`;
            logger.info(
                'AnalysticsHoursTask updateCount',
                dateStr,
                playersCount,
            );
            await AnalysticsHoursTask.write({
                date: dateStr,
                count: playersCount,
            });
        } catch (e) {
            logger.error('AnalysticsHoursTask updateCount error', e);
        }

        AnalysticsHoursTask.isUpdating = false;
        logger.info('AnalysticsHoursTask updateCount:: completed');
    }

    static start(env: GlobalEnv): void {
        logger.info('AnalysticsHoursTask::start()');
        if (this.isRunning) {
            return;
        }
        AnalysticsHoursTask.updateCount(env);

        AnalysticsHoursTask.job = new CronJob(
            AnalysticsHoursTask.timesInterval,
            async () => {
                AnalysticsHoursTask.isRunning = true;
                await AnalysticsHoursTask.updateCount(env);
            },
            null,
            true,
            'Asia/Shanghai',
        );
    }
}
