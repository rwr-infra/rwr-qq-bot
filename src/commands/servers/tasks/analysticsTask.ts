import * as fs from 'node:fs/promises';
import * as path from 'path';
import { CronJob } from 'cron';
import { GlobalEnv } from '../../../types';
import { countTotalPlayers, queryAllServers } from '../utils/utils';
import { logger } from '../../../utils/logger';
import { IAnalysisData } from '../types/types';
import { ANALYSIS_DATA_FILE, OUTPUT_FOLDER } from '../types/constants';

export class AnalysticsTask {
    static readonly timesInterval = '0 */10 * * * *';
    static job: null | CronJob = null;

    static isRunning = false;
    static isUpdating = false;

    static async write(data: IAnalysisData): Promise<void> {
        const folderTarget = path.join(process.cwd(), OUTPUT_FOLDER);
        const writeTarget = path.join(folderTarget, `./${ANALYSIS_DATA_FILE}`);
        logger.info('AnalysticsTask::write() target:', writeTarget);

        let recordValue: IAnalysisData[] = [];

        try {
            const content = await fs.readFile(writeTarget, 'utf-8');
            recordValue = JSON.parse(content);
        } catch {}

        const isFoundTodayValue = recordValue.find((v) => v.date === data.date);

        if (isFoundTodayValue) {
            if (data.count > isFoundTodayValue.count) {
                isFoundTodayValue.count = data.count;
            }
        } else {
            recordValue.push(data);
            if (recordValue.length > 7) {
                recordValue.shift();
            }
        }

        try {
            await fs.mkdir(folderTarget, { recursive: true });
            await fs.writeFile(
                writeTarget,
                JSON.stringify(recordValue),
                'utf-8',
            );
        } catch (e) {
            logger.error('AnalysticsTask write error', e);
        }
    }

    static async updateCount(env: GlobalEnv): Promise<void> {
        logger.info('AnalysticsTask::updateCount(): start');
        if (AnalysticsTask.isUpdating) {
            return;
        }
        AnalysticsTask.isUpdating = true;
        try {
            const serverList = await queryAllServers(env.SERVERS_MATCH_REGEX);
            const playersCount = countTotalPlayers(serverList);

            const date = new Date();
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            logger.info('AnalysticsTask updateCount', dateStr, playersCount);
            await AnalysticsTask.write({
                date: dateStr,
                count: playersCount,
            });
        } catch (e) {
            logger.error('AnalysticsTask updateCount error', e);
        }

        AnalysticsTask.isUpdating = false;
        logger.info('AnalysticsTask updateCount:: completed');
    }

    static start(env: GlobalEnv): void {
        logger.info('AnalysticsTask::start()');
        if (this.isRunning) {
            return;
        }
        AnalysticsTask.updateCount(env);

        AnalysticsTask.job = new CronJob(
            AnalysticsTask.timesInterval,
            async () => {
                AnalysticsTask.isRunning = true;
                await AnalysticsTask.updateCount(env);
            },
            null,
            true,
            'Asia/Shanghai',
        );
    }
}
